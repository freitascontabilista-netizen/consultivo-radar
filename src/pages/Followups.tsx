import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase, type AcaoConsultivaRow, type RadarConsultivoRow } from "@/lib/supabase";
import { CheckCircle, Plus, Calendar, AlertTriangle, Clock, ChevronDown, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── helpers ───────────────────────────────────────────────────────────────────

function parseTags(value: string | null) {
  if (!value) return { tipo: "acao", interacaoId: null as string | null, descricao: "" };
  let remaining = value;
  let tipo = "acao";
  let interacaoId: string | null = null;
  let m: RegExpMatchArray | null;
  while ((m = remaining.match(/^\[([^:\]]+):([^\]]*)\]/)) !== null) {
    if (m[1] === "tipo") tipo = m[2];
    else if (m[1] === "interacao") interacaoId = m[2];
    remaining = remaining.slice(m[0].length);
  }
  return { tipo, interacaoId, descricao: remaining.trim() };
}

function calcGroup(status: string, dataPrev: string | null): "atrasado" | "hoje" | "proximo" | "concluido" {
  if (status === "concluida" || status === "cancelada") return "concluido";
  if (!dataPrev) return "proximo";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dataPrev); due.setHours(0, 0, 0, 0);
  if (due < today) return "atrasado";
  if (due.getTime() === today.getTime()) return "hoje";
  return "proximo";
}

function formatDate(value?: string | null) {
  if (!value) return "Sem prazo";
  try { return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return value; }
}

function nameInitials(name: string | null) {
  return (name ?? "?").trim().split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

// ── config ────────────────────────────────────────────────────────────────────

const urgConfig: Record<string, { label: string; bg: string; color: string }> = {
  alta:    { label: "Alta",  bg: "#fee2e2", color: "#dc2626" },
  critica: { label: "Alta",  bg: "#fee2e2", color: "#dc2626" },
  media:   { label: "Média", bg: "#fef3c7", color: "#d97706" },
  baixa:   { label: "Baixa", bg: "#dcfce7", color: "#16a34a" },
};

const tipoConfig: Record<string, { label: string; bg: string; color: string }> = {
  relacionamento: { label: "Relacionamento",  bg: "#dbeafe", color: "#1d4ed8" },
  consultivo:     { label: "Consultivo",      bg: "#dcfce7", color: "#16a34a" },
  acao:           { label: "Ação consultiva", bg: "#f3e8ff", color: "#7c3aed" },
};

const groupConfig = {
  atrasado: { label: "Em atraso",           borderColor: "#dc2626", headerBg: "#fef2f2", headerColor: "#dc2626" },
  hoje:     { label: "Vencem hoje",         borderColor: "#d97706", headerBg: "#fffbeb", headerColor: "#d97706" },
  proximo:  { label: "Próximos",            borderColor: "#1d4ed8", headerBg: "#eff6ff", headerColor: "#1d4ed8" },
  concluido:{ label: "Concluídos recentes", borderColor: "#d1d5db", headerBg: "#f9fafb", headerColor: "#6b7280" },
} as const;

// ── types ─────────────────────────────────────────────────────────────────────

interface FollowupItem extends AcaoConsultivaRow {
  razao_social: string | null;
  _group: "atrasado" | "hoje" | "proximo" | "concluido";
  _tipo: string;
  _interacaoId: string | null;
}

const inputCls = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelCls = "block text-xs font-medium text-gray-600 mb-1";

// ── component ─────────────────────────────────────────────────────────────────

export default function Followups() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [items, setItems] = useState<FollowupItem[]>([]);
  const [clientes, setClientes] = useState<RadarConsultivoRow[]>([]);
  const [loading, setLoading] = useState(true);
  // filters
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "atrasado" | "hoje" | "pendentes" | "concluido">("todos");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroPrioridade, setFiltroPrioridade] = useState("");

  // pagination
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState<10 | 20 | 50 | 100>(10);

  // adiar modal
  const [adiarId, setAdiarId] = useState<string | null>(null);
  const [adiarData, setAdiarData] = useState("");
  const [adiarSaving, setAdiarSaving] = useState(false);

  // novo follow-up modal
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    clienteId: "", titulo: "", tipo: "acao", prioridade: "media", dataVencimento: "", descricao: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: acoes }, { data: clientesData }] = await Promise.all([
      supabase.from("acoes_consultivas").select("*").order("data_retorno_prevista", { ascending: true }),
      supabase.from("radar_consultivo").select("*"),
    ]);

    const cliMap = new Map(
      (clientesData ?? []).map(c => [String((c as any).cliente_id ?? (c as any).id), c as RadarConsultivoRow])
    );

    const enriched: FollowupItem[] = (acoes ?? []).map((a: AcaoConsultivaRow) => {
      const cli = cliMap.get(String(a.cliente_id));
      const { tipo, interacaoId } = parseTags(a.problema_identificado);
      return {
        ...a,
        razao_social: cli?.razao_social ?? null,
        _group: calcGroup(a.status, a.data_retorno_prevista ?? null),
        _tipo: tipo,
        _interacaoId: interacaoId,
      };
    });

    setItems(enriched);
    setClientes((clientesData as RadarConsultivoRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const clienteId = (location.state as { clienteId?: string } | null)?.clienteId;
    if (clienteId) setFiltroCliente(clienteId);
  }, [location.state]);

  useEffect(() => { setPagina(1); }, [filtroStatus, filtroCliente, filtroPrioridade]);

  // ── metrics ──────────────────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
    return {
      atrasados:      items.filter(i => i._group === "atrasado").length,
      hoje:           items.filter(i => i._group === "hoje").length,
      pendentes:      items.filter(i => i._group === "atrasado" || i._group === "hoje" || i._group === "proximo").length,
      concluidosMes:  items.filter(i => i.status === "concluida" && new Date(i.created_at ?? "") >= startOfMonth).length,
    };
  }, [items]);

  // ── filtered & grouped ───────────────────────────────────────────────────────

  const filtered = useMemo(() => items.filter(i => {
    if (filtroStatus === "atrasado"  && i._group !== "atrasado") return false;
    if (filtroStatus === "hoje"      && i._group !== "hoje") return false;
    if (filtroStatus === "pendentes" && !["atrasado","hoje","proximo"].includes(i._group)) return false;
    if (filtroStatus === "concluido" && i._group !== "concluido") return false;
    if (filtroCliente && String(i.cliente_id) !== filtroCliente) return false;
    if (filtroPrioridade) {
      const u = ((i.urgencia ?? "media") as string) === "critica" ? "alta" : (i.urgencia ?? "media") as string;
      if (u !== filtroPrioridade) return false;
    }
    return true;
  }), [items, filtroStatus, filtroCliente, filtroPrioridade]);

  const totalPaginas = Math.max(1, Math.ceil(filtered.length / porPagina));
  const filteredPaginado = useMemo(
    () => filtered.slice((pagina - 1) * porPagina, pagina * porPagina),
    [filtered, pagina, porPagina],
  );

  const groups = useMemo(() => ({
    atrasado: filteredPaginado.filter(i => i._group === "atrasado"),
    hoje:     filteredPaginado.filter(i => i._group === "hoje"),
    proximo:  filteredPaginado.filter(i => i._group === "proximo"),
    concluido:filteredPaginado.filter(i => i._group === "concluido"),
  }), [filteredPaginado]);

  // ── actions ──────────────────────────────────────────────────────────────────

  const handleConcluir = async (id: string) => {
    const { error } = await supabase.from("acoes_consultivas").update({ status: "concluida" }).eq("id", id);
    if (error) { toast({ title: "Erro ao concluir acompanhamento", description: error.message, variant: "destructive" }); return; }
    load();
  };

  const handleAdiar = async () => {
    if (!adiarId || !adiarData) return;
    setAdiarSaving(true);
    const { error } = await supabase.from("acoes_consultivas").update({ data_retorno_prevista: adiarData }).eq("id", adiarId);
    setAdiarSaving(false);
    if (error) { toast({ title: "Erro ao adiar acompanhamento", description: error.message, variant: "destructive" }); return; }
    setAdiarId(null);
    setAdiarData("");
    load();
  };

  const handleNovoFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clienteId || !form.titulo) return;
    setSaving(true);
    const problema = `[tipo:${form.tipo}]${form.descricao}`;
    await supabase.from("acoes_consultivas").insert({
      cliente_id: form.clienteId,
      tema: form.titulo,
      problema_identificado: problema,
      acao_recomendada: null,
      urgencia: form.prioridade,
      status: "aberta",
      data_retorno_prevista: form.dataVencimento || null,
    });
    setSaving(false);
    setModalOpen(false);
    setForm({ clienteId: "", titulo: "", tipo: "acao", prioridade: "media", dataVencimento: "", descricao: "" });
    load();
  };

  // ── item card renderer ───────────────────────────────────────────────────────

  const renderItem = (item: FollowupItem, idx: number, total: number) => {
    const urg   = urgConfig[(item.urgencia ?? "media") as string] ?? urgConfig.media;
    const tipo  = tipoConfig[item._tipo] ?? tipoConfig.acao;
    const done  = item._group === "concluido";
    const name  = item.razao_social ?? `Cliente ${item.cliente_id}`;

    return (
      <div key={String(item.id)}
        style={{ display: "flex", gap: "12px", padding: "14px 18px", alignItems: "flex-start", borderBottom: idx < total - 1 ? "1px solid #f3f4f6" : "none", background: done ? "#fafafa" : "#fff" }}
        onMouseEnter={e => { if (!done) e.currentTarget.style.background = "#f9fafb"; }}
        onMouseLeave={e => { e.currentTarget.style.background = done ? "#fafafa" : "#fff"; }}>

        {/* Avatar */}
        <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: done ? "#f3f4f6" : "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: done ? "#9ca3af" : "#1d4ed8", flexShrink: 0 }}>
          {nameInitials(name)}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: done ? "#9ca3af" : "#111827", textDecoration: done ? "line-through" : "none", flex: 1 }}>
              {item.tema ?? "Sem título"}
            </p>
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", flexShrink: 0 }}>
              <span style={{ display: "inline-flex", alignItems: "center", borderRadius: "20px", background: urg.bg, color: urg.color, padding: "2px 9px", fontSize: "10px", fontWeight: 600 }}>
                {urg.label}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", borderRadius: "20px", background: tipo.bg, color: tipo.color, padding: "2px 9px", fontSize: "10px", fontWeight: 600 }}>
                {tipo.label}
              </span>
            </div>
          </div>

          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#6b7280" }}>{name}</p>

          {item.acao_recomendada && (
            <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#9ca3af", lineHeight: 1.4 }}>
              {item.acao_recomendada}
            </p>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px", flexWrap: "wrap", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: item._group === "atrasado" ? "#dc2626" : "#9ca3af" }}>
                <Calendar size={11} />
                {formatDate(item.data_retorno_prevista)}
              </span>
              {item._interacaoId && (
                <span style={{ background: "#f3e8ff", color: "#7c3aed", padding: "1px 7px", borderRadius: "8px", fontSize: "10px", fontWeight: 500 }}>
                  Via orientação
                </span>
              )}
            </div>

            {!done && (
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => { setAdiarId(String(item.id)); setAdiarData(item.data_retorno_prevista?.slice(0, 10) ?? ""); }}
                  style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: "6px", padding: "4px 11px", fontSize: "11px", fontWeight: 500, color: "#6b7280", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                  onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                  <Clock size={11} /> Adiar
                </button>
                <button
                  onClick={() => handleConcluir(String(item.id))}
                  style={{ border: "1px solid #bbf7d0", background: "#f0fdf4", borderRadius: "6px", padding: "4px 11px", fontSize: "11px", fontWeight: 600, color: "#16a34a", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#dcfce7"}
                  onMouseLeave={e => e.currentTarget.style.background = "#f0fdf4"}>
                  <CheckCircle size={12} /> Concluir
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderGroup = (key: keyof typeof groupConfig, groupItems: FollowupItem[]) => {
    if (groupItems.length === 0) return null;
    const cfg = groupConfig[key];
    return (
      <div key={key} style={{ marginBottom: "16px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden", borderLeft: `3px solid ${cfg.borderColor}` }}>
        <div style={{ padding: "10px 18px", background: cfg.headerBg, borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: cfg.headerColor, textTransform: "uppercase", letterSpacing: ".04em" }}>
            {cfg.label}
          </span>
          <span style={{ fontSize: "11px", background: "#fff", border: `1px solid ${cfg.borderColor}`, color: cfg.headerColor, borderRadius: "10px", padding: "1px 8px", fontWeight: 600 }}>
            {groupItems.length}
          </span>
        </div>
        {groupItems.map((item, idx) => renderItem(item, idx, groupItems.length))}
      </div>
    );
  };

  // ── JSX ───────────────────────────────────────────────────────────────────────

  return (
    <>
      <main style={{ maxWidth: "1240px", margin: "0 auto", padding: "28px 28px 80px" }}>

        {/* page title */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#111827", margin: 0 }}>Acompanhamentos</h1>
            <p style={{ fontSize: "13px", color: "#6b7280", margin: "3px 0 0" }}>Acompanhe e gerencie os próximos passos com seus clientes</p>
          </div>
          <button onClick={() => setModalOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: "7px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer", boxShadow: "0 1px 3px rgba(29,78,216,.3)" }}
            onMouseEnter={e => e.currentTarget.style.background = "#1e40af"}
            onMouseLeave={e => e.currentTarget.style.background = "#1d4ed8"}>
            <Plus size={15} /> Novo acompanhamento
          </button>
        </div>

        {/* ── metric cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "20px" }}>
          {[
            { label: "Em atraso",        value: metrics.atrasados,     bg: "#fef2f2", color: "#dc2626", border: "#fecaca", icon: <AlertTriangle size={16} /> },
            { label: "Vencem hoje",      value: metrics.hoje,          bg: "#fffbeb", color: "#d97706", border: "#fde68a", icon: <Clock size={16} /> },
            { label: "Pendentes",        value: metrics.pendentes,     bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> },
            { label: "Concluídos no mês",value: metrics.concluidosMes, bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0", icon: <CheckCircle size={16} /> },
          ].map(({ label, value, bg, color, border, icon }) => (
            <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: "10px", padding: "16px 18px", display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}>
                {icon}
              </div>
              <div>
                <div style={{ fontSize: "24px", fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: "11px", fontWeight: 500, color, opacity: .8, marginTop: "3px" }}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── filters ── */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px 18px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* status buttons */}
          <div style={{ display: "flex", gap: "4px", background: "#f3f4f6", padding: "3px", borderRadius: "8px" }}>
            {([
              ["todos",    "Todos"],
              ["atrasado", "Em atraso"],
              ["hoje",     "Vencem hoje"],
              ["pendentes","Pendentes"],
              ["concluido","Concluídos"],
            ] as const).map(([val, label]) => (
              <button key={val} onClick={() => setFiltroStatus(val)}
                style={{ padding: "5px 12px", fontSize: "12px", fontWeight: filtroStatus === val ? 600 : 400, color: filtroStatus === val ? "#1d4ed8" : "#6b7280", background: filtroStatus === val ? "#fff" : "transparent", border: "none", borderRadius: "6px", cursor: "pointer", boxShadow: filtroStatus === val ? "0 1px 3px rgba(0,0,0,.1)" : "none" }}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {/* cliente dropdown */}
          <div style={{ position: "relative" }}>
            <select
              value={filtroCliente}
              onChange={e => setFiltroCliente(e.target.value)}
              style={{ appearance: "none", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "7px", padding: "6px 32px 6px 11px", fontSize: "12px", color: "#374151", cursor: "pointer", minWidth: "160px" }}>
              <option value="">Todos os clientes</option>
              {clientes.map(c => (
                <option key={String((c as any).cliente_id ?? (c as any).id)} value={String((c as any).cliente_id ?? (c as any).id)}>
                  {c.razao_social ?? c.nome_fantasia ?? "Cliente"}
                </option>
              ))}
            </select>
            <ChevronDown size={13} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none" }} />
          </div>

          {/* prioridade dropdown */}
          <div style={{ position: "relative" }}>
            <select
              value={filtroPrioridade}
              onChange={e => setFiltroPrioridade(e.target.value)}
              style={{ appearance: "none", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "7px", padding: "6px 32px 6px 11px", fontSize: "12px", color: "#374151", cursor: "pointer", minWidth: "150px" }}>
              <option value="">Todas as prioridades</option>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
            <ChevronDown size={13} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none" }} />
          </div>
        </div>

        {/* ── list ── */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[1,2,3].map(i => <div key={i} style={{ height: "90px", borderRadius: "10px", background: "#e5e7eb" }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "56px", textAlign: "center" }}>
            <div style={{ width: "44px", height: "44px", background: "#f3f4f6", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "#d1d5db" }}>
              <CheckCircle size={20} />
            </div>
            <p style={{ fontSize: "14px", fontWeight: 600, color: "#374151", margin: 0 }}>Nenhum acompanhamento encontrado</p>
            <p style={{ fontSize: "12px", color: "#9ca3af", margin: "4px 0 0" }}>Tente ajustar os filtros ou crie um novo acompanhamento.</p>
          </div>
        ) : (
          <>
            {renderGroup("atrasado", groups.atrasado)}
            {renderGroup("hoje",     groups.hoje)}
            {renderGroup("proximo",  groups.proximo)}
            {renderGroup("concluido",groups.concluido)}
          </>
        )}

        {/* ── pagination footer ── */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "16px", flexWrap: "wrap", gap: "10px" }}>

            {/* left: por página */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", color: "#6b7280" }}>Exibir por página:</span>
              <div style={{ display: "flex", gap: "4px" }}>
                {([10, 20, 50, 100] as const).map(n => (
                  <button key={n} onClick={() => { setPorPagina(n); setPagina(1); }}
                    style={{ padding: "4px 10px", fontSize: "12px", fontWeight: porPagina === n ? 700 : 400, border: "1px solid", borderColor: porPagina === n ? "#1d4ed8" : "#e5e7eb", borderRadius: "6px", background: porPagina === n ? "#eff6ff" : "#fff", color: porPagina === n ? "#1d4ed8" : "#374151", cursor: "pointer" }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* right: info + navegação */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "12px", color: "#6b7280" }}>
                Exibindo {(pagina - 1) * porPagina + 1}–{Math.min(pagina * porPagina, filtered.length)} de {filtered.length} acompanhamento{filtered.length !== 1 ? "s" : ""}
              </span>

              <div style={{ display: "flex", gap: "4px" }}>
                {/* anterior */}
                <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}
                  style={{ width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e5e7eb", borderRadius: "6px", background: "#fff", color: pagina === 1 ? "#d1d5db" : "#374151", cursor: pagina === 1 ? "default" : "pointer" }}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>
                </button>

                {/* números */}
                {(() => {
                  const pages: (number | "…")[] = [];
                  if (totalPaginas <= 7) {
                    for (let p = 1; p <= totalPaginas; p++) pages.push(p);
                  } else {
                    pages.push(1);
                    if (pagina > 3) pages.push("…");
                    for (let p = Math.max(2, pagina - 1); p <= Math.min(totalPaginas - 1, pagina + 1); p++) pages.push(p);
                    if (pagina < totalPaginas - 2) pages.push("…");
                    pages.push(totalPaginas);
                  }
                  return pages.map((p, i) =>
                    p === "…" ? (
                      <span key={`e${i}`} style={{ width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "#9ca3af" }}>…</span>
                    ) : (
                      <button key={p} onClick={() => setPagina(p as number)}
                        style={{ width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid", borderColor: pagina === p ? "#1d4ed8" : "#e5e7eb", borderRadius: "6px", background: pagina === p ? "#eff6ff" : "#fff", color: pagina === p ? "#1d4ed8" : "#374151", fontSize: "12px", fontWeight: pagina === p ? 700 : 400, cursor: "pointer" }}>
                        {p}
                      </button>
                    )
                  );
                })()}

                {/* próxima */}
                <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}
                  style={{ width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e5e7eb", borderRadius: "6px", background: "#fff", color: pagina === totalPaginas ? "#d1d5db" : "#374151", cursor: pagina === totalPaginas ? "default" : "pointer" }}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── modal: adiar ── */}
      {adiarId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.45)", padding: "16px" }}>
          <div style={{ width: "100%", maxWidth: "360px", borderRadius: "14px", background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#111827" }}>Adiar acompanhamento</h3>
              <button onClick={() => setAdiarId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><X size={18} /></button>
            </div>
            <div style={{ padding: "20px" }}>
              <label className={labelCls}>Nova data de vencimento</label>
              <input type="date" className={inputCls} value={adiarData} onChange={e => setAdiarData(e.target.value)} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", padding: "0 20px 20px" }}>
              <button onClick={() => setAdiarId(null)} style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", color: "#6b7280", cursor: "pointer" }}>Cancelar</button>
              <button onClick={handleAdiar} disabled={adiarSaving || !adiarData}
                style={{ background: "#1d4ed8", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#fff", cursor: "pointer", opacity: adiarSaving || !adiarData ? .6 : 1 }}>
                {adiarSaving ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── modal: novo follow-up ── */}
      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.45)", padding: "16px" }}>
          <div style={{ width: "100%", maxWidth: "500px", borderRadius: "14px", background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid #e8eaed" }}>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#111827" }}>Novo acompanhamento</h3>
              <button onClick={() => setModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><X size={18} /></button>
            </div>
            <form onSubmit={handleNovoFollowup}>
              <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: "14px", maxHeight: "65vh", overflowY: "auto" }}>
                <div>
                  <label className={labelCls}>Cliente *</label>
                  <select className={inputCls} required value={form.clienteId} onChange={e => setForm(f => ({ ...f, clienteId: e.target.value }))}>
                    <option value="">Selecione o cliente...</option>
                    {clientes.map(c => {
                      const id = String((c as any).cliente_id ?? (c as any).id);
                      return <option key={id} value={id}>{c.razao_social ?? c.nome_fantasia ?? id}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Título da tarefa *</label>
                  <input className={inputCls} required value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Ligar para discutir proposta" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label className={labelCls}>Tipo</label>
                    <select className={inputCls} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                      <option value="relacionamento">Relacionamento</option>
                      <option value="consultivo">Consultivo</option>
                      <option value="acao">Ação consultiva</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Prioridade</label>
                    <select className={inputCls} value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))}>
                      <option value="alta">Alta</option>
                      <option value="media">Média</option>
                      <option value="baixa">Baixa</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Data de vencimento</label>
                  <input type="date" className={inputCls} value={form.dataVencimento} onChange={e => setForm(f => ({ ...f, dataVencimento: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Descrição (opcional)</label>
                  <textarea rows={3} className={inputCls} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Contexto ou detalhes do acompanhamento..." />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", padding: "14px 24px", borderTop: "1px solid #e8eaed" }}>
                <button type="button" onClick={() => setModalOpen(false)} style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", color: "#6b7280", cursor: "pointer" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  style={{ background: "#1d4ed8", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#fff", cursor: "pointer", opacity: saving ? .6 : 1 }}>
                  {saving ? "Salvando..." : "Criar acompanhamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
