import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FileConversion {
  id: string;
  user_id: string;
  original_name: string;
  original_format: string;
  target_format: string;
  status: string;
  original_path: string | null;
  converted_path: string | null;
  file_size: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export function useFileConversions() {
  const [conversions, setConversions] = useState<FileConversion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversions = useCallback(async () => {
    const { data, error } = await supabase
      .from("file_conversions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching conversions:", error);
    } else {
      setConversions(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConversions();
  }, [fetchConversions]);

  const uploadFile = useCallback(async (file: File): Promise<FileConversion | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Você precisa estar logado para enviar arquivos.");
      return null;
    }

    const userId = session.user.id;
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const filePath = `${userId}/originals/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file);

    if (uploadError) {
      toast.error("Erro ao enviar arquivo: " + uploadError.message);
      return null;
    }

    const { data: conv, error: insertError } = await supabase
      .from("file_conversions")
      .insert({
        user_id: userId,
        original_name: file.name,
        original_format: ext,
        target_format: ext,
        status: "uploaded",
        original_path: filePath,
        file_size: file.size,
      })
      .select()
      .single();

    if (insertError) {
      toast.error("Erro ao registrar arquivo.");
      return null;
    }

    toast.success(`${file.name} enviado com sucesso!`);
    await fetchConversions();
    return conv;
  }, [fetchConversions]);

  const convertFile = useCallback(async (conversionId: string, filePath: string, targetFormat: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Update status to processing
    await supabase
      .from("file_conversions")
      .update({ status: "processing", target_format: targetFormat })
      .eq("id", conversionId);
    await fetchConversions();

    try {
      const { data, error } = await supabase.functions.invoke("convert-file", {
        body: { action: "convert", conversionId, filePath, targetFormat },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Conversion failed");

      toast.success("Conversão concluída!");
    } catch (err: any) {
      await supabase
        .from("file_conversions")
        .update({ status: "error", error_message: err.message })
        .eq("id", conversionId);
      toast.error("Erro na conversão: " + err.message);
    }
    await fetchConversions();
  }, [fetchConversions]);

  const mergeFiles = useCallback(async (filePaths: string[]) => {
    try {
      const { data, error } = await supabase.functions.invoke("convert-file", {
        body: { action: "merge", filePaths },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Merge failed");
      toast.success("PDFs mesclados com sucesso!");
      await fetchConversions();
      return data.convertedPath;
    } catch (err: any) {
      toast.error("Erro ao mesclar: " + err.message);
      return null;
    }
  }, [fetchConversions]);

  const compressFile = useCallback(async (filePath: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("convert-file", {
        body: { action: "compress", filePath },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Compress failed");
      toast.success("PDF comprimido com sucesso!");
      await fetchConversions();
      return data.convertedPath;
    } catch (err: any) {
      toast.error("Erro ao comprimir: " + err.message);
      return null;
    }
  }, [fetchConversions]);

  const splitFile = useCallback(async (filePath: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("convert-file", {
        body: { action: "split", filePath },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Split failed");
      toast.success("PDF dividido com sucesso!");
      await fetchConversions();
      return data.convertedPath;
    } catch (err: any) {
      toast.error("Erro ao dividir: " + err.message);
      return null;
    }
  }, [fetchConversions]);

  const downloadFile = useCallback(async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from("documents")
      .download(filePath);

    if (error || !data) {
      toast.error("Erro ao baixar arquivo.");
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const deleteConversion = useCallback(async (id: string, originalPath?: string | null, convertedPath?: string | null) => {
    // Delete files from storage
    const pathsToDelete = [originalPath, convertedPath].filter(Boolean) as string[];
    if (pathsToDelete.length > 0) {
      await supabase.storage.from("documents").remove(pathsToDelete);
    }

    await supabase.from("file_conversions").delete().eq("id", id);
    toast.success("Arquivo excluído.");
    await fetchConversions();
  }, [fetchConversions]);

  return {
    conversions,
    loading,
    uploadFile,
    convertFile,
    mergeFiles,
    compressFile,
    splitFile,
    downloadFile,
    deleteConversion,
    refetch: fetchConversions,
  };
}
