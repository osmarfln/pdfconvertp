import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { supabase } from "@/integrations/supabase/client";

/**
 * Generates a simple A4 PDF from plain text.
 * Returns the PDF as a Uint8Array.
 */
export async function generateTextPdf(title: string, body: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 50;
  const fontSize = 11;
  const lineHeight = 16;
  const usableWidth = pageWidth - margin * 2;

  // Word-wrap a paragraph to fit usableWidth
  const wrapLine = (text: string): string[] => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const w of words) {
      const tentative = current ? current + " " + w : w;
      const width = font.widthOfTextAtSize(tentative, fontSize);
      if (width > usableWidth && current) {
        lines.push(current);
        current = w;
      } else {
        current = tentative;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [""];
  };

  const allLines: string[] = [];
  for (const para of body.split(/\n/)) {
    const wrapped = wrapLine(para);
    allLines.push(...wrapped);
  }

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Title
  page.drawText(title, { x: margin, y, size: 16, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  y -= 28;

  for (const line of allLines) {
    if (y < margin + lineHeight) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0.15, 0.15, 0.15) });
    y -= lineHeight;
  }

  return await pdf.save();
}

/**
 * Generates a PDF from text and uploads it as a backup record in file_conversions.
 * Returns the conversion id, or null on failure.
 */
export async function saveCorrectedTextAsBackup(opts: {
  userId: string;
  title: string;
  text: string;
}): Promise<string | null> {
  const { userId, title, text } = opts;
  const pdfBytes = await generateTextPdf(title, text);
  const safeTitle = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w.-]/g, "_").replace(/_+/g, "_");
  const fileName = `${safeTitle || "correcao"}.pdf`;
  const filePath = `${userId}/backups/${Date.now()}_${fileName}`;

  const { error: upErr } = await supabase.storage
    .from("documents")
    .upload(filePath, new Blob([pdfBytes as BlobPart], { type: "application/pdf" }), {
      contentType: "application/pdf",
    });

  if (upErr) {
    console.error("[textToPdf] Upload error:", upErr);
    return null;
  }

  const { data, error: insErr } = await supabase
    .from("file_conversions")
    .insert({
      user_id: userId,
      original_name: fileName,
      original_format: "pdf",
      target_format: "pdf",
      status: "completed",
      original_path: filePath,
      converted_path: filePath,
      file_size: pdfBytes.byteLength,
      is_backup: true,
    })
    .select("id")
    .single();

  if (insErr) {
    console.error("[textToPdf] DB insert error:", insErr);
    return null;
  }

  return (data as any)?.id ?? null;
}
