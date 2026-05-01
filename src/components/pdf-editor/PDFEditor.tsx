import { useState, useRef, useCallback, useEffect, Fragment } from "react";
import { motion } from "framer-motion";
import { PDFDocument, PDFFont, rgb, StandardFonts, degrees } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  Upload,
  Type,
  Square,
  Circle as CircleIcon,
  Minus,
  Eraser,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  Highlighter,
  Hand,
  MousePointer2,
  RotateCw,
  Image as ImageIcon,
  FileText,
  Bold,
  Italic,
  Edit3,
  Move,
  Eye,
  GitCompare,
  Maximize2,
  Minimize2,
  type LucideIcon,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

type Tool = "pan" | "select" | "text" | "edit-text" | "rect" | "ellipse" | "line" | "draw" | "highlight" | "erase";

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
  xOffset?: number; // Overlay px from the original editable area
  yOffset?: number; // Overlay px from the original editable area
}

interface PdfTextItem {
  str: string;
  transform: number[];
  width?: number;
  height?: number;
  fontName?: string;
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

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

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

  const [tool, setTool] = useState<Tool>("edit-text");
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
  const [hoveredEraseId, setHoveredEraseId] = useState<string | null>(null);
  const [hoveredErasedTextId, setHoveredErasedTextId] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [compareUrls, setCompareUrls] = useState<{ before?: string; after?: string }>({});
  const [comparePages, setComparePages] = useState<
    {
      page: number;
      width: number;
      height: number;
      beforeImg: string;
      afterImg: string;
      edits: {
        id: string;
        overlayX: number;
        overlayY: number;
        overlayWidth: number;
        overlayHeight: number;
        originalText: string;
        newText: string;
      }[];
    }[]
  >([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPages, setPreviewPages] = useState<{ page: number; img: string; width: number; height: number }[]>([]);
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
  const [history, setHistory] = useState<Annotation[][]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[][]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const moveTextRef = useRef<{
    extractedId: string;
    eraseArea: EraseAnnotation;
    startClientX: number;
    startClientY: number;
    startOffsetX: number;
    startOffsetY: number;
    boxWidth: number;
    boxHeight: number;
  } | null>(null);
  const drawingRef = useRef<{ startX: number; startY: number; current?: Annotation } | null>(null);
  const [drawingPreview, setDrawingPreview] = useState<Annotation | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isMovingText, setIsMovingText] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [pageRotation, setPageRotation] = useState<Record<number, number>>({});
  const editorRootRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    setPanOffset({ x: 0, y: 0 });
    panRef.current = null;
    setIsPanning(false);
  }, [pageIndex, pdfDoc]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await editorRootRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      toast.error("Tela cheia não suportada neste navegador");
    }
  }, []);

  useEffect(() => {
    if (!isPanning) return;
    const movePan = (event: MouseEvent) => {
      if (!panRef.current) return;
      event.preventDefault();
      const dx = event.clientX - panRef.current.startX;
      const dy = event.clientY - panRef.current.startY;
      setPanOffset({ x: panRef.current.offsetX + dx, y: panRef.current.offsetY + dy });
    };
    const stopPan = () => {
      panRef.current = null;
      setIsPanning(false);
    };
    window.addEventListener("mousemove", movePan, { passive: false });
    window.addEventListener("mouseup", stopPan);
    return () => {
      window.removeEventListener("mousemove", movePan);
      window.removeEventListener("mouseup", stopPan);
    };
  }, [isPanning]);

  useEffect(() => {
    if (!isMovingText) return;
    const moveText = (event: MouseEvent) => {
      const current = moveTextRef.current;
      if (!current) return;
      event.preventDefault();
      const dx = event.clientX - current.startClientX;
      const dy = event.clientY - current.startClientY;
      const maxX = Math.max(0, current.eraseArea.width - current.boxWidth);
      const maxY = Math.max(0, current.eraseArea.height - current.boxHeight);
      updateTextEdit(current.extractedId, {
        xOffset: clamp(current.startOffsetX + dx, 0, maxX),
        yOffset: clamp(current.startOffsetY + dy, 0, maxY),
      });
    };
    const stopMoveText = () => {
      moveTextRef.current = null;
      setIsMovingText(false);
    };
    window.addEventListener("mousemove", moveText, { passive: false });
    window.addEventListener("mouseup", stopMoveText);
    return () => {
      window.removeEventListener("mousemove", moveText);
      window.removeEventListener("mouseup", stopMoveText);
    };
  }, [isMovingText]);

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
      setTool("pan");
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

        // Resolve internal pdf.js font ids (e.g. "g_d0_f1") to the real
        // PostScript font name embedded in the PDF (e.g. "Helvetica-Bold",
        // "TimesNewRomanPS-ItalicMT"). This lets us pick the right standard
        // font when re-drawing edited text on top of the erased area.
        const resolveFontName = (id?: string): string => {
          if (!id) return "Helvetica";
          try {
            // commonObjs holds standard fonts; objs holds embedded fonts
            const anyPage = page as unknown as {
              commonObjs?: { has: (k: string) => boolean; get: (k: string) => unknown };
              objs?: { has: (k: string) => boolean; get: (k: string) => unknown };
            };
            const sources = [anyPage.commonObjs, anyPage.objs];
            for (const src of sources) {
              if (src && typeof src.has === "function" && src.has(id)) {
                const obj = src.get(id) as { name?: string; loadedName?: string } | undefined;
                const real = obj?.name || obj?.loadedName;
                if (real) return real;
              }
            }
          } catch {
            // ignore — fall back to id
          }
          return id;
        };

        const items: ExtractedText[] = [];
        textContent.items.forEach((it, i: number) => {
          if (!("str" in it)) return;
          const textItem = it as PdfTextItem;
          const str: string = textItem.str ?? "";
          // Keep whitespace-only items too (they often anchor blank/justified
          // regions where the user might want to type after erasing).
          if (!str) return;
          const tr = pdfjsLib.Util.transform(viewport.transform, textItem.transform);
          const fontHeightPx = Math.max(Math.hypot(tr[2], tr[3]), 6);
          // Some glyphs/fonts report width=0 (combining marks, emoji, custom
          // encodings). Estimate a sensible width so the bbox can still be
          // hit-tested by the eraser.
          const reportedWidthPx = (textItem.width || 0) * scale;
          const fallbackWidthPx = Math.max(str.length, 1) * fontHeightPx * 0.5;
          const widthPx = Math.max(reportedWidthPx, fallbackWidthPx);
          const overlayX = tr[4];
          const overlayY = tr[5] - fontHeightPx;
          const pdfX = textItem.transform[4];
          const pdfYBaseline = textItem.transform[5];
          const pdfFontSize = Math.max(Math.hypot(textItem.transform[2], textItem.transform[3]), 6);
          const pdfWidth = Math.max(textItem.width || 0, (widthPx / scale));
          const pdfHeight = Math.max(textItem.height || 0, pdfFontSize);
          const realFontName = resolveFontName(textItem.fontName);
          items.push({
            id: `t-${pageIndex}-${i}`,
            page: pageIndex,
            pdfX,
            pdfY: pdfYBaseline,
            pdfWidth,
            pdfHeight,
            fontSize: pdfFontSize,
            fontName: realFontName,
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
            ...prev.filter((t) => t.page !== pageIndex || t.id.startsWith("tv-")),
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

  const createVirtualTextForErase = useCallback(
    (eraseArea: EraseAnnotation, sourceText?: ExtractedText): ExtractedText => {
      const overlayFontSize = sourceText?.overlayFontSize ?? Math.max(12, Math.min(eraseArea.height * 0.7, 48));
      const pdfFontSize = sourceText?.fontSize ?? overlayFontSize / scale;
      const pageHeightPdf = (pageDims.height || eraseArea.height) / scale;

      return {
        id: `tv-${eraseArea.page}-${eraseArea.id}`,
        page: eraseArea.page,
        pdfX: eraseArea.x / scale,
        pdfY: pageHeightPdf - (eraseArea.y + eraseArea.height) / scale + pdfFontSize * 0.2,
        pdfWidth: eraseArea.width / scale,
        pdfHeight: eraseArea.height / scale,
        fontSize: pdfFontSize,
        fontName: sourceText?.fontName ?? fontKey,
        originalText: "",
        overlayX: eraseArea.x,
        overlayY: eraseArea.y,
        overlayWidth: Math.max(eraseArea.width, sourceText?.overlayWidth ?? 80),
        overlayHeight: Math.max(eraseArea.height, overlayFontSize + 6),
        overlayFontSize,
      };
    },
    [fontKey, pageDims.height, scale],
  );

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
      setTool("pan");
      toast.success("PDF carregado");
    };
    reader.readAsArrayBuffer(file);
  };

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (tool === "edit-text") {
      const point = getOverlayPoint(e);
      if (!point) return;
      const eraseArea = findEraseAtPoint(point.x, point.y);
      if (eraseArea) {
        e.preventDefault();
        e.stopPropagation();
        const existingVirtual = extractedTexts.find((t) => t.id === `tv-${pageIndex}-${eraseArea.id}`);
        const virtual = existingVirtual ?? createVirtualTextForErase(eraseArea);
        if (!existingVirtual) {
          setExtractedTexts((prev) => [...prev, virtual]);
        }
        setTextEdits((prev) => ({
          ...prev,
          [virtual.id]: { extractedId: virtual.id, page: pageIndex, newText: prev[virtual.id]?.newText ?? "" },
        }));
        setEditingExtractedId(virtual.id);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setEditingExtractedId(null);
      return;
    }
    if (tool === "pan") {
      e.preventDefault();
      const scroller = scrollContainerRef.current;
      if (!scroller) return;
      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        scrollLeft: scroller.scrollLeft,
        scrollTop: scroller.scrollTop,
        offsetX: panOffset.x,
        offsetY: panOffset.y,
      };
      setIsPanning(true);
      return;
    }
    if (!pdfDoc || tool === "select") return;
    const point = getOverlayPoint(e);
    if (!point) return;
    const { x, y } = point;

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
    if (panRef.current) {
      e.preventDefault();
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      setPanOffset({ x: panRef.current.offsetX + dx, y: panRef.current.offsetY + dy });
      return;
    }
    if (tool === "edit-text") {
      const point = getOverlayPoint(e);
      const erase = point ? findEraseAtPoint(point.x, point.y) : undefined;
      const erasedText = point ? findErasedTextAtPoint(point.x, point.y) : undefined;
      setHoveredEraseId(erase?.id ?? null);
      setHoveredErasedTextId(erasedText?.id ?? null);
      return;
    }
    if (!drawingRef.current) return;
    const point = getOverlayPoint(e);
    if (!point) return;
    const { x, y } = point;
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
    if (panRef.current) {
      panRef.current = null;
      setIsPanning(false);
    }
    if (!drawingRef.current) return;
    if (drawingPreview) {
      pushHistory();
      const finalized: Annotation = { ...drawingPreview, id: uid() };
      setAnnotations((a) => [...a, finalized]);
      if (finalized.type === "erase") {
        // More generous intersection: pad each text bbox by a fraction of its
        // own font height so partial overlaps still register, and so that
        // small/thin glyphs (numbers, punctuation) are detected reliably.
        const candidates = extractedTexts.filter((t) => t.page === pageIndex);
        const erasedTexts = candidates.filter((t) => {
          const padX = Math.max(6, t.overlayHeight * 0.4);
          const padY = Math.max(6, t.overlayHeight * 0.5);
          return rectanglesIntersect(finalized, {
            x: t.overlayX - padX,
            y: t.overlayY - padY,
            width: Math.max(t.overlayWidth, 12) + padX * 2,
            height: Math.max(t.overlayHeight, 10) + padY * 2,
          });
        });

        if (finalized.width > 6 && finalized.height > 6) {
          const virtual = createVirtualTextForErase(finalized, erasedTexts[0]);
          setExtractedTexts((prev) => [...prev, virtual]);
          setTextEdits((prev) => ({
            ...prev,
            [virtual.id]: { extractedId: virtual.id, page: pageIndex, newText: "" },
          }));
        }

        if (erasedTexts.length) {
          setTextEdits((prev) => {
            const next = { ...prev };
            erasedTexts.forEach((t) => {
              next[t.id] = {
                ...(next[t.id] || { extractedId: t.id, page: t.page }),
                extractedId: t.id,
                page: t.page,
                newText: "",
              };
            });
            return next;
          });
          toast.success(
            `${erasedTexts.length} trecho(s) apagado(s). Agora clique em Editar Texto e depois na área branca para digitar.`,
          );
        } else if (finalized.width > 6 && finalized.height > 6) {
          toast.success(
            "Área pronta para edição. Clique em Editar Texto e depois na área apagada para digitar.",
          );
        }
      }
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

  const getOverlayPoint = (e: React.MouseEvent) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const findEraseAtPoint = useCallback(
    (x: number, y: number) => {
      const matches = annotations.filter(
        (ann): ann is EraseAnnotation =>
          ann.page === pageIndex &&
          ann.type === "erase" &&
          x >= ann.x &&
          x <= ann.x + ann.width &&
          y >= ann.y &&
          y <= ann.y + ann.height,
      );
      return matches[matches.length - 1];
    },
    [annotations, pageIndex],
  );

  const isExtractedTextErased = useCallback(
    (text: ExtractedText) =>
      annotations.some((ann): ann is EraseAnnotation => {
        if (ann.type !== "erase" || ann.page !== text.page) return false;
        const padX = Math.max(6, text.overlayHeight * 0.4);
        const padY = Math.max(6, text.overlayHeight * 0.5);
        return rectanglesIntersect(ann, {
          x: text.overlayX - padX,
          y: text.overlayY - padY,
          width: Math.max(text.overlayWidth, 12) + padX * 2,
          height: Math.max(text.overlayHeight, 10) + padY * 2,
        });
      }),
    [annotations],
  );

  const findErasedTextAtPoint = useCallback(
    (x: number, y: number) => {
      const erasers = annotations.filter(
        (ann): ann is EraseAnnotation =>
          ann.page === pageIndex &&
          ann.type === "erase" &&
          x >= ann.x &&
          x <= ann.x + ann.width &&
          y >= ann.y &&
          y <= ann.y + ann.height,
      );
      if (!erasers.length) return undefined;

      return extractedTexts
        .filter(
          (t) =>
            t.page === pageIndex &&
            erasers.some((eraser) => {
              const padX = Math.max(6, t.overlayHeight * 0.4);
              const padY = Math.max(6, t.overlayHeight * 0.5);
              return rectanglesIntersect(eraser, {
                x: t.overlayX - padX,
                y: t.overlayY - padY,
                width: Math.max(t.overlayWidth, 12) + padX * 2,
                height: Math.max(t.overlayHeight, 10) + padY * 2,
              });
            }),
        )
        .map((t) => {
          const centerX = t.overlayX + t.overlayWidth / 2;
          const centerY = t.overlayY + t.overlayHeight / 2;
          return { text: t, distance: Math.hypot(x - centerX, y - centerY) };
        })
        .sort((a, b) => a.distance - b.distance)[0]?.text;
    },
    [annotations, extractedTexts, pageIndex],
  );

  const rotatePage = () => {
    setPageRotation((r) => ({ ...r, [pageIndex]: ((r[pageIndex] ?? 0) + 90) % 360 }));
  };

  const buildEditedPdfBytes = async (): Promise<Uint8Array> => {
    const doc = await PDFDocument.load(pdfBytes!.slice(0));
    const fontCache = new Map<FontKey, PDFFont>();
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

      const isEraseAreaEdit = annotations.some(
        (ann): ann is EraseAnnotation => ann.type === "erase" && ann.page === original.page && original.id === `tv-${original.page}-${ann.id}`,
      );
      if (original.id.startsWith("tv-") && !isEraseAreaEdit) continue;
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
      if (edit.newText.trim()) {
        page.drawText(edit.newText, {
          x: original.pdfX,
          y: original.pdfY,
          size: fontSize,
          font,
          color: rgb(c.r, c.g, c.b),
        });
      }
    }

    for (const ann of annotations) {
      const page = pages[ann.page];
      if (!page) continue;
      const { width: pw, height: ph } = page.getSize();
      const sx = pw / (ann.pageWidth || pageDims.width || pw);
      const sy = ph / (ann.pageHeight || pageDims.height || ph);
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

  const openPreview = async () => {
    if (!pdfBytes) return;
    setShowPreview(true);
    setPreviewLoading(true);
    setPreviewPages([]);
    try {
      const out = await buildEditedPdfBytes();
      setPreviewBytes(out);
      const doc = await pdfjsLib.getDocument({ data: (out as Uint8Array).slice(0) }).promise;
      const built: { page: number; img: string; width: number; height: number }[] = [];
      const RENDER_SCALE = 1.4;
      for (let i = 0; i < doc.numPages; i++) {
        const page = await doc.getPage(i + 1);
        const viewport = page.getViewport({ scale: RENDER_SCALE });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        built.push({
          page: i,
          img: canvas.toDataURL("image/png"),
          width: viewport.width,
          height: viewport.height,
        });
      }
      setPreviewPages(built);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar pré-visualização");
    } finally {
      setPreviewLoading(false);
    }
  };

  const downloadPreviewPDF = () => {
    if (!previewBytes) return;
    const blob = new Blob([previewBytes as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = pdfName.replace(/\.pdf$/i, "") + "-editado.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast.success("PDF baixado");
  };

  const openCompare = async () => {
    if (!pdfBytes) return;
    setCompareLoading(true);
    setShowCompare(true);
    try {
      const beforeBlob = new Blob([pdfBytes.slice(0)], { type: "application/pdf" });
      const beforeUrl = URL.createObjectURL(beforeBlob);
      const out = await buildEditedPdfBytes();
      const afterBytes = out as Uint8Array;
      const afterBlob = new Blob([afterBytes as BlobPart], { type: "application/pdf" });
      const afterUrl = URL.createObjectURL(afterBlob);
      setCompareUrls({ before: beforeUrl, after: afterUrl });

      // Build per-page visual comparison for pages that have edits
      const editsByPage: Record<number, typeof extractedTexts> = {};
      Object.values(textEdits).forEach((edit) => {
        const orig = extractedTexts.find((t) => t.id === edit.extractedId);
        if (!orig) return;
        if (!editsByPage[orig.page]) editsByPage[orig.page] = [];
        editsByPage[orig.page].push(orig);
      });

      const pagesArr = Object.keys(editsByPage)
        .map((n) => parseInt(n, 10))
        .sort((a, b) => a - b);

      if (pagesArr.length === 0) {
        setComparePages([]);
        return;
      }

      const beforeDoc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
      const afterDoc = await pdfjsLib.getDocument({ data: afterBytes.slice(0) }).promise;

      const renderPageImg = async (
        doc: pdfjsLib.PDFDocumentProxy,
        pageNum: number,
        targetScale: number,
      ) => {
        const page = await doc.getPage(pageNum + 1);
        const viewport = page.getViewport({ scale: targetScale });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        return {
          dataUrl: canvas.toDataURL("image/png"),
          width: viewport.width,
          height: viewport.height,
        };
      };

      const RENDER_SCALE = 1.4;
      const built: typeof comparePages = [];
      for (const p of pagesArr) {
        const [before, after] = await Promise.all([
          renderPageImg(beforeDoc, p, RENDER_SCALE),
          renderPageImg(afterDoc, p, RENDER_SCALE),
        ]);
        // Convert overlayX/Y (which were captured at current `scale`) to RENDER_SCALE
        const ratio = RENDER_SCALE / scale;
        const editEntries = Object.values(textEdits)
          .filter((e) => e.page === p)
          .map((e) => {
            const orig = extractedTexts.find((t) => t.id === e.extractedId)!;
            return {
              id: e.extractedId,
              overlayX: orig.overlayX * ratio,
              overlayY: orig.overlayY * ratio,
              overlayWidth: Math.max(orig.overlayWidth * ratio, 8),
              overlayHeight: orig.overlayHeight * ratio,
              originalText: orig.originalText,
              newText: e.newText,
            };
          });
        built.push({
          page: p,
          width: before.width,
          height: before.height,
          beforeImg: before.dataUrl,
          afterImg: after.dataUrl,
          edits: editEntries,
        });
      }
      setComparePages(built);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar comparação");
    } finally {
      setCompareLoading(false);
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
          newText: existing?.newText ?? (isExtractedTextErased(original) ? "" : original.originalText),
        fontKeyOverride: existing?.fontKeyOverride,
        fontSizeOverride: existing?.fontSizeOverride,
        colorOverride: existing?.colorOverride,
        xOffset: existing?.xOffset,
        yOffset: existing?.yOffset,
        ...patch,
      };
      const isUnchanged =
          !isExtractedTextErased(original) &&
        merged.newText === original.originalText &&
        !merged.fontKeyOverride &&
        merged.fontSizeOverride === undefined &&
        !merged.colorOverride &&
        !merged.xOffset &&
        !merged.yOffset;
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

  const getEditBoxMetrics = (text: ExtractedText, edit?: TextEdit) => {
    const fontPx = Math.max(8, (edit?.fontSizeOverride ?? text.fontSize) * (text.overlayFontSize / text.fontSize));
    const content = edit?.newText || text.originalText || " ";
    const estimatedWidth = content.length * fontPx * 0.58;
    const eraseArea = getEraseAreaForVirtualText(text);
    const isEraseAreaText = !!eraseArea;
    const maxWidth = Math.max(24, (eraseArea?.width ?? pageDims.width - text.overlayX) - 4);
    const maxHeight = Math.max(18, (eraseArea?.height ?? pageDims.height - text.overlayY) - 4);
    const baseWidth = isEraseAreaText ? estimatedWidth + 10 : Math.max(text.overlayWidth, estimatedWidth) + 8;
    return {
      width: Math.min(maxWidth, Math.max(24, Math.min(baseWidth, 520))),
      height: Math.min(maxHeight, Math.max(18, text.overlayHeight + 6, fontPx * 1.35)),
      fontPx,
    };
  };

  const getEraseAreaForVirtualText = (text: ExtractedText) => {
    if (!text.id.startsWith(`tv-${text.page}-`)) return undefined;
    const eraseId = text.id.replace(`tv-${text.page}-`, "");
    return annotations.find(
      (ann): ann is EraseAnnotation => ann.type === "erase" && ann.page === text.page && ann.id === eraseId,
    );
  };


  const visibleAnns = annotations.filter((a) => a.page === pageIndex);

  const selectTool = (nextTool: Tool) => {
    setTool(nextTool);
    setEditingExtractedId(null);
    setHoveredEraseId(null);
    setHoveredErasedTextId(null);
    if (nextTool === "edit-text") {
      const eraseAreas = annotations.filter(
        (ann): ann is EraseAnnotation => ann.type === "erase" && ann.page === pageIndex,
      );
      const missingVirtualAreas = eraseAreas.filter(
        (ann) => !extractedTexts.some((t) => t.id === `tv-${pageIndex}-${ann.id}`),
      );
      if (missingVirtualAreas.length) {
        const virtualAreas = missingVirtualAreas.map((ann) => createVirtualTextForErase(ann));
        setExtractedTexts((prev) => [...prev, ...virtualAreas]);
        setTextEdits((prev) => {
          const next = { ...prev };
          virtualAreas.forEach((area) => {
            next[area.id] = next[area.id] ?? { extractedId: area.id, page: area.page, newText: "" };
          });
          return next;
        });
      }
      const hasReadyArea = eraseAreas.length > 0 || extractedTexts.some((t) => t.page === pageIndex && isExtractedTextErased(t));
      toast.info(
        hasReadyArea
          ? "Modo Editar Texto ativo: clique na área apagada destacada para digitar."
          : "Modo Editar Texto ativo: apague uma área com a borracha antes de digitar.",
      );
    }
  };

  const tools: { tool: Tool; icon: LucideIcon; label: string }[] = [
    { tool: "pan", icon: Hand, label: "Mover PDF" },
    { tool: "select", icon: MousePointer2, label: "Selecionar" },
    { tool: "edit-text", icon: Edit3, label: "Editar Texto" },
    { tool: "text", icon: Type, label: "Adicionar Texto" },
    { tool: "highlight", icon: Highlighter, label: "Marca-texto" },
    { tool: "rect", icon: Square, label: "Retângulo" },
    { tool: "ellipse", icon: CircleIcon, label: "Elipse" },
    { tool: "line", icon: Minus, label: "Linha" },
    { tool: "erase", icon: Eraser, label: "Borracha / Apagar texto" },
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
            Adicione textos com diferentes fontes, marque, apague trechos e
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
    <div
      ref={editorRootRef}
      className={cn(
        "space-y-4",
        isFullscreen && "bg-background p-4 overflow-auto h-screen w-screen"
      )}
    >
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
          <Button variant="outline" size="sm" onClick={toggleFullscreen} className="gap-2" title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}>
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            {isFullscreen ? "Sair tela cheia" : "Tela cheia"}
          </Button>
          <Button variant="outline" size="sm" onClick={openPreview} className="gap-2">
            <Eye className="w-4 h-4" /> Pré-visualizar
          </Button>
          <Button variant="glow" size="sm" onClick={exportPDF} disabled={exporting} className="gap-2">
            <Download className="w-4 h-4" />
            {exporting ? "Salvando..." : "Baixar PDF"}
          </Button>
        </div>
      </div>

      <div className={cn("grid grid-cols-1 gap-4", !isFullscreen && "lg:grid-cols-[260px_1fr]")}>
        {!isFullscreen && (
          /* Toolbar */
          <div className="glass rounded-xl p-3 space-y-3 lg:sticky lg:top-2 lg:self-start">
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Ferramentas</Label>
            <TooltipProvider delayDuration={100}>
              <div className="grid grid-cols-4 gap-1.5">
                {tools.map((t) => (
                  <Tooltip key={t.tool}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => selectTool(t.tool)}
                        aria-label={t.label}
                        className={cn(
                          "aspect-square rounded-lg flex items-center justify-center transition-colors border",
                          tool === t.tool
                            ? "bg-primary/15 border-primary/50 text-primary"
                            : "bg-secondary/50 border-border hover:bg-secondary text-foreground",
                        )}
                      >
                        <t.icon className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{t.label}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
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
        )}

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
                size="sm"
                variant={tool === "pan" ? "default" : "outline"}
                className="h-8 gap-1.5"
                onClick={() => selectTool("pan")}
                title="Mover PDF"
              >
                <Hand className="w-4 h-4" />
                Mover PDF
              </Button>
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

          {(tool === "erase" || tool === "edit-text") && (() => {
            const erasedOnPage = annotations.filter(
              (ann): ann is EraseAnnotation => ann.type === "erase" && ann.page === pageIndex,
            );
            const hasErased = erasedOnPage.length > 0;
            const isTypingNow = editingExtractedId !== null;
            // Etapa atual: 1 = apagar, 2 = ativar editar texto, 3 = clicar/digitar
            const currentStep = isTypingNow ? 3 : !hasErased ? 1 : tool === "edit-text" ? 3 : 2;

            const steps = [
              {
                n: 1,
                icon: Eraser,
                title: "Passe a Borracha",
                desc: "Arraste sobre o texto para apagar.",
                done: hasErased,
              },
              {
                n: 2,
                icon: Edit3,
                title: "Ative Editar Texto",
                desc: "Clique na ferramenta Editar Texto.",
                done: hasErased && tool === "edit-text",
              },
              {
                n: 3,
                icon: Type,
                title: "Clique e digite",
                desc: "Clique na área amarela apagada e escreva.",
                done: isTypingNow,
              },
            ];

            return (
              <div className="glass rounded-xl px-3 py-2.5 border border-primary/30 flex items-center gap-2 overflow-x-auto">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary shrink-0 pr-1">
                  Guia
                </span>
                {steps.map((s, idx) => {
                  const Icon = s.icon;
                  const isActive = currentStep === s.n;
                  const isDone = s.done && currentStep !== s.n;
                  return (
                    <Fragment key={s.n}>
                      <div
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-2.5 py-1.5 border transition-all shrink-0",
                          isActive &&
                            "border-warning bg-warning/15 text-foreground shadow-[0_0_12px_-2px_hsl(var(--warning)/0.6)] animate-pulse",
                          isDone && "border-success/50 bg-success/10 text-success",
                          !isActive && !isDone && "border-border/40 text-muted-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold shrink-0",
                            isActive && "bg-warning text-warning-foreground",
                            isDone && "bg-success text-success-foreground",
                            !isActive && !isDone && "bg-muted text-muted-foreground",
                          )}
                        >
                          {isDone ? "✓" : s.n}
                        </span>
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <div className="flex flex-col leading-tight">
                          <span className="text-xs font-semibold">{s.title}</span>
                          <span className="text-[10px] opacity-80">{s.desc}</span>
                        </div>
                      </div>
                      {idx < steps.length - 1 && (
                        <span
                          className={cn(
                            "text-base shrink-0",
                            currentStep > s.n ? "text-success" : "text-muted-foreground/40",
                          )}
                        >
                          →
                        </span>
                      )}
                    </Fragment>
                  );
                })}
              </div>
            );
          })()}

          {tool === "edit-text" && (() => {
            const erasedReadyCount = annotations.filter(
              (ann): ann is EraseAnnotation => ann.type === "erase" && ann.page === pageIndex,
            ).length;
            const isTyping = editingExtractedId !== null;
            return (
              <div
                className={cn(
                  "glass rounded-xl px-3 py-2 text-xs flex items-center gap-2 border transition-colors",
                  isTyping
                    ? "border-success/60 bg-success/5 text-foreground"
                    : "border-primary/30 text-muted-foreground",
                )}
              >
                {isTyping ? (
                  <>
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
                    </span>
                    <span className="font-semibold text-success">Modo digitação ativo</span>
                    <span className="text-muted-foreground">
                      — digite o novo texto. <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Enter</kbd> confirma · <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Esc</kbd> cancela
                    </span>
                  </>
                ) : (
                  <>
                    <Edit3 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>
                      {erasedReadyCount > 0
                        ? "Clique em qualquer área apagada (destacada em amarelo) para escrever em cima com a fonte original."
                        : "Use a borracha para apagar uma área; depois clique na área apagada para digitar."}
                    </span>
                  </>
                )}
                <div className="ml-auto flex items-center gap-2">
                  {erasedReadyCount > 0 && !isTyping && (
                    <span className="bg-warning/20 text-warning border border-warning/40 px-2 py-0.5 rounded-full font-medium animate-pulse">
                      {erasedReadyCount} área(s) prontas
                    </span>
                  )}
                  {Object.keys(textEdits).length > 0 && (
                    <span className="bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">
                      {Object.keys(textEdits).length} alteração(ões)
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          {tool === "pan" && (
            <div className="glass rounded-xl px-3 py-2 text-xs text-muted-foreground flex items-center gap-2 border border-primary/30">
              <Hand className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Arraste o PDF com o mouse para mover a página sem alterar o zoom.</span>
            </div>
          )}

          {tool === "erase" && (
            <div className="glass rounded-xl px-3 py-2 text-xs text-muted-foreground flex items-center gap-2 border border-warning/30">
              <Eraser className="w-3.5 h-3.5 text-warning shrink-0" />
              <span>
                Arraste sobre o texto para apagar. Em seguida, digite o novo texto no painel — será escrito em cima com a mesma fonte do PDF.
              </span>
            </div>
          )}

          <div
            ref={scrollContainerRef}
            className={cn(
              "glass rounded-xl p-3 overflow-auto",
              isFullscreen ? "max-h-[calc(100vh-110px)]" : "max-h-[calc(100vh-260px)]"
            )}
          >
            <div className="flex justify-center min-w-max">
              <div
                className="relative shadow-xl"
                style={{
                  width: pageDims.width,
                  height: pageDims.height,
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
                  cursor: tool === "pan" ? (isPanning ? "grabbing" : "grab") : undefined,
                }}
              >
                <canvas ref={canvasRef} className="block bg-white select-none" />
                <div
                  ref={overlayRef}
                  onMouseDown={onCanvasMouseDown}
                  onMouseMove={onCanvasMouseMove}
                  onMouseUp={onCanvasMouseUp}
                  onDoubleClick={(e) => {
                    const point = getOverlayPoint(e);
                    if (!point) return;
                    // Existing erased area only: do not create/edit text in blank areas.
                    const eraseArea = findEraseAtPoint(point.x, point.y);
                    if (eraseArea) {
                      e.preventDefault();
                      e.stopPropagation();
                      if (tool !== "edit-text") setTool("edit-text");
                      const existingVirtual = extractedTexts.find(
                        (t) => t.id === `tv-${pageIndex}-${eraseArea.id}`,
                      );
                      const virtual =
                        existingVirtual ?? createVirtualTextForErase(eraseArea);
                      if (!existingVirtual) {
                        setExtractedTexts((prev) => [...prev, virtual]);
                      }
                      setTextEdits((prev) => ({
                        ...prev,
                        [virtual.id]: {
                          extractedId: virtual.id,
                          page: pageIndex,
                          newText: prev[virtual.id]?.newText ?? "",
                        },
                      }));
                      setEditingExtractedId(virtual.id);
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredEraseId(null);
                    setHoveredErasedTextId(null);
                  }}
                  className="absolute inset-0"
                  style={{
                    touchAction: tool === "pan" ? "none" : undefined,
                    userSelect: tool === "pan" ? "none" : undefined,
                    cursor:
                      tool === "pan"
                        ? isPanning ? "grabbing" : "grab"
                        : tool === "select"
                        ? "default"
                        : tool === "edit-text"
                          ? "text"
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

                  {/* Subtle highlight for erased areas — only on hover, no labels, no dashed amarelo */}
                  {tool === "edit-text" &&
                    annotations
                      .filter((ann): ann is EraseAnnotation => ann.type === "erase" && ann.page === pageIndex)
                      .map((ann) => {
                        const isHovered = hoveredEraseId === ann.id;
                        const hasText = !!Object.values(textEdits).find(
                          (te) => te.extractedId === `tv-${ann.page}-${ann.id}` && te.newText,
                        );
                        // Hide the hint completely once the user has typed something here.
                        if (hasText && !isHovered) return null;
                        return (
                          <div
                            key={`erase-hint-${ann.id}`}
                            className="absolute pointer-events-none rounded-sm transition-opacity"
                            style={{
                              left: ann.x,
                              top: ann.y,
                              width: ann.width,
                              height: ann.height,
                              border: isHovered
                                ? `1.5px solid hsl(var(--primary))`
                                : `1px dashed hsl(var(--primary) / 0.35)`,
                              background: isHovered
                                ? "hsl(var(--primary) / 0.10)"
                                : "transparent",
                            }}
                          />
                        );
                      })}

                  {/* Editable extracted text overlays */}
                  {tool === "edit-text" &&
                    extractedTexts
                      .filter((t) => t.page === pageIndex)
                      .map((t) => {
                        const isEraseAreaText = t.id.startsWith(`tv-${pageIndex}-`);
                        if (!isEraseAreaText) return null;
                        const edit = textEdits[t.id];
                        const value = edit ? edit.newText : t.originalText;
                        const changed = !!edit;
                        const isEditing = editingExtractedId === t.id;
                        const textIsErased = true;
                        const showHoverPlaceholder = textIsErased && hoveredErasedTextId === t.id && !isEditing && !value;
                        const metrics = getEditBoxMetrics(t, edit);
                        return (
                          <div
                            key={t.id}
                            onMouseDown={(e) => {
                              // Prevent the canvas-level handler from
                              // re-triggering / stealing focus while the
                              // user interacts with this editable block.
                              e.stopPropagation();
                              if (!isEditing) {
                                updateTextEdit(t.id, {
                                  newText: textEdits[t.id]?.newText ?? (textIsErased ? "" : t.originalText),
                                });
                                setEditingExtractedId(t.id);
                              }
                            }}
                            style={{
                              position: "absolute",
                              left: t.overlayX,
                              top: t.overlayY,
                              width: metrics.width,
                              height: metrics.height,
                              cursor: "text",
                            }}
                            className="group"
                          >
                            {isEditing ? (
                              <>
                                <input
                                  autoFocus
                                  value={value}
                                  placeholder="Digite o novo texto..."
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.currentTarget.focus();
                                  }}
                                  onChange={(e) => updateTextEdit(t.id, { newText: e.target.value })}
                                  onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === "Enter") setEditingExtractedId(null);
                                    if (e.key === "Escape") {
                                      resetTextEdit(t.id);
                                      setEditingExtractedId(null);
                                    }
                                  }}
                                  style={{
                                    fontSize: metrics.fontPx,
                                    lineHeight: `${metrics.height}px`,
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
                                    variant="destructive"
                                    className="h-7 px-2 text-xs gap-1"
                                    onClick={() => {
                                      updateTextEdit(t.id, { newText: "" });
                                      setEditingExtractedId(null);
                                      toast.success("Texto apagado");
                                    }}
                                    title="Apagar este trecho"
                                  >
                                    <Eraser className="w-3 h-3" /> Apagar
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
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  updateTextEdit(t.id, { newText: textEdits[t.id]?.newText ?? (textIsErased ? "" : t.originalText) });
                                  setEditingExtractedId(t.id);
                                }}
                                title={value ? `Clique para editar: "${value}"` : "Clique para digitar"}
                                className="w-full h-full text-left cursor-text overflow-visible whitespace-nowrap bg-transparent border-0"
                                style={{
                                  color: edit?.colorOverride || "black",
                                  fontSize: metrics.fontPx,
                                  lineHeight: `${metrics.height}px`,
                                  padding: "0 2px",
                                  fontFamily: getFontFamily(edit?.fontKeyOverride || t.fontName),
                                  fontWeight: edit?.fontKeyOverride?.includes("Bold") ? "bold" : "normal",
                                  fontStyle:
                                    edit?.fontKeyOverride?.includes("Oblique") || edit?.fontKeyOverride?.includes("Italic")
                                      ? "italic"
                                      : "normal",
                                }}
                              >
                                {showHoverPlaceholder ? (
                                  <span className="text-primary/70 italic">Digite aqui</span>
                                ) : (
                                  value || ""
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating footer toolbar (fullscreen) */}
      {isFullscreen && (
        <TooltipProvider delayDuration={100}>
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 glass rounded-2xl px-3 py-2 shadow-2xl border border-border/60 flex items-center gap-2 backdrop-blur-xl flex-wrap max-w-[96vw] justify-center">
            <div className="flex items-center gap-1">
              {tools.map((t) => (
                <Tooltip key={t.tool}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => selectTool(t.tool)}
                      aria-label={t.label}
                      className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center transition-colors border",
                        tool === t.tool
                          ? "bg-primary/20 border-primary/50 text-primary"
                          : "bg-secondary/40 border-border hover:bg-secondary text-foreground",
                      )}
                    >
                      <t.icon className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">{t.label}</TooltipContent>
                </Tooltip>
              ))}
            </div>
            <Separator orientation="vertical" className="h-7" />
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={undo} disabled={!history.length}>
                    <Undo2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Desfazer</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={redo} disabled={!redoStack.length}>
                    <Redo2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Refazer</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={rotatePage}>
                    <RotateCw className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Girar página</TooltipContent>
              </Tooltip>
            </div>
            <Separator orientation="vertical" className="h-7" />
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                    disabled={pageIndex === 0}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Página anterior</TooltipContent>
              </Tooltip>
              <span className="text-xs tabular-nums px-1 min-w-[3.5rem] text-center">
                {pageIndex + 1} / {numPages}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    onClick={() => setPageIndex((p) => Math.min(numPages - 1, p + 1))}
                    disabled={pageIndex >= numPages - 1}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Próxima página</TooltipContent>
              </Tooltip>
            </div>
            <Separator orientation="vertical" className="h-7" />
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}>
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Diminuir zoom</TooltipContent>
              </Tooltip>
              <span className="text-xs tabular-nums w-10 text-center">{Math.round(scale * 100)}%</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setScale((s) => Math.min(3, s + 0.2))}>
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Aumentar zoom</TooltipContent>
              </Tooltip>
            </div>
            <Separator orientation="vertical" className="h-7" />
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={openPreview}>
                    <Eye className="w-4 h-4" /> Pré-visualizar
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Ver resultado final</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="glow" className="h-9 gap-1.5" onClick={exportPDF} disabled={exporting}>
                    <Download className="w-4 h-4" />
                    {exporting ? "Salvando..." : "Baixar"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Baixar PDF editado</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={toggleFullscreen}>
                    <Minimize2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Sair da tela cheia</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </TooltipProvider>
      )}

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-6xl w-[95vw] h-[92vh] flex flex-col p-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <Eye className="w-5 h-5 text-primary" />
              Pré-visualização do PDF editado
              <span className="ml-auto flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowPreview(false)}>
                  Voltar e editar
                </Button>
                <Button
                  size="sm"
                  variant="glow"
                  onClick={downloadPreviewPDF}
                  disabled={!previewBytes || previewLoading}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" /> Baixar PDF
                </Button>
              </span>
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-1">
            Esta é a aparência final, sem marcações de edição. Confira antes de baixar.
          </p>
          <div className="flex-1 overflow-auto bg-muted/40 rounded-lg p-4">
            {previewLoading ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Gerando pré-visualização...
              </div>
            ) : previewPages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Nenhuma página para exibir.
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                {previewPages.map((p) => (
                  <div
                    key={p.page}
                    className="bg-white shadow-lg rounded-md overflow-hidden ring-1 ring-border"
                    style={{ width: p.width, maxWidth: "100%" }}
                  >
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 py-1 bg-muted/60">
                      Página {p.page + 1}
                    </div>
                    <img
                      src={p.img}
                      alt={`Pré-visualização página ${p.page + 1}`}
                      style={{ width: p.width, height: p.height, display: "block" }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showCompare}
        onOpenChange={(o) => {
          setShowCompare(o);
          if (!o) {
            if (compareUrls.before) URL.revokeObjectURL(compareUrls.before);
            if (compareUrls.after) URL.revokeObjectURL(compareUrls.after);
            setCompareUrls({});
            setComparePages([]);
          }
        }}
      >
        <DialogContent className="max-w-7xl w-[97vw] h-[92vh] flex flex-col p-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <GitCompare className="w-5 h-5 text-primary" />
              Comparar — Antes e Depois
              {Object.keys(textEdits).length > 0 && (
                <span className="ml-2 text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full">
                  {Object.keys(textEdits).length} alteração(ões)
                </span>
              )}
              <span className="ml-auto flex items-center gap-3 text-[11px] font-normal text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-destructive/30 border border-destructive/70" />
                  Original removido
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500/30 border border-emerald-500/70" />
                  Novo conteúdo
                </span>
              </span>
            </DialogTitle>
          </DialogHeader>

          {Object.keys(textEdits).length > 0 && (
            <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-1.5 max-h-28 overflow-auto shrink-0">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Lista de alterações:</p>
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
                      {edit.newText || <em className="not-italic opacity-70">(apagado)</em>}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-auto rounded-lg bg-secondary/20 border border-border p-3">
            {compareLoading && (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Gerando comparação visual…
              </div>
            )}

            {!compareLoading && comparePages.length === 0 && (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                Nenhuma alteração de texto detectada. Edite trechos no PDF para ver o destaque visual aqui.
              </div>
            )}

            {!compareLoading && comparePages.length > 0 && (
              <div className="space-y-6">
                {comparePages.map((cp) => (
                  <div key={cp.page} className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <FileText className="w-3.5 h-3.5" />
                      Página {cp.page + 1}
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                        {cp.edits.length} alteração(ões)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* ANTES */}
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-destructive flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-destructive" /> Antes
                        </p>
                        <div
                          className="relative mx-auto bg-white rounded-md shadow-md ring-1 ring-border overflow-hidden"
                          style={{ width: cp.width, maxWidth: "100%" }}
                        >
                          <img
                            src={cp.beforeImg}
                            alt={`Antes pág ${cp.page + 1}`}
                            style={{ width: cp.width, height: cp.height, display: "block" }}
                          />
                          {cp.edits.map((e) => (
                            <div
                              key={e.id}
                              title={`Original: "${e.originalText}"`}
                              className="absolute pointer-events-auto animate-pulse"
                              style={{
                                left: e.overlayX - 3,
                                top: e.overlayY - 3,
                                width: e.overlayWidth + 6,
                                height: e.overlayHeight + 6,
                                background: "hsl(0 84% 60% / 0.28)",
                                border: "2px solid hsl(0 84% 60% / 0.85)",
                                boxShadow: "0 0 0 4px hsl(0 84% 60% / 0.18)",
                                borderRadius: 3,
                              }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* DEPOIS */}
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-500 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Depois
                        </p>
                        <div
                          className="relative mx-auto bg-white rounded-md shadow-md ring-1 ring-emerald-500/40 overflow-hidden"
                          style={{ width: cp.width, maxWidth: "100%" }}
                        >
                          <img
                            src={cp.afterImg}
                            alt={`Depois pág ${cp.page + 1}`}
                            style={{ width: cp.width, height: cp.height, display: "block" }}
                          />
                          {cp.edits.map((e) => (
                            <div
                              key={e.id}
                              title={`Novo: "${e.newText || "(apagado)"}"`}
                              className="absolute pointer-events-auto"
                              style={{
                                left: e.overlayX - 3,
                                top: e.overlayY - 3,
                                width: e.overlayWidth + 6,
                                height: e.overlayHeight + 6,
                                background: "hsl(142 71% 45% / 0.22)",
                                border: "2px solid hsl(142 71% 45% / 0.9)",
                                boxShadow: "0 0 0 4px hsl(142 71% 45% / 0.15)",
                                borderRadius: 3,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              e.currentTarget.focus();
            }}
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
          border: selectable ? "1px dashed rgba(0,0,0,0.2)" : "none",
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
