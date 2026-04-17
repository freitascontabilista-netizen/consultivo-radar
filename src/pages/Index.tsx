import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, type RadarConsultivoRow, type SemaforoStatus } from "@/lib/supabase";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Plus, Search } from "lucide-react";
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
  const [user, setUser] = useState<string>("Usuário");
  const [novoOpen, setNovoOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email;
      if (email) setUser(email);
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("radar_consultivo").select("*");
      if (!mounted) return;
      if (error) {
        setError(error.message);
        setRows([]);
      } else {
        setRows((data ?? []) as RadarConsultivoRow[]);
        setError(null);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
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

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <h1 className="text-base font-semibold tracking-tight sm:text-lg">CRM Consultivo</h1>
          <div className="flex items-center gap-4">
            <img src="/logo_freitas.png" alt="" style={{ height: "44px", objectFit: "contain" }} />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page heading */}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">Dashboard da Carteira</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Visão consolidada do radar consultivo dos seus clientes.
          </p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total de clientes" value={counts.total} loading={loading} />
          <MetricCard label="Críticos" value={counts.critico} tone="critical" loading={loading} />
          <MetricCard label="Em atenção" value={counts.atencao} tone="warning" loading={loading} />
          <MetricCard label="Em dia" value={counts.verde} tone="success" loading={loading} />
        </div>

        {/* Filters + search */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(filterLabels) as Filter[]).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
                className={cn("rounded-full", filter === f && "shadow-sm")}
              >
                {filterLabels[f]}
              </Button>
            ))}
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente..."
                className="pl-9"
              />
            </div>
            <Button size="sm" onClick={() => setNovoOpen(true)} className="gap-1">
              <Plus className="h-4 w-4" /> Novo Cliente
            </Button>
          </div>
        </div>

        {/* List */}
        <Card className="mt-4 overflow-hidden border-border/60 shadow-none">
          {error ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-status-critical">Erro ao carregar dados</p>
              <p className="mt-1 text-xs text-muted-foreground">{error}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                Verifique se a view <code className="rounded bg-muted px-1">radar_consultivo</code> existe e está acessível.
              </p>
            </div>
          ) : loading ? (
            <div className="divide-y divide-border/60">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-5">
                  <div className="space-y-2">
                    <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-32 animate-pulse rounded bg-muted/60" />
                  </div>
                  <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado.
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {filtered.map((r, idx) => {
                const targetId = r.id ?? r.cliente_id;
                const goRadar = () => targetId != null && navigate(`/radar/${targetId}`);
                return (
                  <li
                    key={String(targetId ?? idx)}
                    onClick={goRadar}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && goRadar()}
                    className="flex cursor-pointer items-center justify-between gap-4 p-5 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {r.razao_social ?? "Cliente sem razão social"}
                      </p>
                      {r.nome_fantasia ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {r.nome_fantasia}
                        </p>
                      ) : null}
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {r.segmento ? (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-medium text-foreground/70">
                            {r.segmento}
                          </span>
                        ) : null}
                        <span className="tabular-nums">
                          {r.dias_sem_orientacao ?? 0} dias sem orientação
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={r.semaforo} />
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          goRadar();
                        }}
                      >
                        Ver radar <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </main>
      <NovoClienteModal
        open={novoOpen}
        onOpenChange={setNovoOpen}
        onSaved={() => setReloadKey((k) => k + 1)}
      />
    </div>
  );
}
