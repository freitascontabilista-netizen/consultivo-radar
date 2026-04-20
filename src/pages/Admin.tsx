import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { UserMenu } from "@/components/UserMenu";
import { Card } from "@/components/ui/card";
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
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome } },
    });
    if (authError) {
      toast({ title: "Erro ao criar usuário", description: authError.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    if (authData.user) {
      await supabase.from("usuarios").insert({
        id: authData.user.id,
        nome,
        email,
        ativo: true,
      });
    }
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
            <img src="/logo_freitas.png" alt="" style={{ height: "44px", objectFit: "contain" }}
