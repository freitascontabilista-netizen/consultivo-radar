import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  supabase,
  type AcaoConsultivaRow,
  type InteracaoRow,
  type RadarConsultivoRow,
} from "@/lib/supabase";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { RegistrarOrientacaoModal } from "@/components/RegistrarOrientacaoModal";
import { Pencil, X, Trash2, Calendar, Clock, AlertCircle, CheckCircle2, Tag, MapPin, Building2, StickyNote, Zap, Target, AlertTriangle } from "lucide-react";

const tipoConfig: Record<string, { label: string; bg: string; color: string }> = {
  consultiva:     { label: "Consultiva",     bg: "#dbeafe", color: "#1d4ed8" },
  relacionamento: { label: "Relacionamento", bg: "#f3e8ff", color: "#7e22ce" },
  suporte:        { label: "Suporte",        bg: "#f1f5f9", color: "#475569" },
  comercial:      { label: "Comercial",      bg: "#dcfce7", color: "#16a34a" },
};

const urgenciaConfig: Record<string, { label: string; bg: string; color: string }> = {
  baixa:  { label: "Baixa",    bg: "#f1f5f9", color: "#475569" },
  media:  { label: "Média",    bg: "#fef9c3", color: "#a16207" },
  alta:   { label: "Alta",     bg: "#fef3c7", color: "#d97706" },
  critica:{ label: "Crítica",  bg: "#fee2e2", color: "#dc2626" },
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return value;
  }
}

function formatDateTimeline(value?: string | null): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    const now = new Date();
    const time = d.toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    if (d.toDateString() === now.toDateString()) return `Hoje, ${time}`;
    const ontem = new Date(now); ontem.setDate(now.getDate() - 1);
    if (d.toDateString() === ontem.toDateString()) return `Ontem, ${time}`;
    const data = d.toLocaleString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
    return `${data}, ${time}`;
  } catch {
    return value ?? "—";
  }
}

interface EditForm {
  razao_social: string;
  nome_fantasia: string;
  segmento: string;
  uf: string;
  regime_tributario: string;
  porte: string;
  canal_preferido: string;
  frequencia_contato_dias: number;
  dores_mapeadas: string;
  objetivos_empresario: string;
  observacoes: string;
}

const ITENS_POR_PAGINA = 10;

export default function RadarCliente() {
  const { clienteId = "" } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState<RadarConsultivoRow | null>(null);
  const [interacoes, setInteracoes] = useState<InteracaoRow[]>([]);
  const [acoes, setAcoes] = useState<AcaoConsultivaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [editForm, setEditForm] = useState<EditForm>({
    razao_social: "",
    nome_fantasia: "",
    segmento: "",
    uf: "",
    regime_tributario: "",
    porte: "",
    canal_preferido: "",
    frequencia_contato_dias: 30,
    dores_mapeadas: "",
    objetivos_empresario: "",
    observacoes: "",
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    let cli = await supabase.from("radar_consultivo").select("*").eq("id", clienteId).maybeSingle();
    if (cli.error || !cli.data) {
      cli = await supabase.from("radar_consultivo").select("*").eq("cliente_id", clienteId).maybeSingle();
    }
    const [{ data: i }, { data: a }] = await Promise.all([
      supabase.from("interacoes").select("*").eq("cliente_id", clienteId).order("data_interacao", { ascending: false }),
      supabase.from("acoes_consultivas").select("*").eq("cliente_id", clienteId).in("status", ["aberta", "em_andamento"]),
    ]);
    setCliente((cli.data as RadarConsultivoRow) ?? null);
    setInteracoes((i as InteracaoRow[]) ?? []);
    setAcoes((a as AcaoConsultivaRow[]) ?? []);
    setLoading(false);
  }, [clienteId]);

  useEffect(() => { load(); }, [load]);

  const openEdit = () => {
    if (!cliente) return;
    setEditForm({
      razao_social: (cliente as any).razao_social ?? "",
      nome_fantasia: (cliente as any).nome_fantasia ?? "",
      segmento: (cliente as any).segmento ?? "",
      uf: (cliente as any).uf ?? "",
      regime_tributario: (cliente as any).regime_tributario ?? "",
      porte: (cliente as any).porte ?? "",
      canal_preferido: (cliente as any).canal_preferido ?? "",
      frequencia_contato_dias: (cliente as any).frequencia_contato_dias ?? 30,
      dores_mapeadas: (cliente as any).dores_mapeadas ?? "",
      objetivos_empresario: (cliente as any).objetivos_empresario ?? "",
      observacoes: (cliente as any).observacoes ?? "",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    setSaving(true);

    // Mesma sonda do fluxo de exclusão: testa candidatos via SELECT
    // para confirmar qual campo/valor bate com a linha real na tabela clientes.
    const candidatos = [
      { campo: "id",         valor: (cliente as any)?.cliente_id },
      { campo: "id",         valor: (cliente as any)?.id },
      { campo: "id",         valor: clienteId },
      { campo: "cliente_id", valor: (cliente as any)?.cliente_id },
      { campo: "cliente_id", valor: (cliente as any)?.id },
    ].filter((c): c is { campo: string; valor: string | number } => c.valor != null && c.valor !== "");

    let campoConfirmado: string | null = null;
    let idConfirmado: string | number | null = null;

    for (const { campo, valor } of candidatos) {
      const { data, error } = await supabase
        .from("clientes")
        .select("id")
        .eq(campo, valor)
        .maybeSingle();
      if (!error && data) {
        campoConfirmado = campo;
        idConfirmado    = valor;
        break;
      }
    }

    if (!campoConfirmado || idConfirmado == null) {
      setSaving(false);
      toast({
        title: "Não foi possível identificar o cliente para salvar.",
        description: "Tente recarregar a página e tentar novamente.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("clientes")
      .update({
        razao_social:           editForm.razao_social,
        nome_fantasia:          editForm.nome_fantasia || null,
        segmento:               editForm.segmento || null,
        uf:                     editForm.uf || null,
        regime_tributario:      editForm.regime_tributario || null,
        porte:                  editForm.porte || null,
        canal_preferido:        editForm.canal_preferido || null,
        frequencia_contato_dias: editForm.frequencia_contato_dias,
        dores_mapeadas:         editForm.dores_mapeadas || null,
        objetivos_empresario:   editForm.objetivos_empresario || null,
        observacoes:            editForm.observacoes || null,
      })
      .eq(campoConfirmado, idConfirmado);

    setSaving(false);

    if (error) {
      toast({
        title: "Erro ao salvar alterações.",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Alterações salvas com sucesso." });
    setEditOpen(false);
    load();
  };

  const handleDeleteInteracao = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta interação?")) return;
    setDeletingId(id);
    await supabase.from("interacoes").delete().eq("id", id);
    setDeletingId(null);
    setPaginaAtual(1);
    load();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (!count) return;
    if (!confirm(`Excluir ${count} interação${count > 1 ? "ões" : ""}? Esta ação não pode ser desfeita.`)) return;
    setDeletingId("bulk");
    await supabase.from("interacoes").delete().in("id", Array.from(selectedIds));
    setSelectedIds(new Set());
    setDeletingId(null);
    setPaginaAtual(1);
    load();
  };

  const ultimaOrientacao = useMemo(() => {
    if (cliente?.ultima_orientacao_consultiva) return formatDate(cliente.ultima_orientacao_consultiva);
    const consultiva = interacoes.find((x) => x.tipo === "consultiva");
    return formatDate(consultiva?.data_interacao ?? consultiva?.criado_em ?? null);
  }, [cliente, interacoes]);

  const totalOrientacoes = cliente?.total_orientacoes ?? interacoes.filter((x) => x.tipo === "consultiva").length;
  const followups = cliente?.followups_pendentes ?? acoes.length;
  const dias = cliente?.dias_sem_orientacao ?? 0;
  const totalPaginas = Math.ceil(interacoes.length / ITENS_POR_PAGINA);
  const interacoesPaginadas = interacoes.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA);

  const initials = (email: string) => email.split("@")[0].slice(0, 2).toUpperCase();

  const diasColor = (d: number) => d === 0 ? "#10b981" : d <= 7 ? "#f59e0b" : "#ef4444";

  const inputClass = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-xs font-medium text-gray-600 mb-1";

  const [menuOpen, setMenuOpen] = useState(false);
  const emailInitials = userEmail ? userEmail.split("@")[0].slice(0, 2).toUpperCase() : "TF";

  const navItems = [
    { label: "Dashboard",     path: "/",             active: false },
    { label: "Clientes",      path: "/clientes",     active: true  },
    { label: "Orientações",   path: "/orientacoes",  active: false },
    { label: "Follow-ups",    path: "/followups",    active: false },
    { label: "Administração", path: "/admin",        active: false },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f9", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

      {/* ── Top nav ── */}
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

      {/* ── Main ── */}
      <main style={{ maxWidth: "1240px", margin: "0 auto", padding: "28px 28px 80px" }}>

        {/* Back */}
        <button onClick={() => navigate("/clientes")}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#6b7280", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: "20px" }}
          onMouseEnter={e => e.currentTarget.style.color = "#111827"}
          onMouseLeave={e => e.currentTarget.style.color = "#6b7280"}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Voltar para Clientes
        </button>

        {loading && !cliente ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ height: "110px", borderRadius: "10px", background: "#e5e7eb" }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px" }}>
              {[1,2,3,4].map(i => <div key={i} style={{ height: "80px", borderRadius: "10px", background: "#e5e7eb" }} />)}
            </div>
          </div>
        ) : !cliente ? (
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "48px", textAlign: "center", fontSize: "14px", color: "#9ca3af" }}>
            Cliente não encontrado.
          </div>
        ) : (
          <>
            {/* ── Client header card ── */}
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px 28px", marginBottom: "16px", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "20px", flexWrap: "wrap" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", marginBottom: "12px" }}>
                    {/* Avatar */}
                    <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "linear-gradient(135deg, #1d4ed8, #1e40af)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: 800, color: "#fff", flexShrink: 0, boxShadow: "0 4px 14px rgba(29,78,216,.3)" }}>
                      {(cliente.razao_social ?? "?").trim().split(" ").filter(Boolean).slice(0,2).map((w: string) => w[0]).join("").toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", margin: 0, lineHeight: 1.2 }}>
                        {cliente.razao_social ?? "Cliente"}
                      </h1>
                      {cliente.nome_fantasia && cliente.nome_fantasia !== cliente.razao_social && (
                        <p style={{ fontSize: "13px", color: "#9ca3af", margin: "3px 0 0" }}>{cliente.nome_fantasia}</p>
                      )}
                    </div>
                    <button onClick={openEdit}
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "12px", fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(29,78,216,.3)", flexShrink: 0 }}
                      onMouseEnter={e => e.currentTarget.style.background = "#1e40af"}
                      onMouseLeave={e => e.currentTarget.style.background = "#1d4ed8"}>
                      <Pencil size={12} /> Editar cadastro
                    </button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                    <StatusBadge status={cliente.semaforo} />
                    {cliente.segmento && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", borderRadius: "20px", background: "#eff6ff", border: "1px solid #bfdbfe", padding: "4px 11px", fontSize: "11px", fontWeight: 600, color: "#1d4ed8" }}>
                        <Tag size={10} /> {cliente.segmento}
                      </span>
                    )}
                    {(cliente as any).regime_tributario && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", borderRadius: "20px", background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "4px 11px", fontSize: "11px", fontWeight: 600, color: "#16a34a" }}>
                        <Building2 size={10} /> {(cliente as any).regime_tributario}
                      </span>
                    )}
                    {(cliente as any).uf && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", borderRadius: "20px", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "4px 11px", fontSize: "11px", fontWeight: 500, color: "#64748b" }}>
                        <MapPin size={10} /> {(cliente as any).uf}
                      </span>
                    )}
                    {(cliente as any).porte && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", borderRadius: "20px", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "4px 11px", fontSize: "11px", fontWeight: 500, color: "#64748b" }}>
                        {(cliente as any).porte}
                      </span>
                    )}
                  </div>
                  {(cliente as any).observacoes && (
                    <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderLeft: "4px solid #f59e0b", borderRadius: "8px", padding: "10px 14px", marginTop: "14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "5px" }}>
                        <StickyNote size={11} /> Particularidades
                      </div>
                      <div style={{ fontSize: "13px", color: "#78350f", lineHeight: 1.6 }}>{(cliente as any).observacoes}</div>
                    </div>
                  )}
                </div>

                {/* Dias destaque */}
                {(() => {
                  const bg = dias === 0 ? "#f0fdf4" : dias <= 7 ? "#fffbeb" : "#fef2f2";
                  const border = dias === 0 ? "#bbf7d0" : dias <= 7 ? "#fde68a" : "#fecaca";
                  const tagBg = dias === 0 ? "#dcfce7" : dias <= 7 ? "#fef9c3" : "#fee2e2";
                  const tagColor = dias === 0 ? "#16a34a" : dias <= 7 ? "#a16207" : "#dc2626";
                  const tagLabel = dias === 0 ? "Em dia" : dias <= 7 ? "Atenção" : "Crítico";
                  return (
                    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: "12px", padding: "16px 24px", textAlign: "center", flexShrink: 0, minWidth: "130px" }}>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "6px" }}>Dias sem orientação</div>
                      <div style={{ fontSize: "44px", fontWeight: 900, lineHeight: 1, color: diasColor(dias) }}>{dias}</div>
                      <span style={{ display: "inline-block", marginTop: "8px", background: tagBg, color: tagColor, borderRadius: "20px", padding: "2px 10px", fontSize: "10px", fontWeight: 700 }}>{tagLabel}</span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* ── Metric cards ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "16px" }}>
              <MetricCard label="Última orientação"    value={ultimaOrientacao} loading={loading} icon={<Calendar size={15}/>}     accentColor="#1d4ed8" />
              <MetricCard label="Dias sem orientação"  value={dias}             loading={loading} icon={<Clock size={15}/>}          accentColor={diasColor(dias)} tone={dias === 0 ? "success" : dias <= 7 ? "warning" : "critical"} />
              <MetricCard label="Follow-ups pendentes" value={followups}        loading={loading} icon={<AlertCircle size={15}/>}   accentColor="#f59e0b" />
              <MetricCard label="Total de orientações" value={totalOrientacoes} loading={loading} icon={<CheckCircle2 size={15}/>}  accentColor="#10b981" tone="success" />
            </div>

            {/* ── Two-column layout ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "16px", alignItems: "start" }}>

              {/* Timeline */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                  <h2 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 700, color: "#111827", margin: 0 }}>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "26px", height: "26px", borderRadius: "8px", background: "#eff6ff" }}>
                      <Calendar size={14} color="#1d4ed8" />
                    </span>
                    Timeline de interações
                  </h2>
                  <span style={{ fontSize: "11px", color: "#9ca3af", background: "#f3f4f6", padding: "2px 8px", borderRadius: "10px" }}>{interacoes.length} registros</span>
                </div>
                {selectedIds.size > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", marginBottom: "10px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#1d4ed8", flex: 1 }}>
                      {selectedIds.size} selecionado{selectedIds.size > 1 ? "s" : ""}
                    </span>
                    <button onClick={handleBulkDelete} disabled={deletingId === "bulk"}
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", fontWeight: 600, cursor: "pointer", opacity: deletingId === "bulk" ? .6 : 1 }}>
                      <Trash2 size={13} />
                      {deletingId === "bulk" ? "Excluindo..." : "Excluir selecionados"}
                    </button>
                    <button onClick={clearSelection}
                      style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "#fff", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", fontWeight: 500, cursor: "pointer" }}>
                      <X size={13} />
                      Cancelar seleção
                    </button>
                  </div>
                )}
                <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden" }}>
                  {interacoes.length === 0 ? (
                    <div style={{ padding: "48px", textAlign: "center" }}>
                      <div style={{ width: "40px", height: "40px", background: "#f3f4f6", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "#d1d5db" }}>
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                      </div>
                      <div style={{ fontSize: "13px", color: "#6b7280", fontWeight: 500 }}>Nenhuma interação registrada.</div>
                      <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>Clique em "Registrar orientação" para começar.</div>
                    </div>
                  ) : (
                    <>
                      {interacoesPaginadas.map((it, idx) => {
                        const cfg = tipoConfig[it.tipo as string] ?? tipoConfig.suporte;
                        const isSelected = selectedIds.has(String(it.id));
                        const isLast = idx === interacoesPaginadas.length - 1;
                        return (
                          <div key={String(it.id)}
                            style={{ display: "flex", background: isSelected ? "#eff6ff" : "transparent", transition: "background .15s" }}
                            onMouseEnter={e => { setHoveredId(String(it.id)); if (!isSelected) e.currentTarget.style.background = "#f8fafc"; }}
                            onMouseLeave={e => { setHoveredId(null); if (!isSelected) e.currentTarget.style.background = "transparent"; }}>
                            {/* Linha vertical colorida por tipo */}
                            <div style={{ width: "4px", background: cfg.color, flexShrink: 0, opacity: 0.85 }} />
                            {/* Conteúdo */}
                            <div style={{ flex: 1, padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: "10px", borderBottom: !isLast ? "1px solid #f3f4f6" : "none" }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(String(it.id))}
                                style={{ marginTop: "3px", cursor: "pointer", width: "15px", height: "15px", flexShrink: 0, accentColor: "#1d4ed8" }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", borderRadius: "20px", background: cfg.bg, color: cfg.color, padding: "3px 9px", fontSize: "11px", fontWeight: 600 }}>
                                      <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: cfg.color }} />
                                      {cfg.label}
                                    </span>
                                    {(it as any).canal && (
                                      <span style={{ fontSize: "10px", color: "#9ca3af", background: "#f3f4f6", padding: "2px 6px", borderRadius: "8px" }}>{(it as any).canal}</span>
                                    )}
                                    <span style={{ fontSize: "11px", color: "#9ca3af", fontWeight: 500 }}>
                                      {formatDateTimeline(it.data_interacao ?? (it as any).data ?? it.criado_em ?? (it as any).created_at)}
                                    </span>
                                  </div>
                                  <button onClick={() => handleDeleteInteracao(String(it.id))} disabled={deletingId === String(it.id)}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db", padding: "2px", display: "flex", alignItems: "center" }}
                                    onMouseEnter={e => (e.currentTarget.style.color = "#dc2626")}
                                    onMouseLeave={e => (e.currentTarget.style.color = "#d1d5db")}
                                    title="Excluir">
                                    {deletingId === String(it.id)
                                      ? <span style={{ fontSize: "11px", color: "#9ca3af" }}>Excluindo...</span>
                                      : <Trash2 size={14} />}
                                  </button>
                                </div>
                                <p style={{ margin: "7px 0 0", fontSize: "13px", fontWeight: 600, color: "#111827" }}>{it.assunto ?? "Sem assunto"}</p>
                                {it.resumo && <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#6b7280", lineHeight: 1.5 }}>{it.resumo}</p>}
                                {(it as any).proximo_passo && (
                                  <div style={{ marginTop: "6px", display: "flex", alignItems: "flex-start", gap: "5px", fontSize: "11px", color: "#d97706", background: "#fffbeb", padding: "4px 8px", borderRadius: "6px", border: "1px solid #fde68a" }}>
                                    <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: "1px" }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                                    {(it as any).proximo_passo}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {totalPaginas > 1 && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", borderTop: "1px solid #f3f4f6", padding: "10px 18px" }}>
                          <button onClick={() => setPaginaAtual(p => Math.max(1, p - 1))} disabled={paginaAtual === 1} style={{ padding: "4px 10px", border: "1px solid #e5e7eb", borderRadius: "6px", background: "#fff", fontSize: "12px", cursor: "pointer", color: "#6b7280", opacity: paginaAtual === 1 ? .4 : 1 }}>← Anterior</button>
                          <span style={{ fontSize: "12px", color: "#9ca3af" }}>Página {paginaAtual} de {totalPaginas}</span>
                          <button onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))} disabled={paginaAtual === totalPaginas} style={{ padding: "4px 10px", border: "1px solid #e5e7eb", borderRadius: "6px", background: "#fff", fontSize: "12px", cursor: "pointer", color: "#6b7280", opacity: paginaAtual === totalPaginas ? .4 : 1 }}>Próxima →</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Ações consultivas */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                  <h2 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 700, color: "#111827", margin: 0 }}>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "26px", height: "26px", borderRadius: "8px", background: "#fffbeb" }}>
                      <Zap size={14} color="#f59e0b" />
                    </span>
                    Ações consultivas abertas
                  </h2>
                  {acoes.length > 0 && (
                    <span style={{ fontSize: "11px", fontWeight: 700, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "2px 8px", borderRadius: "10px" }}>{acoes.length}</span>
                  )}
                </div>
                <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden" }}>
                  {acoes.length === 0 ? (
                    <div style={{ padding: "32px", textAlign: "center" }}>
                      <div style={{ width: "36px", height: "36px", background: "#f0fdf4", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", color: "#16a34a" }}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      </div>
                      <div style={{ fontSize: "13px", color: "#6b7280", fontWeight: 500 }}>Nenhuma ação aberta.</div>
                    </div>
                  ) : (
                    acoes.map((ac, idx) => {
                      const ucfg = urgenciaConfig[(ac.urgencia ?? "media") as string] ?? urgenciaConfig.media;
                      return (
                        <div key={String(ac.id)} style={{ padding: "14px 16px", borderBottom: idx < acoes.length - 1 ? "1px solid #f9fafb" : "none" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "6px" }}>
                            <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#111827", flex: 1, minWidth: 0 }}>{ac.tema ?? "Tema"}</p>
                            <span style={{ display: "inline-flex", alignItems: "center", borderRadius: "20px", background: ucfg.bg, color: ucfg.color, padding: "2px 8px", fontSize: "10px", fontWeight: 600, flexShrink: 0 }}>{ucfg.label}</span>
                          </div>
                          {ac.problema_identificado && (
                            <div style={{ marginBottom: "4px" }}>
                              <p style={{ margin: "0 0 2px", fontSize: "10px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".06em" }}>Problema</p>
                              <p style={{ margin: 0, fontSize: "12px", color: "#475569" }}>{ac.problema_identificado}</p>
                            </div>
                          )}
                          {ac.acao_recomendada && (
                            <div style={{ marginBottom: "4px" }}>
                              <p style={{ margin: "0 0 2px", fontSize: "10px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".06em" }}>Ação</p>
                              <p style={{ margin: 0, fontSize: "12px", color: "#475569" }}>{ac.acao_recomendada}</p>
                            </div>
                          )}
                          {ac.data_retorno_prevista && (
                            <p style={{ margin: "4px 0 6px", fontSize: "11px", color: "#9ca3af" }}>Retorno: {formatDate(ac.data_retorno_prevista)}</p>
                          )}
                          <button
                            onClick={async () => { await supabase.from("acoes_consultivas").update({ status: "concluida" }).eq("id", ac.id); load(); }}
                            style={{ marginTop: "8px", border: "1px solid #bbf7d0", background: "#f0fdf4", borderRadius: "6px", padding: "4px 12px", fontSize: "11px", fontWeight: 600, color: "#16a34a", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}
                            onMouseEnter={e => e.currentTarget.style.background = "#dcfce7"}
                            onMouseLeave={e => e.currentTarget.style.background = "#f0fdf4"}>
                            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
                            Marcar como concluída
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Dores + Objetivos */}
                {((cliente as any).dores_mapeadas || (cliente as any).objetivos_empresario) && (
                  <div style={{ marginTop: "16px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden" }}>
                    {(cliente as any).dores_mapeadas && (
                      <div style={{ padding: "14px 16px", borderBottom: (cliente as any).objetivos_empresario ? "1px solid #f3f4f6" : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", margin: "0 0 6px", fontSize: "10px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".06em" }}>
                          <AlertTriangle size={10} color="#ef4444" /> Dores mapeadas
                        </div>
                        <p style={{ margin: 0, fontSize: "12px", color: "#374151", lineHeight: 1.6 }}>{(cliente as any).dores_mapeadas}</p>
                      </div>
                    )}
                    {(cliente as any).objetivos_empresario && (
                      <div style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", margin: "0 0 6px", fontSize: "10px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".06em" }}>
                          <Target size={10} color="#1d4ed8" /> Objetivos do empresário
                        </div>
                        <p style={{ margin: 0, fontSize: "12px", color: "#374151", lineHeight: 1.6 }}>{(cliente as any).objetivos_empresario}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* FAB */}
      <button onClick={() => setModalOpen(true)}
        style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 20, background: "#1d4ed8", color: "#fff", border: "none", borderRadius: "28px", padding: "13px 20px", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 16px rgba(29,78,216,.35)" }}
        onMouseEnter={e => e.currentTarget.style.background = "#1e40af"}
        onMouseLeave={e => e.currentTarget.style.background = "#1d4ed8"}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
        Registrar orientação
      </button>

      <RegistrarOrientacaoModal open={modalOpen} onOpenChange={setModalOpen} clienteId={clienteId} onSaved={load} />

      {/* Edit modal */}
      {editOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.5)", padding: "16px" }}>
          <div style={{ width: "100%", maxWidth: "520px", borderRadius: "14px", background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e8eaed", padding: "16px 24px" }}>
              <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#0f172a" }}>Editar cadastro do cliente</h2>
              <button onClick={() => setEditOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}><X size={18} /></button>
            </div>
            <div style={{ maxHeight: "70vh", overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label className={labelClass}>Razão Social *</label>
                <input className={inputClass} value={editForm.razao_social} onChange={e => setEditForm(f => ({ ...f, razao_social: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Nome Fantasia</label>
                <input className={inputClass} value={editForm.nome_fantasia} onChange={e => setEditForm(f => ({ ...f, nome_fantasia: e.target.value }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label className={labelClass}>Segmento</label>
                  <select className={inputClass} value={editForm.segmento} onChange={e => setEditForm(f => ({ ...f, segmento: e.target.value }))}>
                    <option value="">Selecione o segmento...</option>
                    <option>Serviço</option>
                    <option>Comércio</option>
                    <option>Indústria</option>
                    <option>Comércio e Serviço</option>
                    <option>Comércio, Serviços e Indústria</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>UF</label>
                  <select className={inputClass} value={editForm.uf} onChange={e => setEditForm(f => ({ ...f, uf: e.target.value }))}>
                    <option value="">Selecione o estado...</option>
                    {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(u => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label className={labelClass}>Regime Tributário</label>
                  <select className={inputClass} value={editForm.regime_tributario} onChange={e => setEditForm(f => ({ ...f, regime_tributario: e.target.value }))}>
                    <option value="">Selecione</option>
                    <option>MEI</option>
                    <option>Simples Nacional</option>
                    <option>Lucro Presumido</option>
                    <option>Lucro Real</option>
                    <option>Outro</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Porte</label>
                  <select className={inputClass} value={editForm.porte} onChange={e => setEditForm(f => ({ ...f, porte: e.target.value }))}>
                    <option value="">Selecione</option>
                    <option>Micro</option>
                    <option>Pequena</option>
                    <option>Média</option>
                    <option>Grande</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label className={labelClass}>Canal Preferido</label>
                  <select className={inputClass} value={editForm.canal_preferido} onChange={e => setEditForm(f => ({ ...f, canal_preferido: e.target.value }))}>
                    <option value="">Selecione</option>
                    <option>WhatsApp</option>
                    <option>E-mail</option>
                    <option>Ligação</option>
                    <option>Reunião presencial</option>
                    <option>Videochamada</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Frequência de contato (dias)</label>
                  <input type="number" className={inputClass} value={editForm.frequencia_contato_dias} onChange={e => setEditForm(f => ({ ...f, frequencia_contato_dias: Number(e.target.value) }))} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Dores mapeadas</label>
                <textarea rows={3} className={inputClass} value={editForm.dores_mapeadas} onChange={e => setEditForm(f => ({ ...f, dores_mapeadas: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Objetivos do empresário</label>
                <textarea rows={3} className={inputClass} value={editForm.objetivos_empresario} onChange={e => setEditForm(f => ({ ...f, objetivos_empresario: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Observações / Particularidades</label>
                <textarea rows={4} className={inputClass} value={editForm.observacoes} onChange={e => setEditForm(f => ({ ...f, observacoes: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid #e8eaed", padding: "14px 24px" }}>
              <button onClick={() => setEditOpen(false)} style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", color: "#64748b", cursor: "pointer" }}>Cancelar</button>
              <button onClick={saveEdit} disabled={saving} style={{ background: "#10b981", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#fff", cursor: "pointer", opacity: saving ? .6 : 1 }}>
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
