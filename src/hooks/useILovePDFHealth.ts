import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface HealthStatus {
  healthy: boolean | null;
  reason?: string;
  checking: boolean;
}

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
let cachedResult: { healthy: boolean; reason?: string; ts: number } | null = null;

export function useILovePDFHealth() {
  const [status, setStatus] = useState<HealthStatus>({
    healthy: cachedResult ? cachedResult.healthy : null,
    reason: cachedResult?.reason,
    checking: !cachedResult,
  });

  const check = useCallback(async (force = false) => {
    if (!force && cachedResult && Date.now() - cachedResult.ts < CACHE_TTL) {
      setStatus({ healthy: cachedResult.healthy, reason: cachedResult.reason, checking: false });
      return;
    }

    setStatus((prev) => ({ ...prev, checking: true }));

    try {
      const { data, error } = await supabase.functions.invoke("ilovepdf-health");

      if (error) {
        cachedResult = { healthy: false, reason: "Erro ao verificar serviço", ts: Date.now() };
      } else {
        cachedResult = {
          healthy: !!data?.healthy,
          reason: data?.reason ?? undefined,
          ts: Date.now(),
        };
      }
    } catch {
      cachedResult = { healthy: false, reason: "Erro de conexão", ts: Date.now() };
    }

    setStatus({ healthy: cachedResult!.healthy, reason: cachedResult!.reason, checking: false });
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(() => check(), CACHE_TTL);
    return () => clearInterval(interval);
  }, [check]);

  return { ...status, recheck: () => check(true) };
}