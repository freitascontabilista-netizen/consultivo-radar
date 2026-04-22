import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, type RadarConsultivoRow, type SemaforoStatus } from "@/lib/supabase";
import { StatusBadge } from "@/components/StatusBadge";
import { NovoClienteModal, SEGMENTOS as SEGMENTOS_FIXOS } from "@/components/NovoClienteModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type StatusFilter = "todos" | SemaforoStatus;
type PorPagina = 10 | 20 | 50 | 100;

const statusLabels: Record<StatusFilter, string> = {
  todos: "Todos os status",
  critico: "Crítico",
  atencao: "Em atenção",
  verde: "Em dia",
};

// Variações do banco que não casam por simples normalização de acentos
const SEGMENTO_ALIAS: Record<string, string> = {
  "servico e comercio": "Comércio e Serviço",
  "serviço e comercio": "Comércio e Serviço",
  "serviço e comércio": "Comércio e Serviço",
};

function normalizarSegmento(s: string | null | undefined): string | null {
  if (!s) return null;
  const strip = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const semAcento = strip(s);
  if (SEGMENTO_ALIAS[semAcento]) return SEGMENTO_ALIAS[semAcento];
  const match = SEGMENTOS_FIXOS.find(f => strip(f) === semAcento);
  return match ?? s;
}

export default function Clientes() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RadarConsultivoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<RadarConsultivoRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { toast } = useToast();
  const [userEmail, setUserEmail] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [segmentoFilter, setSegmentoFilter] = useState("todos");
  const [regimeFilter, setRegimeFilter] = useState("todos");
  const [diasMin, setDiasMin] = useState("");

  // Pagination
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState<PorPagina>(10);

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

  const segmentos = SEGMENTOS_FIXOS;

  const regimes = useMemo(() => {
    const s = new Set(rows.map(r => r.regime_tributario).filter(Boolean) as string[]);
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const minDias = diasMin ? parseInt(diasMin, 10) : 0;
    return rows.filter(r => {
      if (statusFilter !== "todos" && r.semaforo !== statusFilter) return false;
      if (segmentoFilter !== "todos" && normalizarSegmento(r.segmento) !== segmentoFilter) return false;
      if (regimeFilter !== "todos" && r.regime_tributario !== regimeFilter) return false;
      if (minDias > 0 && (r.dias_sem_orientacao ?? 0) < minDias) return false;
      if (q) {
        const hay = `${r.razao_social ?? ""} ${r.nome_fantasia ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, segmentoFilter, regimeFilter, diasMin]);

  useEffect(() => { setPagina(1); }, [search, statusFilter, segmentoFilter, regimeFilter, diasMin]);

  const totalPaginas = Math.ceil(filtered.length / porPagina);
  const paginados = filtered.slice((pagina - 1) * porPagina, pagina * porPagina);

  const hasFilters = search || statusFilter !== "todos" || segmentoFilter !== "todos" || regimeFilter !== "todos" || diasMin;

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("todos");
    setSegmentoFilter("todos");
    setRegimeFilter("todos");
    setDiasMin("");
  };

  const initials = (email: string) => email.split("@")[0].slice(0, 2).toUpperCase();
  const nameInitials = (name: string | null) =>
    (name ?? "?").trim().split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();

  const diasColor = (d: number) => d >= 60 ? "#dc2626" : d >= 30 ? "#d97706" : "#16a34a";
  const diasBg   = (d: number) => d >= 60 ? "#fef2f2" : d >= 30 ? "#fffbeb" : "#f0fdf4";

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setDeleteError(null);

    // ── DIAGNÓSTICO: inspecionar o objeto real vindo da view ──────────────────
    console.group("[DELETE CLIENTE] diagnóstico");
    console.log("deleteTarget (todos os campos):", JSON.stringify(deleteTarget, null, 2));

    // ── ETAPA 1: descobrir o ID real na tabela clientes ───────────────────────
    // Tenta cada candidato contra SELECT na tabela clientes para confirmar qual
    // campo/valor realmente bate com uma linha existente.
    const candidatos = [
      { campo: "id",         valor: deleteTarget.cliente_id },
      { campo: "id",         valor: deleteTarget.id },
      { campo: "cliente_id", valor: deleteTarget.cliente_id },
      { campo: "cliente_id", valor: deleteTarget.id },
    ].filter(c => c.valor != null);

    console.log("candidatos de ID a testar:", candidatos);

    let campoConfirmado: string | null = null;
    let idConfirmado: string | number | null = null;

    for (const { campo, valor } of candidatos) {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq(campo, valor!)
        .maybeSingle();

      console.log(`  SELECT clientes WHERE ${campo}=${valor} →`, error?.message ?? data);

      if (!error && data) {
        campoConfirmado = campo;
        idConfirmado    = valor!;
        console.log(`  ✅ linha confirmada! campo="${campo}" valor=${valor}`, data);
        break;
      }
    }

    if (campoConfirmado === null || idConfirmado === null) {
      // Nenhum candidato achou a linha — expõe todos os dados para diagnóstico
      const todosOsCampos = Object.entries(deleteTarget)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join("\n");

      console.error("[DELETE] cliente não localizado em nenhum candidato");
      console.groupEnd();
      setDeleting(false);
      setDeleteError(
        "Não foi possível localizar o cliente na tabela clientes.\n\n" +
        "Candidatos testados:\n" +
        candidatos.map(c => `  ${c.campo} = ${c.valor}`).join("\n") +
        "\n\nCampos disponíveis no objeto da view:\n" +
        todosOsCampos +
        "\n\nVeja o console (F12) para detalhes completos."
      );
      return;
    }

    // ── ETAPA 2: descobrir tabelas vinculadas via information_schema ──────────
    let tabelasVinculadas: string[] = [];
    try {
      const { data: schemaRows, error: schemaErr } = await (supabase as any)
        .schema("information_schema")
        .from("columns")
        .select("table_name")
        .eq("column_name", "cliente_id")
        .eq("table_schema", "public");

      if (schemaErr) {
        console.warn("[SCHEMA] não acessível:", schemaErr.message);
      } else {
        tabelasVinculadas = (schemaRows ?? []).map((r: any) => r.table_name as string);
        console.log("[SCHEMA] tabelas com cliente_id:", tabelasVinculadas);
      }
    } catch (e) {
      console.warn("[SCHEMA] exceção:", e);
    }

    const todasTabelas = Array.from(
      new Set(["interacoes", "acoes_consultivas", ...tabelasVinculadas])
    );
    console.log("[DELETE] limpando vínculos em:", todasTabelas);

    // ── ETAPA 3: deletar vínculos ─────────────────────────────────────────────
    for (const tabela of todasTabelas) {
      const { error: err, count: cnt } = await (supabase as any)
        .from(tabela)
        .delete({ count: "exact" })
        .eq("cliente_id", idConfirmado);

      if (err) {
        console.warn(`[DELETE] ${tabela} →`, err.message);
      } else {
        console.log(`[DELETE] ${tabela} → ${cnt ?? "?"} linha(s)`);
      }
    }

    // ── ETAPA 4: deletar o cliente com o campo/valor confirmados ─────────────
    console.log(`[DELETE] clientes WHERE ${campoConfirmado}=${idConfirmado}`);
    const { error: errCliente, count: cntCliente } = await supabase
      .from("clientes")
      .delete({ count: "exact" })
      .eq(campoConfirmado, idConfirmado);

    console.log("[DELETE] clientes →", { errCliente, cntCliente });
    console.groupEnd();

    setDeleting(false);

    if (errCliente) {
      setDeleteError(
        `Erro ao excluir (${campoConfirmado}=${idConfirmado}):\n` +
        `${errCliente.message}\n` +
        `code: ${(errCliente as any).code ?? "—"}\n` +
        `details: ${(errCliente as any).details ?? "—"}\n` +
        `hint: ${(errCliente as any).hint ?? "—"}`
      );
      return;
    }

    if ((cntCliente ?? 0) === 0) {
      setDeleteError(
        `Delete executou sem erro mas afetou 0 linhas.\n` +
        `Campo: ${campoConfirmado} | Valor: ${idConfirmado}\n` +
        `Isso pode indicar uma política RLS que bloqueia silenciosamente.`
      );
      return;
    }

    // ── ETAPA 5: sucesso ──────────────────────────────────────────────────────
    setRows(prev => prev.filter(r => (r.cliente_id ?? r.id) !== idConfirmado));
    setDeleteTarget(null);
    setDeleteError(null);
    toast({ title: "Cliente excluído com sucesso." });
  };

  const navItems = [
    { label: "Dashboard", path: "/", active: false },
    { label: "Clientes",  path: "/clientes", active: true },
    { label: "Orientações", path: "/orientacoes", active: false },
    { label: "Follow-ups", path: "/followups", active: false },
    { label: "Administração", path: "/admin", active: false },
  ];

  const pageNumbers = () => {
    if (totalPaginas <= 7) return Array.from({ length: totalPaginas }, (_, i) => i + 1);
    const pages: (number | "…")[] = [1];
    if (pagina > 3) pages.push("…");
    for (let p = Math.max(2, pagina - 1); p <= Math.min(totalPaginas - 1, pagina + 1); p++) pages.push(p);
    if (pagina < totalPaginas - 2) pages.push("…");
    pages.push(totalPaginas);
    return pages;
  };

  const sel: React.CSSProperties = {
    fontSize: "12px", color: "#374151", background: "#fff", border: "1px solid #e5e7eb",
    borderRadius: "7px", padding: "7px 10px", outline: "none", cursor: "pointer",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f9", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

      {/* Top nav */}
      <header style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 28px", display: "flex", alignItems: "center", height: "58px", gap: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
            <img src="/logo_freitas.png" alt="" style={{ height: "28px", objectFit: "contain" }} />
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#374151", borderLeft: "1px solid #e5e7eb", paddingLeft: "10px", letterSpacing: ".02em" }}>CRM Consultivo</span>
          </div>

          <nav style={{ display: "flex", gap: "2px", flex: 1 }}>
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

      <main style={{ maxWidth: "1240px", margin: "0 auto", padding: "28px 28px 48px" }}>

        {/* Page header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px" }}>
          <div>
            <h1 style={{ fontSize: "21px", fontWeight: 700, color: "#111827", margin: 0 }}>Clientes</h1>
            <p style={{ fontSize: "13px", color: "#6b7280", margin: "4px 0 0" }}>
              {loading ? "Carregando..." : `${filtered.length} cliente${filtered.length !== 1 ? "s" : ""}${hasFilters ? " encontrado" + (filtered.length !== 1 ? "s" : "") + " com os filtros aplicados" : " cadastrados na carteira"}`}
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

        {/* Filter bar */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "16px 20px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>

            {/* Search */}
            <div style={{ display: "flex", alignItems: "center", gap: "7px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "7px 12px", flex: "1 1 220px", minWidth: "200px" }}>
              <svg width="13" height="13" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou fantasia..."
                style={{ border: "none", outline: "none", fontSize: "13px", color: "#111827", background: "transparent", flex: 1 }} />
              {search && (
                <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex", padding: 0, flexShrink: 0 }}>
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>

            {/* Status */}
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} style={sel}>
              {(Object.keys(statusLabels) as StatusFilter[]).map(k => (
                <option key={k} value={k}>{statusLabels[k]}</option>
              ))}
            </select>

            {/* Segmento */}
            {segmentos.length > 0 && (
              <select value={segmentoFilter} onChange={e => setSegmentoFilter(e.target.value)} style={sel}>
                <option value="todos">Todos os segmentos</option>
                {segmentos.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}

            {/* Regime */}
            {regimes.length > 0 && (
              <select value={regimeFilter} onChange={e => setRegimeFilter(e.target.value)} style={sel}>
                <option value="todos">Todos os regimes</option>
                {regimes.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            )}

            {/* Dias mínimos */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "7px 10px" }}>
              <svg width="12" height="12" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <input type="number" min="0" value={diasMin} onChange={e => setDiasMin(e.target.value)} placeholder="Mín. dias"
                style={{ border: "none", outline: "none", fontSize: "12px", color: "#374151", background: "transparent", width: "70px" }} />
            </div>

            {/* Clear */}
            {hasFilters && (
              <button onClick={clearFilters}
                style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#dc2626", fontSize: "12px", fontWeight: 500, cursor: "pointer" }}>
                <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Limpar filtros
              </button>
            )}
          </div>

          {/* Active filter chips */}
          {hasFilters && (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #f3f4f6" }}>
              {search && <Chip label={`Busca: "${search}"`} onRemove={() => setSearch("")} />}
              {statusFilter !== "todos" && <Chip label={statusLabels[statusFilter]} onRemove={() => setStatusFilter("todos")} />}
              {segmentoFilter !== "todos" && <Chip label={`Segmento: ${segmentoFilter}`} onRemove={() => setSegmentoFilter("todos")} />}
              {regimeFilter !== "todos" && <Chip label={`Regime: ${regimeFilter}`} onRemove={() => setRegimeFilter("todos")} />}
              {diasMin && <Chip label={`≥ ${diasMin} dias sem orientação`} onRemove={() => setDiasMin("")} />}
            </div>
          )}
        </div>

        {/* Table card */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden" }}>

          {/* Table toolbar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid #f3f4f6", background: "#fafafa" }}>
            <span style={{ fontSize: "12px", color: "#6b7280" }}>
              {loading ? "Carregando..." : filtered.length === 0 ? "Nenhum resultado" : `${(pagina - 1) * porPagina + 1}–${Math.min(pagina * porPagina, filtered.length)} de ${filtered.length} clientes`}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "12px", color: "#6b7280" }}>Exibir por página:</span>
              {([10, 20, 50, 100] as PorPagina[]).map(n => (
                <button key={n} onClick={() => { setPorPagina(n); setPagina(1); }}
                  style={{ padding: "4px 10px", fontSize: "12px", fontWeight: porPagina === n ? 700 : 400, border: "1px solid", borderColor: porPagina === n ? "#1d4ed8" : "#e5e7eb", borderRadius: "6px", background: porPagina === n ? "#eff6ff" : "#fff", color: porPagina === n ? "#1d4ed8" : "#374151", cursor: "pointer" }}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 1fr 1fr 52px", padding: "9px 20px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
            {["Cliente", "Segmento", "Regime", "Dias s/ orientação", "Status", ""].map((h, i) => (
              <div key={i} style={{ fontSize: "10px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".07em" }}>{h}</div>
            ))}
          </div>

          {/* Body */}
          {error ? (
            <div style={{ padding: "48px", textAlign: "center" }}>
              <div style={{ fontSize: "14px", color: "#dc2626", fontWeight: 500 }}>Erro ao carregar dados</div>
              <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>{error}</div>
            </div>
          ) : loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 1fr 1fr 52px", padding: "14px 20px", borderBottom: "1px solid #f9fafb", alignItems: "center", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "34px", height: "34px", borderRadius: "8px", background: "#f3f4f6", flexShrink: 0 }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <div style={{ height: "12px", width: "160px", background: "#f3f4f6", borderRadius: "4px" }} />
                    <div style={{ height: "10px", width: "100px", background: "#f9fafb", borderRadius: "4px" }} />
                  </div>
                </div>
                {[70, 90, 50, 80].map((w, j) => (
                  <div key={j} style={{ height: "22px", width: `${w}px`, background: "#f3f4f6", borderRadius: "6px" }} />
                ))}
                <div style={{ height: "28px", width: "28px", background: "#f3f4f6", borderRadius: "6px" }} />
              </div>
            ))
          ) : paginados.length === 0 ? (
            <div style={{ padding: "64px", textAlign: "center" }}>
              <div style={{ width: "48px", height: "48px", background: "#f9fafb", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", color: "#d1d5db" }}>
                <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </div>
              <div style={{ fontSize: "14px", color: "#374151", fontWeight: 500 }}>Nenhum cliente encontrado</div>
              <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>Tente ajustar os filtros de busca.</div>
              <button onClick={clearFilters} style={{ marginTop: "14px", padding: "7px 16px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "7px", color: "#1d4ed8", fontSize: "12px", fontWeight: 500, cursor: "pointer" }}>
                Limpar todos os filtros
              </button>
            </div>
          ) : (
            paginados.map((r, idx) => {
              const id = r.id ?? r.cliente_id;
              const dias = r.dias_sem_orientacao ?? 0;
              const go = () => id != null && navigate(`/radar/${id}`);
              return (
                <div key={String(id ?? idx)} onClick={go}
                  style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 1fr 1fr 52px", padding: "13px 20px", borderBottom: idx < paginados.length - 1 ? "1px solid #f9fafb" : "none", alignItems: "center", cursor: "pointer", transition: "background .12s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#eff6ff"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

                  {/* Name */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                    <div style={{ width: "34px", height: "34px", borderRadius: "8px", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "#1d4ed8", flexShrink: 0 }}>
                      {nameInitials(r.razao_social)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.razao_social ?? "—"}
                      </div>
                      {r.nome_fantasia && r.nome_fantasia !== r.razao_social && (
                        <div style={{ fontSize: "11px", color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "1px" }}>
                          {r.nome_fantasia}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Segmento */}
                  <div>
                    {r.segmento
                      ? <span style={{ display: "inline-block", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 500, background: "#f1f5f9", color: "#475569" }}>{r.segmento}</span>
                      : <span style={{ color: "#d1d5db", fontSize: "13px" }}>—</span>}
                  </div>

                  {/* Regime */}
                  <div>
                    {r.regime_tributario
                      ? <span style={{ display: "inline-block", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 500, background: "#f0fdf4", color: "#166534" }}>{r.regime_tributario}</span>
                      : <span style={{ color: "#d1d5db", fontSize: "13px" }}>—</span>}
                  </div>

                  {/* Dias */}
                  <div>
                    <span style={{ display: "inline-flex", alignItems: "baseline", gap: "3px", background: diasBg(dias), borderRadius: "6px", padding: "4px 9px" }}>
                      <span style={{ fontSize: "15px", fontWeight: 700, color: diasColor(dias), lineHeight: 1 }}>{dias}</span>
                      <span style={{ fontSize: "10px", color: diasColor(dias), opacity: .7 }}>dias</span>
                    </span>
                  </div>

                  {/* Status */}
                  <div><StatusBadge status={r.semaforo} /></div>

                  {/* Ações */}
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <button
                      title="Excluir cliente"
                      aria-label="Excluir cliente"
                      onClick={e => { e.stopPropagation(); setDeleteTarget(r); }}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "30px", height: "30px", border: "1px solid #fecaca", borderRadius: "7px", background: "#fff", color: "#dc2626", cursor: "pointer", transition: "background .12s, border-color .12s", flexShrink: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.borderColor = "#f87171"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#fecaca"; }}>
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {/* Pagination */}
          {!loading && !error && filtered.length > 0 && (
            <div style={{ padding: "12px 20px", borderTop: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
              <span style={{ fontSize: "12px", color: "#9ca3af" }}>
                Página {pagina} de {totalPaginas}
              </span>
              {totalPaginas > 1 && (
                <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
                  <NavBtn onClick={() => setPagina(1)} disabled={pagina === 1} title="Primeira">«</NavBtn>
                  <NavBtn onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1} title="Anterior">‹</NavBtn>

                  {pageNumbers().map((p, i) =>
                    p === "…"
                      ? <span key={`e${i}`} style={{ padding: "0 4px", color: "#9ca3af", fontSize: "13px" }}>…</span>
                      : <button key={p} onClick={() => setPagina(p as number)}
                          style={{ width: "30px", height: "30px", border: "1px solid", borderRadius: "7px", fontSize: "12px", cursor: "pointer", fontWeight: p === pagina ? 700 : 400, background: p === pagina ? "#1d4ed8" : "#fff", color: p === pagina ? "#fff" : "#374151", borderColor: p === pagina ? "#1d4ed8" : "#e5e7eb" }}>
                          {p}
                        </button>
                  )}

                  <NavBtn onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas} title="Próxima">›</NavBtn>
                  <NavBtn onClick={() => setPagina(totalPaginas)} disabled={pagina === totalPaginas} title="Última">»</NavBtn>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 29 }} />}
      <NovoClienteModal open={novoOpen} onOpenChange={setNovoOpen} onSaved={() => setReloadKey(k => k + 1)} />

      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open && !deleting) { setDeleteTarget(null); setDeleteError(null); } }}>
        <DialogContent style={{ maxWidth: "420px" }}>
          <DialogHeader>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "44px", height: "44px", borderRadius: "50%", background: "#fef2f2", marginBottom: "12px" }}>
              <svg width="20" height="20" fill="none" stroke="#dc2626" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </div>
            <DialogTitle style={{ fontSize: "16px", fontWeight: 700, color: "#111827" }}>Excluir cliente</DialogTitle>
            <DialogDescription style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
              Tem certeza que deseja excluir este cliente? Essa ação não poderá ser desfeita.
            </DialogDescription>
          </DialogHeader>

          {deleteTarget && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: "8px", padding: "10px 14px", margin: "4px 0" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "7px", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "#1d4ed8", flexShrink: 0 }}>
                {nameInitials(deleteTarget.razao_social)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {deleteTarget.razao_social ?? "—"}
                </div>
                {deleteTarget.nome_fantasia && deleteTarget.nome_fantasia !== deleteTarget.razao_social && (
                  <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {deleteTarget.nome_fantasia}
                  </div>
                )}
              </div>
            </div>
          )}

          {deleteError && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", marginTop: "4px" }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#dc2626", marginBottom: "6px" }}>Erro ao excluir</div>
              <pre style={{ fontSize: "11px", color: "#b91c1c", fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0 }}>{deleteError}</pre>
              <div style={{ fontSize: "10px", color: "#9ca3af", marginTop: "6px" }}>Veja o console do navegador (F12) para o diagnóstico completo.</div>
            </div>
          )}

          <DialogFooter style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
            <button
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 500, border: "1px solid #e5e7eb", borderRadius: "7px", background: "#fff", color: "#374151", cursor: deleting ? "default" : "pointer", opacity: deleting ? 0.5 : 1 }}>
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{ display: "flex", alignItems: "center", gap: "7px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, border: "none", borderRadius: "7px", background: deleting ? "#f87171" : "#dc2626", color: "#fff", cursor: deleting ? "default" : "pointer", transition: "background .12s" }}
              onMouseEnter={e => { if (!deleting) e.currentTarget.style.background = "#b91c1c"; }}
              onMouseLeave={e => { if (!deleting) e.currentTarget.style.background = "#dc2626"; }}>
              {deleting ? (
                <>
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite" }} aria-hidden="true">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Excluindo...
                </>
              ) : (
                <>
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  </svg>
                  Excluir cliente
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "20px", padding: "3px 10px", fontSize: "11px", fontWeight: 500, color: "#1d4ed8" }}>
      {label}
      <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: "#60a5fa", display: "flex", padding: 0, lineHeight: 1 }}>
        <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </span>
  );
}

function NavBtn({ onClick, disabled, children, title }: { onClick: () => void; disabled: boolean; children: React.ReactNode; title?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ width: "30px", height: "30px", border: "1px solid #e5e7eb", borderRadius: "7px", background: "#fff", cursor: disabled ? "default" : "pointer", color: "#374151", fontSize: "14px", opacity: disabled ? 0.35 : 1 }}>
      {children}
    </button>
  );
}
