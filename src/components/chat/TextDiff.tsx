import { useMemo } from "react";

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

interface Props {
  original: string;
  corrected: string;
}

export function TextDiff({ original, corrected }: Props) {
  const parts = useMemo(() => diffWords(original, corrected), [original, corrected]);
  const stats = useMemo(() => {
    let added = 0, removed = 0;
    parts.forEach(p => {
      if (p.type === "ins" && p.text.trim()) added++;
      if (p.type === "del" && p.text.trim()) removed++;
    });
    return { added, removed };
  }, [parts]);

  return (
    <div className="space-y-2">
      <div className="flex gap-3 text-xs">
        <span className="text-success">+ {stats.added} adicionadas</span>
        <span className="text-destructive">− {stats.removed} removidas</span>
      </div>
      <div className="rounded-lg bg-background/40 border border-border/60 p-3 text-sm leading-relaxed whitespace-pre-wrap break-words">
        {parts.map((p, idx) => {
          if (p.type === "eq") return <span key={idx}>{p.text}</span>;
          if (p.type === "del") return <span key={idx} className="bg-destructive/20 text-destructive line-through rounded px-0.5">{p.text}</span>;
          return <span key={idx} className="bg-success/20 text-success rounded px-0.5">{p.text}</span>;
        })}
      </div>
    </div>
  );
}
