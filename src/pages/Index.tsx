import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, type InteracaoRow, type RadarConsultivoRow, type SemaforoStatus } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { TIPOS_ORIENTACAO } from "@/lib/constants";
import { StatusBadge } from "@/components/StatusBadge";
import { NovoClienteModal } from "@/components/NovoClienteModal";

const TIPO_CHART_COLORS: Record<string, string> = {
  fiscal:         "#3B82F6",
  trabalhista:    "#EC4899",
  contabil:       "#06B6D4",
  societario:     "#F97316",
  planejamento:   "#22C55E",
  consultiva:     "#16A34A",
  suporte:        "#475569",
  relacionamento: "#8B5CF6",
  comercial:      "#A855F7",
};

const TIPO_SHORT_LABELS: Record<string, string> = {
  fiscal:         "Fiscal",
  trabalhista:    "Trabalhista",
  contabil:       "Contábil",
  societario:     "Societário",
  planejamento:   "Planejamento",
  consultiva:     "Consultiva",
  suporte:        "Suporte",
  relacionamento: "Relacionamento",
  comercial:      "Comercial",
};

const TIPO_DISPLAY = TIPOS_ORIENTACAO.map(t => ({
  key:   t.key,
  label: TIPO_SHORT_LABELS[t.key] ?? t.key,
  color: TIPO_CHART_COLORS[t.key]  ?? t.color,
}));

function TipoDonut({ data, total }: { data: [string, number][]; total: number }) {
  const colorMap: Record<string, string> = Object.fromEntries(TIPO_DISPLAY.map(t => [t.key, t.color]));
  const r = 60, cx = 80, cy = 80, sw = 20;
  const circ = 2 * Math.PI * r;
  const startOffset = circ * 0.25;
  let acc = 0;
  const segments = data.map(([key, count]) => {
    const color = colorMap[key] ?? "#94a3b8";
    const len = total > 0 ? (count / total) * circ : 0;
    const dashOffset = startOffset - acc;
    acc += len;
    return { key, count, color, len, dashOffset };
  });
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0f0f5" strokeWidth={sw} />
      {segments.map(seg => (
        <circle key={seg.key} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={sw}
          strokeDasharray={`${seg.len} ${circ}`} strokeDashoffset={seg.dashOffset} strokeLinecap="butt" />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={22} fontWeight="800" fill="#111827">{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize={10} fill="#9ca3af" fontWeight="500">TOTAL</text>
    </svg>
  );
}

export default function Index() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<RadarConsultivoRow[]>([]);
  const [interacoes, setInteracoes] = useState<InteracaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const userEmail = user?.email ?? "";
  const [mounted, setMounted] = useState(false);
  const [displayCounts, setDisplayCounts] = useState({ total: 0, critico: 0, atencao: 0, followups: 0 });
  const [atencaoFilter, setAtencaoFilter] = useState<"todos" | "critico" | "atencao" | "monitorar">("todos");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [{ data, error }, { data: intData }] = await Promise.all([
        supabase.from("radar_consultivo").select("*"),
        supabase.from("interacoes").select("*").order("data_interacao", { ascending: false }),
      ]);
      if (!active) return;
      if (error) { setError(error.message); setRows([]); }
      else { setRows((data ?? []) as RadarConsultivoRow[]); setError(null); }
      setInteracoes((intData ?? []) as InteracaoRow[]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [reloadKey]);

  const counts = useMemo(() => {
    const c = { total: rows.length, critico: 0, atencao: 0, verde: 0 };
    for (const r of rows) {
      if (r.semaforo === "critico") c.critico++;
      else if (r.semaforo === "atencao") c.atencao++;
      else if (r.semaforo === "verde") c.verde++;
    }
    return c;
  }, [rows]);

  const totalFollowups = useMemo(() =>
    rows.reduce((sum, r) => sum + (r.followups_pendentes ?? 0), 0),
    [rows]
  );

  const atencaoList = useMemo(() => {
    const result: Array<{ row: RadarConsultivoRow; severity: "critico" | "atencao" | "monitorar" }> = [];
    for (const r of rows) {
      const dias = r.dias_sem_orientacao ?? 0;
      let severity: "critico" | "atencao" | "monitorar" | null = null;
      if (r.semaforo === "critico" || dias >= 5) {
        severity = "critico";
      } else if (r.semaforo === "atencao" || (dias >= 2 && dias <= 4)) {
        severity = "atencao";
      } else if (dias === 1) {
        severity = "monitorar";
      }
      if (severity === null) continue;
      result.push({ row: r, severity });
    }
    const order = { critico: 0, atencao: 1, monitorar: 2 };
    result.sort((a, b) => {
      if (order[a.severity] !== order[b.severity]) return order[a.severity] - order[b.severity];
      return (b.row.dias_sem_orientacao ?? 0) - (a.row.dias_sem_orientacao ?? 0);
    });
    return result;
  }, [rows]);

  const filteredAtencao = useMemo(() =>
    atencaoFilter === "todos" ? atencaoList : atencaoList.filter(x => x.severity === atencaoFilter),
    [atencaoList, atencaoFilter]
  );

  const topClients = useMemo(() => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const map: Record<string, { count: number; lastDate: Date | null }> = {};
    for (const i of interacoes) {
      const key = String(i.cliente_id ?? "");
      if (!key) continue;
      const d = i.data_interacao ? new Date(i.data_interacao) : null;
      if (!map[key]) map[key] = { count: 0, lastDate: null };
      if (d && d >= thirtyDaysAgo) map[key].count++;
      if (d && (!map[key].lastDate || d > map[key].lastDate!)) map[key].lastDate = d;
    }
    return Object.entries(map)
      .filter(([, v]) => v.count > 0)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 4)
      .map(([id, v]) => {
        const row = rows.find(r => String(r.cliente_id ?? r.id) === id);
        const daysAgo = v.lastDate ? Math.floor((Date.now() - v.lastDate.getTime()) / 86_400_000) : null;
        return { id, count: v.count, row, daysAgo };
      })
      .filter(x => x.row != null) as { id: string; count: number; row: RadarConsultivoRow; daysAgo: number | null }[];
  }, [interacoes, rows]);

  const tipoDistribuicao = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of interacoes) {
      const t = i.tipo ?? "outros";
      map[t] = (map[t] ?? 0) + 1;
    }
    return Object.entries(map)
      .filter(([k]) => TIPO_DISPLAY.some(td => td.key === k))
      .sort((a, b) => b[1] - a[1]) as [string, number][];
  }, [interacoes]);

  const lastTipoByClientId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const i of interacoes) {
      const key = String(i.cliente_id ?? "");
      if (!key || map[key]) continue;
      if (i.tipo) map[key] = i.tipo;
    }
    return map;
  }, [interacoes]);

  const segmentos = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of rows) {
      const s = r.segmento ?? "Outros";
      map[s] = (map[s] ?? 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [rows]);

  // Animated counter on data load
  useEffect(() => {
    if (loading) return;
    setMounted(true);
    const duration = 900;
    const start = Date.now();
    const targets = { total: counts.total, critico: counts.critico, atencao: counts.atencao, followups: totalFollowups };
    let raf: number;
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayCounts({
        total: Math.round(targets.total * ease),
        critico: Math.round(targets.critico * ease),
        atencao: Math.round(targets.atencao * ease),
        followups: Math.round(targets.followups * ease),
      });
      if (progress < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [loading, counts.total, counts.critico, counts.atencao, totalFollowups]);

  const nameInitials = (name: string | null) => (name ?? "?").trim().split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

  const firstName = userEmail ? userEmail.split("@")[0].split(".")[0] : "";
  const firstName2 = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  const now = new Date();
  const hora = now.getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const dataFormatada = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const S: Record<string, React.CSSProperties> = {
    root: { minHeight: "100vh", background: "#f4f6f9", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" },
    header: { background: "#fff", borderBottom: "1px solid #e5e7eb", position: "sticky" as const, top: 0, zIndex: 30 },
    headerInner: { maxWidth: "1240px", margin: "0 auto", padding: "0 28px", display: "flex", alignItems: "center", height: "58px", gap: "28px" },
    logo: { display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 },
    logoText: { fontSize: "12px", fontWeight: 600, color: "#374151", borderLeft: "1px solid #e5e7eb", paddingLeft: "10px", letterSpacing: ".02em" },
    nav: { display: "flex", gap: "2px", flex: 1 },
    main: { maxWidth: "1240px", margin: "0 auto", padding: "28px 28px 48px" },
    greeting: { marginBottom: "28px" },
    greetH: { fontSize: "20px", fontWeight: 700, color: "#111827", margin: 0 },
    greetSub: { fontSize: "13px", color: "#6b7280", marginTop: "3px" },
    grid4: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "22px" },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "20px" },
    grid3: { display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: "16px", marginBottom: "16px" },
    card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,.05)" },
    cardPad: { padding: "20px" },
    cardTitle: { fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: ".08em", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" },
    skel: { background: "#f3f4f6", borderRadius: "5px", animation: "pulse 1.5s ease-in-out infinite" },
  };

  const KpiCard = ({
    label, value, sub, icon, accent, border, gradient,
  }: {
    label: string; value: number | string; sub: string;
    icon: React.ReactNode; accent: string; border: string; gradient: string;
  }) => (
    <div
      style={{
        background: gradient,
        border: "1px solid rgba(0,0,0,.06)",
        borderRadius: "14px",
        borderTop: `3px solid ${border}`,
        padding: "20px 22px",
        boxShadow: "0 2px 10px rgba(0,0,0,.06)",
        transition: "box-shadow .25s ease, transform .25s ease",
        cursor: "default",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = "0 10px 28px rgba(0,0,0,.12)";
        e.currentTarget.style.transform = "translateY(-3px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,.06)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: ".07em", marginBottom: "10px" }}>{label}</div>
          <div style={{ fontSize: "34px", fontWeight: 800, color: "#111827", lineHeight: 1 }}>{loading ? "—" : value}</div>
          <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "6px" }}>{sub}</div>
        </div>
        <div style={{
          width: "48px", height: "48px", borderRadius: "13px",
          background: `linear-gradient(135deg, ${accent} 0%, ${accent}bb 100%)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", flexShrink: 0,
          boxShadow: `0 4px 14px ${accent}45`,
        }}>
          {icon}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes pulse-red {
          0%, 100% { box-shadow: 0 2px 10px rgba(0,0,0,.06), 0 0 0 0 rgba(220,38,38,0.4); }
          50% { box-shadow: 0 2px 10px rgba(0,0,0,.06), 0 0 0 6px rgba(220,38,38,0); }
        }
        @keyframes bar-fill {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 640px) {
          .radial-grid { grid-template-columns: 1fr !important; }
          .health-banner { flex-direction: column !important; gap: 10px !important; align-items: stretch !important; }
        }
      `}</style>

      <main style={S.main}>

        {/* Greeting + action */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "24px" }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: "4px" }}>{dataFormatada}</div>
            <h1 style={{ fontSize: "21px", fontWeight: 700, color: "#111827", margin: 0 }}>{saudacao}{firstName2 ? `, ${firstName2}` : ""}.</h1>
            <p style={{ fontSize: "13px", color: "#6b7280", margin: "4px 0 0" }}>
              {loading ? "Carregando sua carteira..." : `Você tem ${counts.total} cliente${counts.total !== 1 ? "s" : ""} na carteira${counts.critico > 0 ? ` — ${counts.critico} requer${counts.critico === 1 ? "" : "em"} atenção imediata.` : " e tudo está sob controle."}`}
            </p>
          </div>
          <button onClick={() => setNovoOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: "7px", background: "linear-gradient(135deg,#1d4ed8,#1e40af)", color: "#fff", border: "none", borderRadius: "9px", padding: "10px 18px", fontSize: "13px", fontWeight: 600, cursor: "pointer", flexShrink: 0, boxShadow: "0 4px 14px rgba(29,78,216,.35)", transition: "all .2s ease" }}
            onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg,#1e40af,#1e3a8a)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(29,78,216,.45)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg,#1d4ed8,#1e40af)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(29,78,216,.35)"; e.currentTarget.style.transform = "translateY(0)"; }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            Novo cliente
          </button>
        </div>

        {/* KPIs */}
        <div style={S.grid4}>
          <KpiCard
            label="Carteira total" value={displayCounts.total} sub="clientes ativos"
            accent="#1d4ed8" border="#1d4ed8"
            gradient="linear-gradient(135deg, #f0f6ff 0%, #dbeafe 100%)"
            icon={<svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
          />
          <KpiCard
            label="Críticos" value={displayCounts.critico} sub="precisam de contato urgente"
            accent="#dc2626" border="#dc2626"
            gradient="linear-gradient(135deg, #fff5f5 0%, #fee2e2 100%)"
            icon={<svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
          />
          <KpiCard
            label="Em atenção" value={displayCounts.atencao} sub="acompanhamento próximo"
            accent="#d97706" border="#d97706"
            gradient="linear-gradient(135deg, #fffdf0 0%, #fef3c7 100%)"
            icon={<svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          />
          <KpiCard
            label="Acompanhamentos" value={displayCounts.followups} sub="pendentes na carteira"
            accent="#7c3aed" border="#7c3aed"
            gradient="linear-gradient(135deg, #f8f5ff 0%, #ede9fe 100%)"
            icon={<svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>}
          />
        </div>

        {/* Middle row: donut + bloco fundido de atenção */}
        <div style={S.grid3}>

          {/* ─── Saúde da carteira — 3 mini-radiais ─── */}
          <div className="card-elevated" style={{ overflow: "hidden" }}>
            <div style={{ height: "3px", background: "linear-gradient(90deg, #10B981, #14B8A6)" }} />

            {/* Header */}
            <div style={{ padding: "14px 18px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
                💚 Saúde da carteira
              </span>
              <span style={{ fontSize: "11px", color: "#64748B", background: "#F1F5F9", padding: "3px 9px", borderRadius: "999px", fontWeight: 500 }}>
                {loading ? "—" : counts.total} clientes ativos
              </span>
            </div>

            {/* Body */}
            <div style={{ padding: "16px 18px 18px" }}>

              {/* Grid 3 mini-radiais */}
              <div className="radial-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "18px" }}>
                {[
                  {
                    label: "Em dia",
                    value: counts.verde,
                    color: "#10B981",
                    numColor: (!loading && counts.verde > 0) ? "#059669" : "#94A3B8",
                    pct: counts.total > 0 ? counts.verde / counts.total : 0,
                    footer: counts.total === 0 ? "nenhum cliente cadastrado" : `de ${counts.total} clientes`,
                  },
                  {
                    label: "Em atenção",
                    value: counts.atencao,
                    color: "#F59E0B",
                    numColor: (!loading && counts.atencao > 0) ? "#D97706" : "#94A3B8",
                    pct: counts.total > 0 ? counts.atencao / counts.total : 0,
                    footer: counts.atencao > 0 ? `${counts.atencao} no momento` : "nenhum no momento",
                  },
                  {
                    label: "Críticos",
                    value: counts.critico,
                    color: "#EF4444",
                    numColor: (!loading && counts.critico > 0) ? "#DC2626" : "#94A3B8",
                    pct: counts.total > 0 ? counts.critico / counts.total : 0,
                    footer: counts.critico > 0
                      ? `requer${counts.critico === 1 ? "" : "em"} contato`
                      : "nenhum no momento",
                  },
                ].map(card => {
                  const CIRC = 263.9;
                  const offset = !mounted || loading ? CIRC : Math.max(0, CIRC * (1 - card.pct));
                  const pctLabel = counts.total > 0 ? `${Math.round(card.pct * 100)}%` : "0%";
                  return (
                    <div key={card.label}
                      style={{ background: "#FAFBFC", border: "0.5px solid rgba(15,23,42,0.04)", borderRadius: "12px", padding: "18px 14px", display: "flex", flexDirection: "column" as const, alignItems: "center", gap: "12px", transition: "all 0.2s" }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(15,23,42,0.08)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>

                      {/* Label com bolinha */}
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: 600, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
                        <span style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", background: card.color, flexShrink: 0 }} />
                        {card.label}
                      </div>

                      {/* Anel radial + texto central */}
                      <div style={{ position: "relative" as const, width: "100px", height: "100px", flexShrink: 0 }}>
                        <svg width="100" height="100" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="42" fill="none" stroke="#F1F5F9" strokeWidth="8" />
                          <circle
                            cx="50" cy="50" r="42"
                            fill="none"
                            stroke={card.color}
                            strokeWidth="8"
                            strokeLinecap="round"
                            transform="rotate(-90 50 50)"
                            strokeDasharray={CIRC}
                            strokeDashoffset={offset}
                            style={{ transition: "stroke-dashoffset .8s cubic-bezier(.4,0,.2,1)" }}
                          />
                        </svg>
                        <div style={{ position: "absolute" as const, top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" as const, lineHeight: 1, pointerEvents: "none" }}>
                          <div style={{ fontSize: "26px", fontWeight: 700, color: card.numColor, lineHeight: 1 }}>
                            {loading ? "—" : card.value}
                          </div>
                          <div style={{ fontSize: "10px", color: "#94A3B8", marginTop: "3px" }}>
                            {loading ? "" : pctLabel}
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      <div style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 500, textAlign: "center" as const }}>
                        {loading ? "carregando…" : card.footer}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Banner Health Score */}
              {(() => {
                const hs = counts.total > 0 ? Math.round((counts.verde / counts.total) * 100) : -1;
                const isNeutral = counts.total === 0;
                const isGreen = hs >= 70;
                const isYellow = hs >= 40 && hs < 70;

                const bannerBg = isNeutral ? "#F1F5F9" : isGreen ? "linear-gradient(135deg, #ECFDF5, #D1FAE5)" : isYellow ? "linear-gradient(135deg, #FFFBEB, #FEF3C7)" : "linear-gradient(135deg, #FEF2F2, #FECACA)";
                const bannerBorder = isNeutral ? "#E2E8F0" : isGreen ? "#A7F3D0" : isYellow ? "#FCD34D" : "#FCA5A5";
                const strongColor = isNeutral ? "#64748B" : isGreen ? "#047857" : isYellow ? "#B45309" : "#B91C1C";
                const subColor = isNeutral ? "#94A3B8" : isGreen ? "#059669" : isYellow ? "#D97706" : "#DC2626";
                const iconColor = isNeutral ? "#94A3B8" : isGreen ? "#10B981" : isYellow ? "#F59E0B" : "#EF4444";
                const sub = isNeutral ? "Sem dados ainda · cadastre clientes" : isGreen ? "Carteira saudável · continue assim" : isYellow ? "Atenção: alguns clientes precisam de contato" : "Carteira em situação crítica · ação recomendada";

                return (
                  <div className="health-banner" style={{ marginTop: "16px", background: bannerBg, border: `0.5px solid ${bannerBorder}`, borderRadius: "11px", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "38px", height: "38px", background: "#fff", borderRadius: "10px", boxShadow: "0 1px 4px rgba(15,23,42,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="18" height="18" fill="none" stroke={iconColor} strokeWidth="2.2" viewBox="0 0 24 24">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                          <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: strongColor, lineHeight: 1.2 }}>Health Score geral</div>
                        <div style={{ fontSize: "11px", color: subColor, marginTop: "3px" }}>{loading ? "carregando…" : sub}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
                      <span style={{ fontSize: "24px", fontWeight: 700, color: strongColor }}>
                        {loading ? "—" : isNeutral ? "—" : hs}
                      </span>
                      {!isNeutral && !loading && <span style={{ fontSize: "13px", fontWeight: 500, color: subColor }}>%</span>}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ─── Clientes que precisam de atenção (bloco fundido) ─── */}
          <div className="card-elevated" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ height: "3px", background: "linear-gradient(90deg, #EF4444, #F97316)" }} />

            {/* Header */}
            <div style={{ padding: "14px 18px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>⚠️ Clientes que precisam de atenção</span>
                <span style={{ fontSize: "10px", fontWeight: 700, background: "#EF4444", color: "#fff", borderRadius: "10px", padding: "2px 7px" }}>
                  {atencaoList.length}
                </span>
              </div>
              <button onClick={() => navigate("/clientes")}
                style={{ fontSize: "11px", color: "#1D4ED8", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>
                Ver todos →
              </button>
            </div>

            {/* Filter bar */}
            <div style={{ padding: "10px 18px", background: "#FAFBFC", borderBottom: "1px solid #E2E8F0", display: "flex", gap: "6px", flexWrap: "wrap" as const, marginTop: "10px" }}>
              {[
                { key: "todos" as const, label: "Todos", count: atencaoList.length },
                { key: "critico" as const, label: "🔴 Críticos", count: atencaoList.filter(x => x.severity === "critico").length },
                { key: "atencao" as const, label: "🟡 Em atenção", count: atencaoList.filter(x => x.severity === "atencao").length },
                { key: "monitorar" as const, label: "⚪ Monitorar", count: atencaoList.filter(x => x.severity === "monitorar").length },
              ].map(f => (
                <button key={f.key} onClick={() => setAtencaoFilter(f.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: "5px",
                    padding: "4px 10px", fontSize: "11px", fontWeight: 500,
                    borderRadius: "6px", cursor: "pointer",
                    background: atencaoFilter === f.key ? "#1D4ED8" : "#fff",
                    color: atencaoFilter === f.key ? "#fff" : "#64748B",
                    border: atencaoFilter === f.key ? "1px solid #1D4ED8" : "0.5px solid #E2E8F0",
                    transition: "all .15s ease",
                  }}>
                  {f.label}
                  <span style={{
                    fontSize: "10px", fontWeight: 700,
                    background: atencaoFilter === f.key ? "rgba(255,255,255,0.25)" : "#F1F5F9",
                    color: atencaoFilter === f.key ? "#fff" : "#475569",
                    borderRadius: "10px", padding: "0 5px",
                    minWidth: "18px", textAlign: "center" as const,
                  }}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Client list */}
            <div style={{ flex: 1, overflowY: "auto" as const }}>
              {loading ? (
                <div style={{ padding: "8px 18px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[1, 2, 3].map(i => <div key={i} style={{ height: "56px", background: "#f3f4f6", borderRadius: "8px" }} />)}
                </div>
              ) : atencaoList.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 20px", color: "#9ca3af", fontSize: "13px" }}>
                  🎉 Tudo em dia! Nenhum cliente precisa de atenção no momento.
                </div>
              ) : filteredAtencao.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px", color: "#9ca3af", fontSize: "12px" }}>
                  Nenhum cliente nesta categoria.
                </div>
              ) : (
                filteredAtencao.map(({ row: rw, severity }, i) => {
                  const id = rw.id ?? rw.cliente_id;
                  const dias = rw.dias_sem_orientacao ?? 0;
                  const lastTipo = lastTipoByClientId[String(rw.cliente_id ?? rw.id ?? "")];
                  const avatarBg = severity === "critico" ? "#FEF2F2" : severity === "atencao" ? "#FEF3C7" : "#F1F5F9";
                  const avatarColor = severity === "critico" ? "#DC2626" : severity === "atencao" ? "#B45309" : "#475569";
                  const dotColor = severity === "critico" ? "#EF4444" : severity === "atencao" ? "#F59E0B" : "#94A3B8";
                  const pillBg = severity === "critico" ? "#FEF2F2" : severity === "atencao" ? "#FEF3C7" : "#F1F5F9";
                  const pillColor = severity === "critico" ? "#DC2626" : severity === "atencao" ? "#B45309" : "#475569";
                  const severityLabel = severity === "critico" ? "CRÍTICO" : severity === "atencao" ? "EM ATENÇÃO" : "MONITORAR";
                  return (
                    <div key={String(id ?? i)}
                      style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 18px", borderBottom: i < filteredAtencao.length - 1 ? "1px solid #F8FAFC" : "none" }}>

                      {/* Avatar com bolinha de severidade */}
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: avatarBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: avatarColor }}>
                          {nameInitials(rw.razao_social)}
                        </div>
                        <div style={{ position: "absolute", bottom: 0, right: 0, width: "10px", height: "10px", borderRadius: "50%", background: dotColor, border: "2px solid #fff" }} />
                      </div>

                      {/* Nome + meta */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px", flexWrap: "wrap" as const }}>
                          <span style={{ fontSize: "12px", fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: "160px" }}>{rw.razao_social ?? "—"}</span>
                          <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.02em", background: pillBg, color: pillColor, borderRadius: "4px", padding: "1px 5px", flexShrink: 0, whiteSpace: "nowrap" as const }}>
                            {severityLabel}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "#64748B", flexWrap: "wrap" as const }}>
                          <span style={{ fontWeight: 600 }}>{dias} dia{dias !== 1 ? "s" : ""} sem orientação</span>
                          {rw.segmento && (
                            <>
                              <span style={{ color: "#CBD5E1" }}>·</span>
                              <span style={{ background: "#F8FAFC", padding: "1px 5px", borderRadius: "4px", border: "1px solid #E2E8F0" }}>{rw.segmento}</span>
                            </>
                          )}
                          <span style={{ color: "#CBD5E1" }}>·</span>
                          <span>Última: {lastTipo ? (TIPO_SHORT_LABELS[lastTipo] ?? lastTipo) : "—"}</span>
                        </div>
                      </div>

                      {/* Ações */}
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                        {severity === "critico" ? (
                          <button
                            onClick={() => {
                              const telefone = (rw as any).telefone as string | undefined;
                              if (telefone) {
                                window.open(`https://wa.me/${telefone.replace(/\D/g, "")}`, "_blank");
                              } else {
                                navigate(`/radar/${id}`);
                              }
                            }}
                            style={{ padding: "5px 10px", fontSize: "10px", fontWeight: 600, borderRadius: "6px", background: "#1D4ED8", color: "#fff", border: "none", cursor: "pointer", whiteSpace: "nowrap" as const }}>
                            📞 Contatar
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate("/followups", { state: { clienteId: String(rw.cliente_id ?? id) } })}
                            style={{ padding: "5px 10px", fontSize: "10px", fontWeight: 600, borderRadius: "6px", background: "#F59E0B", color: "#fff", border: "none", cursor: "pointer", whiteSpace: "nowrap" as const }}>
                            🕐 Acompanhar
                          </button>
                        )}
                        <button
                          onClick={() => id != null ? navigate(`/radar/${id}`) : console.log("navigate:", id)}
                          style={{ width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", border: "1px solid #E2E8F0", borderRadius: "7px", cursor: "pointer", flexShrink: 0 }}>
                          <svg width="14" height="14" fill="none" stroke="#64748B" strokeWidth="2" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Bottom row: segmentos + quick actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

          {/* Segmentos */}
          {segmentos.length > 0 && (
            <div style={{ ...S.card, ...S.cardPad }}>
              <div style={S.cardTitle}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                Distribuição por Segmento
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {segmentos.map(([seg, count], idx) => {
                  const pct = counts.total > 0 ? (count / counts.total) * 100 : 0;
                  return (
                    <div key={seg}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                        <span style={{ fontSize: "12px", color: "#374151", fontWeight: 500 }}>{seg}</span>
                        <span style={{ fontSize: "12px", color: "#6b7280" }}>{count} cliente{count !== 1 ? "s" : ""}</span>
                      </div>
                      <div style={{ height: "6px", background: "#f0f0f5", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          background: `linear-gradient(90deg, #1d4ed8 0%, #60a5fa 100%)`,
                          borderRadius: "4px",
                          width: mounted ? `${pct}%` : "0%",
                          transition: `width .9s cubic-bezier(.4,0,.2,1) ${idx * 0.08}s`,
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick access */}
          <div style={{ ...S.card, ...S.cardPad }}>
            <div style={S.cardTitle}>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              Acesso Rápido
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              {[
                { label: "Ver todos os clientes", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", path: "/clientes", color: "#1d4ed8", hoverBg: "#eff6ff", hoverBorder: "#bfdbfe" },
                { label: "Registrar orientação", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8", path: "/", color: "#16a34a", hoverBg: "#f0fdf4", hoverBorder: "#bbf7d0" },
                { label: "Acompanhamentos pendentes", icon: "M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11", path: "/", color: "#7c3aed", hoverBg: "#f5f3ff", hoverBorder: "#ddd6fe" },
                { label: "Administração", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", path: "/admin", color: "#374151", hoverBg: "#f9fafb", hoverBorder: "#d1d5db" },
              ].map(a => (
                <button key={a.label} onClick={() => navigate(a.path)}
                  style={{ display: "flex", alignItems: "center", gap: "10px", padding: "13px 14px", border: "1px solid #e5e7eb", borderRadius: "10px", background: "#fff", cursor: "pointer", textAlign: "left" as const, transition: "all .2s ease" }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = a.hoverBg;
                    e.currentTarget.style.borderColor = a.hoverBorder;
                    e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.08)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "#fff";
                    e.currentTarget.style.borderColor = "#e5e7eb";
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}>
                  <div style={{
                    width: "38px", height: "38px", borderRadius: "10px",
                    background: `linear-gradient(135deg, ${a.color}18, ${a.color}28)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: a.color, flexShrink: 0,
                    border: `1px solid ${a.color}20`,
                    transition: "all .2s ease",
                  }}>
                    <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d={a.icon}/></svg>
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: 500, color: "#374151", lineHeight: 1.3 }}>{a.label}</span>
                </button>
              ))}
            </div>

            {/* New client shortcut */}
            <button onClick={() => setNovoOpen(true)}
              style={{ width: "100%", marginTop: "12px", padding: "12px", border: "1px dashed #93c5fd", borderRadius: "10px", background: "linear-gradient(135deg,#eff6ff,#dbeafe)", cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", transition: "all .2s ease" }}
              onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg,#dbeafe,#bfdbfe)"; e.currentTarget.style.borderColor = "#60a5fa"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(29,78,216,.15)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg,#eff6ff,#dbeafe)"; e.currentTarget.style.borderColor = "#93c5fd"; e.currentTarget.style.boxShadow = "none"; }}>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
              Cadastrar novo cliente
            </button>
          </div>
        </div>

        {/* ── Top clientes ── */}
        <div style={{ marginTop: "16px", marginBottom: "16px" }}>
          <div className="card-elevated" style={{ overflow: "hidden" }}>
            <div style={{ height: "3px", background: "linear-gradient(90deg, #6366F1, #1D4ED8)" }} />
            <div style={{ padding: "16px 18px" }}>
              <div style={{ marginBottom: "14px" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" as const, letterSpacing: ".04em" }}>
                  🏆 Top clientes
                </span>
              </div>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {[1, 2, 3, 4].map(i => <div key={i} style={{ height: "44px", background: "#f3f4f6", borderRadius: "8px" }} />)}
                </div>
              ) : topClients.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: "#9ca3af", fontSize: "12px" }}>
                  Nenhuma orientação nos últimos 30 dias
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
                  {topClients.map((tc, idx) => {
                    const rankColors = ["#F59E0B", "#94A3B8", "#B45309", "#94A3B8"];
                    const rankColor = rankColors[idx] ?? "#94A3B8";
                    const maxCount = topClients[0]?.count ?? 1;
                    const barPct = (tc.count / maxCount) * 100;
                    const barGrad = idx === 0
                      ? "linear-gradient(90deg, #F59E0B, #F97316)"
                      : "linear-gradient(90deg, #6366F1, #1D4ED8)";
                    const clientId = tc.row.id ?? tc.row.cliente_id;
                    const meta = [tc.row.segmento, tc.daysAgo !== null ? `última: ${tc.daysAgo}d atrás` : null].filter(Boolean).join(" · ");
                    return (
                      <div key={tc.id} onClick={() => clientId != null && navigate(`/radar/${clientId}`)}
                        style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                        <span style={{ fontSize: "11px", fontWeight: 800, color: rankColor, width: "18px", flexShrink: 0, textAlign: "center" as const }}>#{idx + 1}</span>
                        <div style={{ width: "30px", height: "30px", borderRadius: "7px", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 700, color: "#1d4ed8", flexShrink: 0 }}>
                          {nameInitials(tc.row.razao_social)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "11px", fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tc.row.razao_social ?? "—"}</div>
                          {meta && <div style={{ fontSize: "10px", color: "#9ca3af" }}>{meta}</div>}
                          <div style={{ height: "3px", background: "#f0f0f5", borderRadius: "2px", marginTop: "4px", overflow: "hidden" }}>
                            <div style={{ height: "100%", background: barGrad, borderRadius: "2px", width: mounted ? `${barPct}%` : "0%", transition: "width .8s cubic-bezier(.4,0,.2,1)" }} />
                          </div>
                        </div>
                        <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
                          <div style={{ fontSize: "16px", fontWeight: 800, color: "#111827" }}>{tc.count}</div>
                          <div style={{ fontSize: "9px", color: "#9ca3af" }}>orientações</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Distribuição por tipo ── */}
        <div className="card-elevated" style={{ overflow: "hidden" }}>
          <div style={{ height: "3px", background: "linear-gradient(90deg, #06B6D4, #14B8A6)" }} />
          <div style={{ padding: "20px 24px" }}>
            <div style={{ marginBottom: "20px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" as const, letterSpacing: ".04em" }}>
                🎯 Distribuição por tipo de orientação
              </span>
            </div>
            {loading ? (
              <div style={{ height: "160px", background: "#f3f4f6", borderRadius: "8px" }} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "40px" }}>
                <TipoDonut data={tipoDistribuicao} total={tipoDistribuicao.reduce((s, [, n]) => s + n, 0)} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
                  {TIPO_DISPLAY.map(tc => {
                    const count = tipoDistribuicao.find(([k]) => k === tc.key)?.[1] ?? 0;
                    const totalTipos = tipoDistribuicao.reduce((s, [, n]) => s + n, 0);
                    const pct = totalTipos > 0 ? Math.round((count / totalTipos) * 100) : 0;
                    return (
                      <div key={tc.key} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: tc.color, flexShrink: 0 }} />
                        <span style={{ fontSize: "12px", color: "#374151", flex: 1 }}>{tc.label}</span>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>{count}</span>
                        <span style={{ fontSize: "10px", color: "#fff", background: tc.color, padding: "1px 7px", borderRadius: "10px", minWidth: "32px", textAlign: "center" as const }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

      </main>

      <NovoClienteModal open={novoOpen} onOpenChange={setNovoOpen} onSaved={() => setReloadKey(k => k + 1)} />
    </>
  );
}
