-- Tabela de deduplicação: 1 linha por usuário, garante que o admin
-- só é notificado UMA vez por usuário (independente de quantos logins).
CREATE TABLE IF NOT EXISTS public.admin_login_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  user_email text,
  display_name text,
  provider text,
  notified_at timestamp with time zone NOT NULL DEFAULT now(),
  email_sent boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0,
  last_error text
);

ALTER TABLE public.admin_login_notifications ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ler. Inserções/updates ocorrem via service role (edge function).
CREATE POLICY "Admins can view admin notifications"
ON public.admin_login_notifications
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_admin_login_notifications_notified_at
  ON public.admin_login_notifications (notified_at DESC);
