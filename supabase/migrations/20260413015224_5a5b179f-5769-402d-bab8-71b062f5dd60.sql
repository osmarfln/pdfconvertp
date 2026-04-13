
-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Storage policies
CREATE POLICY "Users can upload own documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create file_conversions table
CREATE TABLE public.file_conversions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  original_name TEXT NOT NULL,
  original_format TEXT NOT NULL,
  target_format TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  original_path TEXT,
  converted_path TEXT,
  file_size BIGINT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.file_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversions"
ON public.file_conversions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversions"
ON public.file_conversions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversions"
ON public.file_conversions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversions"
ON public.file_conversions FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all conversions"
ON public.file_conversions FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_file_conversions_updated_at
BEFORE UPDATE ON public.file_conversions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
