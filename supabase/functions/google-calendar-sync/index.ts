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

async function getValidToken(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
): Promise<string> {
  const { data: row, error } = await supabaseAdmin
    .from("google_calendar_tokens")
    .select("*")
    .eq("user_id", userId)
    .single()

  if (error || !row) throw new Error("Google Calendar not connected")

  if (new Date(row.expires_at) > new Date()) return row.access_token

  // Token expired — refresh it
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: row.refresh_token,
      client_id: Deno.env.get("GOOGLE_CLIENT_ID") ?? "",
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
      grant_type: "refresh_token",
    }),
  })

  if (!res.ok) throw new Error("Token refresh failed")

  const { access_token, expires_in } = await res.json()
  const expiresAt = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString()

  await supabaseAdmin
    .from("google_calendar_tokens")
    .update({ access_token, expires_at: expiresAt })
    .eq("user_id", userId)

  return access_token
}

function buildEventBody(params: Record<string, unknown>): Record<string, unknown> {
  const allDay = params.allDay === true

  const startField = allDay
    ? { date: (params.start as string).slice(0, 10) }
    : { dateTime: params.start, timeZone: "America/Sao_Paulo" }

  const endField = allDay
    ? { date: (params.end as string).slice(0, 10) }
    : { dateTime: params.end, timeZone: "America/Sao_Paulo" }

  const body: Record<string, unknown> = {
    summary: params.summary,
    description: params.description,
    location: params.location,
    start: startField,
    end: endField,
  }

  // transparency: "opaque" (ocupado) | "transparent" (disponível)
  if (params.status === "transparent" || params.status === "opaque") {
    body.transparency = params.status
  }

  // reminders
  if (params.reminders) {
    body.reminders = params.reminders
  }

  // attendees
  if (Array.isArray(params.attendees) && (params.attendees as string[]).length > 0) {
    body.attendees = (params.attendees as string[]).map((e: string) => ({ email: e }))
  }

  // attachments (Drive file links)
  if (Array.isArray(params.attachments) && (params.attachments as unknown[]).length > 0) {
    body.attachments = params.attachments
  }

  // category stored as private extended property
  if (params.category) {
    body.extendedProperties = { private: { category: params.category } }
  }

  return body
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return json({ error: "Unauthorized" }, 401)

  const supabaseAnon = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error: authError } = await supabaseAnon.auth.getUser()
  if (authError || !user) return json({ error: "Unauthorized" }, 401)

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  )

  try {
    const { action, params = {} } = await req.json()
    const accessToken = await getValidToken(supabaseAdmin, user.id)
    const base = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
    const authBearer = { Authorization: `Bearer ${accessToken}` }

    if (action === "list") {
      const qs = new URLSearchParams({ singleEvents: "true", orderBy: "startTime" })
      if (params.timeMin) qs.set("timeMin", params.timeMin)
      if (params.timeMax) qs.set("timeMax", params.timeMax)
      const res = await fetch(`${base}?${qs}`, { headers: authBearer })
      const data = await res.json()
      return json(data.items ?? [])

    } else if (action === "create") {
      const body = buildEventBody(params as Record<string, unknown>)
      const hasAttachments = Array.isArray(params.attachments) && (params.attachments as unknown[]).length > 0
      const url = hasAttachments ? `${base}?supportsAttachments=true` : base
      const res = await fetch(url, {
        method: "POST",
        headers: { ...authBearer, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      return json(await res.json())

    } else if (action === "update") {
      const body = buildEventBody(params as Record<string, unknown>)
      const hasAttachments = Array.isArray(params.attachments) && (params.attachments as unknown[]).length > 0
      const urlBase = `${base}/${params.eventId}`
      const url = hasAttachments ? `${urlBase}?supportsAttachments=true` : urlBase
      const res = await fetch(url, {
        method: "PUT",
        headers: { ...authBearer, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      return json(await res.json())

    } else if (action === "delete") {
      await fetch(`${base}/${params.eventId}`, { method: "DELETE", headers: authBearer })
      return json({ success: true })

    } else {
      return json({ error: "Unknown action" }, 400)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error"
    if (message === "Google Calendar not connected") return json({ error: message }, 400)
    console.error("Calendar sync error:", err)
    return json({ error: message }, 500)
  }
})
