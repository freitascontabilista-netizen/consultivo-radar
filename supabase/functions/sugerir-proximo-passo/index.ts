import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { descricao, assunto } = await req.json();

    if (!descricao || typeof descricao !== "string" || descricao.trim().length < 20) {
      return new Response(
        JSON.stringify({ error: "Campo 'descricao' deve ter ao menos 20 caracteres." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada." }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const userMessage = assunto
      ? `Assunto: ${assunto}\n\nDescrição: ${descricao}`
      : descricao;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        system:
          "Você é um assistente especializado em consultoria contábil e tributária. " +
          "Com base na descrição de uma orientação dada a um cliente, sugira um próximo passo " +
          "concreto e acionável em até 2 frases curtas. " +
          "Comece sempre com um verbo no infinitivo (ex.: 'Enviar', 'Agendar', 'Verificar'). " +
          "Seja direto e prático. Responda apenas com o próximo passo, sem explicações adicionais.",
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!claudeRes.ok) {
      const body = await claudeRes.text();
      return new Response(
        JSON.stringify({ error: `Erro na API do Claude: ${body}` }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const payload = await claudeRes.json();
    const sugestao: string = payload.content?.[0]?.text?.trim() ?? "";

    return new Response(
      JSON.stringify({ sugestao }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
