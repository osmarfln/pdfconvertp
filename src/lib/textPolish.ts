/**
 * Normaliza texto da UI corrigindo erros comuns de pontuação e espaçamento.
 * Foco em PT-BR. Não altera semântica — apenas formatação tipográfica.
 *
 * Regras aplicadas:
 *  - Remove espaços antes de , . ; : ! ? )
 *  - Garante 1 espaço após , . ; : ! ?  (quando seguido de letra)
 *  - Colapsa múltiplos espaços em um
 *  - Normaliza " - " entre palavras para travessão " — "
 *  - Remove vírgulas/duplicadas (",,", " ,") e espaços antes de travessão duplicado
 *  - Trim das pontas
 */
export function polishText(input: string): string {
  if (!input) return input;
  let s = String(input);

  // Espaços invisíveis
  s = s.replace(/\u00A0/g, " ");

  // Vírgulas/pontos duplicados
  s = s.replace(/,{2,}/g, ",").replace(/\.{4,}/g, "...");

  // Remove espaço antes de pontuação
  s = s.replace(/\s+([,.;:!?\)])/g, "$1");

  // Garante espaço depois de pontuação (se vier letra/dígito)
  s = s.replace(/([,.;:!?])([^\s\d.,;:!?\)\]\}"'’”])/g, "$1 $2");

  // Hífen cercado por espaços vira travessão tipográfico
  s = s.replace(/\s-\s/g, " — ");

  // Travessão duplicado
  s = s.replace(/—\s*—/g, "—");

  // Colapsa espaços
  s = s.replace(/[ \t]{2,}/g, " ");

  // Espaço antes de travessão final ".  —" -> ". —"
  s = s.replace(/\s+—/g, " —").replace(/—\s+/g, "— ");

  return s.trim();
}
