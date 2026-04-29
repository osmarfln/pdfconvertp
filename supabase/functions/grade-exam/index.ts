import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUBJECT_INSTRUCTIONS: Record<string, string> = {
  portugues: "Avalie ortografia, gramática, concordância, pontuação, coesão e coerência. Para questões dissertativas, dê nota parcial (0-100% por questão). Indique todos os erros encontrados na resposta do aluno.",
  matematica: "Resolva cada questão matemática passo a passo. Compare com a resposta do aluno. Aceite respostas equivalentes (frações, decimais, formas algébricas equivalentes). Mostre o cálculo correto.",
  calculo: "Resolva derivadas, integrais, limites e equações diferenciais. Compare com a resposta do aluno e aceite formas equivalentes. Mostre o desenvolvimento.",
  geral: "Avalie cada questão de acordo com o conteúdo e dê o gabarito correto.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imagesBase64, mimeTypes, subject = "geral", studentName, examTitle } = await req.json();

    if (!Array.isArray(imagesBase64) || imagesBase64.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma página fornecida" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
        text: `Corrija esta prova${examTitle ? ` (${examTitle})` : ""}${studentName ? ` do aluno ${studentName}` : ""}. ${imagesBase64.length} página(s) anexada(s).`,
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
              exam_title: { type: "string", description: "Título identificado da prova" },
              subject: { type: "string" },
              total_questions: { type: "number" },
              questions: {
                type: "array",
                items: {
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
                  required: ["number", "question_text", "student_answer", "correct_answer", "is_correct", "points_earned", "max_points", "feedback"],
                  additionalProperties: false,
                },
              },
              total_score: { type: "number", description: "Soma de pontos (0-100)" },
              grade: { type: "number", description: "Nota final (0-10)" },
              correct_count: { type: "number" },
              incorrect_count: { type: "number" },
              partial_count: { type: "number" },
              overall_feedback: { type: "string", description: "Feedback geral para o aluno" },
            },
            required: ["subject", "total_questions", "questions", "total_score", "grade", "correct_count", "incorrect_count", "partial_count", "overall_feedback"],
            additionalProperties: false,
          },
        },
      },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "grade_exam" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Configurações > Workspace > Uso." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      throw new Error("Erro no gateway de IA");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("IA não retornou correção estruturada");
    }

    const grading = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, grading }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("grade-exam error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
