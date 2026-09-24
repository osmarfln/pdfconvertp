import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APP_KNOWLEDGE = `
# Convert Pro — Guia completo da plataforma

Convert Pro é uma plataforma SaaS brasileira para conversão, correção e processamento inteligente de documentos. Interface escura no estilo Netflix, em português (BR).

## 🧭 Páginas e como localizá-las

A navegação principal fica na **barra lateral** (no desktop) ou no **menu inferior / botão de menu** (no mobile).

1. **Dashboard (Início)** — rota \`/\`
   - Visão geral, ações rápidas (Quick Actions) e estatísticas.
   - Cards: Converter arquivo, Corrigir texto com IA, OCR, Meus Arquivos.

2. **Converter** — rota \`/convert\`
   - Faça upload de PDF, DOCX, XLSX, PPTX, JPG, PNG.
   - Escolha o formato de destino (ex: PDF → Word, Word → PDF).
   - Botão **"Converter"** processa via CloudConvert / iLovePDF.
   - Após pronto, aparece o botão **"Baixar"**. Uma cópia é salva automaticamente em **Meus Arquivos → Backup**.

3. **Meus Arquivos** — rota \`/files\`
   - Duas abas:
     - **Ativos**: arquivos da sessão atual.
     - **Backup**: cópia permanente de **todos** os arquivos convertidos. Nunca se perdem.
   - Ações: baixar, excluir.
   - Badge "Backup" identifica as cópias de segurança.

4. **Correção com IA** — rota \`/correct\`
   - Cole um texto OU envie um arquivo (.docx, .pdf, .txt).
   - Escolha o **tom**: profissional, casual, acadêmico, criativo.
   - A IA corrige ortografia, gramática, concordância e estilo.
   - Mostra **comparação antes/depois** (TextDiff) e permite copiar / baixar o resultado.

5. **OCR (Extrair texto)** — dentro de \`/convert\` ou via Quick Action
   - Envia imagens ou PDFs escaneados.
   - A IA extrai todo o texto de forma editável.

6. **Comparar textos** — compara dois documentos lado a lado e destaca diferenças.

7. **Compactar / Mesclar PDF** — ferramentas de PDF disponíveis em **Converter** ou Quick Actions.

8. **Relatórios** — rota \`/reports\` (se habilitado): histórico de uso, conversões por período.

9. **Perfil** — rota \`/profile\`
   - Editar nome, avatar, telefone.
   - Ver plano atual e uso de conversões.

10. **Admin** — rota \`/admin\` (apenas administradores)
    - Gerenciar usuários, planos, bloqueios, ver todas as conversões.

11. **Login / Cadastro** — \`/auth\`
    - E-mail + senha ou Google.

## 💬 Chat IA (esta janela!)
- Botão flutuante azul no canto inferior direito.
- Pode: responder dúvidas, **converter arquivos** anexados (clique no clipe 📎), **corrigir texto** (botão ✨ Corrigir), e ajudar a navegar pelo app.

## 📦 Planos
- **Free**: 5 conversões/mês.
- **Pro / Premium**: limite ampliado, sem propaganda, prioridade.
- Para upgrade: Perfil → "Atualizar plano".

## 🛟 Resolução de problemas comuns
- **"Limite atingido"** → upgrade de plano ou aguardar próximo mês.
- **Conversão falhou** → verifique se o arquivo não está corrompido / protegido por senha.
- **Não acho meu arquivo** → vá em **Meus Arquivos → Backup**.
- **Esqueci a senha** → tela de Login → "Esqueci minha senha".

## 📐 Como responder
- Tom amigável e conversacional, em **português brasileiro**.
- Quando o usuário pedir "como faço X", responda com **passo a passo numerado curto**.
- Quando for dúvida geral (não relacionada ao app), responda normalmente como um assistente útil.
- Use emojis com moderação. Use **negrito** em nomes de botões e páginas.
- Se possível, mencione o caminho exato (ex: "Sidebar → Meus Arquivos → aba Backup").
- Se o usuário tiver dados de contexto (plano, conversões usadas), personalize ("Você já usou 3 de 5 conversões este mês").
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    // Try to load user context (best-effort, never blocks the chat)
    let userContext = "";
    try {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } },
        );
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        if (user) {
          const [{ data: profile }, { data: roles }, { count: convCount }, { data: lastConv }] = await Promise.all([
            supabase.from("profiles").select("display_name, plan, conversions_used, conversions_limit").eq("user_id", user.id).maybeSingle(),
            supabase.from("user_roles").select("role").eq("user_id", user.id),
            supabase.from("file_conversions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_backup", false),
            supabase.from("file_conversions").select("original_name, target_format, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
          ]);

          const isAdmin = roles?.some((r: any) => r.role === "admin");
          const lines: string[] = ["## 👤 Contexto do usuário logado"];
          if (profile?.display_name) lines.push(`- Nome: ${profile.display_name}`);
          if (user.email) lines.push(`- E-mail: ${user.email}`);
          if (profile?.plan) lines.push(`- Plano atual: **${profile.plan}**`);
          if (profile?.conversions_used != null && profile?.conversions_limit != null) {
            lines.push(`- Conversões usadas: **${profile.conversions_used} / ${profile.conversions_limit}** este mês`);
          }
          if (typeof convCount === "number") lines.push(`- Total de conversões já feitas: ${convCount}`);
          if (isAdmin) lines.push(`- 🛡️ Este usuário é **administrador** (tem acesso a /admin)`);
          if (lastConv && lastConv.length) {
            lines.push(`- Últimas conversões:`);
            for (const c of lastConv) {
              lines.push(`  • ${c.original_name} → ${c.target_format} (${c.status})`);
            }
          }
          userContext = "\n\n" + lines.join("\n");
        }
      }
    } catch (e) {
      console.warn("Could not load user context:", e);
    }

    const systemPrompt = APP_KNOWLEDGE + userContext;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
