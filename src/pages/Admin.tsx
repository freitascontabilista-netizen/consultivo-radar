import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { UserMenu } from "@/components/UserMenu";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Loader2, Trash2, Pencil, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  role?: string;
  criado_em: string;
}

interface ActivityLog {
  id: string;
  usuario_nome: string;
  acao: string;
  entidade?: string;
  created_at: string;
}

interface Meta {
  id?: string;
  usuario_id: string;
  usuario_nome: string;
  mes: number;
  ano: number;
  meta: number;
  realizado?: number;
}

const initials = (nome: string) =>
  nome.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

const now = new Date();
const MES_ATUAL = now.getMonth() + 1;
const ANO_ATUAL = now.getFullYear();

type Tab = "usuarios" | "log" | "relatorios" | "metas";

const TABS: { key: Tab; label: string }[] = [
  { key: "usuarios",   label: "Usuários" },
  { key: "log",        label: "Log de atividades" },
  { key: "relatorios", label: "Relatórios" },
  { key: "metas",      label: "Metas de atendimento" },
];

export default function Admin() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("usuarios");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState("colaborador");
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);
  const [filtroUser, setFiltroUser] = useState("");
  const [filtroDias, setFiltroDias] = useState(7);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [loadingMetas, setLoadingMetas] = useState(false);
  const [exportando, setExportando] = useState("");

  const inputClass = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";
  const labelClass = "block text-xs font-medium text-gray-600 mb-1";

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("usuarios").select("*").order("criado_em", { ascending: false });
    setUsuarios((data ?? []) as Usuario[]);
    setLoading(false);
  }, []);

  const loadLogs = useCallback(async () => {
    setLoadingLog(true);
    let query = supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(100);
    if (filtroUser) query = query.eq("usuario_id", filtroUser);
    if (filtroDias) {
      const desde = new Date();
      desde.setDate(desde.getDate() - filtroDias);
      query = query.gte("created_at", desde.toISOString());
    }
    const { data } = await query;
    setLogs((data ?? []) as ActivityLog[]);
    setLoadingLog(false);
  }, [filtroUser, filtroDias]);

  const loadMetas = useCallback(async () => {
    setLoadingMetas(true);
    const { data: metasData } = await supabase.from("metas").select("*, usuarios(nome)").eq("mes", MES_ATUAL).eq("ano", ANO_ATUAL);
    const metasComRealizado = await Promise.all(
      (metasData ?? []).map(async (m: any) => {
        const { data: realizado } = await supabase.rpc("get_orientacoes_mes", { p_usuario_id: m.usuario_id, p_mes: MES_ATUAL, p_ano: ANO_ATUAL });
        return { ...m, usuario_nome: m.usuarios?.nome ?? "—", realizado: realizado ?? 0 };
      })
    );
    setMetas(metasComRealizado);
    setLoadingMetas(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === "log") loadLogs(); }, [tab, loadLogs]);
  useEffect(() => { if (tab === "metas") loadMetas(); }, [tab, loadMetas]);

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !email.trim() || !senha.trim()) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password: senha, options: { data: { nome } } });
    if (authError) {
      toast({ title: "Erro ao criar usuário", description: authError.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    if (authData.user) {
      await supabase.from("usuarios").insert({ id: authData.user.id, nome, email, ativo: true, role });
      await supabase.from("activity_logs").insert({ usuario_nome: "Admin", acao: `Novo usuário criado: ${nome}`, entidade: "usuario", entidade_id: authData.user.id });
    }
    toast({ title: "Usuário criado com sucesso!" });
    setNome(""); setEmail(""); setSenha(""); setRole("colaborador");
    setSaving(false);
    load();
  };

  const handleDesativar = async (id: string) => {
    await supabase.from("usuarios").update({ ativo: false }).eq("id", id);
    await supabase.from("activity_logs").insert({ usuario_nome: "Admin", acao: "Usuário desativado", entidade: "usuario", entidade_id: id });
    toast({ title: "Usuário desativado" });
    load();
  };

  const handleAtivar = async (id: string) => {
    await supabase.from("usuarios").update({ ativo: true }).eq("id", id);
    toast({ title: "Usuário ativado" });
    load();
  };

  const handleSalvarEdicao = async () => {
    if (!editando) return;
    setSaving(true);
    await supabase.from("usuarios").update({ nome: editando.nome, role: editando.role }).eq("id", editando.id);
    toast({ title: "Usuário atualizado!" });
    setEditando(null);
    setSaving(false);
    load();
  };

  const handleSalvarMetas = async () => {
    setSaving(true);
    for (const m of metas) {
      await supabase.from("metas").upsert({ usuario_id: m.usuario_id, mes: MES_ATUAL, ano: ANO_ATUAL, meta: m.meta }, { onConflict: "usuario_id,mes,ano" });
    }
    toast({ title: "Metas salvas!" });
    setSaving(false);
  };

  const download = (conteudo: string, nomeArq: string) => {
    const blob = new Blob(["\uFEFF" + conteudo], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nomeArq; a.click();
    URL.revokeObjectURL(url);
  };

  const exportarCSV = async (tipo: string) => {
    setExportando(tipo);
    try {
      if (tipo === "clientes") {
        const { data } = await supabase.from("clientes").select("razao_social, nome_fantasia, cnpj, segmento, regime_tributario").order("razao_social");
        const csv = ["Razão Social,Nome Fantasia,CNPJ,Segmento,Regime Tributário", ...(data ?? []).map((c: any) => `"${c.razao_social}","${c.nome_fantasia}","${c.cnpj}","${c.segmento}","${c.regime_tributario}"`)].join("\n");
        download(csv, "clientes.csv");
      } else if (tipo === "orientacoes") {
        const { data } = await supabase.from("acoes_consultivas").select("criado_em, tema, problema_identificado, acao_recomendada, urgencia, status, clientes(razao_social), usuarios!responsavel_id(nome)").gte("criado_em", new Date(ANO_ATUAL, MES_ATUAL - 1, 1).toISOString()).lt("criado_em", new Date(ANO_ATUAL, MES_ATUAL, 1).toISOString()).order("criado_em", { ascending: false });
        const csv = ["Data,Cliente,Responsável,Tema,Problema,Ação,Urgência,Status", ...(data ?? []).map((o: any) => [new Date(o.criado_em).toLocaleDateString("pt-BR"), o.clientes?.razao_social ?? "", o.usuarios?.nome ?? "", o.tema, o.problema_identificado, o.acao_recomendada, o.urgencia, o.status].map(v => `"${v ?? ""}"`).join(","))].join("\n");
        download(csv, `orientacoes_${MES_ATUAL}_${ANO_ATUAL}.csv`);
      }
      toast({ title: "Arquivo exportado com sucesso!" });
    } catch {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    }
    setExportando("");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar ao dashboard
          </Link>
          <div className="flex items-center gap-4">
            <img src="/logo_freitas.png" alt="" style={{ height: "44px", objectFit: "contain" }} />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">Administração</h2>
          <p className="mt-1 text-sm text-muted-foreground">Gerencie usuários, logs e metas do escritório.</p>
        </div>

        <div className="flex gap-1 border-b border-border/60 mb-6 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${tab === t.key ? "border-green-600 text-green-700 font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "usuarios" && (
          <>
            <Card className="p-6 mb-6 border-border/60 shadow-none">
              <h3 className="text-base font-semibold mb-4">Novo usuário</h3>
              <form onSubmit={handleCriar} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><label className={labelClass}>Nome</label><input className={inputClass} value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" /></div>
                <div><label className={labelClass}>E-mail</label><input className={inputClass} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" /></div>
                <div><label className={labelClass}>Senha inicial</label><input className={inputClass} type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} /></div>
                <div><label className={labelClass}>Perfil</label>
                  <select className={inputClass} value={role} onChange={e => setRole(e.target.value)}>
                    <option value="colaborador">Colaborador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <button type="submit" disabled={saving} className="rounded-md bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />} Criar usuário
                  </button>
                </div>
              </form>
            </Card>

            <Card className="overflow-hidden border-border/60 shadow-none">
              <div className="px-6 py-4 border-b border-border/60"><h3 className="text-base font-semibold">Usuários cadastrados</h3></div>
              {loading ? <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
                : usuarios.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">Nenhum usuário cadastrado.</div>
                : <ul className="divide-y divide-border/60">
                  {usuarios.map((u) => (
                    <li key={u.id} className="px-6 py-4">
                      {editando?.id === u.id ? (
                        <div className="flex items-center gap-3 flex-wrap">
                          <input className="rounded border border-gray-300 px-2 py-1 text-sm w-40" value={editando.nome} onChange={e => setEditando({ ...editando, nome: e.target.value })} />
                          <select className="rounded border border-gray-300 px-2 py-1 text-sm" value={editando.role ?? "colaborador"} onChange={e => setEditando({ ...editando, role: e.target.value })}>
                            <option value="colaborador">Colaborador</option>
                            <option value="admin">Administrador</option>
                          </select>
                          <button onClick={handleSalvarEdicao} disabled={saving} className="text-green-600 hover:text-green-800"><Check className="h-4 w-4" /></button>
                          <button onClick={() => setEditando(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">{initials(u.nome)}</div>
                            <div><p className="text-sm font-medium">{u.nome}</p><p className="text-xs text-muted-foreground">{u.email}</p></div>
                          </div>
                          <div className="flex items-center gap-3">
                            {u.role && <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">{u.role === "admin" ? "Administrador" : "Colaborador"}</span>}
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{u.ativo ? "Ativo" : "Inativo"}</span>
                            <button onClick={() => setEditando(u)} className="text-gray-400 hover:text-gray-600"><Pencil className="h-4 w-4" /></button>
                            {u.ativo
                              ? <button onClick={() => handleDesativar(u.id)} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                              : <button onClick={() => handleAtivar(u.id)} className="text-green-400 hover:text-green-600 text-xs font-medium">Ativar</button>}
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>}
            </Card>
          </>
        )}

        {tab === "log" && (
          <Card className="overflow-hidden border-border/60 shadow-none">
            <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-base font-semibold">Log de atividades</h3>
              <div className="flex gap-2">
                <select className="rounded border border-gray-300 px-2 py-1 text-xs" value={filtroUser} onChange={e => setFiltroUser(e.target.value)}>
                  <option value="">Todos os colaboradores</option>
                  {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
                <select className="rounded border border-gray-300 px-2 py-1 text-xs" value={filtroDias} onChange={e => setFiltroDias(Number(e.target.value))}>
                  <option value={7}>Últimos 7 dias</option>
                  <option value={30}>Últimos 30 dias</option>
                  <option value={90}>Últimos 90 dias</option>
                </select>
              </div>
            </div>
            {loadingLog ? <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
              : logs.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma atividade no período.</div>
              : <ul className="divide-y divide-border/60">
                {logs.map((l) => (
                  <li key={l.id} className="flex gap-3 px-6 py-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <span className="text-sm font-medium">{l.usuario_nome}</span>
                      <span className="text-sm text-muted-foreground"> — {l.acao}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{new Date(l.created_at).toLocaleString("pt-BR")}</p>
                    </div>
                  </li>
                ))}
              </ul>}
          </Card>
        )}

        {tab === "relatorios" && (
          <Card className="p-6 border-border/60 shadow-none">
            <h3 className="text-base font-semibold mb-4">Exportar relatórios</h3>
            <div className="flex flex-col gap-3">
              {[
                { tipo: "clientes", titulo: "Lista de clientes", desc: "Razão social, CNPJ, segmento, regime tributário" },
                { tipo: "orientacoes", titulo: `Orientações de ${MES_ATUAL}/${ANO_ATUAL}`, desc: "Tema, problema, ação, responsável, status" },
              ].map((r) => (
                <div key={r.tipo} className="flex items-center justify-between p-4 border border-border/60 rounded-lg">
                  <div><p className="text-sm font-medium">{r.titulo}</p><p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p></div>
                  <button onClick={() => exportarCSV(r.tipo)} disabled={exportando === r.tipo} className="rounded-md border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2">
                    {exportando === r.tipo && <Loader2 className="h-3 w-3 animate-spin" />} Exportar CSV
                  </button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {tab === "metas" && (
          <Card className="overflow-hidden border-border/60 shadow-none">
            <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Metas de {MES_ATUAL}/{ANO_ATUAL}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Orientações por colaborador no mês</p>
              </div>
              <button onClick={handleSalvarMetas} disabled={saving} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar metas
              </button>
            </div>
            {loadingMetas ? <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
              : metas.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma meta configurada ainda.</div>
              : <ul className="divide-y divide-border/60">
                {metas.map((m, i) => {
                  const pct = m.meta > 0 ? Math.min(100, Math.round(((m.realizado ?? 0) / m.meta) * 100)) : 0;
                  const cor = pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
                  return (
                    <li key={m.usuario_id} className="flex items-center gap-4 px-6 py-4">
                      <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">{initials(m.usuario_nome)}</div>
                      <span className="text-sm w-32 flex-shrink-0">{m.usuario_nome}</span>
                      <div className="flex-1 flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${cor}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground min-w-[56px] text-right">{m.realizado ?? 0} / {m.meta}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>Meta:</span>
                        <input type="number" min={1} max={999} className="w-14 h-7 rounded border border-gray-300 text-center text-sm" value={m.meta}
                          onChange={e => { const updated = [...metas]; updated[i] = { ...m, meta: Number(e.target.value) }; setMetas(updated); }} />
                        <span>/mês</span>
                      </div>
                    </li>
                  );
                })}
              </ul>}
          </Card>
        )}
      </main>
    </div>
  );
}
