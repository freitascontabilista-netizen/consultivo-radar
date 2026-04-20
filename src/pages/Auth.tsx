import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type Tela = "login" | "esqueci" | "codigo" | "nova_senha";

export default function Auth() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [tela, setTela] = useState<Tela>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Entrar | CRM Consultivo";

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setTela("nova_senha");
      }
    });

    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setTela("nova_senha");
    }

    return () => subscription.unsubscribe();
  }, []);

  if (!authLoading && user && tela === "login") {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";
    return <Navigate to={from} replace />;
  }

  // ── Login ──────────────────────────────────────────
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
      return;
    }
    navigate("/", { replace: true });
  };

  // ── Enviar link de recuperação ─────────────────────
  const handleEsqueci = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "E-mail enviado!", description: "Verifique sua caixa de entrada e clique no link." });
    setTela("codigo");
  };

  // ── Salvar nova senha ──────────────────────────────
  const handleNovaSenha = async (e: FormEvent) => {
    e.preventDefault();
    if (novaSenha !== confirmarSenha) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }
    if (novaSenha.length < 6) {
      toast({ title: "A senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setSubmitting(false);
    if (error) {
      toast({ title: "Erro ao atualizar senha", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Senha atualizada com sucesso!" });
    await supabase.auth.signOut();
    setTela("login");
    setNovaSenha("");
    setConfirmarSenha("");
  };

  // ── Estilos ────────────────────────────────────────
  const s = {
    wrap: { minHeight: "100vh", background: "#f0f4ff", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" } as React.CSSProperties,
    box: { width: "100%", maxWidth: "400px" } as React.CSSProperties,
    card: { background: "#fff", borderRadius: "16px", border: "1px solid #e8eaed", padding: "32px" } as React.CSSProperties,
    logo: { textAlign: "center" as const, marginBottom: "28px" },
    title: { fontSize: "18px", fontWeight: 600, color: "#0f172a", marginBottom: "6px", textAlign: "center" as const },
    sub: { fontSize: "13px", color: "#64748b", marginBottom: "24px", textAlign: "center" as const },
    label: { display: "block", fontSize: "12px", fontWeight: 500, color: "#374151", marginBottom: "6px" },
    input: { width: "100%", height: "40px", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0 12px", fontSize: "13px", color: "#0f172a", outline: "none", marginBottom: "16px", boxSizing: "border-box" as const },
    btn: { width: "100%", height: "42px", background: "#0f172a", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "4px" },
    btnGreen: { width: "100%", height: "42px", background: "#10b981", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "4px" },
    link: { background: "none", border: "none", color: "#10b981", fontSize: "13px", cursor: "pointer", padding: 0, fontWeight: 500 },
    divider: { textAlign: "center" as const, marginTop: "20px", fontSize: "13px", color: "#64748b" },
    successBox: { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "16px", marginBottom: "20px", textAlign: "center" as const },
  };

  return (
    <div style={s.wrap}>
      <div style={s.box}>
        <div style={s.logo}>
          <img src="/logo_freitas.png" alt="Freitas" style={{ height: "60px", objectFit: "contain" }} />
          <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "6px" }}>CRM Consultivo</p>
        </div>

        <div style={s.card}>

          {/* ── TELA: LOGIN ── */}
          {tela === "login" && (
            <form onSubmit={handleLogin}>
              <div style={s.title}>Bem-vindo de volta</div>
              <div style={s.sub}>Entre com suas credenciais para acessar</div>

              <label style={s.label}>E-mail</label>
              <input style={s.input} type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ ...s.label, margin: 0 }}>Senha</label>
                <button type="button" style={s.link} onClick={() => setTela("esqueci")}>Esqueci minha senha</button>
              </div>
              <input style={s.input} type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />

              <button type="submit" disabled={submitting} style={{ ...s.btn, opacity: submitting ? .7 : 1 }}>
                {submitting && <Loader2 style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />}
                Entrar
              </button>
            </form>
          )}

          {/* ── TELA: ESQUECI SENHA ── */}
          {tela === "esqueci" && (
            <form onSubmit={handleEsqueci}>
              <div style={s.title}>Recuperar senha</div>
              <div style={s.sub}>Digite seu e-mail e enviaremos um link para criar uma nova senha.</div>

              <label style={s.label}>E-mail cadastrado</label>
              <input style={s.input} type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />

              <button type="submit" disabled={submitting} style={{ ...s.btnGreen, opacity: submitting ? .7 : 1 }}>
                {submitting && <Loader2 style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />}
                Enviar link de recuperação
              </button>

              <div style={s.divider}>
                <button type="button" style={s.link} onClick={() => setTela("login")}>← Voltar ao login</button>
              </div>
            </form>
          )}

          {/* ── TELA: CONFIRMAÇÃO DE ENVIO ── */}
          {tela === "codigo" && (
            <div>
              <div style={s.title}>E-mail enviado!</div>
              <div style={s.successBox}>
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>📧</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#065f46", marginBottom: "4px" }}>Verifique sua caixa de entrada</div>
                <div style={{ fontSize: "13px", color: "#047857" }}>Enviamos um link para <strong>{email}</strong>. Clique nele para criar uma nova senha.</div>
              </div>
              <div style={{ fontSize: "12px", color: "#94a3b8", textAlign: "center", marginBottom: "20px" }}>
                Não recebeu? Verifique a pasta de spam ou
                <button type="button" style={{ ...s.link, marginLeft: "4px", fontSize: "12px" }} onClick={() => setTela("esqueci")}>tente novamente</button>
              </div>
              <button type="button" onClick={() => setTela("login")} style={s.btn}>
                Voltar ao login
              </button>
            </div>
          )}

          {/* ── TELA: NOVA SENHA ── */}
          {tela === "nova_senha" && (
            <form onSubmit={handleNovaSenha}>
              <div style={s.title}>Criar nova senha</div>
              <div style={s.sub}>Escolha uma senha segura com pelo menos 6 caracteres.</div>

              <label style={s.label}>Nova senha</label>
              <input style={s.input} type="password" required minLength={6} value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />

              <label style={s.label}>Confirmar nova senha</label>
              <input style={{ ...s.input, borderColor: confirmarSenha && novaSenha !== confirmarSenha ? "#ef4444" : "#e2e8f0" }} type="password" required value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} placeholder="Repita a senha" />

              {confirmarSenha && novaSenha !== confirmarSenha && (
                <div style={{ fontSize: "12px", color: "#ef4444", marginTop: "-12px", marginBottom: "12px" }}>As senhas não coincidem</div>
              )}

              <button type="submit" disabled={submitting || (!!confirmarSenha && novaSenha !== confirmarSenha)} style={{ ...s.btnGreen, opacity: submitting ? .7 : 1 }}>
                {submitting && <Loader2 style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />}
                Salvar nova senha
              </button>
            </form>
          )}

        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
