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
import { ArrowLeft, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const tipoConfig: Record<string, { label: string; classes: string }> = {
  consultiva: { label: "Consultiva", classes: "bg-status-success-soft text-status-success" },
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
    return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return value;
  }
}

export default function RadarCliente() {
  const { clienteId = "" } = useParams();
  const [cliente, setCliente] = useState<RadarConsultivoRow | null>(null);
  const [interacoes, setInteracoes] = useState<InteracaoRow[]>([]);
  const [acoes, setAcoes] = useState<AcaoConsultivaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

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

  const ultimaOrientacao = useMemo(() => {
    if (cliente?.ultima_orientacao) return formatDate(cliente.ultima_orientacao);
    const consultiva = interacoes.find((x) => x.tipo === "consultiva");
    return formatDate(consultiva?.data ?? consultiva?.created_at ?? null);
  }, [cliente, interacoes]);

  const totalOrientacoes =
    cliente?.total_orientacoes ?? interacoes.filter((x) => x.tipo === "consultiva").length;
  const followups = cliente?.followups_pendentes ?? acoes.length;
  const dias = cliente?.dias_sem_orientacao ?? 0;

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
          <div
            className="flex items-center font-bold tracking-tight"
            style={{ height: "36px", color: "#0A2647", fontSize: "22px", lineHeight: "36px" }}
          >
            Freitas Consultoria
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
                <h1 className="truncate text-2xl font-semibold tracking-tight">
                  {cliente.razao_social ?? "Cliente"}
                </h1>
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
                    {interacoes.map((it) => {
                      const cfg = tipoConfig[it.tipo as string] ?? tipoConfig.suporte;
                      return (
                        <li key={String(it.id)} className="p-5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                                cfg.classes,
                              )}
                            >
                              {cfg.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(it.data ?? it.created_at)}
                            </span>
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
        className="fixed bottom-6 right-6 z-20 h-14 gap-2 rounded-full bg-status-success px-6 text-white shadow-lg hover:bg-status-success/90"
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
    </div>
  );
}
