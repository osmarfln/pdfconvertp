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

  // Render current page
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
      setHistory([]);
      setRedoStack([]);
      toast.success("PDF carregado");
    };
    reader.readAsArrayBuffer(file);
  };

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (!pdfDoc || tool === "select") return;
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
        text: "Texto",
        fontSize,
        fontKey,
        color,
        opacity,
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

  const exportPDF = async () => {
    if (!pdfBytes) return;
    setExporting(true);
    try {
      const doc = await PDFDocument.load(pdfBytes.slice(0));
      const fontCache = new Map<FontKey, any>();
      const getFont = async (k: FontKey) => {
        if (fontCache.has(k)) return fontCache.get(k);
        const opt = FONT_OPTIONS.find((f) => f.key === k)!;
        const f = await doc.embedFont(opt.standard);
        fontCache.set(k, f);
        return f;
      };

      const pages = doc.getPages();

      // Apply rotations
      for (const [pIdx, rot] of Object.entries(pageRotation)) {
        const idx = parseInt(pIdx, 10);
        if (pages[idx]) {
          const current = pages[idx].getRotation().angle;
          pages[idx].setRotation(degrees((current + rot) % 360));
        }
      }

      for (const ann of annotations) {
        const page = pages[ann.page];
        if (!page) continue;
        const { width: pw, height: ph } = page.getSize();
        // The pdfjs canvas was scaled; convert overlay coords (px) to PDF points
        const sx = pw / pageDims.width;
        const sy = ph / pageDims.height;
        const c = hexToRgb01(ann.color || "#000000");

        if (ann.type === "text") {
          const font = await getFont(ann.fontKey);
          // y in pdf = ph - y (overlay) - fontSize
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

      const out = await doc.save();
      const blob = new Blob([out as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = pdfName.replace(/\.pdf$/i, "") + "-editado.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast.success("PDF exportado");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao exportar PDF");
    } finally {
      setExporting(false);
    }
  };

  const visibleAnns = annotations.filter((a) => a.page === pageIndex);

  const tools: { tool: Tool; icon: any; label: string }[] = [
    { tool: "select", icon: MousePointer2, label: "Selecionar" },
    { tool: "text", icon: Type, label: "Texto" },
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
          <Button variant="glow" size="sm" onClick={exportPDF} disabled={exporting} className="gap-2">
            <Download className="w-4 h-4" />
            {exporting ? "Exportando..." : "Baixar PDF"}
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
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
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
