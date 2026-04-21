import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, type RadarConsultivoRow, type SemaforoStatus } from "@/lib/supabase";
import { StatusBadge } from "@/components/StatusBadge";
import { NovoClienteModal } from "@/components/NovoClienteModal";

export default function Index() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RadarConsultivoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [userEmail, setUserEmail] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email);
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("radar_consultivo").select("*");
      if (!mounted) return;
      if (error) { setError(error.message); setRows([]); }
      else { setRows((data ?? []) as RadarConsultivoRow[]); setError(null); }
      setLoading(false);
    })();
    return () => { mounted = false; };
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

  const segmentos = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of rows) {
      const s = r.segmento ?? "Outros";
      map[s] = (map[s] ?? 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [rows]);

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
    { label: "Follow-ups", path: "/followups", active: false },
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
    grid4: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px", marginBottom: "20px" },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "20px" },
    grid3: { display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "14px" },
    card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px" },
    cardPad: { padding: "20px" },
    cardTitle: { fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: ".08em", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" },
    skel: { background: "#f3f4f6", borderRadius: "5px", animation: "pulse 1.5s ease-in-out infinite" },
  };

  const KpiCard = ({ label, value, sub, icon, accent, border }: { label: string; value: number | string; sub: string; icon: React.ReactNode; accent: string; border: string }) => (
    <div style={{ ...S.card, borderTop: `3px solid ${border}`, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: "8px" }}>{label}</div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "#111827", lineHeight: 1 }}>{loading ? "—" : value}</div>
          <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "5px" }}>{sub}</div>
        </div>
        <div style={{ width: "38px", height: "38px", borderRadius: "9px", background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center", color: accent, flexShrink: 0 }}>
          {icon}
        </div>
      </div>
    </div>
  );

  return (
    <div style={S.root}>

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
            style={{ display: "flex", alignItems: "center", gap: "7px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.background = "#1e40af"}
            onMouseLeave={e => e.currentTarget.style.background = "#1d4ed8"}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            Novo cliente
          </button>
        </div>

        {/* KPIs */}
        <div style={S.grid4}>
          <KpiCard label="Carteira total" value={counts.total} sub="clientes ativos" accent="#1d4ed8" border="#1d4ed8"
            icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
          />
          <KpiCard label="Críticos" value={counts.critico} sub="precisam de contato urgente" accent="#dc2626" border="#dc2626"
            icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
          />
          <KpiCard label="Em atenção" value={counts.atencao} sub="acompanhamento próximo" accent="#d97706" border="#d97706"
            icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          />
          <KpiCard label="Follow-ups" value={totalFollowups} sub="pendentes na carteira" accent="#7c3aed" border="#7c3aed"
            icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>}
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
              {/* SVG Donut */}
              <div style={{ flexShrink: 0, position: "relative" }}>
                <svg width="140" height="140" viewBox="0 0 120 120">
                  {/* Track */}
                  <circle cx="60" cy="60" r={r} fill="none" stroke="#f3f4f6" strokeWidth="14"/>
                  {/* Verde */}
                  {counts.verde > 0 && (
                    <circle cx="60" cy="60" r={r} fill="none" stroke="#16a34a" strokeWidth="14"
                      strokeDasharray={`${verdeLen} ${circ}`}
                      strokeDashoffset={startOffset}
                      strokeLinecap="butt" style={{ transition: "stroke-dasharray .6s ease" }}/>
                  )}
                  {/* Atencao */}
                  {counts.atencao > 0 && (
                    <circle cx="60" cy="60" r={r} fill="none" stroke="#d97706" strokeWidth="14"
                      strokeDasharray={`${atencaoLen} ${circ}`}
                      strokeDashoffset={startOffset - verdeLen}
                      strokeLinecap="butt" style={{ transition: "stroke-dasharray .6s ease" }}/>
                  )}
                  {/* Critico */}
                  {counts.critico > 0 && (
                    <circle cx="60" cy="60" r={r} fill="none" stroke="#dc2626" strokeWidth="14"
                      strokeDasharray={`${criticoLen} ${circ}`}
                      strokeDashoffset={startOffset - verdeLen - atencaoLen}
                      strokeLinecap="butt" style={{ transition: "stroke-dasharray .6s ease" }}/>
                  )}
                  {/* Center label */}
                  <text x="60" y="55" textAnchor="middle" fontSize="22" fontWeight="800" fill="#111827">{loading ? "—" : counts.total}</text>
                  <text x="60" y="70" textAnchor="middle" fontSize="9" fill="#9ca3af" fontWeight="500">CLIENTES</text>
                </svg>
              </div>

              {/* Legend */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { label: "Em dia", value: counts.verde, color: "#16a34a", bg: "#f0fdf4" },
                  { label: "Em atenção", value: counts.atencao, color: "#d97706", bg: "#fffbeb" },
                  { label: "Críticos", value: counts.critico, color: "#dc2626", bg: "#fef2f2" },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: item.color }} />
                        <span style={{ fontSize: "12px", color: "#374151" }}>{item.label}</span>
                      </div>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: item.color }}>{loading ? "—" : item.value}</span>
                    </div>
                    <div style={{ height: "4px", background: "#f3f4f6", borderRadius: "2px", overflow: "hidden" }}>
                      <div style={{ height: "100%", background: item.color, borderRadius: "2px", width: loading || counts.total === 0 ? "0%" : `${(item.value / counts.total) * 100}%`, transition: "width .6s ease" }} />
                    </div>
                  </div>
                ))}

                <div style={{ marginTop: "8px", padding: "10px 12px", background: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "2px" }}>Taxa de saúde</div>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#16a34a" }}>
                    {loading || counts.total === 0 ? "—" : `${Math.round((counts.verde / counts.total) * 100)}%`}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Clients needing attention */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

            {/* Critical */}
            <div style={{ ...S.card, flex: 1 }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid #fef2f2", background: "#fff8f8", borderRadius: "10px 10px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ ...S.cardTitle, marginBottom: 0, color: "#dc2626" }}>
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  Contato urgente
                </div>
                <span style={{ fontSize: "10px", fontWeight: 700, background: "#dc2626", color: "#fff", borderRadius: "10px", padding: "2px 7px" }}>{counts.critico}</span>
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
                        style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 16px", borderBottom: i < criticalClients.length - 1 ? "1px solid #fef2f2" : "none", cursor: "pointer" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#fff8f8"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <div style={{ width: "30px", height: "30px", borderRadius: "7px", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: "#dc2626", flexShrink: 0 }}>
                          {nameInitials(r.razao_social)}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: "12px", fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.razao_social ?? "—"}</div>
                          {r.segmento && <div style={{ fontSize: "10px", color: "#9ca3af" }}>{r.segmento}</div>}
                        </div>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#dc2626", whiteSpace: "nowrap", flexShrink: 0 }}>{r.dias_sem_orientacao}d</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Attention */}
            {atencaoClients.length > 0 && (
              <div style={{ ...S.card }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid #fffbeb", background: "#fffdf0", borderRadius: "10px 10px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ ...S.cardTitle, marginBottom: 0, color: "#d97706" }}>
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    Em atenção
                  </div>
                  <span style={{ fontSize: "10px", fontWeight: 700, background: "#d97706", color: "#fff", borderRadius: "10px", padding: "2px 7px" }}>{counts.atencao}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", padding: "12px 16px" }}>
                  {atencaoClients.map((r, i) => {
                    const id = r.id ?? r.cliente_id;
                    return (
                      <div key={String(id ?? i)} onClick={() => id != null && navigate(`/radar/${id}`)}
                        title={r.razao_social ?? ""}
                        style={{ display: "flex", alignItems: "center", gap: "5px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", fontSize: "11px", fontWeight: 500, color: "#92400e" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#fef3c7"}
                        onMouseLeave={e => e.currentTarget.style.background = "#fffbeb"}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "120px" }}>{r.razao_social ?? "—"}</span>
                        <span style={{ background: "#f59e0b", color: "#fff", borderRadius: "4px", padding: "1px 4px", fontSize: "10px", fontWeight: 700, flexShrink: 0 }}>{r.dias_sem_orientacao}d</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom row: segmentos + quick actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>

          {/* Segmentos */}
          {segmentos.length > 0 && (
            <div style={{ ...S.card, ...S.cardPad }}>
              <div style={S.cardTitle}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                Distribuição por Segmento
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {segmentos.map(([seg, count]) => (
                  <div key={seg}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "12px", color: "#374151", fontWeight: 500 }}>{seg}</span>
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>{count} cliente{count !== 1 ? "s" : ""}</span>
                    </div>
                    <div style={{ height: "5px", background: "#f3f4f6", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ height: "100%", background: "#1d4ed8", borderRadius: "3px", width: `${(count / counts.total) * 100}%`, opacity: 0.7 + (count / counts.total) * 0.3, transition: "width .6s ease" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick access */}
          <div style={{ ...S.card, ...S.cardPad }}>
            <div style={S.cardTitle}>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              Acesso Rápido
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {[
                { label: "Ver todos os clientes", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", path: "/clientes", color: "#1d4ed8" },
                { label: "Registrar orientação", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8", path: "/", color: "#16a34a" },
                { label: "Follow-ups pendentes", icon: "M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11", path: "/", color: "#7c3aed" },
                { label: "Administração", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", path: "/admin", color: "#374151" },
              ].map(a => (
                <button key={a.label} onClick={() => navigate(a.path)}
                  style={{ display: "flex", alignItems: "center", gap: "9px", padding: "12px 14px", border: "1px solid #e5e7eb", borderRadius: "8px", background: "#fff", cursor: "pointer", textAlign: "left" as const }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#f9fafb"; e.currentTarget.style.borderColor = "#d1d5db"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#e5e7eb"; }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `${a.color}12`, display: "flex", alignItems: "center", justifyContent: "center", color: a.color, flexShrink: 0 }}>
                    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d={a.icon}/></svg>
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: 500, color: "#374151", lineHeight: 1.3 }}>{a.label}</span>
                </button>
              ))}
            </div>

            {/* New client shortcut */}
            <button onClick={() => setNovoOpen(true)}
              style={{ width: "100%", marginTop: "10px", padding: "11px", border: "1px dashed #93c5fd", borderRadius: "8px", background: "#eff6ff", cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              onMouseEnter={e => e.currentTarget.style.background = "#dbeafe"}
              onMouseLeave={e => e.currentTarget.style.background = "#eff6ff"}>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
              Cadastrar novo cliente
            </button>
          </div>
        </div>

      </main>

      {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 29 }} />}
      <NovoClienteModal open={novoOpen} onOpenChange={setNovoOpen} onSaved={() => setReloadKey(k => k + 1)} />
    </div>
  );
}
