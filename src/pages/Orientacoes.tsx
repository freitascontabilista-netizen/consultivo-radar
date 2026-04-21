import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, type InteracaoRow, type RadarConsultivoRow } from "@/lib/supabase";
import { NovaOrientacaoModal, TIPOS_ORIENTACAO } from "@/components/NovaOrientacaoModal";

// ── Types ──────────────────────────────────────────────────────────────────────

type Periodo = "hoje" | "semana" | "mes" | "tudo";

interface InteracaoEnriquecida extends InteracaoRow {
  cliente_nome: string;
  cliente_fantasia: string | null;
  cliente_id_real: string | number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const tipoConfig = Object.fromEntries(
  TIPOS_ORIENTACAO.map(t => [t.key, t])
);

function getTipoConfig(key?: string | null) {
  return tipoConfig[key ?? ""] ?? { label: key ?? "—", color: "#475569", bg: "#f1f5f9" };
}

function formatDateRelative(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return "Hoje, " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Ontem, " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays < 7) return `${diffDays} dias atrás`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateHeader(value: string): string {
  const d = new Date(value + "T00:00:00");
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
  if (value === today) return "Hoje";
  if (value === yesterday) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

function nameInitials(name: string): string {
  return (name ?? "?").trim().split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function startOfDay(d: Date) { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; }
function startOfWeek(d: Date) { const c = startOfDay(d); c.setDate(c.getDate() - c.getDay()); return c; }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }

// ── Nav shared ─────────────────────────────────────────────────────────────────

const NAV = [
  { label: "Dashboard",    path: "/",             active: false },
  { label: "Clientes",     path: "/clientes",     active: false },
  { label: "Orientações",  path: "/orientacoes",  active: true  },
  { label: "Follow-ups",   path: "/",             active: false },
  { label: "Administração",path: "/admin",        active: false },
];

// ── Component ──────────────────────────────────────────────────────────────────

export default function Orientacoes() {
  const navigate = useNavigate();
  const [interacoes, setInteracoes] = useState<InteracaoEnriquecida[]>([]);
  const [radarRows, setRadarRows] = useState<RadarConsultivoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [novaOpen, setNovaOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Filters
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [clienteFiltro, setClienteFiltro] = useState("todos");
  const [busca, setBusca] = useState("");

  // View
  const [agrupamento, setAgrupamento] = useState<"data" | "cliente">("data");

  // ── Load ──────────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email);
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const [{ data: intData }, { data: radarData }] = await Promise.all([
        supabase.from("interacoes").select("*").order("data_interacao", { ascending: false }),
        supabase.from("radar_consultivo").select("*"),
      ]);
      if (!mounted) return;

      const radar = (radarData ?? []) as RadarConsultivoRow[];
      setRadarRows(radar);

      const nomeMap = new Map<string, { nome: string; fantasia: string | null }>();
      for (const r of radar) {
        const key = String(r.cliente_id ?? r.id ?? "");
        if (key) nomeMap.set(key, { nome: r.razao_social ?? "Cliente", fantasia: r.nome_fantasia ?? null });
      }

      const enriquecidas: InteracaoEnriquecida[] = (intData ?? []).map((i: any) => {
        const key = String(i.cliente_id ?? "");
        const info = nomeMap.get(key);
        return {
          ...i,
          cliente_nome: info?.nome ?? "Cliente desconhecido",
          cliente_fantasia: info?.fantasia ?? null,
          cliente_id_real: i.cliente_id,
        };
      });

      setInteracoes(enriquecidas);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [reloadKey]);

  // ── Filter logic ──────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const now = new Date();
    const periodoStart: Record<Periodo, Date | null> = {
      hoje:   startOfDay(now),
      semana: startOfWeek(now),
      mes:    startOfMonth(now),
      tudo:   null,
    };
    const start = periodoStart[periodo];
    const q = busca.trim().toLowerCase();

    return interacoes.filter(i => {
      const dataI = i.data_interacao ? new Date(i.data_interacao) : null;
      if (start && dataI && dataI < start) return false;
      if (tipoFiltro !== "todos" && i.tipo !== tipoFiltro) return false;
      if (clienteFiltro !== "todos" && String(i.cliente_id_real) !== clienteFiltro) return false;
      if (q) {
        const hay = `${i.cliente_nome} ${i.assunto ?? ""} ${i.resumo ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [interacoes, periodo, tipoFiltro, clienteFiltro, busca]);

  // ── Metrics ───────────────────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const now = new Date();
    const mesStart  = startOfMonth(now);
    const semStart  = startOfWeek(now);

    const noMes    = interacoes.filter(i => i.data_interacao && new Date(i.data_interacao) >= mesStart).length;
    const naSemana = interacoes.filter(i => i.data_interacao && new Date(i.data_interacao) >= semStart).length;

    const clientesComOrientacao = new Set(
      interacoes.filter(i => i.data_interacao && new Date(i.data_interacao) >= mesStart)
        .map(i => String(i.cliente_id_real))
    ).size;

    const mediaPorCliente = clientesComOrientacao > 0
      ? (noMes / clientesComOrientacao).toFixed(1)
      : "0";

    const semOrientacao30 = radarRows.filter(r => (r.dias_sem_orientacao ?? 0) >= 30).length;

    return { noMes, naSemana, mediaPorCliente, semOrientacao30 };
  }, [interacoes, radarRows]);

  // ── Grouping ──────────────────────────────────────────────────────────────────

  const groupedByData = useMemo(() => {
    const map = new Map<string, InteracaoEnriquecida[]>();
    for (const i of filtered) {
      const key = i.data_interacao
        ? new Date(i.data_interacao).toISOString().slice(0, 10)
        : "sem-data";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const groupedByCliente = useMemo(() => {
    const map = new Map<string, { nome: string; fantasia: string | null; items: InteracaoEnriquecida[] }>();
    for (const i of filtered) {
      const key = String(i.cliente_id_real ?? "?");
      if (!map.has(key)) map.set(key, { nome: i.cliente_nome, fantasia: i.cliente_fantasia, items: [] });
      map.get(key)!.items.push(i);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].items.length - a[1].items.length);
  }, [filtered]);

  // ── Client options for filter ─────────────────────────────────────────────────

  const clienteOpts = useMemo(() => {
    const seen = new Map<string, string>();
    for (const i of interacoes) {
      const key = String(i.cliente_id_real ?? "");
      if (key && !seen.has(key)) seen.set(key, i.cliente_nome);
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [interacoes]);

  // ── Shared styles ─────────────────────────────────────────────────────────────

  const emailInitials = userEmail ? userEmail.split("@")[0].slice(0, 2).toUpperCase() : "TF";
  const sel: React.CSSProperties = { fontSize: "12px", color: "#374151", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "7px", padding: "7px 10px", outline: "none", cursor: "pointer" };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f9", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

      {/* ── Top Nav ── */}
      <header style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 28px", display: "flex", alignItems: "center", height: "58px", gap: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
            <img src="/logo_freitas.png" alt="" style={{ height: "28px", objectFit: "contain" }} />
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#374151", borderLeft: "1px solid #e5e7eb", paddingLeft: "10px", letterSpacing: ".02em" }}>CRM Consultivo</span>
          </div>
          <nav style={{ display: "flex", gap: "2px", flex: 1 }}>
            {NAV.map(item => (
              <button key={item.label} onClick={() => navigate(item.path)}
                style={{ padding: "5px 13px", fontSize: "13px", fontWeight: item.active ? 600 : 400, color: item.active ? "#1d4ed8" : "#6b7280", background: item.active ? "#eff6ff" : "transparent", border: "none", borderRadius: "6px", cursor: "pointer" }}
                onMouseEnter={e => { if (!item.active) e.currentTarget.style.background = "#f9fafb"; }}
                onMouseLeave={e => { if (!item.active) e.currentTarget.style.background = "transparent"; }}>
                {item.label}
              </button>
            ))}
          </nav>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button onClick={() => setMenuOpen(o => !o)}
              style={{ display: "flex", alignItems: "center", gap: "8px", background: "transparent", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "5px 10px", cursor: "pointer" }}>
              <div style={{ width: "27px", height: "27px", borderRadius: "50%", background: "linear-gradient(135deg,#1d4ed8,#1e40af)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: "#fff" }}>
                {emailInitials}
              </div>
              <span style={{ fontSize: "12px", color: "#374151", fontWeight: 500, maxWidth: "130px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail || "Usuário"}</span>
              <svg width="11" height="11" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            {menuOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", boxShadow: "0 8px 24px rgba(0,0,0,.08)", minWidth: "190px", overflow: "hidden", zIndex: 50 }}>
                <div style={{ padding: "12px 14px", borderBottom: "1px solid #f3f4f6" }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#111827" }}>{userEmail}</div>
                  <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "1px" }}>Administrador</div>
                </div>
                <button onClick={async () => { await supabase.auth.signOut(); navigate("/auth"); }}
                  style={{ width: "100%", padding: "10px 14px", fontSize: "13px", color: "#dc2626", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: "8px" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sair da conta
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: "1240px", margin: "0 auto", padding: "28px 28px 56px" }}>

        {/* ── Page header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px" }}>
          <div>
            <h1 style={{ fontSize: "21px", fontWeight: 700, color: "#111827", margin: 0 }}>Orientações</h1>
            <p style={{ fontSize: "13px", color: "#6b7280", margin: "4px 0 0" }}>
              Histórico de todas as orientações consultivas registradas.
            </p>
          </div>
          <button onClick={() => setNovaOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: "7px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.background = "#1e40af"}
            onMouseLeave={e => e.currentTarget.style.background = "#1d4ed8"}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            Nova orientação
          </button>
        </div>

        {/* ── Metric cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px", marginBottom: "20px" }}>
          {[
            {
              label: "Orientações no mês",
              value: metrics.noMes,
              sub: "registradas em " + new Date().toLocaleString("pt-BR", { month: "long" }),
              accent: "#1d4ed8", border: "#1d4ed8",
              icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
            },
            {
              label: "Esta semana",
              value: metrics.naSemana,
              sub: "orientações nos últimos 7 dias",
              accent: "#7c3aed", border: "#7c3aed",
              icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
            },
            {
              label: "Média por cliente",
              value: metrics.mediaPorCliente,
              sub: "orientações/cliente no mês",
              accent: "#0891b2", border: "#0891b2",
              icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
            },
            {
              label: "Sem orientação +30d",
              value: metrics.semOrientacao30,
              sub: "clientes precisam de contato",
              accent: "#dc2626", border: "#dc2626",
              icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
            },
          ].map(m => (
            <div key={m.label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderTop: `3px solid ${m.border}`, borderRadius: "10px", padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: "8px" }}>{m.label}</div>
                  <div style={{ fontSize: "32px", fontWeight: 800, color: "#111827", lineHeight: 1 }}>{loading ? "—" : m.value}</div>
                  <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "5px" }}>{m.sub}</div>
                </div>
                <div style={{ width: "38px", height: "38px", borderRadius: "9px", background: `${m.accent}18`, display: "flex", alignItems: "center", justifyContent: "center", color: m.accent, flexShrink: 0 }}>
                  {m.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters + view toggle ── */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px 18px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>

            {/* Period tabs */}
            <div style={{ display: "flex", background: "#f3f4f6", borderRadius: "8px", padding: "3px", gap: "2px" }}>
              {(["hoje","semana","mes","tudo"] as Periodo[]).map(p => {
                const labels: Record<Periodo, string> = { hoje: "Hoje", semana: "Semana", mes: "Mês", tudo: "Tudo" };
                return (
                  <button key={p} onClick={() => setPeriodo(p)}
                    style={{ padding: "5px 13px", fontSize: "12px", fontWeight: 500, border: "none", borderRadius: "6px", cursor: "pointer", background: periodo === p ? "#fff" : "transparent", color: periodo === p ? "#1d4ed8" : "#6b7280", boxShadow: periodo === p ? "0 1px 3px rgba(0,0,0,.1)" : "none", transition: "all .15s" }}>
                    {labels[p]}
                  </button>
                );
              })}
            </div>

            {/* Tipo */}
            <select value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)} style={sel}>
              <option value="todos">Todos os tipos</option>
              {TIPOS_ORIENTACAO.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>

            {/* Cliente */}
            <select value={clienteFiltro} onChange={e => setClienteFiltro(e.target.value)} style={sel}>
              <option value="todos">Todos os clientes</option>
              {clienteOpts.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </select>

            {/* Busca */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "7px", padding: "7px 10px", flex: "1 1 180px" }}>
              <svg width="12" height="12" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar orientação..."
                style={{ border: "none", outline: "none", fontSize: "12px", color: "#111827", background: "transparent", flex: 1 }} />
              {busca && <button onClick={() => setBusca("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex", padding: 0 }}>
                <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>}
            </div>

            {/* View toggle */}
            <div style={{ marginLeft: "auto", display: "flex", background: "#f3f4f6", borderRadius: "8px", padding: "3px", gap: "2px", flexShrink: 0 }}>
              {(["data","cliente"] as const).map(v => (
                <button key={v} onClick={() => setAgrupamento(v)}
                  style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 12px", fontSize: "12px", fontWeight: 500, border: "none", borderRadius: "6px", cursor: "pointer", background: agrupamento === v ? "#fff" : "transparent", color: agrupamento === v ? "#1d4ed8" : "#6b7280", boxShadow: agrupamento === v ? "0 1px 3px rgba(0,0,0,.1)" : "none" }}>
                  {v === "data"
                    ? <><svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Por data</>
                    : <><svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> Por cliente</>
                  }
                </button>
              ))}
            </div>
          </div>

          {/* Results count */}
          <div style={{ marginTop: "10px", fontSize: "12px", color: "#9ca3af" }}>
            {loading ? "Carregando..." : `${filtered.length} orientaç${filtered.length !== 1 ? "ões" : "ão"} encontrada${filtered.length !== 1 ? "s" : ""}`}
          </div>
        </div>

        {/* ── Tipos de orientação (legenda rápida) ── */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" }}>
          {TIPOS_ORIENTACAO.slice(0, 5).map(t => (
            <button key={t.key} onClick={() => setTipoFiltro(tipoFiltro === t.key ? "todos" : t.key)}
              style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 11px", borderRadius: "20px", fontSize: "11px", fontWeight: 500, cursor: "pointer", border: `1px solid ${tipoFiltro === t.key ? t.color : "#e5e7eb"}`, background: tipoFiltro === t.key ? t.bg : "#fff", color: tipoFiltro === t.key ? t.color : "#6b7280", transition: "all .15s" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: t.color }} />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Timeline ── */}
        {loading ? (
          <SkeletonTimeline />
        ) : filtered.length === 0 ? (
          <EmptyState onNew={() => setNovaOpen(true)} />
        ) : agrupamento === "data" ? (
          <TimelineByDate groups={groupedByData} navigate={navigate} />
        ) : (
          <TimelineByCliente groups={groupedByCliente} navigate={navigate} />
        )}
      </main>

      {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 29 }} />}
      <NovaOrientacaoModal open={novaOpen} onOpenChange={setNovaOpen} onSaved={() => setReloadKey(k => k + 1)} />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function OrientacaoCard({ item, navigate }: { item: InteracaoEnriquecida; navigate: (p: string) => void }) {
  const tc = getTipoConfig(item.tipo);
  const clienteId = item.cliente_id_real;
  return (
    <div
      onClick={() => clienteId != null && navigate(`/radar/${clienteId}`)}
      style={{ display: "flex", gap: "14px", padding: "14px 18px", cursor: "pointer", borderRadius: "8px", transition: "background .1s" }}
      onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      {/* Avatar */}
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
        <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "#1d4ed8" }}>
          {nameInitials(item.cliente_nome)}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap", marginBottom: "3px" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>{item.cliente_nome}</span>
              {item.cliente_fantasia && item.cliente_fantasia !== item.cliente_nome && (
                <span style={{ fontSize: "11px", color: "#9ca3af" }}>({item.cliente_fantasia})</span>
              )}
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "20px", fontSize: "10px", fontWeight: 600, background: tc.bg, color: tc.color }}>
                <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: tc.color }} />
                {tc.label}
              </span>
              {item.canal && (
                <span style={{ fontSize: "10px", color: "#9ca3af", background: "#f3f4f6", padding: "2px 7px", borderRadius: "10px" }}>
                  {item.canal}
                </span>
              )}
            </div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b", marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.assunto ?? "Sem assunto"}
            </div>
            {item.resumo && (
              <div style={{ fontSize: "12px", color: "#6b7280", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>
                {item.resumo}
              </div>
            )}
            {(item as any).proximo_passo && (
              <div style={{ marginTop: "6px", display: "flex", alignItems: "flex-start", gap: "5px", fontSize: "11px", color: "#d97706", background: "#fffbeb", padding: "4px 8px", borderRadius: "6px", border: "1px solid #fde68a" }}>
                <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: "1px" }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                <span>{(item as any).proximo_passo}</span>
              </div>
            )}
          </div>
          <div style={{ fontSize: "11px", color: "#9ca3af", whiteSpace: "nowrap", flexShrink: 0 }}>
            {formatDateRelative(item.data_interacao ?? item.data ?? item.criado_em)}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineByDate({ groups, navigate }: { groups: [string, InteracaoEnriquecida[]][]; navigate: (p: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {groups.map(([dateKey, items]) => (
        <div key={dateKey} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden" }}>
          {/* Date header */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 18px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#1d4ed8", flexShrink: 0 }} />
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#374151" }}>
              {dateKey === "sem-data" ? "Sem data" : formatDateHeader(dateKey)}
            </span>
            <span style={{ fontSize: "11px", color: "#9ca3af", background: "#f3f4f6", padding: "1px 7px", borderRadius: "10px" }}>
              {items.length} orientaç{items.length !== 1 ? "ões" : "ão"}
            </span>
          </div>
          {/* Items */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {items.map((item, idx) => (
              <div key={String(item.id ?? idx)} style={{ borderBottom: idx < items.length - 1 ? "1px solid #f9fafb" : "none" }}>
                <OrientacaoCard item={item} navigate={navigate} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineByCliente({ groups, navigate }: { groups: [string, { nome: string; fantasia: string | null; items: InteracaoEnriquecida[] }][]; navigate: (p: string) => void }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(groups.slice(0, 3).map(g => g[0])));

  const toggle = (key: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {groups.map(([key, group]) => {
        const isOpen = expanded.has(key);
        return (
          <div key={key} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden" }}>
            {/* Client header */}
            <button onClick={() => toggle(key)} style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px", padding: "12px 18px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
              onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "#1d4ed8", flexShrink: 0 }}>
                {nameInitials(group.nome)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.nome}</div>
                {group.fantasia && group.fantasia !== group.nome && (
                  <div style={{ fontSize: "11px", color: "#9ca3af" }}>{group.fantasia}</div>
                )}
              </div>
              <span style={{ fontSize: "11px", fontWeight: 600, background: "#eff6ff", color: "#1d4ed8", padding: "2px 9px", borderRadius: "20px", flexShrink: 0 }}>
                {group.items.length} orientaç{group.items.length !== 1 ? "ões" : "ão"}
              </span>
              {/* Mini type breakdown */}
              <div style={{ display: "flex", gap: "3px", flexShrink: 0 }}>
                {Array.from(new Set(group.items.map(i => i.tipo))).slice(0, 3).map(t => {
                  const tc = getTipoConfig(t);
                  return <div key={t} style={{ width: "8px", height: "8px", borderRadius: "50%", background: tc.color }} title={tc.label} />;
                })}
              </div>
              <svg width="14" height="14" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}>
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </button>

            {/* Items */}
            {isOpen && (
              <div style={{ borderTop: "1px solid #f3f4f6" }}>
                {group.items.map((item, idx) => (
                  <div key={String(item.id ?? idx)} style={{ borderBottom: idx < group.items.length - 1 ? "1px solid #f9fafb" : "none" }}>
                    <OrientacaoCard item={item} navigate={navigate} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SkeletonTimeline() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden" }}>
          <div style={{ padding: "10px 18px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6", display: "flex", gap: "8px" }}>
            <div style={{ width: "60px", height: "14px", background: "#e5e7eb", borderRadius: "4px" }} />
            <div style={{ width: "40px", height: "14px", background: "#f3f4f6", borderRadius: "4px" }} />
          </div>
          {[1, 2].map(j => (
            <div key={j} style={{ display: "flex", gap: "14px", padding: "14px 18px", borderBottom: j < 2 ? "1px solid #f9fafb" : "none" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#f3f4f6", flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ height: "12px", width: "40%", background: "#f3f4f6", borderRadius: "4px" }} />
                <div style={{ height: "12px", width: "70%", background: "#f3f4f6", borderRadius: "4px" }} />
                <div style={{ height: "11px", width: "55%", background: "#f9fafb", borderRadius: "4px" }} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "64px 32px", textAlign: "center" }}>
      <div style={{ width: "52px", height: "52px", background: "#eff6ff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#1d4ed8" }}>
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      </div>
      <div style={{ fontSize: "15px", fontWeight: 600, color: "#111827", marginBottom: "6px" }}>Nenhuma orientação encontrada</div>
      <div style={{ fontSize: "13px", color: "#9ca3af", marginBottom: "20px" }}>Tente ajustar os filtros ou registre uma nova orientação.</div>
      <button onClick={onNew}
        style={{ display: "inline-flex", alignItems: "center", gap: "7px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 18px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
        Registrar orientação
      </button>
    </div>
  );
}
