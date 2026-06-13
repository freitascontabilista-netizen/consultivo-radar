import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Loader2, Trash2, Pencil, X, Check, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  perfil?: string;
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

interface Empresa {
  id?: string;
  nome: string;
  nome_fantasia: string;
  cnpj: string;
  email: string;
  telefone: string;
  endereco: string;
  cidade: string;
  uf: string;
  crc: string;
}

interface ListaItem {
  id: string;
  tipo: string;
  valor: string;
  ordem: number;
  ativo: boolean;
}

const initials = (nome: string) =>
  nome.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();

type Tab = "usuarios" | "log" | "relatorios" | "metas" | "empresa" | "configuracoes";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "usuarios",      label: "Usuários",             icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" },
  { key: "log",           label: "Log de atividades",    icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
  { key: "relatorios",    label: "Relatórios",            icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" },
  { key: "metas",         label: "Metas",                icon: "M22 12h-4l-3 9L9 3l-3 9H2" },
  { key: "empresa",       label: "Dados da empresa",     icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" },
  { key: "configuracoes", label: "Configurações",        icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" },
];

const TIPOS_LISTA = [
  { key: "segmento",          label: "Segmentos de cliente" },
  { key: "regime_tributario", label: "Regimes tributários" },
  { key: "tipo_interacao",    label: "Tipos de interação" },
];

const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

const inp: React.CSSProperties = {
  width: "100%", borderRadius: "8px", border: "1px solid #e5e7eb",
  padding: "8px 12px", fontSize: "13px", outline: "none", color: "#111827",
  background: "#fff", boxSizing: "border-box",
};
const lbl: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 600, color: "#6b7280",
  textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "5px",
};
const cardStyle: React.CSSProperties = {
  background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden",
};
const cardHeader: React.CSSProperties = {
  padding: "14px 20px", borderBottom: "1px solid #f3f4f6", background: "#fafafa",
  display: "flex", alignItems: "center", gap: "8px",
};

export default function Admin() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const now = new Date();
  const MES_ATUAL = now.getMonth() + 1;
  const ANO_ATUAL = now.getFullYear();

  const [tab, setTab] = useState<Tab>("usuarios");

  // Usuários
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [perfil, setPerfil] = useState("consultor");
  const [editando, setEditando] = useState<Usuario | null>(null);

  // Log
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);
  const [filtroUser, setFiltroUser] = useState("");
  const [filtroDias, setFiltroDias] = useState(7);

  // Metas
  const [metas, setMetas] = useState<Meta[]>([]);
  const [loadingMetas, setLoadingMetas] = useState(false);

  // Relatórios
  const [exportando, setExportando] = useState("");

  // Empresa
  const [empresa, setEmpresa] = useState<Empresa>({
    nome: "", nome_fantasia: "", cnpj: "", email: "",
    telefone: "", endereco: "", cidade: "", uf: "", crc: "",
  });
  const [loadingEmpresa, setLoadingEmpresa] = useState(false);
  const [savingEmpresa, setSavingEmpresa] = useState(false);

  // Configurações
  const [listas, setListas] = useState<ListaItem[]>([]);
  const [loadingListas, setLoadingListas] = useState(false);
  const [tipoAtivo, setTipoAtivo] = useState("segmento");
  const [novoValor, setNovoValor] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  // ── Loaders ──────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("usuarios").select("*").order("criado_em", { ascending: false });
    if (error) toast({ title: "Erro ao carregar usuários", description: error.message, variant: "destructive" });
    setUsuarios((data ?? []) as Usuario[]);
    setLoading(false);
  }, [toast]);

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
        return { ...m, usuario_nome: m.usuarios?.nome ?? "–", realizado: realizado ?? 0 };
      })
    );
    setMetas(metasComRealizado);
    setLoadingMetas(false);
  }, []);

  const loadEmpresa = useCallback(async () => {
    setLoadingEmpresa(true);
    const { data, error } = await supabase.from("empresa").select("*").limit(1).single();
    if (data) setEmpresa(data as Empresa);
    setLoadingEmpresa(false);
  }, []);

  const loadListas = useCallback(async () => {
    setLoadingListas(true);
    const { data } = await supabase.from("listas_config").select("*").eq("ativo", true).order("ordem");
    setListas((data ?? []) as ListaItem[]);
    setLoadingListas(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === "log") loadLogs(); }, [tab, loadLogs]);
  useEffect(() => { if (tab === "metas") loadMetas(); }, [tab, loadMetas]);
  useEffect(() => { if (tab === "empresa") loadEmpresa(); }, [tab, loadEmpresa]);
  useEffect(() => { if (tab === "configuracoes") loadListas(); }, [tab, loadListas]);

  // ── Usuários ──────────────────────────────────────────────
  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !email.trim() || !senha.trim()) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: fnData, error: fnError } = await supabase.functions.invoke("criar-usuario", {
      body: { nome, email, senha, perfil },
    });
    if (fnError || fnData?.error) {
      toast({ title: "Erro ao criar usuário", description: fnData?.error ?? fnError?.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    toast({ title: "Usuário criado com sucesso!" });
    setNome(""); setEmail(""); setSenha(""); setPerfil("consultor");
    setSaving(false);
    load();
  };

  const handleDesativar = async (id: string) => {
    const { error } = await supabase.from("usuarios").update({ ativo: false }).eq("id", id);
    if (error) { toast({ title: "Erro ao desativar usuário", description: error.message, variant: "destructive" }); return; }
    await supabase.from("activity_logs").insert({ usuario_nome: "Admin", acao: "Usuário desativado", entidade: "usuario", entidade_id: id });
    toast({ title: "Usuário desativado" });
    load();
  };

  const handleAtivar = async (id: string) => {
    const { error } = await supabase.from("usuarios").update({ ativo: true }).eq("id", id);
    if (error) { toast({ title: "Erro ao ativar usuário", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Usuário ativado" });
    load();
  };

  const handleSalvarEdicao = async () => {
    if (!editando) return;
    setSaving(true);
    const { error } = await supabase.from("usuarios").update({ nome: editando.nome, perfil: editando.perfil }).eq("id", editando.id);
    setSaving(false);
    if (error) { toast({ title: "Erro ao atualizar usuário", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Usuário atualizado!" });
    setEditando(null);
    load();
  };

  // ── Metas ──────────────────────────────────────────────
  const handleSalvarMetas = async () => {
    setSaving(true);
    for (const m of metas) {
      await supabase.from("metas").upsert({ usuario_id: m.usuario_id, mes: MES_ATUAL, ano: ANO_ATUAL, meta: m.meta }, { onConflict: "usuario_id,mes,ano" });
    }
    toast({ title: "Metas salvas!" });
    setSaving(false);
  };

  // ── Relatórios ──────────────────────────────────────────────
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

  // ── Empresa ──────────────────────────────────────────────
  const handleSalvarEmpresa = async () => {
    setSavingEmpresa(true);
    const { id, ...dados } = empresa as any;
    if (id) {
      const { error } = await supabase.from("empresa").update({ ...dados, atualizado_em: new Date().toISOString() }).eq("id", id);
      if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); setSavingEmpresa(false); return; }
    } else {
      const { error } = await supabase.from("empresa").insert(dados);
      if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); setSavingEmpresa(false); return; }
    }
    toast({ title: "Dados da empresa salvos!" });
    setSavingEmpresa(false);
    loadEmpresa();
  };

  // ── Listas ──────────────────────────────────────────────
  const handleAdicionarItem = async () => {
    if (!novoValor.trim()) return;
    setAddingItem(true);
    const maxOrdem = listas.filter(l => l.tipo === tipoAtivo).reduce((max, l) => Math.max(max, l.ordem), 0);
    const { error } = await supabase.from("listas_config").insert({ tipo: tipoAtivo, valor: novoValor.trim(), ordem: maxOrdem + 1 });
    if (error) { toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Item adicionado!" }); setNovoValor(""); loadListas(); }
    setAddingItem(false);
  };

  const handleRemoverItem = async (id: string) => {
    const { error } = await supabase.from("listas_config").update({ ativo: false }).eq("id", id);
    if (error) { toast({ title: "Erro ao remover", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Item removido" });
    loadListas();
  };

  const itensTipo = listas.filter(l => l.tipo === tipoAtivo);

  // ── Render ──────────────────────────────────────────────
  return (
    <main style={{ maxWidth: "1240px", margin: "0 auto", padding: "28px 28px 48px" }}>

      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "21px", fontWeight: 700, color: "#111827", margin: 0 }}>Administração</h1>
        <p style={{ fontSize: "13px", color: "#6b7280", margin: "4px 0 0" }}>Gerencie usuários, empresa, listas e configurações do escritório.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "5px", flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", fontSize: "13px", fontWeight: tab === t.key ? 600 : 400, color: tab === t.key ? "#1d4ed8" : "#6b7280", background: tab === t.key ? "#eff6ff" : "transparent", border: "none", borderRadius: "7px", cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s" }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d={t.icon}/>
            </svg>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ABA: USUÁRIOS ── */}
      {tab === "usuarios" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={cardStyle}>
            <div style={cardHeader}>
              <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#1d4ed8" }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
              </div>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#111827", margin: 0 }}>Novo usuário</h3>
            </div>
            <form onSubmit={handleCriar} style={{ padding: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div><label style={lbl}>Nome completo</label><input style={inp} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: João Silva" /></div>
              <div><label style={lbl}>E-mail</label><input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@escritorio.com.br" /></div>
              <div><label style={lbl}>Senha inicial</label><input style={inp} type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} /></div>
              <div>
                <label style={lbl}>Perfil de acesso</label>
                <select style={inp} value={perfil} onChange={e => setPerfil(e.target.value)}>
                  <option value="consultor">Consultor</option>
                  <option value="administrador">Administrador</option>
                </select>
              </div>
              <div style={{ gridColumn: "span 2", display: "flex", justifyContent: "flex-end", paddingTop: "4px" }}>
                <button type="submit" disabled={saving}
                  style={{ display: "flex", alignItems: "center", gap: "7px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 20px", fontSize: "13px", fontWeight: 600, cursor: "pointer", opacity: saving ? .6 : 1 }}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>}
                  Criar usuário
                </button>
              </div>
            </form>
          </div>

          <div style={cardStyle}>
            <div style={{ ...cardHeader, justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#1d4ed8" }}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#111827", margin: 0 }}>Usuários cadastrados</h3>
              </div>
              <span style={{ fontSize: "11px", fontWeight: 600, background: "#f1f5f9", color: "#6b7280", borderRadius: "20px", padding: "2px 9px" }}>
                {loading ? "–" : `${usuarios.length} usuário${usuarios.length !== 1 ? "s" : ""}`}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 100px", padding: "8px 20px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
              {["Colaborador", "Perfil", "Status", "Ações"].map(h => (
                <div key={h} style={{ fontSize: "10px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".07em" }}>{h}</div>
              ))}
            </div>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 100px", padding: "14px 20px", borderBottom: "1px solid #f9fafb", alignItems: "center", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "#f3f4f6", flexShrink: 0 }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      <div style={{ height: "12px", width: "120px", background: "#f3f4f6", borderRadius: "4px" }} />
                      <div style={{ height: "10px", width: "160px", background: "#f9fafb", borderRadius: "4px" }} />
                    </div>
                  </div>
                  <div style={{ height: "22px", width: "90px", background: "#f3f4f6", borderRadius: "20px" }} />
                  <div style={{ height: "22px", width: "60px", background: "#f3f4f6", borderRadius: "20px" }} />
                </div>
              ))
            ) : usuarios.length === 0 ? (
              <div style={{ padding: "48px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>Nenhum usuário cadastrado.</div>
            ) : (
              usuarios.map((u, idx) => (
                <div key={u.id} style={{ padding: "12px 20px", borderBottom: idx < usuarios.length - 1 ? "1px solid #f9fafb" : "none" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  {editando?.id === u.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <input style={{ ...inp, width: "160px" }} value={editando.nome} onChange={e => setEditando({ ...editando, nome: e.target.value })} />
                      <select style={{ ...inp, width: "150px" }} value={editando.perfil ?? "consultor"} onChange={e => setEditando({ ...editando, perfil: e.target.value })}>
                        <option value="consultor">Consultor</option>
                        <option value="administrador">Administrador</option>
                      </select>
                      <button onClick={handleSalvarEdicao} disabled={saving} style={{ width: "30px", height: "30px", border: "1px solid #bbf7d0", borderRadius: "7px", background: "#f0fdf4", color: "#16a34a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={14} /></button>
                      <button onClick={() => setEditando(null)} style={{ width: "30px", height: "30px", border: "1px solid #e5e7eb", borderRadius: "7px", background: "#fff", color: "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 100px", alignItems: "center", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "linear-gradient(135deg,#1d4ed8,#1e40af)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "#fff", flexShrink: 0 }}>{initials(u.nome)}</div>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: "#111827" }}>{u.nome}</div>
                          <div style={{ fontSize: "11px", color: "#9ca3af" }}>{u.email}</div>
                        </div>
                      </div>
                      <div><span style={{ fontSize: "11px", padding: "3px 9px", borderRadius: "20px", fontWeight: 500, background: u.perfil === "administrador" ? "#eff6ff" : "#f1f5f9", color: u.perfil === "administrador" ? "#1d4ed8" : "#475569" }}>{u.perfil === "administrador" ? "Administrador" : "Consultor"}</span></div>
                      <div><span style={{ fontSize: "11px", padding: "3px 9px", borderRadius: "20px", fontWeight: 500, background: u.ativo ? "#f0fdf4" : "#f9fafb", color: u.ativo ? "#16a34a" : "#6b7280" }}>{u.ativo ? "Ativo" : "Inativo"}</span></div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <button onClick={() => setEditando(u)} title="Editar"
                          style={{ width: "28px", height: "28px", border: "1px solid #e5e7eb", borderRadius: "7px", background: "#fff", color: "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#1d4ed8"; el.style.color = "#1d4ed8"; el.style.background = "#eff6ff"; }}
                          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#e5e7eb"; el.style.color = "#9ca3af"; el.style.background = "#fff"; }}>
                          <Pencil size={13} />
                        </button>
                        {u.ativo ? (
                          <button onClick={() => handleDesativar(u.id)} title="Desativar"
                            style={{ width: "28px", height: "28px", border: "1px solid #e5e7eb", borderRadius: "7px", background: "#fff", color: "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#fca5a5"; el.style.color = "#dc2626"; el.style.background = "#fef2f2"; }}
                            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#e5e7eb"; el.style.color = "#9ca3af"; el.style.background = "#fff"; }}>
                            <Trash2 size={13} />
                          </button>
                        ) : (
                          <button onClick={() => handleAtivar(u.id)} style={{ padding: "3px 10px", border: "1px solid #bbf7d0", borderRadius: "7px", background: "#f0fdf4", color: "#16a34a", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>Ativar</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── ABA: LOG ── */}
      {tab === "log" && (
        <div style={cardStyle}>
          <div style={{ ...cardHeader, justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#1d4ed8" }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#111827", margin: 0 }}>Log de atividades</h3>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <select value={filtroUser} onChange={e => setFiltroUser(e.target.value)} style={{ fontSize: "12px", color: "#374151", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "7px", padding: "6px 10px", outline: "none" }}>
                <option value="">Todos os colaboradores</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
              <select value={filtroDias} onChange={e => setFiltroDias(Number(e.target.value))} style={{ fontSize: "12px", color: "#374151", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "7px", padding: "6px 10px", outline: "none" }}>
                <option value={7}>Últimos 7 dias</option>
                <option value={30}>Últimos 30 dias</option>
                <option value={90}>Últimos 90 dias</option>
              </select>
              <button onClick={loadLogs} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "7px", color: "#1d4ed8", fontSize: "12px", fontWeight: 500, cursor: "pointer" }}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                Atualizar
              </button>
            </div>
          </div>
          {loadingLog ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#9ca3af", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}><Loader2 size={16} className="animate-spin" /> Carregando logs...</div>
          ) : logs.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>Nenhuma atividade no período.</div>
          ) : (
            logs.map((l, idx) => (
              <div key={l.id} style={{ display: "flex", gap: "14px", padding: "13px 20px", borderBottom: idx < logs.length - 1 ? "1px solid #f9fafb" : "none", alignItems: "flex-start" }}
                onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#1d4ed8", flexShrink: 0 }}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", color: "#111827" }}><span style={{ fontWeight: 600 }}>{l.usuario_nome}</span><span style={{ color: "#6b7280" }}> — {l.acao}</span></div>
                  {l.entidade && <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "1px" }}>Entidade: {l.entidade}</div>}
                </div>
                <div style={{ fontSize: "11px", color: "#9ca3af", flexShrink: 0, textAlign: "right" }}>
                  {new Date(l.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── ABA: RELATÓRIOS ── */}
      {tab === "relatorios" && (
        <div style={cardStyle}>
          <div style={cardHeader}>
            <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#1d4ed8" }}>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
            </div>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#111827", margin: 0 }}>Exportar relatórios</h3>
          </div>
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { tipo: "clientes", titulo: "Lista de clientes", desc: "Razão social, CNPJ, segmento e regime tributário", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", color: "#1d4ed8", bg: "#eff6ff" },
              { tipo: "orientacoes", titulo: `Orientações — ${MES_ATUAL.toString().padStart(2,"0")}/${ANO_ATUAL}`, desc: "Tema, problema, ação, responsável e status do mês atual", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8", color: "#16a34a", bg: "#f0fdf4" },
            ].map(r => (
              <div key={r.tipo} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", border: "1px solid #e5e7eb", borderRadius: "10px", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: r.bg, display: "flex", alignItems: "center", justifyContent: "center", color: r.color, flexShrink: 0 }}>
                    <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d={r.icon}/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#111827" }}>{r.titulo}</div>
                    <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "2px" }}>{r.desc}</div>
                  </div>
                </div>
                <button onClick={() => exportarCSV(r.tipo)} disabled={exportando === r.tipo}
                  style={{ display: "flex", alignItems: "center", gap: "6px", border: "1px solid #e5e7eb", background: "#fff", borderRadius: "8px", padding: "8px 16px", fontSize: "12px", fontWeight: 500, color: "#374151", cursor: "pointer", flexShrink: 0, opacity: exportando === r.tipo ? .6 : 1 }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#f9fafb"; e.currentTarget.style.borderColor = "#d1d5db"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#e5e7eb"; }}>
                  {exportando === r.tipo ? <><Loader2 size={12} className="animate-spin" /> Exportando...</> : <><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Exportar CSV</>}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ABA: METAS ── */}
      {tab === "metas" && (
        <div style={cardStyle}>
          <div style={{ ...cardHeader, justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#1d4ed8" }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>Metas de {now.toLocaleString("pt-BR", { month: "long" })} de {ANO_ATUAL}</div>
                <div style={{ fontSize: "11px", color: "#9ca3af" }}>Orientações por colaborador no mês</div>
              </div>
            </div>
            <button onClick={handleSalvarMetas} disabled={saving}
              style={{ display: "flex", alignItems: "center", gap: "7px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 18px", fontSize: "13px", fontWeight: 600, cursor: "pointer", opacity: saving ? .6 : 1 }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>}
              Salvar metas
            </button>
          </div>
          {loadingMetas ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#9ca3af", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}><Loader2 size={16} className="animate-spin" /> Carregando metas...</div>
          ) : metas.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>Nenhuma meta configurada para este mês.</div>
          ) : (
            metas.map((m, i) => {
              const pct = m.meta > 0 ? Math.min(100, Math.round(((m.realizado ?? 0) / m.meta) * 100)) : 0;
              const barColor = pct >= 80 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626";
              const barBg    = pct >= 80 ? "#f0fdf4" : pct >= 50 ? "#fffbeb" : "#fef2f2";
              return (
                <div key={m.usuario_id} style={{ padding: "16px 20px", borderBottom: i < metas.length - 1 ? "1px solid #f9fafb" : "none" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "linear-gradient(135deg,#1d4ed8,#1e40af)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "#fff", flexShrink: 0 }}>{initials(m.usuario_nome)}</div>
                    <div style={{ minWidth: "130px", flexShrink: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#111827" }}>{m.usuario_nome}</div>
                      <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "1px" }}>{m.realizado ?? 0} de {m.meta} orientações</div>
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "5px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", color: "#6b7280" }}>Progresso</span>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: barColor }}>{pct}%</span>
                      </div>
                      <div style={{ height: "6px", background: "#f3f4f6", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: "3px", background: barColor, width: `${pct}%`, transition: "width .4s ease" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, background: barBg, border: `1px solid ${barColor}30`, borderRadius: "8px", padding: "6px 12px" }}>
                      <span style={{ fontSize: "12px", color: "#6b7280", fontWeight: 500 }}>Meta:</span>
                      <input type="number" min={1} max={999} style={{ width: "50px", border: "1px solid #e5e7eb", borderRadius: "6px", textAlign: "center", fontSize: "13px", fontWeight: 600, color: "#111827", padding: "3px 6px", outline: "none", background: "#fff" }}
                        value={m.meta} onChange={e => { const updated = [...metas]; updated[i] = { ...m, meta: Number(e.target.value) }; setMetas(updated); }} />
                      <span style={{ fontSize: "12px", color: "#9ca3af" }}>/mês</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── ABA: DADOS DA EMPRESA ── */}
      {tab === "empresa" && (
        <div style={cardStyle}>
          <div style={{ ...cardHeader, justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#1d4ed8" }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </div>
              <div>
                <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#111827", margin: 0 }}>Dados do escritório</h3>
                <p style={{ fontSize: "11px", color: "#9ca3af", margin: 0 }}>Informações que aparecem em relatórios e comunicações</p>
              </div>
            </div>
            <button onClick={handleSalvarEmpresa} disabled={savingEmpresa}
              style={{ display: "flex", alignItems: "center", gap: "7px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 18px", fontSize: "13px", fontWeight: 600, cursor: "pointer", opacity: savingEmpresa ? .6 : 1 }}>
              {savingEmpresa ? <Loader2 size={14} className="animate-spin" /> : <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>}
              Salvar alterações
            </button>
          </div>

          {loadingEmpresa ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#9ca3af", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}><Loader2 size={16} className="animate-spin" /> Carregando...</div>
          ) : (
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>

              {/* Identificação */}
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: "12px", paddingBottom: "8px", borderBottom: "1px solid #f3f4f6" }}>Identificação</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div style={{ gridColumn: "span 2" }}>
                    <label style={lbl}>Razão social</label>
                    <input style={inp} value={empresa.nome} onChange={e => setEmpresa({ ...empresa, nome: e.target.value })} placeholder="Ex.: Freitas Consultoria Contábil e Financeira Ltda" />
                  </div>
                  <div>
                    <label style={lbl}>Nome fantasia</label>
                    <input style={inp} value={empresa.nome_fantasia} onChange={e => setEmpresa({ ...empresa, nome_fantasia: e.target.value })} placeholder="Ex.: Freitas Consultoria" />
                  </div>
                  <div>
                    <label style={lbl}>CNPJ</label>
                    <input style={inp} value={empresa.cnpj} onChange={e => setEmpresa({ ...empresa, cnpj: e.target.value })} placeholder="00.000.000/0001-00" />
                  </div>
                  <div>
                    <label style={lbl}>CRC</label>
                    <input style={inp} value={empresa.crc} onChange={e => setEmpresa({ ...empresa, crc: e.target.value })} placeholder="Ex.: CRC/DF-000000/O-0" />
                  </div>
                </div>
              </div>

              {/* Contato */}
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: "12px", paddingBottom: "8px", borderBottom: "1px solid #f3f4f6" }}>Contato</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={lbl}>E-mail</label>
                    <input style={inp} type="email" value={empresa.email} onChange={e => setEmpresa({ ...empresa, email: e.target.value })} placeholder="contato@escritorio.com.br" />
                  </div>
                  <div>
                    <label style={lbl}>Telefone / WhatsApp</label>
                    <input style={inp} value={empresa.telefone} onChange={e => setEmpresa({ ...empresa, telefone: e.target.value })} placeholder="(61) 9 0000-0000" />
                  </div>
                </div>
              </div>

              {/* Endereço */}
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: "12px", paddingBottom: "8px", borderBottom: "1px solid #f3f4f6" }}>Endereço</div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 80px", gap: "16px" }}>
                  <div style={{ gridColumn: "span 3" }}>
                    <label style={lbl}>Logradouro</label>
                    <input style={inp} value={empresa.endereco} onChange={e => setEmpresa({ ...empresa, endereco: e.target.value })} placeholder="Ex.: SCS Quadra 01, Bloco A, Sala 100" />
                  </div>
                  <div>
                    <label style={lbl}>Cidade</label>
                    <input style={inp} value={empresa.cidade} onChange={e => setEmpresa({ ...empresa, cidade: e.target.value })} placeholder="Brasília" />
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <label style={lbl}>UF</label>
                    <select style={inp} value={empresa.uf} onChange={e => setEmpresa({ ...empresa, uf: e.target.value })}>
                      <option value="">Selecione</option>
                      {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ABA: CONFIGURAÇÕES ── */}
      {tab === "configuracoes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Sub-tabs de tipo */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {TIPOS_LISTA.map(t => (
              <button key={t.key} onClick={() => { setTipoAtivo(t.key); setNovoValor(""); }}
                style={{ padding: "6px 14px", fontSize: "12px", fontWeight: tipoAtivo === t.key ? 600 : 400, color: tipoAtivo === t.key ? "#1d4ed8" : "#6b7280", background: tipoAtivo === t.key ? "#eff6ff" : "#fff", border: tipoAtivo === t.key ? "1.5px solid #bfdbfe" : "1px solid #e5e7eb", borderRadius: "8px", cursor: "pointer", transition: "all .15s" }}>
                {t.label}
              </button>
            ))}
          </div>

          <div style={cardStyle}>
            <div style={cardHeader}>
              <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#1d4ed8" }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              </div>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#111827", margin: 0 }}>
                {TIPOS_LISTA.find(t => t.key === tipoAtivo)?.label}
              </h3>
              <span style={{ marginLeft: "auto", fontSize: "11px", fontWeight: 600, background: "#f1f5f9", color: "#6b7280", borderRadius: "20px", padding: "2px 9px" }}>
                {itensTipo.length} {itensTipo.length === 1 ? "item" : "itens"}
              </span>
            </div>

            {/* Adicionar novo item */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", gap: "8px", alignItems: "center" }}>
              <input style={{ ...inp, flex: 1 }} value={novoValor} onChange={e => setNovoValor(e.target.value)}
                placeholder={`Novo ${TIPOS_LISTA.find(t => t.key === tipoAtivo)?.label.toLowerCase().replace("s de cliente","").replace("s tributários","").replace("s de interação","").trim()}...`}
                onKeyDown={e => { if (e.key === "Enter") handleAdicionarItem(); }} />
              <button onClick={handleAdicionarItem} disabled={addingItem || !novoValor.trim()}
                style={{ display: "flex", alignItems: "center", gap: "6px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer", flexShrink: 0, opacity: addingItem || !novoValor.trim() ? .5 : 1 }}>
                {addingItem ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Adicionar
              </button>
            </div>

            {/* Lista de itens */}
            {loadingListas ? (
              <div style={{ padding: "48px", textAlign: "center", color: "#9ca3af", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}><Loader2 size={16} className="animate-spin" /> Carregando...</div>
            ) : itensTipo.length === 0 ? (
              <div style={{ padding: "48px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>Nenhum item cadastrado.</div>
            ) : (
              itensTipo.map((item, idx) => (
                <div key={item.id}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 20px", borderBottom: idx < itensTipo.length - 1 ? "1px solid #f9fafb" : "none" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#d1d5db", flexShrink: 0 }} />
                    <span style={{ fontSize: "13px", color: "#111827" }}>{item.valor}</span>
                    <span style={{ fontSize: "10px", color: "#d1d5db", fontWeight: 500 }}>#{item.ordem}</span>
                  </div>
                  <button onClick={() => handleRemoverItem(item.id)}
                    style={{ width: "28px", height: "28px", border: "1px solid #e5e7eb", borderRadius: "7px", background: "#fff", color: "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#fca5a5"; el.style.color = "#dc2626"; el.style.background = "#fef2f2"; }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#e5e7eb"; el.style.color = "#9ca3af"; el.style.background = "#fff"; }}>
                    <X size={13} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div style={{ padding: "12px 16px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", fontSize: "12px", color: "#92400e" }}>
            <strong>Atenção:</strong> remover um item aqui não altera clientes já cadastrados com esse valor — apenas remove a opção dos novos cadastros.
          </div>
        </div>
      )}
    </main>
  );
}
