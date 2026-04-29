import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Loader2, XCircle, Circle } from "lucide-react";
import { motion } from "framer-motion";

export type ConversionStage = "idle" | "preparing" | "uploading" | "processing" | "downloading" | "completed" | "error";

export interface ConversionProgressState {
  open: boolean;
  title: string;
  fileName?: string;
  stage: ConversionStage;
  progress: number; // 0-100
  message?: string;
  error?: string;
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

interface Props {
  state: ConversionProgressState;
  onClose: () => void;
}

export function ConversionProgressDialog({ state, onClose }: Props) {
  const isError = state.stage === "error";
  const isDone = state.stage === "completed";
  const activeIdx = stageIndex(state.stage);

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
