import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, ArrowRight, Users, FileText, Calendar, CheckCircle,
  PieChart, Bell, Shield, Cloud, RefreshCw, Lock,
} from "lucide-react";

type Tela = "login" | "esqueci" | "codigo";

const features = [
  { icon: Users,       title: "Clientes",          sub: "Gestão da carteira" },
  { icon: FileText,    title: "Orientações",        sub: "Histórico completo" },
  { icon: Calendar,    title: "Agenda",             sub: "Google Calendar" },
  { icon: CheckCircle, title: "Acompanhamentos",    sub: "Prazos e tarefas" },
  { icon: PieChart,    title: "Dashboard",          sub: "Saúde da carteira" },
  { icon: Bell,        title: "Alertas",            sub: "Clientes críticos" },
];

const metrics = [
  { value: "100", suffix: "%",      label: "Clientes acompanhados" },
  { value: "0",   suffix: " perdas", label: "Orientações registradas" },
  { value: "24",  suffix: "/7",     label: "Acesso ao radar" },
];

const inputStyle = (focused: boolean): React.CSSProperties => ({
  width: "100%",
  border: `0.5px solid ${focused ? "#1D4ED8" : "#CBD5E1"}`,
  borderRadius: "8px",
  padding: "10px 13px",
  fontSize: "13px",
  color: "#0F172A",
  outline: "none",
  background: "#fff",
  boxSizing: "border-box",
  boxShadow: focused ? "0 0 0 3px rgba(29,78,216,0.08)" : "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
});

export default function Auth() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [tela, setTela] = useState<Tela>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [pwdFocused, setPwdFocused] = useState(false);

  useEffect(() => {
    document.title = "Entrar | Consultivo Radar";
  }, []);

  if (!authLoading && user && tela === "login") {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";
    return <Navigate to={from} replace />;
  }

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

  const handleEsqueci = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "E-mail enviado!", description: "Verifique sua caixa de entrada e clique no link." });
    setTela("codigo");
  };

  return (
    <>
      <div className="auth-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", minHeight: "100vh" }}>

        {/* ═══════ LADO ESQUERDO ═══════ */}
        <div className="auth-left" style={{ background: "#060D1A", padding: "52px 48px", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative", overflow: "hidden" }}>

          {/* Orbs de fundo */}
          <div style={{ position: "absolute", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.07), transparent 70%)", bottom: "-120px", right: "-100px", pointerEvents: "none", animation: "breathe 7s ease-in-out infinite" }} />
          <div style={{ position: "absolute", width: "250px", height: "250px", borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.07), transparent 70%)", top: "-80px", left: "-60px", pointerEvents: "none", animation: "breathe 9s ease-in-out infinite reverse" }} />

          {/* Bloco 1 — Logo */}
          <div style={{ animation: "fadeUp 0.5s ease 0s both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <div style={{ width: "34px", height: "34px", background: "#10B981", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: 700, color: "#fff", flexShrink: 0 }}>F</div>
              <span style={{ color: "#fff", fontSize: "14px", fontWeight: 500 }}>Consultivo Radar</span>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "999px", padding: "3px 9px" }}>
              <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#10B981", flexShrink: 0, display: "inline-block", animation: "ping 2s ease-in-out infinite" }} />
              <span style={{ color: "#10B981", fontSize: "10px" }}>Todos os sistemas operacionais</span>
            </div>
          </div>

          {/* Bloco 2 — Headline */}
          <div style={{ animation: "fadeUp 0.5s ease 0.08s both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
              <span style={{ color: "rgba(255,255,255,0.15)", fontSize: "10px", textTransform: "uppercase" as const, letterSpacing: "0.1em", whiteSpace: "nowrap" as const }}>Para contadores consultores</span>
            </div>
            <h1 style={{ margin: "0 0 12px", fontSize: "26px", fontWeight: 500, color: "#fff", letterSpacing: "-0.5px", lineHeight: 1.35 }}>
              Consultoria mais próxima.<br />
              <span style={{ color: "#10B981" }}>Clientes mais satisfeitos.</span>
            </h1>
            <p style={{ margin: 0, color: "#475569", fontSize: "13px", lineHeight: 1.75 }}>
              Registre orientações, acompanhe prazos fiscais e mantenha sua carteira sempre saudável — em um único dashboard.
            </p>
          </div>

          {/* Bloco 3 — Métricas */}
          <div style={{ animation: "fadeUp 0.5s ease 0.16s both" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1px", background: "rgba(255,255,255,0.06)", borderRadius: "10px", overflow: "hidden" }}>
              {metrics.map(m => (
                <div key={m.label} style={{ background: "#060D1A", padding: "16px 14px" }}>
                  <div style={{ fontSize: "22px", fontWeight: 700, color: "#fff", lineHeight: 1 }}>
                    {m.value}<span style={{ fontSize: "12px", color: "#10B981", marginLeft: "2px" }}>{m.suffix}</span>
                  </div>
                  <div style={{ fontSize: "10px", color: "#334155", marginTop: "5px" }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Bloco 4 — Funcionalidades */}
          <div style={{ animation: "fadeUp 0.5s ease 0.24s both" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {features.map(f => {
                const Icon = f.icon;
                return (
                  <div key={f.title}
                    style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.05)", borderRadius: "9px", padding: "10px 12px", display: "flex", alignItems: "center", gap: "10px", cursor: "default", transition: "transform 0.15s, border-color 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateX(3px)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.15)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"; }}>
                    <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10B981", flexShrink: 0 }}>
                      <Icon size={13} />
                    </div>
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 500, color: "rgba(255,255,255,0.75)", lineHeight: 1.2 }}>{f.title}</div>
                      <div style={{ fontSize: "10px", color: "#334155", marginTop: "1px" }}>{f.sub}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══════ LADO DIREITO ═══════ */}
        <div style={{ background: "#F1F5F9", padding: "52px 40px", display: "flex", flexDirection: "column", justifyContent: "center", position: "relative" }}>

          {/* Faixa superior */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #1D4ED8, #6366F1)" }} />

          {/* Header do formulário */}
          <div style={{ marginBottom: "28px" }}>
            <div style={{ fontSize: "10px", fontWeight: 500, color: "#1D4ED8", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: "8px" }}>
              {tela === "login" ? "Acesso seguro" : tela === "esqueci" ? "Recuperação de senha" : "Verifique seu e-mail"}
            </div>
            <h2 style={{ margin: "0 0 6px", fontSize: "22px", fontWeight: 500, color: "#0F172A", letterSpacing: "-0.3px" }}>
              {tela === "login" ? "Entre na sua conta" : tela === "esqueci" ? "Esqueceu sua senha?" : "Link enviado!"}
            </h2>
            <p style={{ margin: 0, fontSize: "13px", color: "#64748B" }}>
              {tela === "login"   ? "Bem-vindo de volta ao Consultivo Radar"
               : tela === "esqueci" ? "Enviaremos um link de redefinição para seu e-mail"
               : "Acesse seu e-mail para continuar"}
            </p>
          </div>

          {/* ── TELA: LOGIN ── */}
          {tela === "login" && (
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 500, color: "#64748B", textTransform: "uppercase" as const, letterSpacing: "0.03em", marginBottom: "6px" }}>E-mail</label>
                <input
                  type="email" required autoComplete="email"
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  style={inputStyle(emailFocused)}
                />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 500, color: "#64748B", textTransform: "uppercase" as const, letterSpacing: "0.03em" }}>Senha</label>
                  <button type="button" onClick={() => setTela("esqueci")}
                    style={{ background: "none", border: "none", color: "#1D4ED8", fontSize: "11px", cursor: "pointer", padding: 0, fontWeight: 500 }}>
                    Esqueci minha senha
                  </button>
                </div>
                <input
                  type="password" required autoComplete="current-password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  onFocus={() => setPwdFocused(true)}
                  onBlur={() => setPwdFocused(false)}
                  style={inputStyle(pwdFocused)}
                />
              </div>
              <button type="submit" disabled={submitting}
                style={{ width: "100%", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: "8px", padding: "12px", fontSize: "14px", fontWeight: 500, cursor: submitting ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", opacity: submitting ? 0.7 : 1, transition: "background 0.15s, box-shadow 0.15s, transform 0.15s" }}
                onMouseEnter={e => { if (!submitting) { e.currentTarget.style.background = "#1E40AF"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(29,78,216,0.3)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
                onMouseLeave={e => { e.currentTarget.style.background = "#1D4ED8"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = ""; }}>
                {submitting ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <ArrowRight size={16} />}
                {submitting ? "Entrando…" : "Entrar no sistema"}
              </button>
            </form>
          )}

          {/* ── TELA: ESQUECI SENHA ── */}
          {tela === "esqueci" && (
            <form onSubmit={handleEsqueci}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 500, color: "#64748B", textTransform: "uppercase" as const, letterSpacing: "0.03em", marginBottom: "6px" }}>E-mail cadastrado</label>
                <input
                  type="email" required
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  style={inputStyle(emailFocused)}
                />
              </div>
              <button type="submit" disabled={submitting}
                style={{ width: "100%", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: "8px", padding: "12px", fontSize: "14px", fontWeight: 500, cursor: submitting ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", opacity: submitting ? 0.7 : 1, transition: "background 0.15s, box-shadow 0.15s, transform 0.15s", marginBottom: "16px" }}
                onMouseEnter={e => { if (!submitting) { e.currentTarget.style.background = "#1E40AF"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(29,78,216,0.3)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
                onMouseLeave={e => { e.currentTarget.style.background = "#1D4ED8"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = ""; }}>
                {submitting ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <ArrowRight size={16} />}
                {submitting ? "Enviando…" : "Enviar link de recuperação"}
              </button>
              <div style={{ textAlign: "center" as const }}>
                <button type="button" onClick={() => setTela("login")}
                  style={{ background: "none", border: "none", color: "#1D4ED8", fontSize: "13px", cursor: "pointer", fontWeight: 500 }}>
                  ← Voltar ao login
                </button>
              </div>
            </form>
          )}

          {/* ── TELA: CONFIRMAÇÃO ── */}
          {tela === "codigo" && (
            <div>
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "20px", marginBottom: "20px", textAlign: "center" as const }}>
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>📧</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#065f46", marginBottom: "6px" }}>Verifique sua caixa de entrada</div>
                <div style={{ fontSize: "13px", color: "#047857" }}>Enviamos um link para <strong>{email}</strong>. Clique nele para criar uma nova senha.</div>
              </div>
              <div style={{ fontSize: "12px", color: "#94a3b8", textAlign: "center" as const, marginBottom: "16px" }}>
                Não recebeu? Verifique a pasta de spam ou{" "}
                <button type="button" onClick={() => setTela("esqueci")}
                  style={{ background: "none", border: "none", color: "#1D4ED8", fontSize: "12px", cursor: "pointer", fontWeight: 500 }}>
                  tente novamente
                </button>
              </div>
              <button type="button" onClick={() => setTela("login")}
                style={{ width: "100%", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: "8px", padding: "12px", fontSize: "14px", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", transition: "background 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#1E40AF"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#1D4ED8"; }}>
                <ArrowRight size={16} /> Voltar ao login
              </button>
            </div>
          )}

          {/* Rodapé */}
          <div style={{ marginTop: "32px", borderTop: "1px solid #E2E8F0", paddingTop: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginBottom: "16px" }}>
              <Lock size={11} color="#94A3B8" />
              <span style={{ fontSize: "11px", color: "#94A3B8" }}>Conexão segura · SSL · Dados criptografados</span>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: "24px" }}>
              {[
                { Icon: Shield,    color: "#10b981", label: "Dados seguros" },
                { Icon: Cloud,     color: "#6366f1", label: "Cloud hospedado" },
                { Icon: RefreshCw, color: "#1d4ed8", label: "Sempre atualizado" },
              ].map(b => (
                <div key={b.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                  <b.Icon size={13} color={b.color} />
                  <span style={{ fontSize: "10px", color: "#94A3B8" }}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin    { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes breathe { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.12) } }
        @keyframes fadeUp  { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes ping    { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }
        @media (max-width: 768px) {
          .auth-left { display: none !important; }
          .auth-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
