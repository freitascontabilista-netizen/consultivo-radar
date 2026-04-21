import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Loader2, Trash2, Pencil, X, Check } from "lucide-react";
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
  const navigate = useNavigate();
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
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email);
    });
  }, []);

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

  /* ── helpers de card ── */
  const card: React.CSSProperties = { background: "#fff", border: "1px solid #e8eaed", borderRadius: "12px", overflow: "hidden" };
  const cardPad: React.CSSProperties = { ...card, padding: "24px" };

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
            { label: "Dashboard", path: "/" },
            { label: "Clientes", path: "/" },
            { label: "Orientações", path: "/", badge: "12" },
            { label: "Follow-ups", path: "/", badge: "5" },
          ].map((item) => (
            <div key={item.label} onClick={() => navigate(item.path)} style={{ padding: "8px 20px", fontSize: "13px", color: "rgba(255,255,255,.55)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", borderLeft: "2px solid transparent" }}>
              {item.label}
              {(item as any).badge && <span style={{ background: "#ef4444", color: "#fff", borderRadius: "20px", fontSize: "9px", fontWeight: 600, padding: "1px 6px" }}>{(item as any).badge}</span>}
            </div>
          ))}

          <div style={{ fontSize: "10px", color: "rgba(255,255,255,.3)", padding: "14px 20px 4px", textTransform: "uppercase", letterSpacing: ".08em" }}>Gestão</div>
          {[
            { label: "Relatórios", path: "/" },
            { label: "Metas", path: "/" },
            { label: "Administração", path: "/admin", active: true },
          ].map((item) => (
            <div key={item.label} onClick={() => navigate(item.path)} style={{ padding: "8px 20px", fontSize: "13px", color: (item as any).active ? "#fff" : "rgba(255,255,255,.55)", cursor: "pointer", borderLeft: (item as any).active ? "2px solid #10b981" : "2px solid transparent", background: (item as any).active ? "rgba(255,255,255,.06)" : "transparent", fontWeight: (item as any).active ? 500 : 400 }}>
              {item.label}
            </div>
          ))}
        </nav>

        <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,.08)", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg,#10b981,#059669)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 600, color: "#fff", flexShrink: 0 }}>
            {userEmail ? userEmail.split("@")[0].slice(0, 2).toUpperCase() : "TF"}
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

        {/* Top */}
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#0f172a", margin: 0 }}>Administração</h1>
          <p style={{ fontSize: "13px", color: "#64748b", marginTop: "3px" }}>Gerencie usuários, logs e metas do escritório.</p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e8eaed", marginBottom: "24px", overflowX: "auto" }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: "10px 18px", fontSize: "13px", fontWeight: tab === t.key ? 600 : 400, color: tab === t.key ? "#10b981" : "#64748b", background: "none", border: "none", borderBottom: tab === t.key ? "2px solid #10b981" : "2px solid transparent", cursor: "pointer", whiteSpace: "nowrap", marginBottom: "-1px" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── ABA: USUÁRIOS ── */}
        {tab === "usuarios" && (
          <>
            <div style={{ ...cardPad, marginBottom: "16px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a", margin: "0 0 16px" }}>Novo usuário</h3>
              <form onSubmit={handleCriar} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div><label className={labelClass}>Nome</label><input className={inputClass} value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" /></div>
                <div><label className={labelClass}>E-mail</label><input className={inputClass} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" /></div>
                <div><label className={labelClass}>Senha inicial</label><input className={inputClass} type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} /></div>
                <div><label className={labelClass}>Perfil</label>
                  <select className={inputClass} value={role} onChange={e => setRole(e.target.value)}>
                    <option value="colaborador">Colaborador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div style={{ gridColumn: "span 2", display: "flex", justifyContent: "flex-end" }}>
                  <button type="submit" disabled={saving} style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 20px", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", opacity: saving ? .6 : 1 }}>
                    {saving && <Loader2 size={14} className="animate-spin" />} Criar usuário
                  </button>
                </div>
              </form>
            </div>

            <div style={card}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a", margin: 0 }}>Usuários cadastrados</h3>
              </div>
              {loading
                ? <div style={{ padding: "48px", textAlign: "center", fontSize: "13px", color: "#94a3b8" }}>Carregando...</div>
                : usuarios.length === 0
                  ? <div style={{ padding: "48px", textAlign: "center", fontSize: "13px", color: "#94a3b8" }}>Nenhum usuário cadastrado.</div>
                  : usuarios.map((u, idx) => (
                    <div key={u.id} style={{ padding: "14px 20px", borderBottom: idx < usuarios.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                      {editando?.id === u.id ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                          <input className="rounded border border-gray-300 px-2 py-1 text-sm w-40" value={editando.nome} onChange={e => setEditando({ ...editando, nome: e.target.value })} />
                          <select className="rounded border border-gray-300 px-2 py-1 text-sm" value={editando.role ?? "colaborador"} onChange={e => setEditando({ ...editando, role: e.target.value })}>
                            <option value="colaborador">Colaborador</option>
                            <option value="admin">Administrador</option>
                          </select>
                          <button onClick={handleSalvarEdicao} disabled={saving} style={{ background: "none", border: "none", cursor: "pointer", color: "#10b981", display: "flex" }}><Check size={16} /></button>
                          <button onClick={() => setEditando(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}><X size={16} /></button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg,#10b981,#059669)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 600, color: "#fff", flexShrink: 0 }}>{initials(u.nome)}</div>
                            <div>
                              <div style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>{u.nome}</div>
                              <div style={{ fontSize: "11px", color: "#94a3b8" }}>{u.email}</div>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {u.role && <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "20px", background: "#dbeafe", color: "#1d4ed8", fontWeight: 500 }}>{u.role === "admin" ? "Administrador" : "Colaborador"}</span>}
                            <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "20px", fontWeight: 500, background: u.ativo ? "#dcfce7" : "#f1f5f9", color: u.ativo ? "#16a34a" : "#64748b" }}>{u.ativo ? "Ativo" : "Inativo"}</span>
                            <button onClick={() => setEditando(u)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }} onMouseEnter={e => (e.currentTarget.style.color = "#475569")} onMouseLeave={e => (e.currentTarget.style.color = "#94a3b8")}><Pencil size={14} /></button>
                            {u.ativo
                              ? <button onClick={() => handleDesativar(u.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#fca5a5", display: "flex" }} onMouseEnter={e => (e.currentTarget.style.color = "#dc2626")} onMouseLeave={e => (e.currentTarget.style.color = "#fca5a5")}><Trash2 size={14} /></button>
                              : <button onClick={() => handleAtivar(u.id)} style={{ background: "none", border: "1px solid #10b981", borderRadius: "6px", cursor: "pointer", color: "#10b981", fontSize: "11px", fontWeight: 500, padding: "2px 8px" }}>Ativar</button>
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  ))
              }
            </div>
          </>
        )}

        {/* ── ABA: LOG ── */}
        {tab === "log" && (
          <div style={card}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a", margin: 0 }}>Log de atividades</h3>
              <div style={{ display: "flex", gap: "8px" }}>
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
            {loadingLog
              ? <div style={{ padding: "48px", textAlign: "center", fontSize: "13px", color: "#94a3b8" }}>Carregando...</div>
              : logs.length === 0
                ? <div style={{ padding: "48px", textAlign: "center", fontSize: "13px", color: "#94a3b8" }}>Nenhuma atividade no período.</div>
                : logs.map((l, idx) => (
                  <div key={l.id} style={{ display: "flex", gap: "12px", padding: "12px 20px", borderBottom: idx < logs.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", marginTop: "5px", flexShrink: 0 }} />
                    <div>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>{l.usuario_nome}</span>
                      <span style={{ fontSize: "13px", color: "#64748b" }}> — {l.acao}</span>
                      <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>{new Date(l.created_at).toLocaleString("pt-BR")}</div>
                    </div>
                  </div>
                ))
            }
          </div>
        )}

        {/* ── ABA: RELATÓRIOS ── */}
        {tab === "relatorios" && (
          <div style={cardPad}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a", margin: "0 0 16px" }}>Exportar relatórios</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { tipo: "clientes", titulo: "Lista de clientes", desc: "Razão social, CNPJ, segmento, regime tributário" },
                { tipo: "orientacoes", titulo: `Orientações de ${MES_ATUAL}/${ANO_ATUAL}`, desc: "Tema, problema, ação, responsável, status" },
              ].map((r) => (
                <div key={r.tipo} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", border: "1px solid #e8eaed", borderRadius: "10px" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>{r.titulo}</div>
                    <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>{r.desc}</div>
                  </div>
                  <button onClick={() => exportarCSV(r.tipo)} disabled={exportando === r.tipo} style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: "8px", padding: "7px 16px", fontSize: "12px", fontWeight: 500, color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", opacity: exportando === r.tipo ? .6 : 1 }}>
                    {exportando === r.tipo && <Loader2 size={12} className="animate-spin" />} Exportar CSV
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ABA: METAS ── */}
        {tab === "metas" && (
          <div style={card}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a" }}>Metas de {MES_ATUAL}/{ANO_ATUAL}</div>
                <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>Orientações por colaborador no mês</div>
              </div>
              <button onClick={handleSalvarMetas} disabled={saving} style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 18px", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", opacity: saving ? .6 : 1 }}>
                {saving && <Loader2 size={14} className="animate-spin" />} Salvar metas
              </button>
            </div>
            {loadingMetas
              ? <div style={{ padding: "48px", textAlign: "center", fontSize: "13px", color: "#94a3b8" }}>Carregando...</div>
              : metas.length === 0
                ? <div style={{ padding: "48px", textAlign: "center", fontSize: "13px", color: "#94a3b8" }}>Nenhuma meta configurada ainda.</div>
                : metas.map((m, i) => {
                  const pct = m.meta > 0 ? Math.min(100, Math.round(((m.realizado ?? 0) / m.meta) * 100)) : 0;
                  const barColor = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
                  return (
                    <div key={m.usuario_id} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 20px", borderBottom: i < metas.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg,#10b981,#059669)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 600, color: "#fff", flexShrink: 0 }}>{initials(m.usuario_nome)}</div>
                      <span style={{ fontSize: "13px", color: "#0f172a", width: "120px", flexShrink: 0 }}>{m.usuario_nome}</span>
                      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ flex: 1, height: "6px", background: "#f1f5f9", borderRadius: "20px", overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: "20px", background: barColor, width: `${pct}%`, transition: "width .3s" }} />
                        </div>
                        <span style={{ fontSize: "11px", color: "#94a3b8", minWidth: "56px", textAlign: "right" }}>{m.realizado ?? 0} / {m.meta}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#64748b" }}>
                        <span>Meta:</span>
                        <input type="number" min={1} max={999} style={{ width: "52px", height: "28px", border: "1px solid #e2e8f0", borderRadius: "6px", textAlign: "center", fontSize: "13px", outline: "none" }} value={m.meta}
                          onChange={e => { const updated = [...metas]; updated[i] = { ...m, meta: Number(e.target.value) }; setMetas(updated); }} />
                        <span>/mês</span>
                      </div>
                    </div>
                  );
                })
            }
          </div>
        )}
      </div>
    </div>
  );
}
