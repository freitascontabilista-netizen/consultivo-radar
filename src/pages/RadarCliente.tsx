import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  supabase,
  type AcaoConsultivaRow,
  type InteracaoRow,
  type RadarConsultivoRow,
} from "@/lib/supabase";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { RegistrarOrientacaoModal } from "@/components/RegistrarOrientacaoModal";
import { Pencil, X, Trash2 } from "lucide-react";

const tipoConfig: Record<string, { label: string; bg: string; color: string }> = {
  consultiva:     { label: "Consultiva",    bg: "#dcfce7", color: "#16a34a" },
  suporte:        { label: "Suporte",       bg: "#f1f5f9", color: "#475569" },
  relacionamento: { label: "Relacionamento",bg: "#dbeafe", color: "#1d4ed8" },
  comercial:      { label: "Comercial",     bg: "#f3e8ff", color: "#7e22ce" },
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

interface EditForm {
  razao_social: string;
  nome_fantasia: string;
  segmento: string;
  regime_tributario: string;
  porte: string;
  canal_preferido: string;
  frequencia_contato_dias: number;
  dores_mapeadas: string;
  objetivos_empresario: string;
  observacoes: string;
}

const ITENS_POR_PAGINA = 5;

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [userEmail, setUserEmail] = useState("");
  const [editForm, setEditForm] = useState<EditForm>({
    razao_social: "",
    nome_fantasia: "",
    segmento: "",
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
    const realId = (cliente as any)?.cliente_id ?? (cliente as any)?.id ?? clienteId;
    await supabase.from("clientes").update({
      razao_social: editForm.razao_social,
      nome_fantasia: editForm.nome_fantasia || null,
      segmento: editForm.segmento || null,
      regime_tributario: editForm.regime_tributario || null,
      porte: editForm.porte || null,
      canal_preferido: editForm.canal_preferido || null,
      frequencia_contato_dias: editForm.frequencia_contato_dias,
      dores_mapeadas: editForm.dores_mapeadas || null,
      objetivos_empresario: editForm.objetivos_empresario || null,
      observacoes: editForm.observacoes || null,
    }).eq("id", realId);
    setSaving(false);
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

  const diasColor = (d: number) => d >= 60 ? "#ef4444" : d >= 30 ? "#f59e0b" : "#10b981";

  const inputClass = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";
  const labelClass = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f0f4ff" }}>

      {/* Sidebar */}
      <aside style={{ width: "220px", background: "#0f172a", display: "flex", flexDirection: "column", flexShrink: 0, position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 20 }}>
        <div style={{ padding: "20px", borderBottom: "1px solid rgba(255,255,255,.08)", marginBottom: "8px" }}>
          <img src="/logo_freitas.png" alt="" style={{ height: "36px", objectFit: "contain", filter: "brightness(0) invert(1)", opacity: 0.9 }} />
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,.4)", marginTop: "6px" }}>CRM Consultivo</div>
        </div>

        <nav style={{ flex: 1, padding: "4px 0" }}>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,.3)", padding: "10px 20px 4px", textTransform: "uppercase", letterSpacing: ".08em" }}>Principal</div>

          {[
            { label: "Dashboard", path: "/", active: false },
            { label: "Clientes", path: "/", active: true },
            { label: "Orientações", path: "/", active: false, badge: "12" },
            { label: "Follow-ups", path: "/", active: false, badge: "5" },
          ].map((item) => (
            <div key={item.label} onClick={() => navigate(item.path)} style={{ padding: "8px 20px", fontSize: "13px", color: item.active ? "#fff" : "rgba(255,255,255,.55)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", borderLeft: item.active ? "2px solid #10b981" : "2px solid transparent", background: item.active ? "rgba(255,255,255,.06)" : "transparent", fontWeight: item.active ? 500 : 400 }}>
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

        <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,.08)", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg,#10b981,#059669)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 600, color: "#fff", flexShrink: 0 }}>
            {initials(userEmail || "TF")}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: "12px", fontWeight: 500, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail || "Usuário"}</div>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,.4)" }}>Administrador</div>
          </div>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate("/auth"); }}
            title="Sair"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,.4)", padding: "4px", display: "flex", alignItems: "center", flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,.4)")}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div style={{ marginLeft: "220px", flex: 1, padding: "28px" }}>

        {/* Back link */}
        <button
          onClick={() => navigate("/")}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: "20px" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#0f172a")}
          onMouseLeave={e => (e.currentTarget.style.color = "#64748b")}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Voltar ao dashboard
        </button>

        {loading && !cliente ? (
          <div style={{ height: "120px", borderRadius: "12px", background: "#e2e8f0", animation: "pulse 1.5s ease-in-out infinite" }} />
        ) : !cliente ? (
          <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: "12px", padding: "48px", textAlign: "center", fontSize: "14px", color: "#94a3b8" }}>
            Cliente não encontrado.
          </div>
        ) : (
          <>
            {/* Client header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px", gap: "16px", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#0f172a", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {cliente.razao_social ?? "Cliente"}
                  </h1>
                  <button
                    onClick={openEdit}
                    style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#1e3a5f", color: "#fff", border: "none", borderRadius: "6px", padding: "4px 10px", fontSize: "11px", fontWeight: 500, cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#1e40af")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#1e3a5f")}
                  >
                    <Pencil size={11} /> Editar cadastro
                  </button>
                </div>
                {cliente.nome_fantasia && (
                  <p style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>{cliente.nome_fantasia}</p>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginTop: "10px" }}>
                  <StatusBadge status={cliente.semaforo} />
                  {cliente.segmento && (
                    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: "20px", background: "#f1f5f9", padding: "3px 10px", fontSize: "11px", fontWeight: 500, color: "#475569" }}>
                      {cliente.segmento}
                    </span>
                  )}
                  {(cliente as any).regime_tributario && (
                    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: "20px", background: "#f1f5f9", padding: "3px 10px", fontSize: "11px", fontWeight: 500, color: "#475569" }}>
                      {(cliente as any).regime_tributario}
                    </span>
                  )}
                </div>
                {(cliente as any).observacoes && (
                  <div style={{ background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: "8px", padding: "12px 16px", marginTop: "12px" }}>
                    <div style={{ fontSize: "10px", fontWeight: 600, color: "#92400e", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "5px" }}>Particularidades gerais da empresa</div>
                    <div style={{ fontSize: "13px", color: "#78350f", lineHeight: 1.6 }}>{(cliente as any).observacoes}</div>
                  </div>
                )}
              </div>

              {/* Dias sem orientação destaque */}
              <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: "12px", padding: "16px 24px", textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: "10px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em" }}>Dias sem orientação</div>
                <div style={{ fontSize: "36px", fontWeight: 700, lineHeight: 1.1, color: diasColor(dias), tabularNums: true } as any}>{dias}</div>
              </div>
            </div>

            {/* Metric cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "28px" }}>
              <MetricCard label="Última orientação" value={ultimaOrientacao} loading={loading} />
              <MetricCard label="Dias sem orientação" value={dias} tone={dias >= 60 ? "critical" : dias >= 30 ? "warning" : "success"} loading={loading} />
              <MetricCard label="Follow-ups pendentes" value={followups} loading={loading} />
              <MetricCard label="Total de orientações" value={totalOrientacoes} loading={loading} />
            </div>

            {/* Timeline */}
            <div style={{ marginBottom: "24px" }}>
              <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#0f172a", margin: "0 0 12px" }}>Timeline de interações</h2>
              <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: "12px", overflow: "hidden" }}>
                {interacoes.length === 0 ? (
                  <div style={{ padding: "48px", textAlign: "center", fontSize: "14px", color: "#94a3b8" }}>Nenhuma interação registrada.</div>
                ) : (
                  <>
                    {interacoesPaginadas.map((it, idx) => {
                      const cfg = tipoConfig[it.tipo as string] ?? tipoConfig.suporte;
                      return (
                        <div key={String(it.id)} style={{ padding: "16px 20px", borderBottom: idx < interacoesPaginadas.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", borderRadius: "20px", background: cfg.bg, color: cfg.color, padding: "3px 10px", fontSize: "11px", fontWeight: 600 }}>
                                {cfg.label}
                              </span>
                              <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                                {formatDate(it.data_interacao ?? (it as any).data ?? it.criado_em ?? (it as any).created_at)}
                              </span>
                            </div>
                            <button
                              onClick={() => handleDeleteInteracao(String(it.id))}
                              disabled={deletingId === String(it.id)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#fca5a5", padding: "2px", display: "flex", alignItems: "center" }}
                              onMouseEnter={e => (e.currentTarget.style.color = "#dc2626")}
                              onMouseLeave={e => (e.currentTarget.style.color = "#fca5a5")}
                              title="Excluir interação"
                            >
                              {deletingId === String(it.id)
                                ? <span style={{ fontSize: "11px", color: "#94a3b8" }}>Excluindo...</span>
                                : <Trash2 size={15} />
                              }
                            </button>
                          </div>
                          <p style={{ margin: "8px 0 0", fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>{it.assunto ?? "Sem assunto"}</p>
                          {it.resumo && <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>{it.resumo}</p>}
                        </div>
                      );
                    })}

                    {totalPaginas > 1 && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #f1f5f9", padding: "12px 20px" }}>
                        <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                          Página {paginaAtual} de {totalPaginas} — {interacoes.length} interações
                        </span>
                        <div style={{ display: "flex", gap: "4px" }}>
                          <button onClick={() => setPaginaAtual(p => Math.max(1, p - 1))} disabled={paginaAtual === 1} style={{ padding: "4px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", background: "#fff", fontSize: "12px", cursor: "pointer", color: "#64748b", opacity: paginaAtual === 1 ? .4 : 1 }}>← Anterior</button>
                          <button onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))} disabled={paginaAtual === totalPaginas} style={{ padding: "4px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", background: "#fff", fontSize: "12px", cursor: "pointer", color: "#64748b", opacity: paginaAtual === totalPaginas ? .4 : 1 }}>Próxima →</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Ações consultivas */}
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#0f172a", margin: "0 0 12px" }}>Ações consultivas abertas</h2>
              <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: "12px", overflow: "hidden" }}>
                {acoes.length === 0 ? (
                  <div style={{ padding: "48px", textAlign: "center", fontSize: "14px", color: "#94a3b8" }}>Nenhuma ação aberta.</div>
                ) : (
                  acoes.map((ac, idx) => {
                    const ucfg = urgenciaConfig[(ac.urgencia ?? "media") as string] ?? urgenciaConfig.media;
                    return (
                      <div key={String(ac.id)} style={{ padding: "16px 20px", borderBottom: idx < acoes.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
                          <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>{ac.tema ?? "Tema"}</p>
                          <span style={{ display: "inline-flex", alignItems: "center", borderRadius: "20px", background: ucfg.bg, color: ucfg.color, padding: "3px 10px", fontSize: "11px", fontWeight: 600 }}>{ucfg.label}</span>
                        </div>
                        {ac.problema_identificado && (
                          <>
                            <p style={{ margin: "6px 0 2px", fontSize: "10px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em" }}>Problema identificado</p>
                            <p style={{ margin: 0, fontSize: "13px", color: "#475569" }}>{ac.problema_identificado}</p>
                          </>
                        )}
                        {ac.acao_recomendada && (
                          <>
                            <p style={{ margin: "6px 0 2px", fontSize: "10px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em" }}>Ação recomendada</p>
                            <p style={{ margin: 0, fontSize: "13px", color: "#475569" }}>{ac.acao_recomendada}</p>
                          </>
                        )}
                        {ac.data_retorno_prevista && (
                          <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#94a3b8" }}>Retorno previsto: {formatDate(ac.data_retorno_prevista)}</p>
                        )}
                        <button
                          onClick={async () => {
                            await supabase.from("acoes_consultivas").update({ status: "concluida" }).eq("id", ac.id);
                            load();
                          }}
                          style={{ marginTop: "10px", border: "1px solid #10b981", background: "transparent", borderRadius: "6px", padding: "4px 12px", fontSize: "12px", fontWeight: 500, color: "#10b981", cursor: "pointer" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "#f0fdf4"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                        >
                          Marcar como concluída
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setModalOpen(true)}
        style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 20, background: "#10b981", color: "#fff", border: "none", borderRadius: "28px", padding: "14px 22px", fontSize: "14px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 14px rgba(16,185,129,.4)" }}
        onMouseEnter={e => (e.currentTarget.style.background = "#059669")}
        onMouseLeave={e => (e.currentTarget.style.background = "#10b981")}
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
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
              <div>
                <label className={labelClass}>Segmento</label>
                <input className={inputClass} value={editForm.segmento} onChange={e => setEditForm(f => ({ ...f, segmento: e.target.value }))} />
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
