
CREATE TABLE public.extraction_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  file_name TEXT,
  file_type TEXT,
  extracted_text TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.extraction_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs" ON public.extraction_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own jobs" ON public.extraction_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own jobs" ON public.extraction_jobs FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_extraction_jobs_updated_at
  BEFORE UPDATE ON public.extraction_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
