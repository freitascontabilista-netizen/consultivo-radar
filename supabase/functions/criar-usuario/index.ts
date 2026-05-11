import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })

  try {
    const { nome, email, senha, role } = await req.json()

    if (!nome || !email || !senha) {
      return json({ error: "Campos obrigatórios: nome, email, senha" }, 400)
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      user_metadata: { nome },
      email_confirm: true,
    })

    if (authError) return json({ error: authError.message }, 400)

    const userId = authData.user.id

    await supabaseAdmin
      .from("usuarios")
      .insert({ id: userId, nome, email, ativo: true, role: role ?? "colaborador" })

    await supabaseAdmin
      .from("activity_logs")
      .insert({ usuario_nome: "Admin", acao: `Novo usuário criado: ${nome}`, entidade: "usuario", entidade_id: userId })

    return json({ id: userId })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
