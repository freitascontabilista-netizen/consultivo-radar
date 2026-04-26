import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, type RadarConsultivoRow, type SemaforoStatus } from "@/lib/supabase";
import { StatusBadge } from "@/components/StatusBadge";
import { NovoClienteModal } from "@/components/NovoClienteModal";

const TIPO_DISPLAY = [
  { key: "fiscal",       label: "Fiscal",        color: "#3B82F6" },
  { key: "trabalhista",  label: "Trabalhista",    color: "#EC4899" },
  { key: "contabil",     label: "Contábil",       color: "#06B6D4" },
  { key: "societario",   label: "Societário",     color: "#F97316" },
  { key: "planejamento", label: "Planejamento",   color: "#22C55E" },
];

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
  const [rows, setRows] = useState<RadarConsultivoRow[]>([]);
  const [interacoes, setInteracoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [userEmail, setUserEmail] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [displayCounts, setDisplayCounts] = useState({ total: 0, critico: 0, atencao: 0, followups: 0 });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email);
    });
  }, []);

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
      setInteracoes((intData ?? []) as any[]);
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

  const criticalClients = useMemo(() =>
    rows.filter(r => r.semaforo === "critico").sort((a, b) => (b.dias_sem_orientacao ?? 0) - (a.dias_sem_orientacao ?? 0)).slice(0, 5),
    [rows]
  );

  const atencaoClients = useMemo(() =>
    rows.filter(r => r.semaforo === "atencao").sort((a, b) => (b.dias_sem_orientacao ?? 0) - (a.dias_sem_orientacao ?? 0)).slice(0, 4),
    [rows]
  );

  const totalFollowups = useMemo(() =>
    rows.reduce((sum, r) => sum + (r.followups_pendentes ?? 0), 0),
    [rows]
  );

  const urgentClients = useMemo(() =>
    [...rows]
      .filter(r => (r.dias_sem_orientacao ?? 0) > 0)
      .sort((a, b) => (b.dias_sem_orientacao ?? 0) - (a.dias_sem_orientacao ?? 0))
      .slice(0, 3),
    [rows]
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

  const initials = (email: string) => email.split("@")[0].slice(0, 2).toUpperCase();
  const nameInitials = (name: string | null) => (name ?? "?").trim().split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

  const firstName = userEmail ? userEmail.split("@")[0].split(".")[0] : "";
  const firstName2 = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  const now = new Date();
  const hora = now.getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const dataFormatada = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // Donut chart
  const r = 54;
  const circ = 2 * Math.PI * r;
  const total = counts.total || 1;
  const verdeLen = (counts.verde / total) * circ;
  const atencaoLen = (counts.atencao / total) * circ;
  const criticoLen = (counts.critico / total) * circ;
  const startOffset = circ * 0.25;

  const navItems = [
    { label: "Dashboard", path: "/", active: true },
    { label: "Clientes", path: "/clientes", active: false },
    { label: "Orientações", path: "/orientacoes", active: false },
    { label: "Acompanhamentos", path: "/followups", active: false },
    { label: "Administração", path: "/admin", active: false },
  ];

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
    grid3: { display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "16px", marginBottom: "16px" },
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
    <div style={S.root}>
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
      `}</style>

      {/* Top nav */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={S.logo}>
            <img src="/logo_freitas.png" alt="" style={{ height: "28px", objectFit: "contain" }} />
            <span style={S.logoText}>CRM Consultivo</span>
          </div>

          <nav style={S.nav}>
            {navItems.map(item => (
              <button key={item.label} onClick={() => navigate(item.path)}
                style={{ padding: "5px 13px", fontSize: "13px", fontWeight: item.active ? 600 : 400, color: item.active ? "#1d4ed8" : "#6b7280", background: item.active ? "#eff6ff" : "transparent", border: "none", borderRadius: "6px", cursor: "pointer", transition: "background .15s ease" }}
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
                {initials(userEmail || "TF")}
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

        {/* Middle row: donut + critical alerts */}
        <div style={S.grid3}>

          {/* Health donut */}
          <div style={{ ...S.card, ...S.cardPad }}>
            <div style={S.cardTitle}>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
              Saúde da Carteira
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
              {/* SVG Donut — displayed larger via width/height, same viewBox math */}
              <div style={{ flexShrink: 0, position: "relative" }}>
                <svg width="170" height="170" viewBox="0 0 120 120">
                  {/* Track */}
                  <circle cx="60" cy="60" r={r} fill="none" stroke="#f0f0f5" strokeWidth="14"/>
                  {/* Verde */}
                  {counts.verde > 0 && (
                    <circle cx="60" cy="60" r={r} fill="none" stroke="url(#grad-verde)" strokeWidth="14"
                      strokeDasharray={`${mounted ? verdeLen : 0} ${circ}`}
                      strokeDashoffset={startOffset}
                      strokeLinecap="butt" style={{ transition: "stroke-dasharray .8s cubic-bezier(.4,0,.2,1)" }}/>
                  )}
                  {/* Atencao */}
                  {counts.atencao > 0 && (
                    <circle cx="60" cy="60" r={r} fill="none" stroke="url(#grad-atencao)" strokeWidth="14"
                      strokeDasharray={`${mounted ? atencaoLen : 0} ${circ}`}
                      strokeDashoffset={startOffset - verdeLen}
                      strokeLinecap="butt" style={{ transition: "stroke-dasharray .8s cubic-bezier(.4,0,.2,1) .1s" }}/>
                  )}
                  {/* Critico */}
                  {counts.critico > 0 && (
                    <circle cx="60" cy="60" r={r} fill="none" stroke="url(#grad-critico)" strokeWidth="14"
                      strokeDasharray={`${mounted ? criticoLen : 0} ${circ}`}
                      strokeDashoffset={startOffset - verdeLen - atencaoLen}
                      strokeLinecap="butt" style={{ transition: "stroke-dasharray .8s cubic-bezier(.4,0,.2,1) .2s" }}/>
                  )}
                  {/* Gradient defs */}
                  <defs>
                    <linearGradient id="grad-verde" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#16a34a"/>
                      <stop offset="100%" stopColor="#4ade80"/>
                    </linearGradient>
                    <linearGradient id="grad-atencao" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#d97706"/>
                      <stop offset="100%" stopColor="#fbbf24"/>
                    </linearGradient>
                    <linearGradient id="grad-critico" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#dc2626"/>
                      <stop offset="100%" stopColor="#f87171"/>
                    </linearGradient>
                  </defs>
                  {/* Center label */}
                  <text x="60" y="55" textAnchor="middle" fontSize="22" fontWeight="800" fill="#111827">{loading ? "—" : counts.total}</text>
                  <text x="60" y="70" textAnchor="middle" fontSize="9" fill="#9ca3af" fontWeight="500">CLIENTES</text>
                </svg>
              </div>

              {/* Legend */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  { label: "Em dia", value: counts.verde, color: "#16a34a", gradBar: "linear-gradient(90deg,#16a34a,#4ade80)", bg: "#f0fdf4" },
                  { label: "Em atenção", value: counts.atencao, color: "#d97706", gradBar: "linear-gradient(90deg,#d97706,#fbbf24)", bg: "#fffbeb" },
                  { label: "Críticos", value: counts.critico, color: "#dc2626", gradBar: "linear-gradient(90deg,#dc2626,#f87171)", bg: "#fef2f2" },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                        <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: item.color }} />
                        <span style={{ fontSize: "12px", color: "#374151" }}>{item.label}</span>
                      </div>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: item.color }}>{loading ? "—" : item.value}</span>
                    </div>
                    <div style={{ height: "5px", background: "#f0f0f5", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        background: item.gradBar,
                        borderRadius: "3px",
                        width: loading || counts.total === 0 ? "0%" : `${(item.value / counts.total) * 100}%`,
                        transition: "width .8s cubic-bezier(.4,0,.2,1)",
                      }} />
                    </div>
                  </div>
                ))}

                <div style={{ marginTop: "6px", padding: "11px 14px", background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", borderRadius: "10px", border: "1px solid #bbf7d0" }}>
                  <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "2px" }}>Taxa de saúde</div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "#16a34a" }}>
                    {loading || counts.total === 0 ? "—" : `${Math.round((counts.verde / counts.total) * 100)}%`}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Clients needing attention */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Critical — pulsating border */}
            <div style={{
              ...S.card,
              flex: 1,
              border: "1px solid #fca5a5",
              animation: counts.critico > 0 ? "pulse-red 2.5s ease-in-out infinite" : "none",
            }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid #fef2f2", background: "linear-gradient(135deg,#fff8f8,#fef2f2)", borderRadius: "11px 11px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ ...S.cardTitle, marginBottom: 0, color: "#dc2626" }}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  Contato urgente
                </div>
                <span style={{ fontSize: "10px", fontWeight: 700, background: "linear-gradient(135deg,#dc2626,#b91c1c)", color: "#fff", borderRadius: "10px", padding: "2px 8px", boxShadow: "0 2px 6px rgba(220,38,38,.35)" }}>{counts.critico}</span>
              </div>
              {loading ? (
                <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[1,2,3].map(i => <div key={i} style={{ height: "32px", background: "#f3f4f6", borderRadius: "6px" }} />)}
                </div>
              ) : criticalClients.length === 0 ? (
                <div style={{ padding: "20px 16px", textAlign: "center", color: "#9ca3af", fontSize: "12px" }}>Nenhum cliente crítico</div>
              ) : (
                <div>
                  {criticalClients.map((r, i) => {
                    const id = r.id ?? r.cliente_id;
                    return (
                      <div key={String(id ?? i)} onClick={() => id != null && navigate(`/radar/${id}`)}
                        style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 16px", borderBottom: i < criticalClients.length - 1 ? "1px solid #fef2f2" : "none", cursor: "pointer", transition: "background .15s ease" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#fff1f1"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(135deg,#fef2f2,#fee2e2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: "#dc2626", flexShrink: 0, border: "1px solid #fca5a5" }}>
                          {nameInitials(r.razao_social)}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: "12px", fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.razao_social ?? "—"}</div>
                          {r.segmento && <div style={{ fontSize: "10px", color: "#9ca3af" }}>{r.segmento}</div>}
                        </div>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#dc2626", whiteSpace: "nowrap", flexShrink: 0, background: "#fef2f2", borderRadius: "6px", padding: "2px 6px" }}>{r.dias_sem_orientacao}d</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Attention */}
            {atencaoClients.length > 0 && (
              <div style={{ ...S.card }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid #fffbeb", background: "linear-gradient(135deg,#fffdf0,#fef3c7)", borderRadius: "11px 11px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ ...S.cardTitle, marginBottom: 0, color: "#d97706" }}>
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    Em atenção
                  </div>
                  <span style={{ fontSize: "10px", fontWeight: 700, background: "linear-gradient(135deg,#d97706,#b45309)", color: "#fff", borderRadius: "10px", padding: "2px 8px", boxShadow: "0 2px 6px rgba(217,119,6,.3)" }}>{counts.atencao}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", padding: "12px 16px" }}>
                  {atencaoClients.map((r, i) => {
                    const id = r.id ?? r.cliente_id;
                    return (
                      <div key={String(id ?? i)} onClick={() => id != null && navigate(`/radar/${id}`)}
                        title={r.razao_social ?? ""}
                        style={{ display: "flex", alignItems: "center", gap: "5px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", fontSize: "11px", fontWeight: 500, color: "#92400e", transition: "all .15s ease" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#fef3c7"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#fffbeb"; e.currentTarget.style.transform = "translateY(0)"; }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "120px" }}>{r.razao_social ?? "—"}</span>
                        <span style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff", borderRadius: "4px", padding: "1px 4px", fontSize: "10px", fontWeight: 700, flexShrink: 0 }}>{r.dias_sem_orientacao}d</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
                  const hue = [211, 197, 158, 270, 142][idx % 5];
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

        {/* ── Novos blocos: Linha 1 (Atenção urgente + Top clientes) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "16px", marginTop: "16px", marginBottom: "16px" }}>

          {/* Bloco A — Atenção urgente */}
          <div className="card-elevated" style={{ overflow: "hidden" }}>
            <div style={{ height: "3px", background: "linear-gradient(90deg, #EF4444, #F97316)" }} />
            <div style={{ padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" as const, letterSpacing: ".04em" }}>
                  🚨 Atenção urgente
                </span>
                <button onClick={() => navigate("/clientes")}
                  style={{ fontSize: "11px", color: "#1d4ed8", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>
                  Ver todos →
                </button>
              </div>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[1, 2, 3].map(i => <div key={i} style={{ height: "52px", background: "#f3f4f6", borderRadius: "8px" }} />)}
                </div>
              ) : urgentClients.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: "#9ca3af", fontSize: "12px" }}>Nenhum cliente crítico</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {urgentClients.map(r => {
                    const id = r.id ?? r.cliente_id;
                    const dias = r.dias_sem_orientacao ?? 0;
                    const isRed = dias > 3;
                    const isYellow = dias >= 2 && dias <= 3;
                    const avatarBg = isRed ? "#fef2f2" : isYellow ? "#fffbeb" : "#f1f5f9";
                    const avatarColor = isRed ? "#dc2626" : isYellow ? "#d97706" : "#64748b";
                    const badgeBg = isRed ? "#fef2f2" : isYellow ? "#fffbeb" : "#f1f5f9";
                    const badgeColor = isRed ? "#dc2626" : isYellow ? "#d97706" : "#64748b";
                    const btnStyle: React.CSSProperties = isRed
                      ? { background: "#1d4ed8", color: "#fff", border: "none" }
                      : isYellow
                      ? { background: "#F59E0B", color: "#fff", border: "none" }
                      : { background: "transparent", color: "#374151", border: "1px solid #e5e7eb" };
                    return (
                      <div key={String(id ?? "")} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "8px", background: "#f9fafb", border: "1px solid #f3f4f6" }}>
                        <div style={{ width: "34px", height: "34px", borderRadius: "8px", background: avatarBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: avatarColor, flexShrink: 0 }}>
                          {nameInitials(r.razao_social)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.razao_social ?? "—"}</div>
                          {r.segmento && <div style={{ fontSize: "10px", color: "#9ca3af" }}>{r.segmento}</div>}
                        </div>
                        <span style={{ fontSize: "10px", fontWeight: 700, background: badgeBg, color: badgeColor, borderRadius: "12px", padding: "2px 7px", flexShrink: 0 }}>
                          {dias}d
                        </span>
                        <button onClick={() => id != null && navigate(`/radar/${id}`)}
                          style={{ padding: "4px 10px", fontSize: "10px", fontWeight: 600, borderRadius: "6px", cursor: "pointer", flexShrink: 0, ...btnStyle }}>
                          {isRed ? "Contatar" : isYellow ? "Acompanhar" : "Ver detalhes"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Bloco B — Top clientes */}
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
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
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

        {/* ── Novos blocos: Linha 2 (Distribuição por tipo) ── */}
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

      {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 29 }} />}
      <NovoClienteModal open={novoOpen} onOpenChange={setNovoOpen} onSaved={() => setReloadKey(k => k + 1)} />
    </div>
  );
}
