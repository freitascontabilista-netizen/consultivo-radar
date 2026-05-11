import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Callback OAuth público — sem verificação de JWT (verify_jwt = false)

function redirect(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      "Location": url,
      "Access-Control-Allow-Origin": "*",
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" },
    })
  }

  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state") // user_id
  const appUrl = Deno.env.get("APP_URL") ?? ""

  console.log("[oauth-callback] === INÍCIO ===")
  console.log("[oauth-callback] code:", code ? code.slice(0, 10) + "..." : "AUSENTE")
  console.log("[oauth-callback] state (user_id):", state ?? "AUSENTE")
  console.log("[oauth-callback] APP_URL:", appUrl || "NÃO CONFIGURADO")
  console.log("[oauth-callback] GOOGLE_CLIENT_ID:", Deno.env.get("GOOGLE_CLIENT_ID") ? "✓ presente" : "✗ AUSENTE")
  console.log("[oauth-callback] GOOGLE_CLIENT_SECRET:", Deno.env.get("GOOGLE_CLIENT_SECRET") ? "✓ presente" : "✗ AUSENTE")
  console.log("[oauth-callback] GOOGLE_REDIRECT_URI:", Deno.env.get("GOOGLE_REDIRECT_URI") ?? "✗ AUSENTE")
  console.log("[oauth-callback] SUPABASE_URL:", Deno.env.get("SUPABASE_URL") ? "✓ presente" : "✗ AUSENTE")
  console.log("[oauth-callback] SUPABASE_SERVICE_ROLE_KEY:", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ? "✓ presente" : "✗ AUSENTE")

  if (!code || !state) {
    console.error("[oauth-callback] ERRO: code ou state ausente — abortando")
    return redirect(`${appUrl}/agenda?error=oauth`)
  }

  try {
    // ── 1. Trocar code por tokens no Google ────────────────────────────────
    console.log("[oauth-callback] Trocando code por tokens no Google...")
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: Deno.env.get("GOOGLE_CLIENT_ID") ?? "",
        client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
        redirect_uri: Deno.env.get("GOOGLE_REDIRECT_URI") ?? "",
        grant_type: "authorization_code",
      }),
    })

    const tokenBody = await tokenRes.json()
    console.log("[oauth-callback] Google status:", tokenRes.status)
    console.log("[oauth-callback] Google response:", JSON.stringify({
      ...tokenBody,
      access_token: tokenBody.access_token ? tokenBody.access_token.slice(0, 10) + "..." : "AUSENTE",
      refresh_token: tokenBody.refresh_token ? "✓ presente" : "✗ AUSENTE",
      id_token: tokenBody.id_token ? "✓ presente" : undefined,
    }))

    if (!tokenRes.ok) {
      console.error("[oauth-callback] ERRO na troca de tokens Google:", JSON.stringify(tokenBody))
      return redirect(`${appUrl}/agenda?error=oauth`)
    }

    const { access_token, refresh_token, expires_in } = tokenBody
    const expiresAt = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString()
    console.log("[oauth-callback] Tokens obtidos. expires_in:", expires_in, "expiresAt:", expiresAt)

    // ── 2. Salvar tokens no Supabase com admin client ──────────────────────
    console.log("[oauth-callback] Criando Supabase admin client...")
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    )

    console.log("[oauth-callback] Fazendo upsert para user_id:", state)
    const { error: upsertError } = await supabase
      .from("google_calendar_tokens")
      .upsert(
        { user_id: state, access_token, refresh_token, expires_at: expiresAt },
        { onConflict: "user_id" },
      )

    if (upsertError) {
      console.error("[oauth-callback] ERRO no upsert:", JSON.stringify(upsertError))
      console.error("[oauth-callback] code:", upsertError.code)
      console.error("[oauth-callback] message:", upsertError.message)
      console.error("[oauth-callback] details:", upsertError.details)
      console.error("[oauth-callback] hint:", upsertError.hint)
      return redirect(`${appUrl}/agenda?error=oauth`)
    }

    console.log("[oauth-callback] ✓ Tokens salvos com sucesso!")
    return redirect(`${appUrl}/agenda?connected=true`)

  } catch (err) {
    console.error("[oauth-callback] EXCEÇÃO não tratada:", String(err))
    return redirect(`${appUrl}/agenda?error=oauth`)
  }
})
