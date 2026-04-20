import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, type RadarConsultivoRow, type SemaforoStatus } from "@/lib/supabase";
import { StatusBadge } from "@/components/StatusBadge";
import { NovoClienteModal } from "@/components/NovoClienteModal";
import { cn } from "@/lib/utils";

type Filter = "todos" | SemaforoStatus;

const filterLabels: Record<Filter, string> = {
  todos: "Todos",
  critico: "Crítico",
  atencao: "Em atenção",
  verde: "Em dia",
};

export default function Index() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RadarConsultivoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("todos");
  const [search, setSearch] = useState("");
  const [novoOpen, setNovoOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [userEmail, setUserEmail] = useState("");
  const [pagina, setPagina] = useState(1);
  const POR_PAGINA = 10;

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

  const filtered = useMemo(() => {
    setPagina(1);
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "todos" && r.semaforo !== filter) return false;
      if (q) {
        const haystack = `${r.razao_social ?? ""} ${r.nome_fantasia ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filter, search]);

  const totalPaginas = Math.ceil(filtered.length / POR_PAGINA);
  const paginados = filtered.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const initials = (email: string) =>
    email.split("@")[0].slice(0, 2).toUpperCase();

  const diasColor = (dias: number) => {
    if (dias >= 60) return "#ef4444";
    if (dias >= 30) return "#f59e0b";
    return "#10b981";
  };

  const navItems = [
    { label: "Dashboard", icon: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z", active: true },
    { label: "Clientes", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", active: false },
    { label: "Orientações", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6", active: false },
    { label: "Follow-ups", icon: "M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11", active: false },
  ];

  const metrics = [
    { label: "Total de clientes", value: counts.total, sub: `${counts.total} na carteira`, bg: "#6366f1" },
    { label: "Críticos", value: counts.critico, sub: `${counts.total > 0 ? Math.round(counts.critico / counts.total * 100) : 0}% da carteira`, bg: "#ef4444" },
    { label: "Em atenção", value: counts.atencao, sub: `${counts.total > 0 ? Math.round(counts.atencao / counts.total * 100) : 0}% da carteira`, bg: "#f59e0b" },
    { label: "Em dia", value: counts.verde, sub: `${counts.total > 0 ? Math.round(counts.verde / counts.total * 100) : 0}% da carteira`, bg: "#10b981" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f0f4ff" }}>

      {/* Sidebar */}
      <aside style={{ width: "220px", background: "#0f172a", display: "flex", flexDirection: "column", flexShrink: 0, position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 20 }}>
        {/* Logo */}
        <div style={{ padding: "20px", borderBottom: "1px solid rgba(255,255,255,.08)", marginBottom: "8px" }}>
          <img src="/logo_freitas.png" alt="" style={{ height: "36px", objectFit: "contain", filter: "brightness(0) invert(1)", opacity: 0.9 }} />
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,.4)", marginTop: "6px" }}>CRM Consultivo</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "4px 0" }}>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,.3)", padding: "10px 20px 4px", textTransform: "uppercase", letterSpacing: ".08em" }}>Principal</div>

          {[
            { label: "Dashboard", path: "/", active: true },
            { label: "Clientes", path: "/", active: false },
            { label: "Orientações", path: "/", active: false, badge: "12" },
            { label: "Follow-ups", path: "/", active: false, badge: "5" },
          ].map((item) => (
            <div key={item.label} style={{ padding: "8px 20px", fontSize: "13px", color: item.active ? "#fff" : "rgba(255,255,255,.55)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", borderLeft: item.active ? "2px solid #10b981" : "2px solid transparent", background: item.active ? "rgba(255,255,255,.06)" : "transparent", fontWeight: item.active ? 500 : 400 }}>
              {item.label}
              {item.badge && <span style={{ background: "#ef4444", color: "#fff", borderRadius: "20px", fontSize: "9px", fontWeight: 600, padding: "1px 6px" }}>{item.badge}</span>}
            </div>
          ))}

          <div style={{ fontSize: "10px", color: "rgba(255,255,255,.3)", padding: "14px 20px 4px", textTransform: "uppercase", letterSpacing: ".08em" }}>Gestão</div>

          {[
            { label: "Relatórios", path: "/" },
            { label: "Metas", path: "/" },
            { label: "Administração", path: "/admin" },
          ].map((item) => (
            <div key={item.label} onClick={() => navigate(item.path)} style={{ padding: "8px 20px", fontSize: "13px", color: "rgba(255,255,255,.55)", cursor: "pointer", borderLeft: "2px solid transparent" }}>
              {item.label}
            </div>
          ))}
        </nav>

        {/* User */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,.08)", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg,#10b981,#059669)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 600, color: "#fff", flexShrink: 0 }}>
            {initials(userEmail || "TF")}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "12px", fontWeight: 500, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail || "Usuário"}</div>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,.4)" }}>Administrador</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ marginLeft: "220px", flex: 1, padding: "28px" }}>

        {/* Top */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#0f172a", margin: 0 }}>Dashboard da Carteira</h1>
            <p style={{ fontSize: "13px", color: "#64748b", marginTop: "3px" }}>Visão consolidada do radar consultivo dos seus clientes.</p>
          </div>
          <button onClick={() => setNovoOpen(true)} style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 18px", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            Novo cliente
          </button>
        </div>

        {/* Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "24px" }}>
          {metrics.map((m) => (
            <div key={m.label} style={{ background: m.bg, borderRadius: "12px", padding: "18px", color: "#fff", position: "relative", overflow: "hidden" }}>
              <div style={{ fontSize: "12px", fontWeight: 500, opacity: .8, marginBottom: "10px" }}>{m.label}</div>
              <div style={{ fontSize: "34px", fontWeight: 700, lineHeight: 1 }}>{loading ? "—" : m.value}</div>
              <div style={{ fontSize: "11px", opacity: .7, marginTop: "4px" }}>{m.sub}</div>
              <div style={{ position: "absolute", right: "-10px", bottom: "-10px", width: "70px", height: "70px", borderRadius: "50%", background: "rgba(255,255,255,.1)" }} />
              <div style={{ position: "absolute", right: "20px", bottom: "20px", width: "40px", height: "40px", borderRadius: "50%", background: "rgba(255,255,255,.1)" }} />
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {(Object.keys(filterLabels) as Filter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 16px", borderRadius: "20px", fontSize: "12px", fontWeight: 500, cursor: "pointer", border: filter === f ? "none" : "1px solid #e2e8f0", background: filter === f ? "#0f172a" : "#fff", color: filter === f ? "#fff" : "#64748b", transition: "all .15s" }}>
                {filterLabels[f]}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "7px 12px" }}>
            <svg width="13" height="13" fill="none" stroke="#94a3b8" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente..." style={{ border: "none", outline: "none", fontSize: "13px", color: "#0f172a", background: "transparent", width: "200px" }} />
          </div>
        </div>

        {/* Table */}
        <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: "12px", overflow: "hidden" }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr .7fr .9fr .7fr .3fr", padding: "11px 20px", background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
            {["Cliente", "Segmento", "Dias sem orientação", "Status", ""].map((h) => (
              <div key={h} style={{ fontSize: "10px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em" }}>{h}</div>
            ))}
          </div>

          {error ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#ef4444", fontSize: "14px" }}>Erro ao carregar: {error}</div>
          ) : loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr .7fr .9fr .7fr .3fr", padding: "15px 20px", borderBottom: "1px solid #f8fafc", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ height: "13px", width: "160px", background: "#f1f5f9", borderRadius: "4px" }} />
                  <div style={{ height: "11px", width: "100px", background: "#f8fafc", borderRadius: "4px" }} />
                </div>
                <div style={{ height: "22px", width: "70px", background: "#f1f5f9", borderRadius: "20px" }} />
                <div style={{ height: "20px", width: "40px", background: "#f1f5f9", borderRadius: "4px" }} />
                <div style={{ height: "22px", width: "80px", background: "#f1f5f9", borderRadius: "20px" }} />
              </div>
            ))
          ) : paginados.length === 0 ? (
            <div style={{ padding: "64px", textAlign: "center", color: "#94a3b8", fontSize: "14px" }}>Nenhum cliente encontrado.</div>
          ) : (
            paginados.map((r, idx) => {
              const targetId = r.id ?? r.cliente_id;
              const dias = r.dias_sem_orientacao ?? 0;
              const goRadar = () => targetId != null && navigate(`/radar/${targetId}`);
              return (
                <div key={String(targetId ?? idx)} onClick={goRadar} style={{ display: "grid", gridTemplateColumns: "2fr .7fr .9fr .7fr .3fr", padding: "14px 20px", borderBottom: idx < paginados.length - 1 ? "1px solid #f8fafc" : "none", alignItems: "center", cursor: "pointer", transition: "background .1s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#fafbff")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.razao_social ?? "Cliente sem razão social"}</div>
                    {r.nome_fantasia && r.nome_fantasia !== r.razao_social && (
                      <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nome_fantasia}</div>
                    )}
                  </div>
                  <div>
                    {r.segmento ? (
                      <span style={{ display: "inline-block", padding: "3px 8px", borderRadius: "20px", fontSize: "10px", fontWeight: 500, background: "#f1f5f9", color: "#475569" }}>{r.segmento}</span>
                    ) : <span style={{ color: "#cbd5e1", fontSize: "12px" }}>—</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                    <span style={{ fontSize: "20px", fontWeight: 700, color: diasColor(dias) }}>{dias}</span>
                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>dias</span>
                  </div>
                  <div>
                    <StatusBadge status={r.semaforo} />
                  </div>
                  <div>
                    <div onClick={(e) => { e.stopPropagation(); goRadar(); }} style={{ width: "28px", height: "28px", border: "1px solid #e2e8f0", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "#fff", color: "#64748b" }}>
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {!loading && !error && filtered.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "14px" }}>
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>
              {filtered.length === 0 ? "Nenhum cliente" : `Mostrando ${(pagina - 1) * POR_PAGINA + 1}–${Math.min(pagina * POR_PAGINA, filtered.length)} de ${filtered.length} clientes`}
            </span>
            {totalPaginas > 1 && (
              <div style={{ display: "flex", gap: "4px" }}>
                <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1} style={{ width: "28px", height: "28px", border: "1px solid #e2e8f0", borderRadius: "6px", background: "#fff", cursor: "pointer", color: "#64748b", fontSize: "13px", opacity: pagina === 1 ? .4 : 1 }}>‹</button>
                {Array.from({ length: totalPaginas }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPagina(p)} style={{ width: "28px", height: "28px", border: "1px solid #e2e8f0", borderRadius: "6px", background: p === pagina ? "#10b981" : "#fff", color: p === pagina ? "#fff" : "#64748b", cursor: "pointer", fontSize: "12px", fontWeight: p === pagina ? 600 : 400, borderColor: p === pagina ? "#10b981" : "#e2e8f0" }}>{p}</button>
                ))}
                <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas} style={{ width: "28px", height: "28px", border: "1px solid #e2e8f0", borderRadius: "6px", background: "#fff", cursor: "pointer", color: "#64748b", fontSize: "13px", opacity: pagina === totalPaginas ? .4 : 1 }}>›</button>
              </div>
            )}
          </div>
        )}
      </div>

      <NovoClienteModal open={novoOpen} onOpenChange={setNovoOpen} onSaved={() => setReloadKey((k) => k + 1)} />
    </div>
  );
}
