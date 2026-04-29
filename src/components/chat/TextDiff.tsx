import { useMemo, useState } from "react";

// Word-level LCS diff
function diffWords(a: string, b: string) {
  const A = a.split(/(\s+)/);
  const B = b.split(/(\s+)/);
  const n = A.length, m = B.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: { type: "eq" | "del" | "ins"; text: string }[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ type: "eq", text: A[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: "del", text: A[i] }); i++; }
    else { out.push({ type: "ins", text: B[j] }); j++; }
  }
  while (i < n) { out.push({ type: "del", text: A[i++] }); }
  while (j < m) { out.push({ type: "ins", text: B[j++] }); }
  return out;
}

function splitParagraphs(t: string): string[] {
  return t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

// Map paragraphs of original to corrected via LCS on paragraph identity (best-effort by index)
function alignParagraphs(orig: string[], corr: string[]) {
  const max = Math.max(orig.length, corr.length);
  const pairs: { o: string; c: string }[] = [];
  for (let k = 0; k < max; k++) {
    pairs.push({ o: orig[k] ?? "", c: corr[k] ?? "" });
  }
  return pairs;
}

interface Props {
  original: string;
  corrected: string;
}

export function TextDiff({ original, corrected }: Props) {
  const pairs = useMemo(
    () => alignParagraphs(splitParagraphs(original), splitParagraphs(corrected)),
    [original, corrected]
  );
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const stats = useMemo(() => {
    let added = 0, removed = 0, changedParas = 0;
    pairs.forEach(({ o, c }) => {
      if (o !== c) changedParas++;
      const d = diffWords(o, c);
      d.forEach((p) => {
        if (p.type === "ins" && p.text.trim()) added++;
        if (p.type === "del" && p.text.trim()) removed++;
      });
    });
    return { added, removed, changedParas };
  }, [pairs]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="text-success">+ {stats.added} adicionadas</span>
        <span className="text-destructive">− {stats.removed} removidas</span>
        <span className="text-muted-foreground">{stats.changedParas} parágrafo(s) alterado(s)</span>
      </div>
      <div className="space-y-2">
        {pairs.map((pair, idx) => {
          const isChanged = pair.o !== pair.c;
          const isOpen = openIdx === idx;
          const wordParts = isOpen ? diffWords(pair.o, pair.c) : [];
          return (
            <div
              key={idx}
              className={`rounded-lg border text-sm overflow-hidden transition-colors ${
                isChanged
                  ? "bg-warning/5 border-warning/40 hover:border-warning/70 cursor-pointer"
                  : "bg-background/40 border-border/40"
              }`}
              onClick={() => isChanged && setOpenIdx(isOpen ? null : idx)}
              role={isChanged ? "button" : undefined}
              title={isChanged ? "Clique para revisar as mudanças" : undefined}
            >
              <div className="flex items-center justify-between px-2.5 py-1 border-b border-border/40 bg-background/30">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Parágrafo {idx + 1}
                </span>
                {isChanged && (
                  <span className="text-[10px] text-warning font-medium">
                    {isOpen ? "− ocultar" : "✏️ ver mudanças"}
                  </span>
                )}
              </div>

              {!isOpen ? (
                <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border/40">
                  <div className="p-2.5 whitespace-pre-wrap break-words">
                    <div className="text-[10px] text-muted-foreground mb-1">Antes</div>
                    {pair.o || <span className="text-muted-foreground italic">—</span>}
                  </div>
                  <div className="p-2.5 whitespace-pre-wrap break-words">
                    <div className="text-[10px] text-muted-foreground mb-1">Depois</div>
                    {pair.c || <span className="text-muted-foreground italic">—</span>}
                  </div>
                </div>
              ) : (
                <div className="p-2.5 leading-relaxed whitespace-pre-wrap break-words">
                  {wordParts.map((p, i2) => {
                    if (p.type === "eq") return <span key={i2}>{p.text}</span>;
                    if (p.type === "del")
                      return (
                        <span key={i2} className="bg-destructive/20 text-destructive line-through rounded px-0.5">
                          {p.text}
                        </span>
                      );
                    return (
                      <span key={i2} className="bg-success/20 text-success rounded px-0.5">
                        {p.text}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
