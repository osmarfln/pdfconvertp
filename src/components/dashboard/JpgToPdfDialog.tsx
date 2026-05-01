import { useState, useEffect, useRef, useMemo } from "react";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Download, FileImage, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { shouldAutoCleanupAfterDownload } from "@/lib/download";

interface JpgToPdfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
}

type WatermarkPosition = "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

export function JpgToPdfDialog({ open, onOpenChange, file }: JpgToPdfDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);

  const [author, setAuthor] = useState("");
  const [includeDate, setIncludeDate] = useState(true);
  const [includeAuthor, setIncludeAuthor] = useState(false);
  const [watermarkText, setWatermarkText] = useState("");
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>("center");
  const [watermarkOpacity, setWatermarkOpacity] = useState(30);
  const [watermarkSize, setWatermarkSize] = useState(48);

  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [generatedName, setGeneratedName] = useState("");
  const generatedUrlRef = useRef<string | null>(null);

  // Build/cleanup preview URL
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      setImgDims(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    const img = new Image();
    img.onload = () => setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      if (generatedUrlRef.current) {
        URL.revokeObjectURL(generatedUrlRef.current);
        generatedUrlRef.current = null;
      }
      setGeneratedUrl(null);
      setGenerating(false);
    }
  }, [open]);

  const baseName = useMemo(
    () => file?.name.replace(/\.[^.]+$/, "") || "imagem",
    [file],
  );

  const generatePdf = async () => {
    if (!file) return;
    setGenerating(true);
    try {
      const buf = await file.arrayBuffer();
      const ext = file.name.split(".").pop()?.toLowerCase();
      const doc = await PDFDocument.create();

      doc.setTitle(baseName);
      if (includeAuthor && author.trim()) doc.setAuthor(author.trim());
      doc.setCreator("PDF Convert Pro");
      doc.setProducer("PDF Convert Pro");
      const now = new Date();
      doc.setCreationDate(now);
      doc.setModificationDate(now);

      const img =
        ext === "png"
          ? await doc.embedPng(buf)
          : await doc.embedJpg(buf);

      const margin = 36;
      const pageW = img.width + margin * 2;
      const pageH = img.height + margin * 2;
      const page = doc.addPage([pageW, pageH]);
      page.drawImage(img, {
        x: margin,
        y: margin,
        width: img.width,
        height: img.height,
      });

      const helv = await doc.embedFont(StandardFonts.Helvetica);
      const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);

      // Footer with date / author
      const footerParts: string[] = [];
      if (includeDate) {
        footerParts.push(
          `Gerado em ${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
        );
      }
      if (includeAuthor && author.trim()) {
        footerParts.push(`Autor: ${author.trim()}`);
      }
      if (footerParts.length) {
        const footer = footerParts.join("  •  ");
        page.drawText(footer, {
          x: margin,
          y: 14,
          size: 9,
          font: helv,
          color: rgb(0.4, 0.4, 0.4),
        });
      }

      // Watermark
      if (watermarkText.trim()) {
        const text = watermarkText.trim();
        const size = watermarkSize;
        const opacity = Math.max(0, Math.min(1, watermarkOpacity / 100));
        const textWidth = helvBold.widthOfTextAtSize(text, size);

        let x = pageW / 2 - textWidth / 2;
        let y = pageH / 2 - size / 2;
        let rotate = 0;

        if (watermarkPosition === "center") {
          rotate = -30;
          x = pageW / 2 - textWidth / 2;
          y = pageH / 2 - size / 2;
        } else if (watermarkPosition === "top-left") {
          x = margin + 8;
          y = pageH - margin - size;
        } else if (watermarkPosition === "top-right") {
          x = pageW - margin - textWidth - 8;
          y = pageH - margin - size;
        } else if (watermarkPosition === "bottom-left") {
          x = margin + 8;
          y = margin + 8;
        } else if (watermarkPosition === "bottom-right") {
          x = pageW - margin - textWidth - 8;
          y = margin + 8;
        }

        page.drawText(text, {
          x,
          y,
          size,
          font: helvBold,
          color: rgb(0.5, 0.5, 0.5),
          opacity,
          rotate: rotate ? degrees(rotate) : undefined,
        });
      }

      const bytes = await doc.save();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      // Trigger automatic download
      const downloadName = `${baseName}.pdf`;
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();

      generatedUrlRef.current = url;
      setGeneratedUrl(url);
      setGeneratedName(downloadName);
      toast.success("PDF gerado e baixado!");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao gerar PDF: " + (e?.message || "desconhecido"));
    } finally {
      setGenerating(false);
    }
  };

  const manualDownload = () => {
    if (!generatedUrl) return;
    const a = document.createElement("a");
    a.href = generatedUrl;
    a.download = generatedName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileImage className="w-5 h-5 text-primary" />
            JPG → PDF
          </DialogTitle>
          <DialogDescription>
            Confirme a imagem e adicione informações antes de gerar o PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview */}
          <div className="rounded-lg border border-border bg-secondary/30 p-3">
            <Label className="text-xs text-muted-foreground mb-2 block">Pré-visualização</Label>
            {previewUrl ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center bg-background rounded-md overflow-hidden max-h-64">
                  <img
                    src={previewUrl}
                    alt="Pré-visualização"
                    className="max-h-64 object-contain"
                  />
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{file?.name}</span>
                  {imgDims && (
                    <span>
                      • {imgDims.w} × {imgDims.h}px
                    </span>
                  )}
                  {file && <span>• {(file.size / 1024).toFixed(1)} KB</span>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhuma imagem selecionada
              </p>
            )}
          </div>

          {/* Metadata */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="include-date" className="text-sm cursor-pointer">
                Incluir data de geração
              </Label>
              <Switch
                id="include-date"
                checked={includeDate}
                onCheckedChange={setIncludeDate}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="include-author" className="text-sm cursor-pointer">
                Incluir autor
              </Label>
              <Switch
                id="include-author"
                checked={includeAuthor}
                onCheckedChange={setIncludeAuthor}
              />
            </div>
            {includeAuthor && (
              <Input
                placeholder="Nome do autor"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />
            )}
          </div>

          {/* Watermark */}
          <div className="space-y-3 rounded-lg border border-border p-3">
            <Label className="text-sm font-medium">Marca d'água (opcional)</Label>
            <Input
              placeholder="Ex.: CONFIDENCIAL"
              value={watermarkText}
              onChange={(e) => setWatermarkText(e.target.value)}
            />
            {watermarkText.trim() && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Posição</Label>
                    <Select
                      value={watermarkPosition}
                      onValueChange={(v) => setWatermarkPosition(v as WatermarkPosition)}
                    >
                      <SelectTrigger className="h-9 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="center">Centro (diagonal)</SelectItem>
                        <SelectItem value="top-left">Topo esquerdo</SelectItem>
                        <SelectItem value="top-right">Topo direito</SelectItem>
                        <SelectItem value="bottom-left">Base esquerda</SelectItem>
                        <SelectItem value="bottom-right">Base direita</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Tamanho: {watermarkSize}px
                    </Label>
                    <Slider
                      value={[watermarkSize]}
                      min={16}
                      max={120}
                      step={2}
                      onValueChange={(v) => setWatermarkSize(v[0])}
                      className="mt-3"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Opacidade: {watermarkOpacity}%
                  </Label>
                  <Slider
                    value={[watermarkOpacity]}
                    min={5}
                    max={80}
                    step={5}
                    onValueChange={(v) => setWatermarkOpacity(v[0])}
                    className="mt-2"
                  />
                </div>
              </>
            )}
          </div>

          {/* Result */}
          {generatedUrl && (
            <div className="rounded-lg border border-success/40 bg-success/5 p-3 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {generatedName}
                </p>
                <p className="text-xs text-muted-foreground">
                  Se o download não iniciou, use o botão abaixo.
                </p>
              </div>
              <Button size="sm" variant="glow" onClick={manualDownload} className="gap-1.5 shrink-0">
                <Download className="w-4 h-4" /> Baixar
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={generatePdf} disabled={!file || generating} variant="glow">
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Gerando...
              </>
            ) : (
              <>
                <FileImage className="w-4 h-4" /> Gerar PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
