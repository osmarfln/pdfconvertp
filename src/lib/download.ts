import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Detects mobile / iOS Safari where programmatic anchor downloads can be blocked.
 */
function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent);
}

/**
 * Triggers a download in a way that works across desktop and mobile (iOS Safari included).
 * - Uses an anchor with `download` attribute when supported.
 * - Falls back to opening the blob URL in a new tab so the user can long-press / save.
 * Returns the object URL so a manual button can reuse it without re-downloading.
 */
export function triggerBlobDownload(blob: Blob, filename: string): string {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.target = "_self";
  // Some mobile browsers require the anchor to be in the DOM
  document.body.appendChild(a);
  try {
    a.click();
  } catch {
    // ignore
  }
  // Best-effort fallback for iOS Safari where `download` is ignored:
  if (isMobile()) {
    setTimeout(() => {
      try {
        // Open in new tab so user can save it manually if auto-download was blocked
        const w = window.open(url, "_blank");
        if (!w) {
          toast.message("Toque em \"Baixar arquivo\" para concluir o download.", { duration: 6000 });
        }
      } catch {
        // ignore
      }
    }, 250);
  }
  setTimeout(() => {
    a.remove();
    // Don't revoke immediately so the manual button can still use it briefly
  }, 1000);
  return url;
}

/**
 * Downloads a file from Supabase storage and triggers a browser download.
 * Returns true when the file was fetched and download was attempted.
 */
export async function downloadFromStorage(path: string, filename: string): Promise<boolean> {
  const { data, error } = await supabase.storage.from("documents").download(path);
  if (error || !data) {
    toast.error("Erro ao baixar arquivo.");
    return false;
  }
  triggerBlobDownload(data, filename);
  return true;
}
