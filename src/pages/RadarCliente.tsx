import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  supabase,
  type AcaoConsultivaRow,
  type InteracaoRow,
  type RadarConsultivoRow,
} from "@/lib/supabase";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { RegistrarOrientacaoModal } from "@/components/RegistrarOrientacaoModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Plus, Pencil, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/UserMenu";

const tipoConfig: Record<string, { label: string; classes: string }> = {
  consultiva: { label: "Consultiva", classes: "bg-green-100 text-green-700 !bg-[#dcfce7] !text-[#16a34a]" },
  suporte: { label: "Suporte", classes: "bg-muted text-foreground/70" },
  relacionamento: { label: "Relacionamento", classes: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  comercial: { label: "Comercial", classes: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300" },
};

const urgenciaConfig: Record<string, { label: string; classes: string }> = {
  baixa: { label: "Baixa", classes: "bg-muted text-foreground/70" },
  media: { label: "Média", classes: "bg-status-warning-soft text-status-warning" },
  alta: { label: "Alta", classes: "bg-status-warning-soft text-status-warning" },
  critica: { label: "Crítica", classes: "bg-status-critical-soft text-status-critical" },
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

export default function RadarCliente() {
  const { clienteId = "" } = useParams();
  const [cliente, setCliente] = useState<RadarConsultivoRow | null>(null);
  const [interacoes, setInteracoes] = useState<InteracaoRow[]>([]);
  const [acoes, setAcoes] = useState<AcaoConsultivaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const ITENS_POR_PAGINA = 5;
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

  const load = useCallback(async () => {
    setLoading(true);
    let cli = await supabase.from("radar_consultivo").select("*").eq("id", clienteId).maybeSingle();
    if (cli.error || !cli.data) {
      cli = await supabase.from("radar_consultivo").select("*").eq("cliente_id", clienteId).maybeSingle();
    }
    const [{ data: i }, { data: a }] = await Promise.all([
      supabase
        .from("interacoes")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("data_interacao", { ascending: false }),
      supabase
        .from("acoes_consultivas")
        .select("*")
        .eq("cliente_id", clienteId)
        .in("status", ["aberta", "em_andamento"]),
    ]);
    setCliente((cli.data as RadarConsultivoRow) ?? null);
    setInteracoes((i as InteracaoRow[]) ?? []);
    setAcoes((a as AcaoConsultivaRow[]) ?? []);
    setLoading(false);
  }, [clienteId]);

  useEffect(() => {
    load();
  }, [load]);

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
    if (!confirm("Tem certeza que deseja excluir esta interação? Esta ação não pode ser desfeita.")) return;
    setDeletingId(id);
    await supabase.from("interacoes").delete().eq("id", id);
    setDeletingId(null);
    load();
  };

  const ultimaOrientacao = useMemo(() => {
    if (cliente?.ultima_orientacao_consultiva) return formatDate(cliente.ultima_orientacao_consultiva);
    const consultiva = interacoes.find((x) => x.tipo === "consultiva");
    return formatDate(consultiva?.data_interacao ?? consultiva?.criado_em ?? null);
  }, [cliente, interacoes]);

  const totalOrientacoes =
    cliente?.total_orientacoes ?? interacoes.filter((x) => x.tipo === "consultiva").length;
  const followups = cliente?.followups_pendentes ?? acoes.length;
  const dias = cliente?.dias_sem_orientacao ?? 0;

  const totalPaginas = Math.ceil(interacoes.length / ITENS_POR_PAGINA);
  const interacoesPaginadas = interacoes.slice(
    (paginaAtual - 1) * ITENS_POR_PAGINA,
    paginaAtual * ITENS_POR_PAGINA
  );

  const inputClass = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";
  const labelClass = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao dashboard
          </Link>
          <div className="flex items-center gap-4">
            <div
              className="hidden items-center font-bold tracking-tight sm:flex"
              style={{ height: "36px", color: "#0A2647", fontSize: "22px", lineHeight: "36px" }}
            >
              Freitas Consultoria
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {loading && !cliente ? (
          <div className="h-32 animate-pulse rounded-lg bg-muted" />
        ) : !cliente ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">Cliente não encontrado.</Card>
        ) : (
          <>
            {/* Header do cliente */}
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h1 className="truncate text-2xl font-semibold tracking-tight">
                    {cliente.razao_social ?? "Cliente"}
                  </h1>
                  <button
                    onClick={openEdit}
                    className="inline-flex items-center gap-1 rounded-md bg-blue-900 px-2 py-1 text-xs text-white hover:bg-blue-800 transition-colors"
                  >
                    <Pencil className="h-3 w-3" /> Editar cadastro
                  </button>
                </div>
                {cliente.nome_fantasia && (
                  <p className="mt-1 text-sm text-muted-foreground">{cliente.nome_fantasia}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={cliente.semaforo} />
                  {cliente.segmento && (
                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/70">
                      {cliente.segmento}
                    </span>
                  )}
                  {cliente.regime_tributario && (
                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/70">
                      {cliente.regime_tributario}
                    </span>
                  )}
                </div>
                {(cliente as any).observacoes && (
                  <div style={{background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: '8px', padding: '12px 16px', marginTop: '12px'}}>
                    <div style={{fontSize: '11px', fontWeight: 500, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px'}}>Particularidades gerais da empresa</div>
                    <div style={{fontSize: '13px', color: '#78350f', lineHeight: '1.6'}}>{(cliente as any).observacoes}</div>
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-border/60 bg-card px-5 py-3 text-right">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Dias sem orientação
                </div>
                <div
                  className={cn(
                    "text-3xl font-semibold tabular-nums",
                    dias >= 60
                      ? "text-status-critical"
                      : dias >= 30
                      ? "text-status-warning"
                      : "text-status-success",
                  )}
                >
                  {dias}
                </div>
              </div>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Última orientação" value={ultimaOrientacao} loading={loading} />
              <MetricCard
                label="Dias sem orientação"
                value={dias}
                tone={dias >= 60 ? "critical" : dias >= 30 ? "warning" : "success"}
                loading={loading}
              />
              <MetricCard label="Follow-ups pendentes" value={followups} loading={loading} />
              <MetricCard label="Total de orientações" value={totalOrientacoes} loading={loading} />
            </div>

            {/* Timeline */}
            <section className="mt-10">
              <h2 className="mb-3 text-lg font-semibold tracking-tight">Timeline de interações</h2>
              <Card className="overflow-hidden border-border/60 shadow-none">
                {interacoes.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Nenhuma interação registrada.
                  </div>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {interacoesPaginadas.map((it) => {
                      const cfg = tipoConfig[it.tipo as string] ?? tipoConfig.suporte;
                      return (
                        <li key={String(it.id)} className="p-5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", cfg.classes)}>
                                {cfg.label}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(it.data_interacao ?? it.data ?? it.criado_em ?? it.created_at)}
                              </span>
                            </div>
                            <button
                              onClick={() => handleDeleteInteracao(String(it.id))}
                              disabled={deletingId === String(it.id)}
                              className="text-red-400 hover:text-red-600 disabled:opacity-50"
                              title="Excluir interação"
                            >
                              {deletingId === String(it.id)
                                ? <span className="text-xs text-muted-foreground">Excluindo...</span>
                                : <Trash2 className="h-4 w-4" />
                              }
                            </button>
                          </div>
                          <p className="mt-2 text-sm font-medium text-foreground">
                            {it.assunto ?? "Sem assunto"}
                          </p>
                          {it.resumo && (
                            <p className="mt-1 text-sm text-muted-foreground">{it.resumo}</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {totalPaginas > 1 && (
                    <div className="flex items-center justify-between border-t border-border/60 px-5 py-3">
                      <span className="text-xs text-muted-foreground">
                        Página {paginaAtual} de {totalPaginas} — {interacoes.length} interações
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                          disabled={paginaAtual === 1}
                          className="rounded-md border border-gray-200 px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-40"
                        >
                          ← Anterior
                        </button>
                        <button
                          onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                          disabled={paginaAtual === totalPaginas}
                          className="rounded-md border border-gray-200 px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-40"
                        >
                          Próxima →
                        </button>
                      </div>
                    </div>
                  )}
              </Card>
            </section>

            {/* Ações abertas */}
            <section className="mt-10">
              <h2 className="mb-3 text-lg font-semibold tracking-tight">Ações consultivas abertas</h2>
              <Card className="overflow-hidden border-border/60 shadow-none">
                {acoes.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Nenhuma ação aberta.
                  </div>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {acoes.map((ac) => {
                      const ucfg = urgenciaConfig[(ac.urgencia ?? "media") as string] ?? urgenciaConfig.media;
                      return (
                        <li key={String(ac.id)} className="p-5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">{ac.tema ?? "Tema"}</p>
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                                ucfg.classes,
                              )}
                            >
                              {ucfg.label}
                            </span>
                          </div>
                          {ac.problema_identificado && (
                            <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
                              Problema identificado
                            </p>
                          )}
                          {ac.problema_identificado && (
                            <p className="text-sm text-foreground/80">{ac.problema_identificado}</p>
                          )}
                          {ac.acao_recomendada && (
                            <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
                              Ação recomendada
                            </p>
                          )}
                          {ac.acao_recomendada && (
                            <p className="text-sm text-foreground/80">{ac.acao_recomendada}</p>
                          )}
                          {ac.data_retorno_prevista && (
                            <p className="mt-3 text-xs text-muted-foreground">
                              Retorno previsto: {formatDate(ac.data_retorno_prevista)}
                            </p>
                          )}
                          <button
                            onClick={async () => {
                              await supabase.from("acoes_consultivas").update({ status: "concluida" }).eq("id", ac.id);
                              load();
                            }}
                            className="mt-3 rounded-md border border-green-600 px-3 py-1 text-xs font-medium text-green-600 hover:bg-green-50 transition-colors"
                          >
                            Marcar como concluída
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </section>
          </>
        )}
      </main>

      {/* FAB */}
      <Button
        onClick={() => setModalOpen(true)}
        className="fixed bottom-6 right-6 z-20 h-14 gap-2 rounded-full bg-green-600 px-6 text-white shadow-lg hover:bg-green-700"
      >
        <Plus className="h-5 w-5" />
        Registrar orientação
      </Button>

      <RegistrarOrientacaoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        clienteId={clienteId}
        onSaved={load}
      />

      {/* Modal de edição de cadastro */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-base font-semibold text-gray-800">Editar cadastro do cliente</h2>
              <button onClick={() => setEditOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className={labelClass}>Razão Social *</label>
                <input className={inputClass} value={editForm.razao_social}
                  onChange={e => setEditForm(f => ({ ...f, razao_social: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Nome Fantasia</label>
                <input className={inputClass} value={editForm.nome_fantasia}
                  onChange={e => setEditForm(f => ({ ...f, nome_fantasia: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Segmento</label>
                <input className={inputClass} value={editForm.segmento}
                  onChange={e => setEditForm(f => ({ ...f, segmento: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Regime Tributário</label>
                  <select className={inputClass} value={editForm.regime_tributario}
                    onChange={e => setEditForm(f => ({ ...f, regime_tributario: e.target.value }))}>
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
                  <select className={inputClass} value={editForm.porte}
                    onChange={e => setEditForm(f => ({ ...f, porte: e.target.value }))}>
                    <option value="">Selecione</option>
                    <option>Micro</option>
                    <option>Pequena</option>
                    <option>Média</option>
                    <option>Grande</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Canal Preferido</label>
                  <select className={inputClass} value={editForm.canal_preferido}
                    onChange={e => setEditForm(f => ({ ...f, canal_preferido: e.target.value }))}>
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
                  <input type="number" className={inputClass} value={editForm.frequencia_contato_dias}
                    onChange={e => setEditForm(f => ({ ...f, frequencia_contato_dias: Number(e.target.value) }))} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Dores mapeadas</label>
                <textarea rows={3} className={inputClass} value={editForm.dores_mapeadas}
                  onChange={e => setEditForm(f => ({ ...f, dores_mapeadas: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Objetivos do empresário</label>
                <textarea rows={3} className={inputClass} value={editForm.objetivos_empresario}
                  onChange={e => setEditForm(f => ({ ...f, objetivos_empresario: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Observações / Particularidades</label>
                <textarea rows={4} className={inputClass} value={editForm.observacoes}
                  onChange={e => setEditForm(f => ({ ...f, observacoes: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t px-6 py-4">
              <button onClick={() => setEditOpen(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={saveEdit} disabled={saving}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
