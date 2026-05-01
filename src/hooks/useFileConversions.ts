import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { downloadFromStorage, shouldAutoCleanupAfterDownload } from "@/lib/download";

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
  is_backup?: boolean;
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
    console.log("[Upload] Starting upload for:", file.name, "size:", file.size);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error("[Upload] No session found");
      toast.error("Você precisa estar logado para enviar arquivos.");
      return null;
    }

    const userId = session.user.id;
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const safeName = file.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w.\-]/g, "_")
      .replace(/_+/g, "_");
    const filePath = `${userId}/originals/${Date.now()}_${safeName}`;
    
    console.log("[Upload] Uploading to storage path:", filePath);

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file);

    if (uploadError) {
      console.error("[Upload] Storage upload error:", uploadError);
      toast.error("Erro ao enviar arquivo: " + uploadError.message);
      return null;
    }
    
    console.log("[Upload] Storage upload success, inserting record...");

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
      console.error("[Upload] DB insert error:", insertError);
      toast.error("Erro ao registrar arquivo: " + insertError.message);
      return null;
    }

    console.log("[Upload] Success! Record:", conv?.id);
    toast.success(`${file.name} enviado com sucesso!`);
    await fetchConversions();
    return conv;
  }, [fetchConversions]);

  const convertFile = useCallback(async (conversionId: string, filePath: string, targetFormat: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

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

      const convertedPath: string | undefined = data.convertedPath;

      // Auto-download the converted file (mobile + desktop friendly via signed URL)
      if (convertedPath) {
        const baseName = filePath.split("/").pop()?.replace(/\.[^.]+$/, "") || "converted";
        const downloadName = `${baseName}.${targetFormat}`;
        const ok = await downloadFromStorage(convertedPath, downloadName);
        if (ok) {
          // Optional auto-cleanup: delete the generated file from storage and the
          // conversion record so URLs/blobs don't accumulate in the session.
          if (shouldAutoCleanupAfterDownload()) {
            // Give the browser a moment to start the actual download stream
            // before we revoke access to the file.
            setTimeout(async () => {
              try {
                await supabase.storage.from("documents").remove([convertedPath]);
                await supabase.from("file_conversions").delete().eq("id", conversionId);
                await fetchConversions();
              } catch (cleanupErr) {
                console.warn("[Convert] Auto-cleanup failed:", cleanupErr);
              }
            }, 8000);
            toast.success(`${downloadName} baixado. Removendo da sua sessão...`, { duration: 5000 });
          } else {
            toast.success(`${downloadName} baixado automaticamente!`, { duration: 5000 });
          }
        } else {
          toast.success("Conversão concluída! Acesse Meus Arquivos para baixar.", { duration: 6000 });
        }
      } else {
        toast.success("Conversão concluída!", { duration: 5000 });
      }

      await fetchConversions();
      return convertedPath ?? null;
    } catch (err: any) {
      console.error("[Convert] Error:", err);
      await supabase
        .from("file_conversions")
        .update({ status: "error", error_message: err.message })
        .eq("id", conversionId);
      toast.error("Erro na conversão: " + err.message);
      await fetchConversions();
      return null;
    }
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
    await downloadFromStorage(filePath, fileName);
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
