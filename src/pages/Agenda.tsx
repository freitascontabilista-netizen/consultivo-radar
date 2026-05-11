import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, ChevronLeft, ChevronRight, Edit2, MapPin, Paperclip,
  Plus, Save, Trash2, Users, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

const SUPABASE_URL = "https://menfidltdpxbyovuqayr.supabase.co";
const EDGE_URL = `${SUPABASE_URL}/functions/v1/google-calendar-sync`;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ── types ─────────────────────────────────────────────────────────────────────

interface CalEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  transparency?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  extendedProperties?: { private?: { category?: string } };
  attendees?: Array<{ email: string; self?: boolean }>;
}

type Category = "cliente" | "tarefa" | "vencimento" | "aniversario";
type ReminderOption = "none" | "30" | "60" | "120" | "1440" | "custom";
type ReminderUnit = "minutes" | "hours" | "days";
type EventStatus = "opaque" | "transparent";

interface AttachmentItem {
  id: string;
  file: File;
  url?: string;
}

// ── config ────────────────────────────────────────────────────────────────────

const catConfig: Record<Category, { label: string; color: string; bg: string; emoji: string }> = {
  cliente:     { label: "CLIENTE",     color: "#3B82F6", bg: "#EFF6FF", emoji: "🔵" },
  tarefa:      { label: "TAREFA",      color: "#10B981", bg: "#F0FDF4", emoji: "🟢" },
  vencimento:  { label: "VENCIMENTO",  color: "#F97316", bg: "#FFF7ED", emoji: "🟠" },
  aniversario: { label: "ANIVERSÁRIO", color: "#EC4899", bg: "#FDF2F8", emoji: "🩷" },
};

const catLabels: Record<Category, string> = {
  cliente: "Clientes", tarefa: "Tarefas",
  vencimento: "Vencimentos", aniversario: "Aniversários",
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// ── helpers ───────────────────────────────────────────────────────────────────

function getCategory(ev: CalEvent): Category {
  const cat = ev.extendedProperties?.private?.category;
  if (cat && cat in catConfig) return cat as Category;
  return "cliente";
}

function sameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function fmt24(dt?: string) {
  if (!dt) return "";
  try { return new Date(dt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false }); }
  catch { return ""; }
}

function reminderToMinutes(r: ReminderOption, val: string, unit: ReminderUnit): number | null {
  if (r === "none") return null;
  const fixed: Record<string, number> = { "30": 30, "60": 60, "120": 120, "1440": 1440 };
  if (r in fixed) return fixed[r];
  const n = Math.max(1, parseInt(val) || 1);
  if (unit === "hours") return n * 60;
  if (unit === "days") return n * 1440;
  return n;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function isEmail(s: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim()); }

// ── modal styles ──────────────────────────────────────────────────────────────

const ms: Record<string, React.CSSProperties> = {
  input: {
    width: "100%", border: "0.5px solid #E2E8F0", borderRadius: "8px",
    padding: "9px 12px", fontSize: "13px", color: "#111827",
    outline: "none", background: "#fff", boxSizing: "border-box",
  },
  select: {
    width: "100%", border: "0.5px solid #E2E8F0", borderRadius: "8px",
    padding: "9px 12px", fontSize: "13px", color: "#111827",
    outline: "none", background: "#fff", boxSizing: "border-box",
    cursor: "pointer",
  },
  textarea: {
    width: "100%", border: "0.5px solid #E2E8F0", borderRadius: "8px",
    padding: "9px 12px", fontSize: "13px", color: "#111827",
    outline: "none", background: "#fff", boxSizing: "border-box",
    resize: "vertical", fontFamily: "inherit", lineHeight: 1.5,
  },
  sLabel: {
    fontSize: "10px", fontWeight: 600, color: "#94A3B8",
    letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "12px",
    display: "block",
  } as React.CSSProperties,
  fLabel: { display: "block", fontSize: "12px", fontWeight: 500, color: "#374151", marginBottom: "5px" },
  iconRow: { display: "flex", alignItems: "flex-start", gap: "10px" },
  section: { padding: "16px 20px" },
  divider: { height: "1px", background: "#F1F5F9" },
};

// ── component ─────────────────────────────────────────────────────────────────

export default function Agenda() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── page state ──────────────────────────────────────────────────────────────
  const [connected, setConnected] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [monthEvents, setMonthEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [filters, setFilters] = useState<Record<Category, boolean>>({
    cliente: true, tarefa: true, vencimento: true, aniversario: true,
  });

  // ── modal state ─────────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalEvent | null>(null);
  const [saving, setSaving] = useState(false);

  const blankForm = () => ({
    title: "", date: "", timeStart: "09:00", timeEnd: "10:00",
    category: "cliente" as Category, description: "", location: "",
    allDay: false, status: "opaque" as EventStatus,
    reminder: "none" as ReminderOption,
    reminderCustomValue: "30", reminderCustomUnit: "minutes" as ReminderUnit,
  });
  const [form, setForm] = useState(blankForm);
  const [attendees, setAttendees] = useState<string[]>([]);
  const [attendeeInput, setAttendeeInput] = useState("");
  const [attendeeError, setAttendeeError] = useState("");
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [fileError, setFileError] = useState("");

  // ── OAuth callback params ───────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") setConnected(true);
    if (params.has("connected") || params.has("error")) navigate("/agenda", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── check DB connection ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const check = async () => {
      setCheckingConnection(true);
      const { data } = await supabase
        .from("google_calendar_tokens").select("user_id").eq("user_id", user.id).maybeSingle();
      setConnected(!!data);
      setCheckingConnection(false);
    };
    check();
  }, [user]);

  // ── load events ─────────────────────────────────────────────────────────────
  const loadMonthEvents = useCallback(async () => {
    if (!connected) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setLoading(true);
    try {
      const yr = currentMonth.getFullYear(), mo = currentMonth.getMonth();
      const timeMin = new Date(yr, mo, 1).toISOString();
      const timeMax = new Date(yr, mo + 1, 0, 23, 59, 59, 999).toISOString();
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", params: { timeMin, timeMax } }),
      });
      const data = await res.json();
      setMonthEvents(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  }, [connected, currentMonth]);

  useEffect(() => { loadMonthEvents(); }, [loadMonthEvents]);

  // ── derived state ───────────────────────────────────────────────────────────
  const dayEvents = useMemo(() =>
    monthEvents.filter(ev => {
      const dt = ev.start.dateTime ?? ev.start.date;
      if (!dt) return false;
      if (!sameDay(new Date(dt), selectedDate)) return false;
      return filters[getCategory(ev)];
    }),
    [monthEvents, selectedDate, filters],
  );

  const daysWithEvents = useMemo(() => {
    const set = new Set<number>();
    monthEvents.forEach(ev => {
      const dt = ev.start.dateTime ?? ev.start.date;
      if (!dt) return;
      const d = new Date(dt);
      if (d.getFullYear() === currentMonth.getFullYear() && d.getMonth() === currentMonth.getMonth())
        set.add(d.getDate());
    });
    return set;
  }, [monthEvents, currentMonth]);

  const calDays = useMemo(() => {
    const yr = currentMonth.getFullYear(), mo = currentMonth.getMonth();
    const firstWeekday = new Date(yr, mo, 1).getDay();
    const daysInMonth = new Date(yr, mo + 1, 0).getDate();
    return [...Array(firstWeekday).fill(null as null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  }, [currentMonth]);

  // ── actions ─────────────────────────────────────────────────────────────────
  const callSync = async (action: string, params: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const res = await fetch(EDGE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action, params }),
    });
    return res.json();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const startVal = form.allDay ? form.date : `${form.date}T${form.timeStart}:00`;
    const endVal   = form.allDay ? form.date : `${form.date}T${form.timeEnd}:00`;

    // Upload attachments to Supabase Storage
    const uploadedAttachments: Array<{ fileUrl: string; title: string; mimeType: string }> = [];
    for (const att of attachments) {
      const safeName = att.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user!.id}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("agenda-anexos").upload(path, att.file, { contentType: att.file.type });
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from("agenda-anexos").getPublicUrl(path);
        uploadedAttachments.push({ fileUrl: publicUrl, title: att.file.name, mimeType: att.file.type });
      }
    }

    const mins = reminderToMinutes(form.reminder, form.reminderCustomValue, form.reminderCustomUnit);
    const reminders = { useDefault: false, overrides: mins !== null ? [{ method: "popup", minutes: mins }] : [] };

    const params: Record<string, unknown> = {
      summary: form.title, description: form.description, location: form.location,
      category: form.category, allDay: form.allDay, start: startVal, end: endVal,
      status: form.status, reminders, attendees,
    };
    if (uploadedAttachments.length) params.attachments = uploadedAttachments;

    if (editingEvent) {
      await callSync("update", { ...params, eventId: editingEvent.id });
    } else {
      await callSync("create", params);
    }

    setSaving(false);
    closeModal();
    loadMonthEvents();
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm("Excluir este evento do Google Calendar?")) return;
    await callSync("delete", { eventId });
    loadMonthEvents();
  };

  const openCreateModal = () => {
    setForm({ ...blankForm(), date: selectedDate.toISOString().slice(0, 10) });
    setAttendees([]); setAttendeeInput(""); setAttendeeError("");
    setAttachments([]); setFileError("");
    setEditingEvent(null); setModalOpen(true);
  };

  const openEditModal = (ev: CalEvent) => {
    const isAllDay = !ev.start.dateTime && !!ev.start.date;
    const datePart = ev.start.dateTime ? ev.start.dateTime.slice(0, 10)
      : (ev.start.date ?? selectedDate.toISOString().slice(0, 10));
    setForm({
      title: ev.summary ?? "", description: ev.description ?? "",
      location: ev.location ?? "", date: datePart,
      timeStart: fmt24(ev.start.dateTime) || "09:00",
      timeEnd: fmt24(ev.end.dateTime) || "10:00",
      category: getCategory(ev), allDay: isAllDay,
      status: ev.transparency === "transparent" ? "transparent" : "opaque",
      reminder: "none", reminderCustomValue: "30", reminderCustomUnit: "minutes",
    });
    setAttendees((ev.attendees ?? []).filter(a => !a.self).map(a => a.email));
    setAttendeeInput(""); setAttendeeError("");
    setAttachments([]); setFileError("");
    setEditingEvent(ev); setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false); setEditingEvent(null);
    setAttendees([]); setAttendeeInput(""); setAttendeeError("");
    setAttachments([]); setFileError("");
  };

  const addAttendee = () => {
    const email = attendeeInput.trim();
    if (!isEmail(email)) { setAttendeeError("E-mail inválido."); return; }
    if (attendees.includes(email)) { setAttendeeError("Já adicionado."); return; }
    if (attendees.length >= 10) { setAttendeeError("Máximo de 10 convidados."); return; }
    setAttendees(a => [...a, email]);
    setAttendeeInput(""); setAttendeeError("");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError("");
    const files = Array.from(e.target.files ?? []);
    const oversized = files.filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length) {
      setFileError(`Arquivo(s) acima de 10 MB: ${oversized.map(f => f.name).join(", ")}`);
    }
    const valid = files.filter(f => f.size <= MAX_FILE_SIZE);
    setAttachments(prev => [...prev, ...valid.map(f => ({ id: Math.random().toString(36).slice(2), file: f }))]);
    e.target.value = "";
  };

  const handleConnect = () => {
    const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || "";
    const redirectUri = `${SUPABASE_URL}/functions/v1/google-oauth-callback`;
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "));
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", user?.id ?? "");
    window.location.href = url.toString();
  };

  // ── render ────────────────────────────────────────────────────────────────
  const today = new Date();
  const userEmail = user?.email ?? "";
  const yr = currentMonth.getFullYear(), mo = currentMonth.getMonth();

  const dayHeader = (() => {
    const isToday = sameDay(selectedDate, today);
    const str = selectedDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    const cap = str.charAt(0).toUpperCase() + str.slice(1);
    return isToday ? `Hoje · ${cap}` : cap;
  })();

  return (
    <>
      <main style={{ maxWidth: "1240px", margin: "0 auto", padding: "28px 28px 80px" }}>
        {/* Card */}
        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 4px rgba(15,23,42,.06)" }}>
          <div style={{ height: "3px", background: "linear-gradient(90deg, #1D4ED8, #6366F1)" }} />

          {/* ── Header ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid #F3F4F6", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h1 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#111827" }}>📅 Agenda</h1>
              {userEmail && (
                <span style={{ background: "#F1F5F9", borderRadius: "999px", padding: "3px 10px", fontSize: "12px", color: "#475569", fontWeight: 500 }}>
                  {userEmail}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {!checkingConnection && (connected ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: 600, color: "#16A34A" }}>
                  ✓ Conectado
                </span>
              ) : (
                <button onClick={handleConnect}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#fff", border: "1px solid #D1D5DB", borderRadius: "8px", padding: "6px 14px", fontSize: "12px", fontWeight: 600, color: "#374151", cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#F9FAFB"; e.currentTarget.style.borderColor = "#9CA3AF"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#D1D5DB"; }}>
                  Conectar Google
                </button>
              ))}
              <button onClick={openCreateModal}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#1D4ED8", border: "none", borderRadius: "8px", padding: "7px 14px", fontSize: "13px", fontWeight: 600, color: "#fff", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#1E40AF"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#1D4ED8"; }}>
                <Plus size={14} /> Novo evento
              </button>
            </div>
          </div>

          {/* ── Connection banner ── */}
          {!connected && !checkingConnection && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 24px", background: "#EFF6FF", borderBottom: "1px solid #BFDBFE", flexWrap: "wrap", gap: "8px" }}>
              <span style={{ fontSize: "13px", color: "#1E40AF" }}>Conecte sua conta Google para sincronizar a agenda</span>
              <button onClick={handleConnect} style={{ fontSize: "12px", fontWeight: 600, color: "#1D4ED8", background: "none", border: "1px solid #1D4ED8", borderRadius: "6px", padding: "5px 12px", cursor: "pointer" }}>
                Conectar Google
              </button>
            </div>
          )}

          {/* ── Dual view ── */}
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", minHeight: "480px" }}>

            {/* ──── Mini calendar ──── */}
            <div style={{ borderRight: "1px solid #F1F5F9", padding: "20px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", display: "flex", padding: "3px" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "#374151"; }} onMouseLeave={e => { e.currentTarget.style.color = "#9CA3AF"; }}>
                  <ChevronLeft size={15} />
                </button>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#111827" }}>{MONTHS_PT[mo]} {yr}</span>
                <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", display: "flex", padding: "3px" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "#374151"; }} onMouseLeave={e => { e.currentTarget.style.color = "#9CA3AF"; }}>
                  <ChevronRight size={15} />
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: "2px" }}>
                {WEEKDAYS.map(d => (
                  <div key={d} style={{ textAlign: "center", fontSize: "9px", fontWeight: 600, color: "#94A3B8", padding: "3px 0" }}>{d}</div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "1px" }}>
                {calDays.map((day, i) => {
                  if (!day) return <div key={`pad-${i}`} />;
                  const date = new Date(yr, mo, day);
                  const isToday_ = sameDay(date, today), isSelected = sameDay(date, selectedDate);
                  const hasEvts = daysWithEvents.has(day);
                  return (
                    <button key={day} onClick={() => setSelectedDate(date)}
                      style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", padding: "3px 1px", border: "none", outline: isSelected && !isToday_ ? "1px solid #1D4ED8" : "none", borderRadius: "5px", background: isToday_ ? "#1D4ED8" : isSelected ? "#EFF6FF" : "transparent", color: isToday_ ? "#fff" : isSelected ? "#1D4ED8" : "#374151", fontSize: "11px", fontWeight: isToday_ || isSelected ? 700 : 400, cursor: "pointer" }}
                      onMouseEnter={e => { if (!isToday_) e.currentTarget.style.background = isSelected ? "#DBEAFE" : "#F8FAFC"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isToday_ ? "#1D4ED8" : isSelected ? "#EFF6FF" : "transparent"; }}>
                      {day}
                      {hasEvts && <div style={{ width: "3px", height: "3px", borderRadius: "50%", background: isToday_ ? "rgba(255,255,255,.7)" : "#1D4ED8", marginTop: "1px" }} />}
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: "18px", borderTop: "1px solid #F1F5F9", paddingTop: "14px" }}>
                <div style={{ fontSize: "9px", fontWeight: 600, color: "#94A3B8", letterSpacing: "0.07em", textTransform: "uppercase" as const, marginBottom: "8px" }}>Categorias</div>
                {(Object.keys(catConfig) as Category[]).map(cat => (
                  <label key={cat} style={{ display: "flex", alignItems: "center", gap: "7px", cursor: "pointer", padding: "3px 0" }}>
                    <input type="checkbox" checked={filters[cat]} onChange={() => setFilters(f => ({ ...f, [cat]: !f[cat] }))}
                      style={{ accentColor: catConfig[cat].color, width: "12px", height: "12px", cursor: "pointer" }} />
                    <span style={{ fontSize: "11px", fontWeight: 500, color: "#374151" }}>{catConfig[cat].emoji} {catLabels[cat]}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* ──── Day list ──── */}
            <div style={{ padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>{dayHeader}</span>
                <span style={{ background: "#F1F5F9", borderRadius: "999px", padding: "2px 9px", fontSize: "11px", fontWeight: 600, color: "#64748B" }}>
                  {dayEvents.length} evento{dayEvents.length !== 1 ? "s" : ""}
                </span>
              </div>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[1, 2, 3].map(i => <div key={i} style={{ height: "70px", borderRadius: "8px", background: "#F1F5F9" }} />)}
                </div>
              ) : dayEvents.length === 0 ? (
                <div style={{ textAlign: "center", padding: "52px 20px" }}>
                  <div style={{ fontSize: "32px", marginBottom: "10px" }}>🎉</div>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#374151" }}>Nenhum evento para este dia</p>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
                    {connected ? "Sua agenda está livre! Que tal criar um evento?" : "Conecte o Google Calendar para ver eventos."}
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {dayEvents.map(ev => {
                    const cat = getCategory(ev), cfg = catConfig[cat];
                    const timeStart = fmt24(ev.start.dateTime), timeEnd = fmt24(ev.end.dateTime);
                    const meta = ev.location || (ev.description ? ev.description.slice(0, 70) : null);
                    return (
                      <div key={ev.id}
                        style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "12px 14px", background: "#FAFAFA", border: "1px solid #F1F5F9", borderRadius: "8px", borderLeft: `3px solid ${cfg.color}` }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#F8FAFC"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#FAFAFA"; }}>
                        {timeStart && (
                          <span style={{ background: cfg.bg, color: cfg.color, borderRadius: "6px", padding: "3px 8px", fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap" as const, flexShrink: 0, marginTop: "1px" }}>
                            {timeStart}{timeEnd ? ` - ${timeEnd}` : ""}
                          </span>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ display: "inline-block", background: cfg.bg, color: cfg.color, borderRadius: "4px", padding: "1px 6px", fontSize: "9px", fontWeight: 800, letterSpacing: ".05em", marginBottom: "3px" }}>
                                {cfg.label}
                              </span>
                              <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#111827" }}>{ev.summary ?? "Sem título"}</p>
                              {meta && <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{meta}</p>}
                            </div>
                            <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                              <button onClick={() => openEditModal(ev)} title="Editar"
                                style={{ background: "none", border: "1px solid #E5E7EB", borderRadius: "6px", padding: "4px", cursor: "pointer", color: "#9CA3AF", display: "flex" }}
                                onMouseEnter={e => { e.currentTarget.style.color = "#1D4ED8"; e.currentTarget.style.borderColor = "#1D4ED8"; }}
                                onMouseLeave={e => { e.currentTarget.style.color = "#9CA3AF"; e.currentTarget.style.borderColor = "#E5E7EB"; }}>
                                <Edit2 size={13} />
                              </button>
                              <button onClick={() => handleDelete(ev.id)} title="Excluir"
                                style={{ background: "none", border: "1px solid #E5E7EB", borderRadius: "6px", padding: "4px", cursor: "pointer", color: "#9CA3AF", display: "flex" }}
                                onMouseEnter={e => { e.currentTarget.style.color = "#DC2626"; e.currentTarget.style.borderColor = "#DC2626"; }}
                                onMouseLeave={e => { e.currentTarget.style.color = "#9CA3AF"; e.currentTarget.style.borderColor = "#E5E7EB"; }}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── FAB ── */}
      <button onClick={openCreateModal} title="Novo evento"
        style={{ position: "fixed", bottom: "28px", right: "28px", width: "52px", height: "52px", borderRadius: "50%", background: "#1D4ED8", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(29,78,216,.45)", zIndex: 40, transition: "transform .15s, background .15s" }}
        onMouseEnter={e => { e.currentTarget.style.background = "#1E40AF"; e.currentTarget.style.transform = "scale(1.07)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "#1D4ED8"; e.currentTarget.style.transform = "scale(1)"; }}>
        <Plus size={22} />
      </button>

      {/* ══════════════════════════════════════════════════════════════
          MODAL
      ══════════════════════════════════════════════════════════════ */}
      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.48)", padding: "16px" }}>
          <div style={{ width: "100%", maxWidth: "560px", borderRadius: "16px", background: "#fff", boxShadow: "0 24px 64px rgba(0,0,0,.22)", display: "flex", flexDirection: "column", maxHeight: "92vh" }}>

            {/* Modal header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#111827" }}>
                {editingEvent ? "Editar evento" : "Novo evento"}
              </h3>
              <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", display: "flex", padding: "2px", borderRadius: "4px" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
              <div style={{ overflowY: "auto", flex: 1 }}>

                {/* ── SEÇÃO 1: BÁSICO ── */}
                <div style={ms.section}>
                  <span style={ms.sLabel}>Básico</span>

                  {/* Título */}
                  <input required value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Adicionar título"
                    style={{ ...ms.input, fontSize: "15px", fontWeight: 600, padding: "10px 12px", marginBottom: "14px" }} />

                  {/* Toggle dia inteiro + Status */}
                  <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "14px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button type="button" onClick={() => setForm(f => ({ ...f, allDay: !f.allDay }))}
                        style={{ width: "36px", height: "20px", borderRadius: "10px", border: "none", background: form.allDay ? "#1D4ED8" : "#D1D5DB", cursor: "pointer", padding: "2px", position: "relative", flexShrink: 0 }}>
                        <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#fff", position: "absolute", top: "2px", left: form.allDay ? "18px" : "2px", transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
                      </button>
                      <span style={{ fontSize: "13px", fontWeight: 500, color: "#374151" }}>Dia inteiro</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 600 }}>STATUS</span>
                      <select value={form.status}
                        onChange={e => setForm(f => ({ ...f, status: e.target.value as EventStatus }))}
                        style={{ ...ms.select, width: "auto", padding: "5px 10px", fontSize: "12px" }}>
                        <option value="opaque">Ocupado</option>
                        <option value="transparent">Disponível</option>
                      </select>
                    </div>
                  </div>

                  {/* Data + Hora (oculto se dia inteiro) */}
                  <div style={{ display: "grid", gridTemplateColumns: form.allDay ? "1fr" : "1fr 1fr 1fr", gap: "10px", marginBottom: "14px" }}>
                    <div>
                      <label style={ms.fLabel}>Data *</label>
                      <input type="date" required value={form.date}
                        onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                        style={ms.input} />
                    </div>
                    {!form.allDay && (
                      <>
                        <div>
                          <label style={ms.fLabel}>Hora início</label>
                          <input type="time" value={form.timeStart}
                            onChange={e => setForm(f => ({ ...f, timeStart: e.target.value }))}
                            style={ms.input} />
                        </div>
                        <div>
                          <label style={ms.fLabel}>Hora fim</label>
                          <input type="time" value={form.timeEnd}
                            onChange={e => setForm(f => ({ ...f, timeEnd: e.target.value }))}
                            style={ms.input} />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Categoria */}
                  <div>
                    <label style={ms.fLabel}>Categoria</label>
                    <select value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}
                      style={ms.select}>
                      {(Object.keys(catConfig) as Category[]).map(cat => (
                        <option key={cat} value={cat}>{catConfig[cat].emoji} {catLabels[cat]}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* ── SEÇÃO 2: DETALHES ── */}
                <div style={{ ...ms.divider }} />
                <div style={ms.section}>
                  <span style={ms.sLabel}>Detalhes</span>

                  {/* Local */}
                  <div style={{ ...ms.iconRow, marginBottom: "12px" }}>
                    <MapPin size={15} style={{ color: "#94A3B8", flexShrink: 0, marginTop: "10px" }} />
                    <div style={{ flex: 1 }}>
                      <label style={ms.fLabel}>Local</label>
                      <input value={form.location}
                        onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                        placeholder="Endereço ou sala"
                        style={ms.input} />
                    </div>
                  </div>

                  {/* Descrição */}
                  <div style={ms.iconRow}>
                    <div style={{ width: "15px", flexShrink: 0, marginTop: "10px" }} />
                    <div style={{ flex: 1 }}>
                      <label style={ms.fLabel}>Descrição</label>
                      <textarea rows={3} value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Detalhes do evento..."
                        style={ms.textarea} />
                    </div>
                  </div>
                </div>

                {/* ── SEÇÃO 3: PESSOAS ── */}
                <div style={ms.divider} />
                <div style={ms.section}>
                  <span style={ms.sLabel}>Pessoas</span>

                  <div style={ms.iconRow}>
                    <Users size={15} style={{ color: "#94A3B8", flexShrink: 0, marginTop: "10px" }} />
                    <div style={{ flex: 1 }}>
                      <label style={ms.fLabel}>Convidados {attendees.length > 0 && `(${attendees.length}/10)`}</label>

                      {/* Input row */}
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input type="email"
                          value={attendeeInput}
                          onChange={e => { setAttendeeInput(e.target.value); setAttendeeError(""); }}
                          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addAttendee(); } }}
                          placeholder="email@exemplo.com"
                          style={{ ...ms.input, flex: 1 }} />
                        <button type="button" onClick={addAttendee}
                          disabled={attendees.length >= 10}
                          style={{ background: "#F1F5F9", border: "0.5px solid #E2E8F0", borderRadius: "8px", padding: "0 14px", fontSize: "12px", fontWeight: 600, color: "#374151", cursor: "pointer", whiteSpace: "nowrap" as const, flexShrink: 0, opacity: attendees.length >= 10 ? 0.5 : 1 }}>
                          + Adicionar
                        </button>
                      </div>

                      {attendeeError && <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#EF4444" }}>{attendeeError}</p>}

                      {/* Chips */}
                      {attendees.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                          {attendees.map(email => (
                            <div key={email} style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#F1F5F9", borderRadius: "999px", padding: "3px 8px 3px 5px", fontSize: "12px" }}>
                              <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "#1D4ED8", color: "#fff", fontSize: "9px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                {email[0].toUpperCase()}
                              </div>
                              <span style={{ color: "#374151", fontWeight: 500 }}>{email}</span>
                              <button type="button" onClick={() => setAttendees(a => a.filter(e => e !== email))}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: 0, display: "flex", flexShrink: 0 }}>
                                <X size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── SEÇÃO 4: EXTRAS ── */}
                <div style={ms.divider} />
                <div style={ms.section}>
                  <span style={ms.sLabel}>Extras</span>

                  {/* Lembrete */}
                  <div style={{ ...ms.iconRow, marginBottom: "14px" }}>
                    <Bell size={15} style={{ color: "#94A3B8", flexShrink: 0, marginTop: "10px" }} />
                    <div style={{ flex: 1 }}>
                      <label style={ms.fLabel}>Lembrete</label>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <select value={form.reminder}
                          onChange={e => setForm(f => ({ ...f, reminder: e.target.value as ReminderOption }))}
                          style={{ ...ms.select, flex: 1, minWidth: "160px" }}>
                          <option value="none">Sem lembrete</option>
                          <option value="30">30 minutos antes</option>
                          <option value="60">1 hora antes</option>
                          <option value="120">2 horas antes</option>
                          <option value="1440">1 dia antes</option>
                          <option value="custom">Personalizado...</option>
                        </select>
                        {form.reminder === "custom" && (
                          <>
                            <input type="number" min={1} value={form.reminderCustomValue}
                              onChange={e => setForm(f => ({ ...f, reminderCustomValue: e.target.value }))}
                              style={{ ...ms.input, width: "72px" }} />
                            <select value={form.reminderCustomUnit}
                              onChange={e => setForm(f => ({ ...f, reminderCustomUnit: e.target.value as ReminderUnit }))}
                              style={{ ...ms.select, width: "110px" }}>
                              <option value="minutes">minutos</option>
                              <option value="hours">horas</option>
                              <option value="days">dias</option>
                            </select>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Anexos */}
                  <div style={ms.iconRow}>
                    <Paperclip size={15} style={{ color: "#94A3B8", flexShrink: 0, marginTop: "10px" }} />
                    <div style={{ flex: 1 }}>
                      <label style={ms.fLabel}>Anexos</label>
                      <input ref={fileInputRef} type="file" multiple hidden
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                        onChange={handleFileSelect} />
                      <button type="button" onClick={() => fileInputRef.current?.click()}
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#F8FAFC", border: "0.5px solid #E2E8F0", borderRadius: "8px", padding: "7px 14px", fontSize: "12px", fontWeight: 500, color: "#374151", cursor: "pointer" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#F1F5F9"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#F8FAFC"; }}>
                        <Paperclip size={13} /> Anexar arquivo
                      </button>
                      <span style={{ marginLeft: "8px", fontSize: "10px", color: "#9CA3AF" }}>PDF, DOC, XLS, JPG, PNG · máx 10 MB</span>

                      {fileError && <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#EF4444" }}>{fileError}</p>}

                      {attachments.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                          {attachments.map(att => (
                            <div key={att.id} style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "#F8FAFC", border: "0.5px solid #E2E8F0", borderRadius: "6px", padding: "4px 8px 4px 7px", fontSize: "11px" }}>
                              <Paperclip size={10} style={{ color: "#94A3B8", flexShrink: 0 }} />
                              <span style={{ color: "#374151", fontWeight: 500, maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{att.file.name}</span>
                              <span style={{ color: "#9CA3AF" }}>({fmtSize(att.file.size)})</span>
                              <button type="button" onClick={() => setAttachments(a => a.filter(x => x.id !== att.id))}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: 0, display: "flex", flexShrink: 0 }}>
                                <X size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal footer */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", padding: "14px 20px", borderTop: "1px solid #F1F5F9", flexShrink: 0 }}>
                <button type="button" onClick={closeModal}
                  style={{ border: "0.5px solid #E2E8F0", background: "#fff", borderRadius: "8px", padding: "9px 18px", fontSize: "13px", fontWeight: 500, color: "#6B7280", cursor: "pointer" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  style={{ display: "inline-flex", alignItems: "center", gap: "7px", background: "#1D4ED8", border: "none", borderRadius: "8px", padding: "9px 18px", fontSize: "13px", fontWeight: 600, color: "#fff", cursor: "pointer", opacity: saving ? 0.65 : 1 }}
                  onMouseEnter={e => { if (!saving) e.currentTarget.style.background = "#1E40AF"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#1D4ED8"; }}>
                  <Save size={14} />
                  {saving ? "Salvando..." : "Salvar evento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
