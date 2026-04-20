import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, type RadarConsultivoRow, type SemaforoStatus } from "@/lib/supabase";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRight, Plus, Search, Users, AlertTriangle, Clock, CheckCircle, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/UserMenu";
import { NovoClienteModal } from "@/components/NovoClienteModal";

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

  const semaforoLabel: Record<string, string> = {
    critico: "Crítico",
    atencao: "Em atenção",
    verde: "Em dia",
  };

  const diasColor = (dias: number) => {
    if (dias >= 60) return "text-red-500";
    if (dias >= 30) return "text-amber-500";
    return "text-emerald-500";
  };

  return (
    <div className="min-h-screen" style={{ background: "#f8f9fb" }}>
      {/* Top bar */}
      <header style={{ background: "#fff", borderBottom: "1px solid #e8eaed", position: "sticky", top: 0, zIndex: 10 }}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img src="/logo_freitas.png" alt="" style={{ height: "40px", objectFit: "contain" }} />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/admin")}
              style={{ background: "transparent", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "6px 12px", fontSize: "13px", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Settings size={14} /> Admin
            </button>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Heading */}
        <div className="mb-8">
          <h2 style={{ fontSize: "24px", fontWeight: 600, color: "#0f172a", marginBottom: "4px" }}>Dashboard da Carteira</h2>
          <p style={{ fontSize: "14px", color: "#64748b" }}>Visão consolidada do radar consultivo dos seus clientes.</p>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total de clientes", value: counts.total, icon: <Users size={18} />, color: "#3b82f6", bg: "#eff6ff" },
            { label: "Críticos", value: counts.critico, icon: <AlertTriangle size={18} />, color: "#ef4444", bg: "#fef2f2" },
            { label: "Em atenção", value: counts.atencao, icon: <Clock size={18} />, color: "#f59e0b", bg: "#fffbeb" },
            { label: "Em dia", value: counts.verde, icon: <CheckCircle size={18} />, color: "#10b981", bg: "#f0fdf4" },
          ].map((m) => (
            <div key={m.label} style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", align: "center", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}>{m.label}</span>
                <div style={{ background: m.bg, color: m.color, borderRadius: "8px", padding: "6px", display: "flex" }}>{m.icon}</div>
              </div>
              <div style={{ fontSize: "32px", fontWeight: 700, color: loading ? "#e2e8f0" : m.color, lineHeight: 1 }}>
                {loading ? "—" : m.value}
              </div>
            </div>
          ))}
        </div>

        {/* Filters + search + new */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {(Object.keys(filterLabels) as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "6px 16px",
                  borderRadius: "20px",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                  border: filter === f ? "none" : "1px solid #e2e8f0",
                  background: filter === f ? "#0f172a" : "#fff",
                  color: filter === f ? "#fff" : "#64748b",
                  transition: "all .15s",
                }}
              >
                {filterLabels[f]}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente..."
                style={{ paddingLeft: "32px", paddingRight: "12px", height: "36px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px", background: "#fff", outline: "none", width: "220px", color: "#0f172a" }}
              />
            </div>
            <button
              onClick={() => setNovoOpen(true)}
              style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Plus size={15} /> Novo Cliente
            </button>
          </div>
        </div>

        {/* Client list */}
        <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: "12px", overflow: "hidden" }}>
          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 160px 120px", padding: "12px 20px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cliente</span>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Segmento</span>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Dias sem orientação</span>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</span>
          </div>

          {error ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#ef4444", fontSize: "14px" }}>
              Erro ao carregar dados: {error}
            </div>
          ) : loading ? (
            <div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 140px 160px 120px", padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ height: "14px", width: "180px", background: "#f1f5f9", borderRadius: "4px" }} />
                    <div style={{ height: "12px", width: "120px", background: "#f8fafc", borderRadius: "4px" }} />
                  </div>
                  <div style={{ height: "14px", width: "80px", background: "#f1f5f9", borderRadius: "4px", alignSelf: "center" }} />
                  <div style={{ height: "14px", width: "60px", background: "#f1f5f9", borderRadius: "4px", alignSelf: "center" }} />
                  <div style={{ height: "24px", width: "80px", background: "#f1f5f9", borderRadius: "20px", alignSelf: "center" }} />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "64px", textAlign: "center", color: "#94a3b8", fontSize: "14px" }}>
              Nenhum cliente encontrado.
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {filtered.map((r, idx) => {
                const targetId = r.id ?? r.cliente_id;
                const dias = r.dias_sem_orientacao ?? 0;
                const goRadar = () => targetId != null && navigate(`/radar/${targetId}`);
                return (
                  <li
                    key={String(targetId ?? idx)}
                    onClick={goRadar}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 140px 160px 120px",
                      padding: "16px 20px",
                      borderBottom: idx < filtered.length - 1 ? "1px solid #f1f5f9" : "none",
                      cursor: "pointer",
                      transition: "background .12s",
                      alignItems: "center",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Nome */}
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.razao_social ?? "Cliente sem razão social"}
                      </p>
                      {r.nome_fantasia && r.nome_fantasia !== r.razao_social && (
                        <p style={{ fontSize: "12px", color: "#94a3b8", margin: "2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {r.nome_fantasia}
                        </p>
                      )}
                    </div>

                    {/* Segmento */}
                    <div>
                      {r.segmento ? (
                        <span style={{ fontSize: "11px", fontWeight: 500, color: "#475569", background: "#f1f5f9", padding: "3px 10px", borderRadius: "20px" }}>
                          {r.segmento}
                        </span>
                      ) : (
                        <span style={{ color: "#cbd5e1", fontSize: "13px" }}>—</span>
                      )}
                    </div>

                    {/* Dias */}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "20px", fontWeight: 700 }} className={diasColor(dias)}>{dias}</span>
                      <span style={{ fontSize: "12px", color: "#94a3b8" }}>dias</span>
                    </div>

                    {/* Status + botão */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <StatusBadge status={r.semaforo} />
                      <button
                        onClick={(e) => { e.stopPropagation(); goRadar(); }}
                        style={{ background: "transparent", border: "1px solid #e2e8f0", borderRadius: "6px", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748b", flexShrink: 0 }}
                      >
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer count */}
        {!loading && !error && (
          <p style={{ textAlign: "center", fontSize: "12px", color: "#94a3b8", marginTop: "16px" }}>
            {filtered.length} de {rows.length} clientes
          </p>
        )}
      </main>

      <NovoClienteModal open={novoOpen} onOpenChange={setNovoOpen} onSaved={() => setReloadKey((k) => k + 1)} />
    </div>
  );
}
