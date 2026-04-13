
CREATE TABLE public.correction_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  original_text TEXT NOT NULL,
  corrected_text TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'profissional',
  source_type TEXT NOT NULL DEFAULT 'typed',
  file_format TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.correction_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own corrections" ON public.correction_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own corrections" ON public.correction_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own corrections" ON public.correction_history FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all corrections" ON public.correction_history FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_correction_history_user ON public.correction_history(user_id, created_at DESC);
