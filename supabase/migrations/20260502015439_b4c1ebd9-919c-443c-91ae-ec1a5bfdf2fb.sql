CREATE TABLE IF NOT EXISTS public.user_logins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text,
  display_name text,
  provider text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_logins_user_id_idx ON public.user_logins(user_id);
CREATE INDEX IF NOT EXISTS user_logins_created_at_idx ON public.user_logins(created_at DESC);

ALTER TABLE public.user_logins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own login"
ON public.user_logins
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all logins"
ON public.user_logins
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own logins"
ON public.user_logins
FOR SELECT
USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_logins;
ALTER TABLE public.user_logins REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;