import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { UserMenu } from "@/components/UserMenu";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  criado_em: string;
}

export default function Admin() {
  const { toast } = useToast();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const inputClass = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";
  const labelClass = "block text-xs font-medium text-gray-600 mb-1";

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("usuarios").select("*").order("criado_em", { ascending: false });
    setUsuarios((data ?? []) as Usuario[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !email.trim() || !senha.trim()) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome },
    });
    if (authError) {
      toast({ title: "Erro ao criar usuário", description: authError.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    await supabase.from("usuarios").insert({
      id: authData.user.id,
      nome,
      email,
      ativo: true,
    });
    toast({ title: "Usuário criado com sucesso!" });
    setNome(""); setEmail(""); setSenha("");
    setSaving(false);
    load();
  };

  const handleDesativar = async (id: string) => {
    await supabase.from("usuarios").update({ ativo: false }).eq("id", id);
    toast({ title: "Usuário desativado" });
    load();
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
        <div className="mb-8">
          <h2 className="text-2xl font-semibold tracking-tight">Administração</h2>
          <p className="mt-1 text-sm text-muted-foreground">Gerencie os usuários com acesso ao CRM.</p>
        </div>

        {/* Formulário de criação */}
        <Card className="p-6 mb-8 border-border/60 shadow-none">
          <h3 className="text-base font-semibold mb-4">Novo usuário</h3>
          <form onSubmit={handleCriar} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Nome</label>
              <input className={inputClass} value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div>
              <label className={labelClass}>E-mail</label>
              <input className={inputClass} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div>
              <label className={labelClass}>Senha inicial</label>
              <input className={inputClass} type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <button type="submit" disabled={saving}
                className="rounded-md bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Criar usuário
              </button>
            </div>
          </form>
        </Card>

        {/* Lista de usuários */}
        <Card className="overflow-hidden border-border/60 shadow-none">
          <div className="px-6 py-4 border-b border-border/60">
            <h3 className="text-base font-semibold">Usuários cadastrados</h3>
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : usuarios.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhum usuário cadastrado.</div>
          ) : (
            <ul className="divide-y divide-border/60">
              {usuarios.map((u) => (
                <li key={u.id} className="flex items-center justify-between px-6 py-4 gap-4">
                  <div>
                    <p className="text-sm font-medium">{u.nome}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.ativo ? "Ativo" : "Inativo"}
                    </span>
                    {u.ativo && (
                      <button onClick={() => handleDesativar(u.id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        title="Desativar usuário">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}
