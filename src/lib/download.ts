import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent) && !(window as any).MSStream;
}

function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent);
}

/**
 * Navigate via a hidden iframe to a URL that returns Content-Disposition: attachment.
 * Works reliably on desktop AND mobile (including iOS Safari) because the browser
 * handles it as an attachment response — no popup blockers, no user-gesture issues.
 */
function downloadViaIframe(url: string) {
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = url;
  document.body.appendChild(iframe);
  setTimeout(() => iframe.remove(), 30_000);
}

/**
 * Anchor-based download for blobs. Used when we already have the blob in memory
 * (e.g., manual button presses) — keeps it inside the user-gesture chain.
 */
export function triggerBlobDownload(blob: Blob, filename: string): string {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.target = "_self";
  document.body.appendChild(a);
  try {
    a.click();
  } catch {
    // ignore
  }
  // iOS fallback: open the blob in a new tab so the user can save it
  if (isIOS()) {
    setTimeout(() => {
      try {
        const w = window.open(url, "_blank");
        if (!w) {
          toast.message('Toque em "Baixar arquivo" para concluir o download.', { duration: 6000 });
        }
      } catch {
        // ignore
      }
    }, 250);
  }
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
  return url;
}

/**
 * Downloads a file from Supabase storage. Strategy:
 *  1) Create a short-lived signed URL with `download=<filename>` so the response
 *     has Content-Disposition: attachment — browsers always download it.
 *  2) Navigate via a hidden iframe (no popup, no gesture loss). On iOS Safari
 *     this triggers the native "Save / Open in..." sheet.
 *  3) If the signed URL fails, fall back to fetching the blob and using the
 *     anchor approach.
 */
export async function downloadFromStorage(path: string, filename: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(path, 60, { download: filename });

    if (!error && data?.signedUrl) {
      if (isIOS()) {
        // iOS handles attachment URLs better via direct navigation in same tab,
        // which opens its native share/save sheet for the file.
        window.location.href = data.signedUrl;
      } else {
        downloadViaIframe(data.signedUrl);
      }
      return true;
    }
    console.warn("Signed URL failed, falling back to blob:", error);
  } catch (e) {
    console.warn("Signed URL exception, falling back to blob:", e);
  }

  // Fallback: fetch as blob then anchor-click
  const { data: blob, error } = await supabase.storage.from("documents").download(path);
  if (error || !blob) {
    toast.error("Erro ao baixar arquivo.");
    return false;
  }
  triggerBlobDownload(blob, filename);
  if (isMobile()) {
    toast.message('Se o download não iniciar, toque novamente em "Baixar".', { duration: 5000 });
  }
  return true;
}
