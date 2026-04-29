import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Loader2, XCircle, Circle, Clock, Gauge } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export type ConversionStage = "idle" | "preparing" | "uploading" | "processing" | "downloading" | "completed" | "error";

export interface ConversionProgressState {
  open: boolean;
  title: string;
  fileName?: string;
  stage: ConversionStage;
  progress: number; // 0-100
  message?: string;
  error?: string;
  startedAt?: number; // ms timestamp
  pages?: number;     // total pages (real if available)
  pagesSource?: "real" | "estimated";
  // Real per-stage durations (ms) — keyed by stage name; only set as each stage finishes
  stageDurations?: Partial<Record<ConversionStage, number>>;
  // Timestamp when current stage started (used to derive live durations)
  stageStartedAt?: number;
}

const STAGES: { key: ConversionStage; label: string; range: [number, number] }[] = [
  { key: "preparing", label: "Preparando arquivo", range: [0, 15] },
  { key: "uploading", label: "Enviando para o servidor", range: [15, 35] },
  { key: "processing", label: "Convertendo documento", range: [35, 85] },
  { key: "downloading", label: "Finalizando e salvando", range: [85, 100] },
];

function stageIndex(s: ConversionStage) {
  return STAGES.findIndex((x) => x.key === s);
}

function formatTime(secs: number) {
  if (!isFinite(secs) || secs <= 0) return "—";
  if (secs < 60) return `${Math.ceil(secs)}s`;
  const m = Math.floor(secs / 60);
  const s = Math.ceil(secs % 60);
  return `${m}m ${s}s`;
}

interface Props {
  state: ConversionProgressState;
  onClose: () => void;
}

export function ConversionProgressDialog({ state, onClose }: Props) {
  const isError = state.stage === "error";
  const isDone = state.stage === "completed";
  const activeIdx = stageIndex(state.stage);

  // Tick every 500ms to refresh ETA/speed
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!state.open || isDone || isError) return;
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, [state.open, isDone, isError]);

  // Compute ETA + speed using REAL backend timings when possible
  const elapsed = state.startedAt ? (Date.now() - state.startedAt) / 1000 : 0;
  const stageDurations = state.stageDurations || {};
  const realProcessingMs = stageDurations.processing;
  const realUploadingMs = stageDurations.uploading;
  const realPreparingMs = stageDurations.preparing;
  const stageElapsedSec = state.stageStartedAt ? (Date.now() - state.stageStartedAt) / 1000 : 0;

  // Prefer ETA derived from completed real stages + current stage live elapsed
  const completedRealMs =
    (realPreparingMs || 0) + (realUploadingMs || 0) + (realProcessingMs || 0) + (stageDurations.downloading || 0);
  const progressFrac = Math.max(0.01, state.progress / 100);
  let remaining: number;
  if (completedRealMs > 0 && progressFrac > 0.05) {
    const totalEstimatedSec = (completedRealMs / 1000) / progressFrac;
    remaining = Math.max(0, totalEstimatedSec - elapsed);
  } else {
    const totalEstimated = elapsed > 0 && progressFrac > 0.02 ? elapsed / progressFrac : 0;
    remaining = Math.max(0, totalEstimated - elapsed);
  }

  // Pages/sec: use the processing-stage real duration if completed; otherwise
  // derive from current stage if we're processing.
  let pagesPerSec = 0;
  if (state.pages) {
    if (realProcessingMs && realProcessingMs > 0) {
      pagesPerSec = state.pages / (realProcessingMs / 1000);
    } else if (state.stage === "processing" && stageElapsedSec > 0) {
      const pagesDone = state.pages * Math.min(1, (state.progress - 35) / 50);
      if (pagesDone > 0) pagesPerSec = pagesDone / stageElapsedSec;
    }
  }

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && (isDone || isError) && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{state.title}</DialogTitle>
          {state.fileName && (
            <DialogDescription className="truncate">{state.fileName}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                {isError ? "Falhou" : isDone ? "Concluído" : state.message || "Processando..."}
              </span>
              <span className="text-sm font-medium text-foreground">{Math.round(state.progress)}%</span>
            </div>
            <Progress value={state.progress} className={isError ? "[&>div]:bg-destructive" : isDone ? "[&>div]:bg-success" : ""} />
            {!isError && !isDone && state.startedAt && (
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Restante: <span className="text-foreground font-medium">{formatTime(remaining)}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5" />
                  {state.pages
                    ? <>
                        <span className="text-foreground font-medium">{pagesPerSec > 0 ? pagesPerSec.toFixed(1) : "—"} pág/s</span>
                        <span className="text-muted-foreground/70">
                          ({state.pages} pág{state.pagesSource === "estimated" ? " ~" : ""})
                        </span>
                      </>
                    : <>Decorrido: <span className="text-foreground font-medium">{formatTime(elapsed)}</span></>}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {STAGES.map((s, i) => {
              const done = !isError && (isDone || i < activeIdx);
              const active = !isError && !isDone && i === activeIdx;
              const failed = isError && i === activeIdx;
              return (
                <motion.div
                  key={s.key}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 text-sm"
                >
                  {failed ? (
                    <XCircle className="w-4 h-4 text-destructive shrink-0" />
                  ) : done ? (
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  ) : active ? (
                    <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                  )}
                  <span className={
                    failed ? "text-destructive" :
                    done ? "text-foreground" :
                    active ? "text-foreground font-medium" :
                    "text-muted-foreground"
                  }>
                    {s.label}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {isError && state.error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
              {state.error}
            </div>
          )}

          {isDone && (
            <div className="rounded-lg bg-success/10 border border-success/30 p-3 text-sm text-success">
              Conversão concluída! Acesse "Meus Arquivos" para baixar.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const initialProgressState: ConversionProgressState = {
  open: false,
  title: "",
  stage: "idle",
  progress: 0,
};

export { STAGES };
