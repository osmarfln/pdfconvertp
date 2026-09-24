import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUBJECT_INSTRUCTIONS: Record<string, string> = {
  portugues:
    "Avalie ortografia, gramática, concordância, pontuação, coesão e coerência. Para questões dissertativas, dê nota parcial (0-100% por questão). Indique todos os erros encontrados na resposta do aluno.",
  matematica:
    "Resolva cada questão matemática passo a passo. Compare com a resposta do aluno. Aceite respostas equivalentes (frações, decimais, formas algébricas equivalentes). Mostre o cálculo correto.",
  calculo:
    "Resolva derivadas, integrais, limites e equações diferenciais. Compare com a resposta do aluno e aceite formas equivalentes. Mostre o desenvolvimento.",
  geral: "Avalie cada questão de acordo com o conteúdo e dê o gabarito correto.",
};

const QUESTION_SCHEMA = {
  type: "object",
  properties: {
    number: { type: "number" },
    question_text: { type: "string", description: "Enunciado resumido" },
    student_answer: { type: "string" },
    correct_answer: { type: "string" },
    is_correct: { type: "string", enum: ["correct", "partial", "incorrect", "blank"] },
    points_earned: { type: "number" },
    max_points: { type: "number" },
    feedback: { type: "string" },
  },
  required: [
    "number",
    "question_text",
    "student_answer",
    "correct_answer",
    "is_correct",
    "points_earned",
    "max_points",
    "feedback",
  ],
  additionalProperties: false,
};

function aiHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function callAI(body: Record<string, unknown>, apiKey: string) {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: aiHeaders(apiKey),
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    if (resp.status === 429) throw Object.assign(new Error("Limite de requisições excedido. Tente novamente em alguns instantes."), { status: 429 });
    if (resp.status === 402) throw Object.assign(new Error("Créditos de IA esgotados. Adicione créditos em Configurações > Workspace > Uso."), { status: 402 });
    const errText = await resp.text();
    console.error("AI error:", resp.status, errText);
    throw new Error("Erro no gateway de IA");
  }
  return resp.json();
}

function gradeFromQuestions(rawQuestions: any[], subject: string, examTitle?: string) {
  const questions = (rawQuestions || []).map((q, i) => ({
    number: typeof q.number === "number" ? q.number : i + 1,
    question_text: String(q.question_text ?? ""),
    student_answer: String(q.student_answer ?? ""),
    correct_answer: String(q.correct_answer ?? ""),
    is_correct: q.is_correct ?? "blank",
    points_earned: Number(q.points_earned) || 0,
    max_points: Number(q.max_points) || 0,
    feedback: String(q.feedback ?? ""),
  }));

  // Renumber sequentially to avoid duplicates across pages
  questions.forEach((q, i) => (q.number = i + 1));

  const totalMax = questions.reduce((s, q) => s + (q.max_points || 0), 0) || 100;
  // Normalize so total max = 100
  const factor = totalMax === 100 ? 1 : 100 / totalMax;
  questions.forEach((q) => {
    q.max_points = q.max_points * factor;
    q.points_earned = q.points_earned * factor;
  });

  const total_score = questions.reduce((s, q) => s + (q.points_earned || 0), 0);
  const grade = Math.max(0, Math.min(10, total_score / 10));
  const correct_count = questions.filter((q) => q.is_correct === "correct").length;
  const partial_count = questions.filter((q) => q.is_correct === "partial").length;
  const incorrect_count = questions.filter((q) => q.is_correct === "incorrect").length;

  return {
    exam_title: examTitle,
    subject,
    total_questions: questions.length,
    questions,
    total_score,
    grade,
    correct_count,
    partial_count,
    incorrect_count,
    overall_feedback: "",
  };
}

async function gradeSinglePage(
  pageBase64: string,
  mime: string,
  pageIndex: number,
  totalPages: number,
  subject: string,
  apiKey: string,
) {
  const subjectDesc = SUBJECT_INSTRUCTIONS[subject] || SUBJECT_INSTRUCTIONS.geral;
  const systemPrompt = `Você é um professor especialista em corrigir provas escolares e acadêmicas em português brasileiro.
Disciplina: ${subject.toUpperCase()}.
${subjectDesc}

Você recebe UMA página da prova (página ${pageIndex + 1} de ${totalPages}).
Tarefa para esta página:
1. Identificar todas as questões visíveis nesta página (numeradas).
2. Extrair a resposta do aluno (mesmo se manuscrita).
3. Determinar a resposta correta.
4. Atribuir pontos por questão (max_points = peso da questão; total da prova será normalizado depois).
5. Dar feedback objetivo.

Use a função grade_page para retornar as questões desta página. Se a página não tiver questões (capa, rodapé), retorne um array vazio.`;

  const tools = [
    {
      type: "function",
      function: {
        name: "grade_page",
        description: "Retorna as questões corrigidas extraídas desta página",
        parameters: {
          type: "object",
          properties: {
            questions: { type: "array", items: QUESTION_SCHEMA },
          },
          required: ["questions"],
          additionalProperties: false,
        },
      },
    },
  ];

  const result = await callAI(
    {
      model: "openai/gpt-5-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: `Corrija as questões desta página (${pageIndex + 1}/${totalPages}).` },
            { type: "image_url", image_url: { url: `data:${mime};base64,${pageBase64}` } },
          ],
        },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "grade_page" } },
    },
    apiKey,
  );

  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) return [];
  try {
    const parsed = JSON.parse(toolCall.function.arguments);
    return Array.isArray(parsed.questions) ? parsed.questions : [];
  } catch (e) {
    console.error("Parse page result error:", e);
    return [];
  }
}

async function generateOverallFeedback(grading: any, subject: string, apiKey: string): Promise<string> {
  try {
    const summary = grading.questions
      .map((q: any) => `${q.number}. ${q.is_correct.toUpperCase()} (${q.points_earned.toFixed(1)}/${q.max_points.toFixed(1)})`)
      .join("\n");
    const result = await callAI(
      {
        model: "openai/gpt-5-mini",
        messages: [
          {
            role: "system",
            content: `Você é um professor de ${subject}. Escreva um comentário geral construtivo (3-5 frases) para o aluno com base no desempenho. Português BR.`,
          },
          {
            role: "user",
            content: `Nota: ${grading.grade.toFixed(1)}/10\nAcertos: ${grading.correct_count}\nParciais: ${grading.partial_count}\nErros: ${grading.incorrect_count}\n\nDetalhes:\n${summary}`,
          },
        ],
      },
      apiKey,
    );
    return result.choices?.[0]?.message?.content?.trim() || "";
  } catch (e) {
    console.error("Overall feedback error:", e);
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { imagesBase64, mimeTypes, subject = "geral", studentName, examTitle, stream = false } = body;

    if (!Array.isArray(imagesBase64) || imagesBase64.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma página fornecida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    // ===== Streaming SSE mode: page-by-page =====
    if (stream) {
      const encoder = new TextEncoder();
      const sse = new ReadableStream({
        async start(controller) {
          const send = (event: string, data: Record<string, unknown>) => {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          };

          const overallStart = Date.now();
          const allQuestions: any[] = [];
          const pageDurations: number[] = [];

          try {
            send("start", { totalPages: imagesBase64.length, startedAt: overallStart });

            for (let i = 0; i < imagesBase64.length; i++) {
              const pageStart = Date.now();
              send("page_start", { index: i, total: imagesBase64.length, startedAt: pageStart });

              const mime = (mimeTypes && mimeTypes[i]) || "image/png";
              try {
                const pageQuestions = await gradeSinglePage(
                  imagesBase64[i],
                  mime,
                  i,
                  imagesBase64.length,
                  subject,
                  OPENAI_API_KEY,
                );
                allQuestions.push(...pageQuestions);
                const dur = Date.now() - pageStart;
                pageDurations.push(dur);
                send("page_done", {
                  index: i,
                  total: imagesBase64.length,
                  durationMs: dur,
                  questionsFound: pageQuestions.length,
                  questionsTotal: allQuestions.length,
                });
              } catch (pageErr: any) {
                const dur = Date.now() - pageStart;
                pageDurations.push(dur);
                send("page_error", { index: i, error: pageErr?.message || "Erro na página", durationMs: dur });
              }
            }

            send("aggregating", { totalQuestions: allQuestions.length });
            const grading = gradeFromQuestions(allQuestions, subject, examTitle);
            send("overall_feedback_start", {});
            grading.overall_feedback = await generateOverallFeedback(grading, subject, OPENAI_API_KEY);

            send("done", {
              grading,
              totalDurationMs: Date.now() - overallStart,
              pageDurations,
            });
          } catch (e: any) {
            console.error("Stream error:", e);
            send("error", { error: e?.message || "Erro desconhecido" });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(sse, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // ===== Legacy non-streaming mode (single AI call) =====
    const subjectDesc = SUBJECT_INSTRUCTIONS[subject] || SUBJECT_INSTRUCTIONS.geral;

    const systemPrompt = `Você é um professor especialista em corrigir provas escolares e acadêmicas em português brasileiro.
Disciplina: ${subject.toUpperCase()}.
${subjectDesc}

Sua tarefa:
1. Identificar TODAS as questões da prova (numeradas).
2. Extrair a resposta do aluno para cada questão (mesmo se rabiscada/manuscrita).
3. Determinar a resposta correta (gabarito).
4. Avaliar se cada resposta está: certa, errada, ou parcialmente correta.
5. Atribuir pontos (0 a max_points) por questão. Soma de todas = 100 pontos totais.
6. Calcular nota final na escala 0–10.
7. Dar feedback objetivo por questão.

Use a função grade_exam para retornar o resultado estruturado. NÃO escreva texto fora da função.`;

    const userContent: any[] = [
      {
        type: "text",
        text: `Corrija esta prova${examTitle ? ` (${examTitle})` : ""}${
          studentName ? ` do aluno ${studentName}` : ""
        }. ${imagesBase64.length} página(s) anexada(s).`,
      },
      ...imagesBase64.map((b64: string, i: number) => ({
        type: "image_url",
        image_url: { url: `data:${(mimeTypes && mimeTypes[i]) || "image/png"};base64,${b64}` },
      })),
    ];

    const tools = [
      {
        type: "function",
        function: {
          name: "grade_exam",
          description: "Retorna a correção estruturada da prova",
          parameters: {
            type: "object",
            properties: {
              exam_title: { type: "string" },
              subject: { type: "string" },
              total_questions: { type: "number" },
              questions: { type: "array", items: QUESTION_SCHEMA },
              total_score: { type: "number" },
              grade: { type: "number" },
              correct_count: { type: "number" },
              incorrect_count: { type: "number" },
              partial_count: { type: "number" },
              overall_feedback: { type: "string" },
            },
            required: [
              "subject",
              "total_questions",
              "questions",
              "total_score",
              "grade",
              "correct_count",
              "incorrect_count",
              "partial_count",
              "overall_feedback",
            ],
            additionalProperties: false,
          },
        },
      },
    ];

    const result = await callAI(
      {
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "grade_exam" } },
      },
      OPENAI_API_KEY,
    );

    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("IA não retornou correção estruturada");
    }
    const grading = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, grading }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("grade-exam error:", e);
    const status = e?.status || 500;
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
