import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const ensureProfile = async (u: User) => {
      try {
        const { data: existing } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("user_id", u.id)
          .maybeSingle();
        if (!existing) {
          await supabase.from("profiles").insert({
            user_id: u.id,
            email: u.email,
            display_name:
              (u.user_metadata as any)?.full_name ||
              (u.user_metadata as any)?.name ||
              (u.email ? u.email.split("@")[0] : "Usuário"),
          });
        }
      } catch (e) {
        console.warn("ensureProfile failed", e);
      }
    };

    const notifyAdminOnce = (u: User) => {
      const key = `login-notified-${u.id}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      // Fire-and-forget — never block UI
      supabase.functions
        .invoke("notify-admin-login", { body: {} })
        .catch((e) => console.warn("notify-admin-login failed", e));
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      // Defer role check to avoid deadlocks inside the auth callback
      if (session?.user) {
        const u = session.user;
        setTimeout(async () => {
          await ensureProfile(u);
          if (event === "SIGNED_IN") notifyAdminOnce(u);
          const { data } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", u.id)
            .eq("role", "admin")
            .maybeSingle();
          setIsAdmin(!!data);
        }, 0);
      } else {
        setIsAdmin(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("role", "admin")
          .maybeSingle();
        setIsAdmin(!!data);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
