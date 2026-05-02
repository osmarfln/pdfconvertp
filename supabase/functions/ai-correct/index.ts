import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function processOcrInBackground(jobId: string, imageBase64: string, ocrMime: string, apiKey: string) {
  const supabaseAdmin = getSupabaseAdmin();
  
  try {
    await supabaseAdmin.from("extraction_jobs").update({ status: "processing" }).eq("id", jobId);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extraia todo o texto desta imagem/documento. Retorne apenas o texto extraído, preservando a estrutura e formatação original (parágrafos, listas, etc). Se não houver texto, responda 'Nenhum texto encontrado.'",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${ocrMime};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OCR error:", response.status, errText);
      await supabaseAdmin.from("extraction_jobs").update({ 
        status: "failed", 
        error_message: response.status === 429 ? "Limite de requisições excedido." : response.status === 402 ? "Créditos de IA esgotados." : "Erro no OCR" 
      }).eq("id", jobId);
      return;
    }

    const result = await response.json();
    const extractedText = result.choices?.[0]?.message?.content || "";

    await supabaseAdmin.from("extraction_jobs").update({ 
      status: "completed", 
      extracted_text: extractedText 
    }).eq("id", jobId);
  } catch (error) {
    console.error("Background OCR error:", error);
    await supabaseAdmin.from("extraction_jobs").update({ 
      status: "failed", 
      error_message: error instanceof Error ? error.message : "Erro desconhecido" 
    }).eq("id", jobId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, text, tone, imageBase64, mimeType, jobId } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (action === "correct") {
      if (!text || !text.trim()) {
        return new Response(JSON.stringify({ error: "Texto vazio" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const toneMap: Record<string, string> = {
        profissional: "tom profissional e formal, adequado para ambientes corporativos",
        academico: "tom acadêmico e científico, seguindo normas ABNT",
        juridico: "tom jurídico formal, com terminologia legal precisa",
        simples: "tom simples, claro e direto, fácil de entender",
      };

      const toneDesc = toneMap[tone] || toneMap["profissional"];

      const systemPrompt = `Você é um especialista em revisão e correção de textos em português brasileiro. 
Sua tarefa é:
1. Corrigir todos os erros de ortografia, gramática e pontuação
2. Melhorar a clareza e coesão do texto
3. Reescrever usando ${toneDesc}
4. Manter o significado original do texto

Responda APENAS com o texto corrigido, sem explicações adicionais.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-5-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text },
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errText = await response.text();
        console.error("AI gateway error:", response.status, errText);
        throw new Error("Erro no gateway de IA");
      }

      const result = await response.json();
      const correctedText = result.choices?.[0]?.message?.content || "";

      return new Response(JSON.stringify({ success: true, correctedText }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "detect") {
      if (!text || !text.trim()) {
        return new Response(JSON.stringify({ error: "Texto vazio" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const systemPrompt = `Você é um revisor profissional de textos em português brasileiro (pareceres jurídicos, acadêmicos, profissionais).
Analise o texto do usuário e identifique TODOS os erros: ortografia, gramática, pontuação, concordância, regência, coesão e estilo.
Para CADA erro encontrado, retorne:
- snippet: o trecho EXATO com erro (copie literalmente do texto, máx 80 caracteres)
- type: tipo do erro ("ortografia" | "gramática" | "pontuação" | "concordância" | "estilo")
- suggestion: como deveria ser escrito corretamente
Use a função report_errors. Se não houver erros, retorne lista vazia.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text },
          ],
          tools: [{
            type: "function",
            function: {
              name: "report_errors",
              description: "Reporta os erros encontrados no texto",
              parameters: {
                type: "object",
                properties: {
                  errors: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        snippet: { type: "string" },
                        type: { type: "string" },
                        suggestion: { type: "string" },
                      },
                      required: ["snippet", "type", "suggestion"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["errors"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "report_errors" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const errText = await response.text();
        console.error("Detect error:", response.status, errText);
        throw new Error("Erro na detecção");
      }

      const result = await response.json();
      const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
      let errors: Array<{ snippet: string; type: string; suggestion: string }> = [];
      try {
        const args = JSON.parse(toolCall?.function?.arguments || "{}");
        errors = Array.isArray(args.errors) ? args.errors : [];
      } catch (e) {
        console.error("Parse tool args failed:", e);
      }

      return new Response(JSON.stringify({ success: true, hasErrors: errors.length > 0, errors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "ocr") {
      // Synchronous OCR (legacy, still works for quick jobs)
      if (!imageBase64) {
        return new Response(JSON.stringify({ error: "Imagem não fornecida" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const ocrMime = mimeType || "image/png";

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-5-mini",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: "Extraia todo o texto desta imagem/documento. Retorne apenas o texto extraído, preservando a estrutura e formatação original (parágrafos, listas, etc). Se não houver texto, responda 'Nenhum texto encontrado.'" },
              { type: "image_url", image_url: { url: `data:${ocrMime};base64,${imageBase64}` } },
            ],
          }],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("Erro no OCR");
      }

      const result = await response.json();
      const extractedText = result.choices?.[0]?.message?.content || "";

      return new Response(JSON.stringify({ success: true, extractedText }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "ocr-background") {
      // Background OCR with job tracking
      if (!imageBase64 || !jobId) {
        return new Response(JSON.stringify({ error: "Dados insuficientes" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const ocrMime = mimeType || "image/png";

      // Start background processing
      EdgeRuntime.waitUntil(processOcrInBackground(jobId, imageBase64, ocrMime, LOVABLE_API_KEY));

      return new Response(
        JSON.stringify({ success: true, message: "Processamento iniciado", jobId }),
        { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "chat") {
      const { messages } = body;
      
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-5-mini",
          messages: [
            {
              role: "system",
              content: "Você é o assistente do PDF Convert Pro, uma plataforma de conversão e correção de documentos. Responda de forma amigável, concisa e em português brasileiro. Ajude com conversões, OCR, correção de texto e dúvidas sobre a plataforma.",
            },
            ...(messages || []),
          ],
          stream: true,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Chat error:", response.status, errText);
        return new Response(JSON.stringify({ error: "Erro no chat" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-correct error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
