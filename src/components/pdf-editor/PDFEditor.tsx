import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  Upload,
  Type,
  Square,
  Circle as CircleIcon,
  Minus,
  Eraser,
  Pencil,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  Highlighter,
  MousePointer2,
  RotateCw,
  Image as ImageIcon,
  FileText,
  Bold,
  Italic,
  AlignLeft,
  Edit3,
  Eye,
  GitCompare,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

type Tool = "select" | "text" | "edit-text" | "rect" | "ellipse" | "line" | "draw" | "highlight" | "erase";

interface ExtractedText {
  id: string;
  page: number;
  // Original PDF coordinates (PDF points, origin bottom-left)
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfHeight: number;
  fontSize: number; // PDF points
  fontName: string;
  originalText: string;
  // Overlay coordinates (CSS px, origin top-left) for current zoom
  overlayX: number;
  overlayY: number;
  overlayWidth: number;
  overlayHeight: number;
  overlayFontSize: number;
}

interface TextEdit {
  extractedId: string;
  page: number;
  newText: string;
  fontKeyOverride?: FontKey;
  fontSizeOverride?: number; // PDF points
  colorOverride?: string;
}

type FontKey =
  | "Helvetica"
  | "HelveticaBold"
  | "HelveticaOblique"
  | "TimesRoman"
  | "TimesRomanBold"
  | "TimesRomanItalic"
  | "Courier"
  | "CourierBold";

const FONT_OPTIONS: { key: FontKey; label: string; standard: StandardFonts }[] = [
  { key: "Helvetica", label: "Helvetica", standard: StandardFonts.Helvetica },
  { key: "HelveticaBold", label: "Helvetica Bold", standard: StandardFonts.HelveticaBold },
  { key: "HelveticaOblique", label: "Helvetica Italic", standard: StandardFonts.HelveticaOblique },
  { key: "TimesRoman", label: "Times Roman", standard: StandardFonts.TimesRoman },
  { key: "TimesRomanBold", label: "Times Roman Bold", standard: StandardFonts.TimesRomanBold },
  { key: "TimesRomanItalic", label: "Times Roman Italic", standard: StandardFonts.TimesRomanItalic },
  { key: "Courier", label: "Courier", standard: StandardFonts.Courier },
  { key: "CourierBold", label: "Courier Bold", standard: StandardFonts.CourierBold },
];

interface BaseAnnotation {
  id: string;
  page: number;
  type: Tool;
  color: string;
  opacity: number;
  pageWidth?: number;
  pageHeight?: number;
}

interface TextAnnotation extends BaseAnnotation {
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontKey: FontKey;
}

interface ShapeAnnotation extends BaseAnnotation {
  type: "rect" | "ellipse" | "highlight";
  x: number;
  y: number;
  width: number;
  height: number;
  strokeWidth: number;
  filled: boolean;
}

interface LineAnnotation extends BaseAnnotation {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeWidth: number;
}

interface DrawAnnotation extends BaseAnnotation {
  type: "draw";
  points: { x: number; y: number }[];
  strokeWidth: number;
}

interface EraseAnnotation extends BaseAnnotation {
  type: "erase";
  x: number;
  y: number;
  width: number;
  height: number;
}

type Annotation =
  | TextAnnotation
  | ShapeAnnotation
  | LineAnnotation
  | DrawAnnotation
  | EraseAnnotation;

const uid = () => Math.random().toString(36).slice(2, 10);

const getFontFamily = (fontKeyOrName?: string) => {
  const name = (fontKeyOrName || "").toLowerCase();
  if (name.includes("times") || name.includes("serif")) return "Times, serif";
  if (name.includes("courier") || name.includes("mono")) return "Courier, monospace";
  return "Helvetica, Arial, sans-serif";
};

const rectanglesIntersect = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

function hexToRgb01(hex: string) {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  return { r, g, b };
}

export function PDFEditor() {
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [pdfName, setPdfName] = useState<string>("");
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.3);
  const [pageDims, setPageDims] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fontSize, setFontSize] = useState(16);
  const [fontKey, setFontKey] = useState<FontKey>("Helvetica");
  const [filled, setFilled] = useState(false);
  const [opacity, setOpacity] = useState(1);

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [extractedTexts, setExtractedTexts] = useState<ExtractedText[]>([]);
  const [textEdits, setTextEdits] = useState<Record<string, TextEdit>>({});
  const [editingExtractedId, setEditingExtractedId] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [compareUrls, setCompareUrls] = useState<{ before?: string; after?: string }>({});
  const [history, setHistory] = useState<Annotation[][]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[][]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef<{ startX: number; startY: number; current?: Annotation } | null>(null);
  const [drawingPreview, setDrawingPreview] = useState<Annotation | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [pageRotation, setPageRotation] = useState<Record<number, number>>({});

  // Allow other parts of the app to open a PDF directly in the editor
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ bytes: ArrayBuffer; name: string }>).detail;
      if (!detail?.bytes) return;
      setPdfBytes(detail.bytes);
      setPdfName(detail.name || "documento.pdf");
      setAnnotations([]);
      setExtractedTexts([]);
      setTextEdits({});
      setHistory([]);
      setRedoStack([]);
    };
    window.addEventListener("open-pdf-editor", handler as EventListener);
    return () => window.removeEventListener("open-pdf-editor", handler as EventListener);
  }, []);

  // Load PDF
  useEffect(() => {
    if (!pdfBytes) return;
    let cancelled = false;
    (async () => {
      try {
        const doc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setPageIndex(0);
      } catch (e) {
        toast.error("Erro ao abrir PDF");
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfBytes]);

  // Render current page + extract text positions
  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    (async () => {
      const page = await pdfDoc.getPage(pageIndex + 1);
      const rotation = pageRotation[pageIndex] ?? 0;
      const viewport = page.getViewport({ scale, rotation });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setPageDims({ width: viewport.width, height: viewport.height });
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;

      try {
        const textContent = await page.getTextContent();
        const items: ExtractedText[] = [];
        textContent.items.forEach((it: any, i: number) => {
          const str: string = it.str;
          if (!str || !str.trim()) return;
          const tr = pdfjsLib.Util.transform(viewport.transform, it.transform);
          const fontHeightPx = Math.hypot(tr[2], tr[3]);
          const widthPx = (it.width || 0) * scale;
          const overlayX = tr[4];
          const overlayY = tr[5] - fontHeightPx;
          const pdfX = it.transform[4];
          const pdfYBaseline = it.transform[5];
          const pdfFontSize = Math.hypot(it.transform[2], it.transform[3]);
          const pdfWidth = it.width || 0;
          const pdfHeight = it.height || pdfFontSize;
          items.push({
            id: `t-${pageIndex}-${i}`,
            page: pageIndex,
            pdfX,
            pdfY: pdfYBaseline,
            pdfWidth,
            pdfHeight,
            fontSize: pdfFontSize,
            fontName: it.fontName || "Helvetica",
            originalText: str,
            overlayX,
            overlayY,
            overlayWidth: widthPx,
            overlayHeight: fontHeightPx,
            overlayFontSize: fontHeightPx,
          });
        });
        if (!cancelled) {
          setExtractedTexts((prev) => [
            ...prev.filter((t) => t.page !== pageIndex),
            ...items,
          ]);
        }
      } catch (err) {
        console.warn("text extract failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageIndex, scale, pageRotation]);

  const pushHistory = useCallback(() => {
    setHistory((h) => [...h.slice(-49), annotations]);
    setRedoStack([]);
  }, [annotations]);

  const handleUpload = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Selecione um arquivo PDF");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setPdfBytes(e.target?.result as ArrayBuffer);
      setPdfName(file.name);
      setAnnotations([]);
      setExtractedTexts([]);
      setTextEdits({});
      setHistory([]);
      setRedoStack([]);
      toast.success("PDF carregado");
    };
    reader.readAsArrayBuffer(file);
  };

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (!pdfDoc || tool === "select" || tool === "edit-text") return;
    const rect = overlayRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === "text") {
      pushHistory();
      const ann: TextAnnotation = {
        id: uid(),
        page: pageIndex,
        type: "text",
        x,
        y,
        text: "",
        fontSize,
        fontKey,
        color,
        opacity,
        pageWidth: pageDims.width,
        pageHeight: pageDims.height,
      };
      setAnnotations((a) => [...a, ann]);
      setEditingTextId(ann.id);
      return;
    }

    drawingRef.current = { startX: x, startY: y };

    if (tool === "draw") {
      const ann: DrawAnnotation = {
        id: uid(),
        page: pageIndex,
        type: "draw",
        points: [{ x, y }],
        color,
        opacity,
        strokeWidth,
        pageWidth: pageDims.width,
        pageHeight: pageDims.height,
      };
      drawingRef.current.current = ann;
      setDrawingPreview(ann);
    }
  };

  const onCanvasMouseMove = (e: React.MouseEvent) => {
    if (!drawingRef.current) return;
    const rect = overlayRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { startX, startY } = drawingRef.current;

    if (tool === "draw" && drawingRef.current.current) {
      const ann = drawingRef.current.current as DrawAnnotation;
      ann.points.push({ x, y });
      setDrawingPreview({ ...ann });
      return;
    }

    if (tool === "rect" || tool === "ellipse" || tool === "highlight") {
      const ann: ShapeAnnotation = {
        id: "preview",
        page: pageIndex,
        type: tool,
        x: Math.min(startX, x),
        y: Math.min(startY, y),
        width: Math.abs(x - startX),
        height: Math.abs(y - startY),
        color: tool === "highlight" ? "#fde047" : color,
        opacity: tool === "highlight" ? 0.4 : opacity,
        strokeWidth,
        filled: tool === "highlight" ? true : filled,
        pageWidth: pageDims.width,
        pageHeight: pageDims.height,
      };
      setDrawingPreview(ann);
    } else if (tool === "line") {
      const ann: LineAnnotation = {
        id: "preview",
        page: pageIndex,
        type: "line",
        x1: startX,
        y1: startY,
        x2: x,
        y2: y,
        color,
        opacity,
        strokeWidth,
        pageWidth: pageDims.width,
        pageHeight: pageDims.height,
      };
      setDrawingPreview(ann);
    } else if (tool === "erase") {
      const ann: EraseAnnotation = {
        id: "preview",
        page: pageIndex,
        type: "erase",
        x: Math.min(startX, x),
        y: Math.min(startY, y),
        width: Math.abs(x - startX),
        height: Math.abs(y - startY),
        color: "#ffffff",
        opacity: 1,
        pageWidth: pageDims.width,
        pageHeight: pageDims.height,
      };
      setDrawingPreview(ann);
    }
  };

  const onCanvasMouseUp = () => {
    if (!drawingRef.current) return;
    if (drawingPreview) {
      pushHistory();
      const finalized: Annotation = { ...drawingPreview, id: uid() };
      setAnnotations((a) => [...a, finalized]);
    }
    drawingRef.current = null;
    setDrawingPreview(null);
  };

  const undo = () => {
    if (!history.length) return;
    setRedoStack((r) => [annotations, ...r].slice(0, 50));
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setAnnotations(prev);
  };

  const redo = () => {
    if (!redoStack.length) return;
    setHistory((h) => [...h, annotations]);
    const next = redoStack[0];
    setRedoStack((r) => r.slice(1));
    setAnnotations(next);
  };

  const deleteAnnotation = (id: string) => {
    pushHistory();
    setAnnotations((a) => a.filter((x) => x.id !== id));
  };

  const updateText = (id: string, text: string) => {
    setAnnotations((a) =>
      a.map((x) => (x.id === id && x.type === "text" ? { ...x, text } : x)),
    );
  };

  const rotatePage = () => {
    setPageRotation((r) => ({ ...r, [pageIndex]: ((r[pageIndex] ?? 0) + 90) % 360 }));
  };

  const buildEditedPdfBytes = async (): Promise<Uint8Array> => {
    const doc = await PDFDocument.load(pdfBytes!.slice(0));
    const fontCache = new Map<FontKey, any>();
    const getFont = async (k: FontKey) => {
      if (fontCache.has(k)) return fontCache.get(k);
      const opt = FONT_OPTIONS.find((f) => f.key === k)!;
      const f = await doc.embedFont(opt.standard);
      fontCache.set(k, f);
      return f;
    };
    const guessFontKey = (fontName: string): FontKey => {
      const n = (fontName || "").toLowerCase();
      const isBold = n.includes("bold");
      const isItalic = n.includes("italic") || n.includes("oblique");
      if (n.includes("times") || n.includes("serif")) {
        return isBold ? "TimesRomanBold" : isItalic ? "TimesRomanItalic" : "TimesRoman";
      }
      if (n.includes("courier") || n.includes("mono")) {
        return isBold ? "CourierBold" : "Courier";
      }
      return isBold ? "HelveticaBold" : isItalic ? "HelveticaOblique" : "Helvetica";
    };

    const pages = doc.getPages();

    for (const [pIdx, rot] of Object.entries(pageRotation)) {
      const idx = parseInt(pIdx, 10);
      if (pages[idx]) {
        const current = pages[idx].getRotation().angle;
        pages[idx].setRotation(degrees((current + rot) % 360));
      }
    }

    // Apply text edits (cover original + draw new in same place/font)
    for (const edit of Object.values(textEdits)) {
      const original = extractedTexts.find((t) => t.id === edit.extractedId);
      if (!original) continue;
      const page = pages[edit.page];
      if (!page) continue;

      const fk = edit.fontKeyOverride ?? guessFontKey(original.fontName);
      const fontSize = edit.fontSizeOverride ?? original.fontSize;
      const font = await getFont(fk);

      // Cover original text with a generously padded white rectangle so no
      // ascender/descender residue remains.
      const ascent = original.fontSize * 0.9;
      const descent = original.fontSize * 0.35;
      const padX = Math.max(2, original.fontSize * 0.2);
      const padTop = Math.max(2, original.fontSize * 0.25);
      const padBottom = Math.max(2, original.fontSize * 0.2);
      const newTextWidth = font.widthOfTextAtSize(edit.newText || " ", fontSize);
      const coverWidth = Math.max(original.pdfWidth, newTextWidth) + padX * 2;
      const coverHeight = ascent + descent + padTop + padBottom;
      page.drawRectangle({
        x: original.pdfX - padX,
        y: original.pdfY - descent - padBottom,
        width: coverWidth,
        height: coverHeight,
        color: rgb(1, 1, 1),
        opacity: 1,
      });

      const c = hexToRgb01(edit.colorOverride || "#000000");
      page.drawText(edit.newText, {
        x: original.pdfX,
        y: original.pdfY,
        size: fontSize,
        font,
        color: rgb(c.r, c.g, c.b),
      });
    }

    for (const ann of annotations) {
      const page = pages[ann.page];
      if (!page) continue;
      const { width: pw, height: ph } = page.getSize();
      const sx = pw / pageDims.width;
      const sy = ph / pageDims.height;
      const c = hexToRgb01(ann.color || "#000000");

      if (ann.type === "text") {
        const font = await getFont(ann.fontKey);
        page.drawText(ann.text, {
          x: ann.x * sx,
          y: ph - ann.y * sy - ann.fontSize * sy,
          size: ann.fontSize * sy,
          font,
          color: rgb(c.r, c.g, c.b),
          opacity: ann.opacity,
        });
      } else if (ann.type === "rect" || ann.type === "highlight") {
        page.drawRectangle({
          x: ann.x * sx,
          y: ph - (ann.y + ann.height) * sy,
          width: ann.width * sx,
          height: ann.height * sy,
          color: ann.filled ? rgb(c.r, c.g, c.b) : undefined,
          borderColor: rgb(c.r, c.g, c.b),
          borderWidth: ann.filled ? 0 : ann.strokeWidth,
          opacity: ann.opacity,
        });
      } else if (ann.type === "ellipse") {
        page.drawEllipse({
          x: (ann.x + ann.width / 2) * sx,
          y: ph - (ann.y + ann.height / 2) * sy,
          xScale: (ann.width / 2) * sx,
          yScale: (ann.height / 2) * sy,
          color: ann.filled ? rgb(c.r, c.g, c.b) : undefined,
          borderColor: rgb(c.r, c.g, c.b),
          borderWidth: ann.filled ? 0 : ann.strokeWidth,
          opacity: ann.opacity,
        });
      } else if (ann.type === "line") {
        page.drawLine({
          start: { x: ann.x1 * sx, y: ph - ann.y1 * sy },
          end: { x: ann.x2 * sx, y: ph - ann.y2 * sy },
          thickness: ann.strokeWidth,
          color: rgb(c.r, c.g, c.b),
          opacity: ann.opacity,
        });
      } else if (ann.type === "draw") {
        for (let i = 1; i < ann.points.length; i++) {
          const p1 = ann.points[i - 1];
          const p2 = ann.points[i];
          page.drawLine({
            start: { x: p1.x * sx, y: ph - p1.y * sy },
            end: { x: p2.x * sx, y: ph - p2.y * sy },
            thickness: ann.strokeWidth,
            color: rgb(c.r, c.g, c.b),
            opacity: ann.opacity,
          });
        }
      } else if (ann.type === "erase") {
        page.drawRectangle({
          x: ann.x * sx,
          y: ph - (ann.y + ann.height) * sy,
          width: ann.width * sx,
          height: ann.height * sy,
          color: rgb(1, 1, 1),
          opacity: 1,
        });
      }
    }
    return await doc.save();
  };

  const exportPDF = async () => {
    if (!pdfBytes) return;
    setExporting(true);
    try {
      const out = await buildEditedPdfBytes();
      const blob = new Blob([out as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = pdfName.replace(/\.pdf$/i, "") + "-editado.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast.success("PDF salvo e baixado");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao exportar PDF");
    } finally {
      setExporting(false);
    }
  };

  const openCompare = async () => {
    if (!pdfBytes) return;
    try {
      const beforeBlob = new Blob([pdfBytes.slice(0)], { type: "application/pdf" });
      const beforeUrl = URL.createObjectURL(beforeBlob);
      const out = await buildEditedPdfBytes();
      const afterBlob = new Blob([out as BlobPart], { type: "application/pdf" });
      const afterUrl = URL.createObjectURL(afterBlob);
      setCompareUrls({ before: beforeUrl, after: afterUrl });
      setShowCompare(true);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar comparação");
    }
  };

  const updateTextEdit = (
    extractedId: string,
    patch: Partial<Omit<TextEdit, "extractedId" | "page">>,
  ) => {
    const original = extractedTexts.find((t) => t.id === extractedId);
    if (!original) return;
    setTextEdits((prev) => {
      const existing = prev[extractedId];
      const merged: TextEdit = {
        extractedId,
        page: original.page,
        newText: existing?.newText ?? original.originalText,
        fontKeyOverride: existing?.fontKeyOverride,
        fontSizeOverride: existing?.fontSizeOverride,
        colorOverride: existing?.colorOverride,
        ...patch,
      };
      const isUnchanged =
        merged.newText === original.originalText &&
        !merged.fontKeyOverride &&
        merged.fontSizeOverride === undefined &&
        !merged.colorOverride;
      if (isUnchanged) {
        const { [extractedId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [extractedId]: merged };
    });
  };

  const resetTextEdit = (extractedId: string) => {
    setTextEdits((prev) => {
      const { [extractedId]: _, ...rest } = prev;
      return rest;
    });
  };


  const visibleAnns = annotations.filter((a) => a.page === pageIndex);

  const tools: { tool: Tool; icon: any; label: string }[] = [
    { tool: "select", icon: MousePointer2, label: "Selecionar" },
    { tool: "edit-text", icon: Edit3, label: "Editar Texto" },
    { tool: "text", icon: Type, label: "Adicionar Texto" },
    { tool: "draw", icon: Pencil, label: "Desenhar" },
    { tool: "highlight", icon: Highlighter, label: "Marca-texto" },
    { tool: "rect", icon: Square, label: "Retângulo" },
    { tool: "ellipse", icon: CircleIcon, label: "Elipse" },
    { tool: "line", icon: Minus, label: "Linha" },
    { tool: "erase", icon: Eraser, label: "Apagar (cobrir)" },
  ];

  if (!pdfBytes) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-display font-bold text-foreground">
            Editor de PDF
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Edite, anote, desenhe e adicione textos com várias fontes diretamente no PDF.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-8 md:p-12 text-center"
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          <h3 className="font-display font-semibold text-foreground text-lg mb-2">
            Carregue um PDF para editar
          </h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
            Adicione textos com diferentes fontes, desenhe à mão livre, marque, apague trechos e
            insira formas geométricas.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
          <Button
            variant="glow"
            size="lg"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            <Upload className="w-5 h-5" />
            Selecionar PDF
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl md:text-2xl font-display font-bold text-foreground truncate">
            Editor de PDF
          </h2>
          <p className="text-muted-foreground text-sm truncate">{pdfName}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
            <Upload className="w-4 h-4" /> Outro PDF
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
          <Button variant="outline" size="sm" onClick={openCompare} className="gap-2">
            <GitCompare className="w-4 h-4" /> Antes/Depois
          </Button>
          <Button variant="glow" size="sm" onClick={exportPDF} disabled={exporting} className="gap-2">
            <Download className="w-4 h-4" />
            {exporting ? "Salvando..." : "Salvar e Baixar"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Toolbar */}
        <div className="glass rounded-xl p-3 space-y-3 lg:sticky lg:top-2 lg:self-start">
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Ferramentas</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {tools.map((t) => (
                <button
                  key={t.tool}
                  onClick={() => setTool(t.tool)}
                  title={t.label}
                  className={cn(
                    "aspect-square rounded-lg flex items-center justify-center transition-colors border",
                    tool === t.tool
                      ? "bg-primary/15 border-primary/50 text-primary"
                      : "bg-secondary/50 border-border hover:bg-secondary text-foreground",
                  )}
                >
                  <t.icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          <Separator />

          <Tabs defaultValue="style">
            <TabsList className="w-full grid grid-cols-2 h-8">
              <TabsTrigger value="style" className="text-xs">Estilo</TabsTrigger>
              <TabsTrigger value="text" className="text-xs">Texto</TabsTrigger>
            </TabsList>

            <TabsContent value="style" className="space-y-3 mt-3">
              <div>
                <Label className="text-xs text-muted-foreground">Cor</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-9 rounded cursor-pointer bg-transparent border border-border"
                  />
                  <div className="flex flex-wrap gap-1">
                    {["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#000000", "#ffffff"].map((c) => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        style={{ background: c }}
                        className={cn(
                          "w-5 h-5 rounded border-2",
                          color === c ? "border-primary" : "border-border",
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Espessura: {strokeWidth}px</Label>
                <Slider
                  value={[strokeWidth]}
                  min={1}
                  max={20}
                  step={1}
                  onValueChange={(v) => setStrokeWidth(v[0])}
                  className="mt-2"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Opacidade: {Math.round(opacity * 100)}%</Label>
                <Slider
                  value={[opacity * 100]}
                  min={10}
                  max={100}
                  step={5}
                  onValueChange={(v) => setOpacity(v[0] / 100)}
                  className="mt-2"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="filled"
                  type="checkbox"
                  checked={filled}
                  onChange={(e) => setFilled(e.target.checked)}
                  className="rounded border-border"
                />
                <Label htmlFor="filled" className="text-xs cursor-pointer">
                  Preencher formas
                </Label>
              </div>
            </TabsContent>

            <TabsContent value="text" className="space-y-3 mt-3">
              <div>
                <Label className="text-xs text-muted-foreground">Fonte</Label>
                <Select value={fontKey} onValueChange={(v) => setFontKey(v as FontKey)}>
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((f) => (
                      <SelectItem key={f.key} value={f.key}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tamanho: {fontSize}px</Label>
                <Slider
                  value={[fontSize]}
                  min={8}
                  max={72}
                  step={1}
                  onValueChange={(v) => setFontSize(v[0])}
                  className="mt-2"
                />
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant={fontKey.includes("Bold") ? "default" : "outline"}
                  className="flex-1 h-8"
                  onClick={() =>
                    setFontKey((k) =>
                      k === "Helvetica" ? "HelveticaBold" :
                      k === "HelveticaBold" ? "Helvetica" :
                      k === "TimesRoman" ? "TimesRomanBold" :
                      k === "TimesRomanBold" ? "TimesRoman" :
                      k === "Courier" ? "CourierBold" :
                      k === "CourierBold" ? "Courier" : k
                    )
                  }
                >
                  <Bold className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant={fontKey.includes("Oblique") || fontKey.includes("Italic") ? "default" : "outline"}
                  className="flex-1 h-8"
                  onClick={() =>
                    setFontKey((k) =>
                      k === "Helvetica" ? "HelveticaOblique" :
                      k === "HelveticaOblique" ? "Helvetica" :
                      k === "TimesRoman" ? "TimesRomanItalic" :
                      k === "TimesRomanItalic" ? "TimesRoman" : k
                    )
                  }
                >
                  <Italic className="w-3.5 h-3.5" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Selecione a ferramenta <strong>Texto</strong> e clique no PDF para inserir.
              </p>
            </TabsContent>
          </Tabs>

          <Separator />

          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="flex-1 h-8 gap-1" onClick={undo} disabled={!history.length}>
              <Undo2 className="w-3.5 h-3.5" /> Desf
            </Button>
            <Button size="sm" variant="outline" className="flex-1 h-8 gap-1" onClick={redo} disabled={!redoStack.length}>
              <Redo2 className="w-3.5 h-3.5" /> Ref
            </Button>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full h-8 gap-1"
            onClick={() => {
              if (!visibleAnns.length) return;
              pushHistory();
              setAnnotations((a) => a.filter((x) => x.page !== pageIndex));
            }}
          >
            <Trash2 className="w-3.5 h-3.5" /> Limpar página
          </Button>
          <Button size="sm" variant="outline" className="w-full h-8 gap-1" onClick={rotatePage}>
            <RotateCw className="w-3.5 h-3.5" /> Girar página
          </Button>
        </div>

        {/* Canvas area */}
        <div className="space-y-3">
          <div className="glass rounded-xl p-2 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                disabled={pageIndex === 0}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm tabular-nums px-2">
                {pageIndex + 1} / {numPages}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setPageIndex((p) => Math.min(numPages - 1, p + 1))}
                disabled={pageIndex >= numPages - 1}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-xs tabular-nums w-12 text-center">{Math.round(scale * 100)}%</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setScale((s) => Math.min(3, s + 0.2))}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {tool === "edit-text" && (
            <div className="glass rounded-xl px-3 py-2 text-xs text-muted-foreground flex items-center gap-2 border border-primary/30">
              <Edit3 className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>
                Clique sobre qualquer trecho de texto do PDF para editar. As alterações ficam destacadas e são aplicadas ao salvar.
              </span>
              {Object.keys(textEdits).length > 0 && (
                <span className="ml-auto bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">
                  {Object.keys(textEdits).length} alteração(ões)
                </span>
              )}
            </div>
          )}

          <ScrollArea className="glass rounded-xl p-3 max-h-[calc(100vh-260px)]">
            <div className="flex justify-center">
              <div
                className="relative shadow-xl"
                style={{ width: pageDims.width, height: pageDims.height }}
              >
                <canvas ref={canvasRef} className="block bg-white" />
                <div
                  ref={overlayRef}
                  onMouseDown={onCanvasMouseDown}
                  onMouseMove={onCanvasMouseMove}
                  onMouseUp={onCanvasMouseUp}
                  onMouseLeave={onCanvasMouseUp}
                  className="absolute inset-0"
                  style={{
                    cursor:
                      tool === "select"
                        ? "default"
                        : tool === "text"
                          ? "text"
                          : tool === "erase"
                            ? "cell"
                            : "crosshair",
                  }}
                >
                  {[...visibleAnns, ...(drawingPreview && drawingPreview.page === pageIndex ? [drawingPreview] : [])].map((ann) => (
                    <AnnotationView
                      key={ann.id}
                      ann={ann}
                      selectable={tool === "select"}
                      editing={editingTextId === ann.id}
                      onEdit={(t) => updateText(ann.id, t)}
                      onDelete={() => deleteAnnotation(ann.id)}
                      onStartEdit={() => setEditingTextId(ann.id)}
                      onFinishEdit={() => setEditingTextId(null)}
                    />
                  ))}

                  {/* Editable extracted text overlays */}
                  {tool === "edit-text" &&
                    extractedTexts
                      .filter((t) => t.page === pageIndex)
                      .map((t) => {
                        const edit = textEdits[t.id];
                        const value = edit ? edit.newText : t.originalText;
                        const changed = !!edit;
                        const isEditing = editingExtractedId === t.id;
                        return (
                          <div
                            key={t.id}
                            style={{
                              position: "absolute",
                              left: t.overlayX,
                              top: t.overlayY,
                              minWidth: Math.max(t.overlayWidth, 30),
                              height: t.overlayHeight + 4,
                            }}
                            className={cn(
                              "group",
                              changed && "ring-1 ring-primary/60",
                            )}
                          >
                            {isEditing ? (
                              <>
                                <input
                                  autoFocus
                                  value={value}
                                  onChange={(e) => updateTextEdit(t.id, { newText: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") setEditingExtractedId(null);
                                    if (e.key === "Escape") {
                                      resetTextEdit(t.id);
                                      setEditingExtractedId(null);
                                    }
                                  }}
                                  style={{
                                    fontSize: (edit?.fontSizeOverride ?? t.fontSize) * (t.overlayFontSize / t.fontSize),
                                    lineHeight: 1,
                                    width: "100%",
                                    height: "100%",
                                    background: "white",
                                    color: edit?.colorOverride || "black",
                                    border: "1px solid hsl(var(--primary))",
                                    outline: "none",
                                    padding: "0 2px",
                                    fontFamily: (() => {
                                      const fk = edit?.fontKeyOverride;
                                      if (fk?.startsWith("Times")) return "Times, serif";
                                      if (fk?.startsWith("Courier")) return "Courier, monospace";
                                      if (fk?.startsWith("Helvetica")) return "Helvetica, Arial, sans-serif";
                                      return t.fontName.toLowerCase().includes("times")
                                        ? "Times, serif"
                                        : t.fontName.toLowerCase().includes("courier")
                                          ? "Courier, monospace"
                                          : "Helvetica, Arial, sans-serif";
                                    })(),
                                    fontWeight: edit?.fontKeyOverride?.includes("Bold") ? "bold" : "normal",
                                    fontStyle:
                                      edit?.fontKeyOverride?.includes("Oblique") ||
                                      edit?.fontKeyOverride?.includes("Italic")
                                        ? "italic"
                                        : "normal",
                                  }}
                                />
                                {/* Floating style panel */}
                                <div
                                  className="absolute z-20 left-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-xl p-2 flex items-center gap-1.5 flex-nowrap whitespace-nowrap"
                                  onMouseDown={(e) => e.preventDefault()}
                                >
                                  <Select
                                    value={edit?.fontKeyOverride ?? "__auto__"}
                                    onValueChange={(v) =>
                                      updateTextEdit(t.id, {
                                        fontKeyOverride: v === "__auto__" ? undefined : (v as FontKey),
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-7 w-[130px] text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__auto__">Auto ({t.fontName.slice(0, 14)})</SelectItem>
                                      {FONT_OPTIONS.map((f) => (
                                        <SelectItem key={f.key} value={f.key}>
                                          {f.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    type="number"
                                    min={4}
                                    max={144}
                                    step={0.5}
                                    value={Number((edit?.fontSizeOverride ?? t.fontSize).toFixed(1))}
                                    onChange={(e) => {
                                      const n = parseFloat(e.target.value);
                                      updateTextEdit(t.id, {
                                        fontSizeOverride: isNaN(n) ? undefined : n,
                                      });
                                    }}
                                    className="h-7 w-16 text-xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cur = edit?.fontKeyOverride ?? "Helvetica";
                                      const next = cur.includes("Bold")
                                        ? (cur.replace("Bold", "") as FontKey)
                                        : (cur === "Helvetica"
                                            ? "HelveticaBold"
                                            : cur === "TimesRoman"
                                              ? "TimesRomanBold"
                                              : cur === "Courier"
                                                ? "CourierBold"
                                                : cur === "HelveticaOblique"
                                                  ? "HelveticaBold"
                                                  : cur === "TimesRomanItalic"
                                                    ? "TimesRomanBold"
                                                    : cur) as FontKey;
                                      updateTextEdit(t.id, { fontKeyOverride: next });
                                    }}
                                    className={cn(
                                      "h-7 w-7 rounded border flex items-center justify-center",
                                      edit?.fontKeyOverride?.includes("Bold")
                                        ? "bg-primary/15 border-primary/50 text-primary"
                                        : "bg-secondary/50 border-border",
                                    )}
                                    title="Negrito"
                                  >
                                    <Bold className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cur = edit?.fontKeyOverride ?? "Helvetica";
                                      const isItalic = cur.includes("Oblique") || cur.includes("Italic");
                                      let next: FontKey = cur;
                                      if (isItalic) {
                                        next = (cur.includes("Helvetica") ? "Helvetica" : cur.includes("Times") ? "TimesRoman" : cur) as FontKey;
                                      } else {
                                        next = cur.startsWith("Times") ? "TimesRomanItalic" : "HelveticaOblique";
                                      }
                                      updateTextEdit(t.id, { fontKeyOverride: next });
                                    }}
                                    className={cn(
                                      "h-7 w-7 rounded border flex items-center justify-center",
                                      (edit?.fontKeyOverride?.includes("Oblique") || edit?.fontKeyOverride?.includes("Italic"))
                                        ? "bg-primary/15 border-primary/50 text-primary"
                                        : "bg-secondary/50 border-border",
                                    )}
                                    title="Itálico"
                                  >
                                    <Italic className="w-3.5 h-3.5" />
                                  </button>
                                  <input
                                    type="color"
                                    value={edit?.colorOverride || "#000000"}
                                    onChange={(e) =>
                                      updateTextEdit(t.id, { colorOverride: e.target.value })
                                    }
                                    className="h-7 w-7 rounded border border-border cursor-pointer bg-transparent"
                                    title="Cor"
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => {
                                      resetTextEdit(t.id);
                                      setEditingExtractedId(null);
                                    }}
                                  >
                                    Cancelar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => setEditingExtractedId(null)}
                                  >
                                    OK
                                  </Button>
                                </div>
                              </>

                            ) : (
                              <button
                                onClick={() => setEditingExtractedId(t.id)}
                                title={`Clique para editar: "${t.originalText}"`}
                                className={cn(
                                  "w-full h-full text-left cursor-text",
                                  "border border-transparent hover:border-primary/60 hover:bg-primary/5",
                                  changed && "border-primary/60 bg-primary/10",
                                )}
                                style={{ background: changed ? undefined : "transparent" }}
                              />
                            )}
                          </div>
                        );
                      })}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

      <Dialog
        open={showCompare}
        onOpenChange={(o) => {
          setShowCompare(o);
          if (!o) {
            if (compareUrls.before) URL.revokeObjectURL(compareUrls.before);
            if (compareUrls.after) URL.revokeObjectURL(compareUrls.after);
            setCompareUrls({});
          }
        }}
      >
        <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col p-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-primary" />
              Comparar — Antes e Depois
              {Object.keys(textEdits).length > 0 && (
                <span className="ml-2 text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full">
                  {Object.keys(textEdits).length} alteração(ões) de texto
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {Object.keys(textEdits).length > 0 && (
            <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-1.5 max-h-32 overflow-auto">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Alterações:</p>
              {Object.values(textEdits).map((edit) => {
                const orig = extractedTexts.find((t) => t.id === edit.extractedId);
                if (!orig) return null;
                return (
                  <div key={edit.extractedId} className="text-xs flex flex-wrap items-center gap-1.5">
                    <span className="text-muted-foreground">pág {edit.page + 1}:</span>
                    <span className="line-through text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                      {orig.originalText}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      {edit.newText}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-0">
            <div className="flex flex-col min-h-0">
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Antes (original)</p>
              {compareUrls.before && (
                <iframe src={compareUrls.before} className="flex-1 w-full rounded-lg border border-border bg-white" title="Antes" />
              )}
            </div>
            <div className="flex flex-col min-h-0">
              <p className="text-xs font-semibold text-primary mb-1.5">Depois (editado)</p>
              {compareUrls.after && (
                <iframe src={compareUrls.after} className="flex-1 w-full rounded-lg border border-primary/40 bg-white" title="Depois" />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AnnotationView({
  ann,
  selectable,
  editing,
  onEdit,
  onDelete,
  onStartEdit,
  onFinishEdit,
}: {
  ann: Annotation;
  selectable: boolean;
  editing: boolean;
  onEdit: (t: string) => void;
  onDelete: () => void;
  onStartEdit: () => void;
  onFinishEdit: () => void;
}) {
  const common: React.CSSProperties = {
    position: "absolute",
    opacity: ann.opacity,
    pointerEvents: selectable ? "auto" : "none",
  };

  if (ann.type === "text") {
    return (
      <div
        style={{ ...common, left: ann.x, top: ann.y, color: ann.color, fontSize: ann.fontSize }}
        onDoubleClick={onStartEdit}
        className="group"
      >
        {editing ? (
          <input
            autoFocus
            value={ann.text}
            onChange={(e) => onEdit(e.target.value)}
            onBlur={onFinishEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") onFinishEdit();
            }}
            style={{
              fontSize: ann.fontSize,
              color: ann.color,
              fontFamily: ann.fontKey.startsWith("Times")
                ? "Times, serif"
                : ann.fontKey.startsWith("Courier")
                  ? "Courier, monospace"
                  : "Helvetica, Arial, sans-serif",
              fontWeight: ann.fontKey.includes("Bold") ? "bold" : "normal",
              fontStyle: ann.fontKey.includes("Oblique") || ann.fontKey.includes("Italic") ? "italic" : "normal",
            }}
            className="bg-transparent border border-primary/60 outline-none px-1 min-w-[80px]"
          />
        ) : (
          <span
            style={{
              fontFamily: ann.fontKey.startsWith("Times")
                ? "Times, serif"
                : ann.fontKey.startsWith("Courier")
                  ? "Courier, monospace"
                  : "Helvetica, Arial, sans-serif",
              fontWeight: ann.fontKey.includes("Bold") ? "bold" : "normal",
              fontStyle: ann.fontKey.includes("Oblique") || ann.fontKey.includes("Italic") ? "italic" : "normal",
            }}
            className="whitespace-pre"
          >
            {ann.text}
          </span>
        )}
        {selectable && !editing && (
          <button
            onClick={onDelete}
            className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] opacity-0 group-hover:opacity-100"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  if (ann.type === "rect" || ann.type === "highlight") {
    return (
      <div
        style={{
          ...common,
          left: ann.x,
          top: ann.y,
          width: ann.width,
          height: ann.height,
          background: ann.filled ? ann.color : "transparent",
          border: ann.filled ? "none" : `${ann.strokeWidth}px solid ${ann.color}`,
        }}
        className="group"
      >
        {selectable && (
          <button
            onClick={onDelete}
            className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] opacity-0 group-hover:opacity-100"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  if (ann.type === "ellipse") {
    return (
      <div
        style={{
          ...common,
          left: ann.x,
          top: ann.y,
          width: ann.width,
          height: ann.height,
          borderRadius: "50%",
          background: ann.filled ? ann.color : "transparent",
          border: ann.filled ? "none" : `${ann.strokeWidth}px solid ${ann.color}`,
        }}
        className="group"
      >
        {selectable && (
          <button
            onClick={onDelete}
            className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] opacity-0 group-hover:opacity-100"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  if (ann.type === "line") {
    const minX = Math.min(ann.x1, ann.x2);
    const minY = Math.min(ann.y1, ann.y2);
    const w = Math.abs(ann.x2 - ann.x1) || 1;
    const h = Math.abs(ann.y2 - ann.y1) || 1;
    return (
      <svg
        style={{ ...common, left: minX - 4, top: minY - 4, width: w + 8, height: h + 8, overflow: "visible" }}
      >
        <line
          x1={ann.x1 - minX + 4}
          y1={ann.y1 - minY + 4}
          x2={ann.x2 - minX + 4}
          y2={ann.y2 - minY + 4}
          stroke={ann.color}
          strokeWidth={ann.strokeWidth}
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (ann.type === "draw") {
    if (ann.points.length < 2) return null;
    const xs = ann.points.map((p) => p.x);
    const ys = ann.points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const w = Math.max(...xs) - minX || 1;
    const h = Math.max(...ys) - minY || 1;
    const d = ann.points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x - minX} ${p.y - minY}`)
      .join(" ");
    return (
      <svg
        style={{ ...common, left: minX, top: minY, width: w, height: h, overflow: "visible" }}
      >
        <path d={d} stroke={ann.color} strokeWidth={ann.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (ann.type === "erase") {
    return (
      <div
        style={{
          ...common,
          left: ann.x,
          top: ann.y,
          width: ann.width,
          height: ann.height,
          background: "white",
          border: "1px dashed rgba(0,0,0,0.2)",
        }}
        className="group"
      >
        {selectable && (
          <button
            onClick={onDelete}
            className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] opacity-0 group-hover:opacity-100"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  return null;
}
