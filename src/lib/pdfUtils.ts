import { supabase } from "@/integrations/supabase/client";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

/**
 * Counts pages of a PDF stored in Supabase. Returns null on failure
 * so callers can fallback to a size-based estimate.
 */
export async function countPdfPages(filePath: string): Promise<number | null> {
  try {
    const { data, error } = await supabase.storage.from("documents").download(filePath);
    if (error || !data) return null;
    const buf = await data.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    return pdf.numPages;
  } catch (e) {
    console.warn("countPdfPages failed:", e);
    return null;
  }
}

/**
 * Best-effort page count for any source. PDFs use pdfjs; everything else falls
 * back to a rough size-based estimate (~100KB per "page").
 */
export async function detectPageCount(
  format: string | null | undefined,
  filePath: string | null | undefined,
  fileSize: number | null | undefined,
): Promise<number | undefined> {
  if (format === "pdf" && filePath) {
    const real = await countPdfPages(filePath);
    if (real && real > 0) return real;
  }
  if (fileSize && fileSize > 0) {
    return Math.max(1, Math.round(fileSize / (100 * 1024)));
  }
  return undefined;
}
