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
  { icon: Users,       title: "Clientes",       sub: "Gestão da carteira" },
  { icon: FileText,    title: "Orientações",     sub: "Histórico completo" },
  { icon: Calendar,    title: "Agenda",          sub: "Google Calendar" },
  { icon: CheckCircle, title: "Acompanhamentos", sub: "Prazos e tarefas" },
  { icon: PieChart,    title: "Dashboard",       sub: "Saúde da carteira" },
  { icon: Bell,        title: "Alertas",         sub: "Clientes críticos" },
];

const metrics = [
  { value: "100%",     label: "Clientes acompanhados" },
  { value: "0 perdas", label: "Orientações registradas" },
  { value: "24/7",     label: "Acesso ao radar" },
];

const inputStyle = (focused: boolean): React.CSSProperties => ({
  width: "100%",
  border: `1px solid ${focused ? "#10B981" : "#DDE3ED"}`,
  borderRadius: "9px",
  padding: "11px 14px",
  fontSize: "14px",
  color: "#0F172A",
  outline: "none",
  background: "#F8FAFC",
  boxSizing: "border-box",
  boxShadow: focused ? "0 0 0 3px rgba(16,185,129,0.10)" : "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
  fontFamily: "inherit",
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
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @media (max-width: 768px) {
          .auth-container {
            grid-template-columns: 1fr !important;
          }
          .auth-left {
            display: none !important;
          }
        }
      `}</style>

      {/* VIEWPORT WRAPPER */}
      <div style={{
        minHeight: "100vh",
        background: "#EEF0F5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        boxSizing: "border-box",
      }}>

        {/* CONTAINER SPLIT-SCREEN */}
        <div
          className="auth-container"
          style={{
            width: "100%",
            maxWidth: "1100px",
            display: "grid",
            gridTemplateColumns: "1fr 440px",
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 24px 80px rgba(0,0,0,0.18)",
          }}
        >

          {/* ══════════════ LADO ESQUERDO ══════════════ */}
          <div
            className="auth-left"
            style={{
              background: "#0A0F1E",
              padding: "44px 52px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Topo: logo + status */}
            <div style={{ animation: "fadeUp 0.35s ease both" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <div style={{
                  width: "36px", height: "36px", background: "#10B981",
                  borderRadius: "9px", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: "16px", fontWeight: 600, color: "#fff",
                }}>F</div>
                <span style={{ fontSize: "15px", fontWeight: 500, color: "#fff" }}>Consultivo Radar</span>
              </div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: "7px",
                background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)",
                borderRadius: "20px", padding: "5px 13px", fontSize: "12px", color: "#10B981",
              }}>
                <span style={{
                  width: "6px", height: "6px", background: "#10B981", borderRadius: "50%",
                  animation: "pulse-dot 2s ease-in-out infinite",
                }} />
                Todos os sistemas operacionais
              </div>
            </div>

            {/* Centro */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "40px 0 24px", gap: "24px" }}>

              {/* Eyebrow */}
              <div style={{ animation: "fadeUp 0.4s ease 0.05s both" }}>
                <div style={{
                  fontSize: "11px", fontWeight: 500, letterSpacing: "1.6px",
                  color: "rgba(255,255,255,0.28)", textTransform: "uppercase",
                  display: "flex", alignItems: "center", gap: "10px",
                }}>
                  <span style={{ width: "24px", height: "1px", background: "rgba(255,255,255,0.15)", display: "block" }} />
                  Para contadores consultores
                </div>
              </div>

              {/* Headline */}
              <div style={{ animation: "fadeUp 0.4s ease 0.08s both" }}>
                <div style={{ fontSize: "31px", fontWeight: 500, color: "#fff", lineHeight: 1.22, letterSpacing: "-0.8px" }}>
                  Quando foi a última vez<br />
                  que você{" "}
                  <span style={{ color: "#10B981" }}>falou com<br />seu cliente?</span>
                </div>
              </div>

              {/* Caixa de alerta */}
              <div style={{ animation: "fadeUp 0.4s ease 0.11s both" }}>
                <div style={{
                  background: "rgba(251,191,36,0.07)",
                  border: "1px solid rgba(251,191,36,0.22)",
                  borderLeft: "3px solid #FBBF24",
                  borderRadius: "10px",
                  padding: "15px 17px",
                }}>
                  <div style={{
                    fontSize: "10px", fontWeight: 600, letterSpacing: "1.4px",
                    textTransform: "uppercase", color: "#FBBF24",
                    marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px",
                  }}>
                    ⏰ Atenção
                  </div>
                  <div style={{ fontSize: "15px", fontWeight: 500, color: "#fff", marginBottom: "5px", lineHeight: 1.4 }}>
                    Clientes silenciosos se tornam clientes perdidos.
                  </div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.38)", lineHeight: 1.6 }}>
                    O Consultivo Radar identifica quem você não contacta há mais tempo — antes que seja tarde.
                  </div>
                </div>
              </div>

              {/* Métricas */}
              <div style={{ animation: "fadeUp 0.45s ease 0.16s both" }}>
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "1px", background: "rgba(255,255,255,0.07)",
                  borderRadius: "10px", overflow: "hidden",
                }}>
                  {metrics.map(m => (
                    <div key={m.label} style={{ background: "#0A0F1E", padding: "16px 14px" }}>
                      <div style={{ fontSize: "19px", fontWeight: 700, color: "#fff", lineHeight: 1 }}>{m.value}</div>
                      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "5px", lineHeight: 1.4 }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Módulos 2×3 */}
              <div style={{ animation: "fadeUp 0.45s ease 0.24s both" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {features.map(f => {
                    const Icon = f.icon;
                    return (
                      <div
                        key={f.title}
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          border: "0.5px solid rgba(255,255,255,0.06)",
                          borderRadius: "9px", padding: "10px 12px",
                          display: "flex", alignItems: "center", gap: "10px",
                          cursor: "default", transition: "transform 0.15s, border-color 0.15s",
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = "translateX(3px)";
                          e.currentTarget.style.borderColor = "rgba(16,185,129,0.18)";
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = "";
                          e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                        }}
                      >
                        <div style={{
                          width: "28px", height: "28px", borderRadius: "7px",
                          background: "rgba(16,185,129,0.12)", display: "flex",
                          alignItems: "center", justifyContent: "center",
                          color: "#10B981", flexShrink: 0,
                        }}>
                          <Icon size={13} />
                        </div>
                        <div>
                          <div style={{ fontSize: "12px", fontWeight: 500, color: "rgba(255,255,255,0.78)", lineHeight: 1.2 }}>{f.title}</div>
                          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)", marginTop: "2px" }}>{f.sub}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

          {/* ══════════════ LADO DIREITO ══════════════ */}
          <div style={{
            background: "#fff",
            padding: "52px 46px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}>

            {tela === "login" && (
              <div style={{ animation: "fadeUp 0.4s ease both" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "1.4px", textTransform: "uppercase", color: "#10B981", marginBottom: "10px" }}>
                  Acesso seguro
                </div>
                <div style={{ fontSize: "27px", fontWeight: 500, color: "#0F172A", letterSpacing: "-0.5px", marginBottom: "5px" }}>
                  Entre na sua conta
                </div>
                <p style={{ fontSize: "14px", color: "#64748B", marginBottom: "28px" }}>
                  Bem-vindo de volta ao Consultivo Radar
                </p>

                <div style={{ height: "1px", background: "#E8EDF3", marginBottom: "28px" }} />

                <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                  {/* E-mail */}
                  <div style={{ marginBottom: "18px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "7px" }}>
                      E-mail
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      placeholder="seu@email.com"
                      style={inputStyle(emailFocused)}
                    />
                  </div>

                  {/* Senha */}
                  <div style={{ marginBottom: "4px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "7px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>Senha</span>
                      <button
                        type="button"
                        onClick={() => setTela("esqueci")}
                        style={{ fontSize: "12px", color: "#10B981", background: "none", border: "none", cursor: "pointer", fontWeight: 400, letterSpacing: 0, textTransform: "none", padding: 0 }}
                      >
                        Esqueci minha senha
                      </button>
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onFocus={() => setPwdFocused(true)}
                      onBlur={() => setPwdFocused(false)}
                      placeholder="••••••••••"
                      style={inputStyle(pwdFocused)}
                    />
                  </div>

                  {/* Botão */}
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      width: "100%", height: "46px", background: submitting ? "#6EE7B7" : "#10B981",
                      border: "none", borderRadius: "9px", fontSize: "14px", fontWeight: 500,
                      color: "#fff", cursor: submitting ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                      marginTop: "24px", transition: "background 0.15s", letterSpacing: "-0.2px",
                    }}
                    onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = "#059669"; }}
                    onMouseLeave={e => { if (!submitting) e.currentTarget.style.background = "#10B981"; }}
                  >
                    {submitting
                      ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Entrando...</>
                      : <><ArrowRight size={16} /> Entrar no sistema</>
                    }
                  </button>
                </form>

                {/* Rodapé de confiança */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginTop: "18px", fontSize: "12px", color: "#94A3B8" }}>
                  <Lock size={12} /> Conexão segura · SSL · Dados criptografados
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginTop: "22px", paddingTop: "20px", borderTop: "1px solid #E8EDF3" }}>
                  {[
                    { icon: Shield,    label: "Dados seguros" },
                    { icon: Cloud,     label: "Cloud hospedado" },
                    { icon: RefreshCw, label: "Sempre atualizado" },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", fontSize: "11px", color: "#94A3B8", textAlign: "center" }}>
                      <Icon size={18} style={{ color: "#10B981" }} />
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tela === "esqueci" && (
              <div style={{ animation: "fadeUp 0.4s ease both" }}>
                <button
                  onClick={() => setTela("login")}
                  style={{ background: "none", border: "none", color: "#10B981", fontSize: "13px", cursor: "pointer", marginBottom: "24px", padding: 0, display: "flex", alignItems: "center", gap: "6px" }}
                >
                  ← Voltar ao login
                </button>
                <div style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "1.4px", textTransform: "uppercase", color: "#10B981", marginBottom: "10px" }}>
                  Recuperar acesso
                </div>
                <div style={{ fontSize: "24px", fontWeight: 500, color: "#0F172A", letterSpacing: "-0.5px", marginBottom: "5px" }}>
                  Esqueceu sua senha?
                </div>
                <p style={{ fontSize: "14px", color: "#64748B", marginBottom: "28px" }}>
                  Informe seu e-mail e enviaremos um link para redefinir sua senha.
                </p>
                <div style={{ height: "1px", background: "#E8EDF3", marginBottom: "28px" }} />
                <form onSubmit={handleEsqueci}>
                  <div style={{ marginBottom: "18px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "7px" }}>E-mail</div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      placeholder="seu@email.com"
                      style={inputStyle(emailFocused)}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      width: "100%", height: "46px", background: submitting ? "#6EE7B7" : "#10B981",
                      border: "none", borderRadius: "9px", fontSize: "14px", fontWeight: 500,
                      color: "#fff", cursor: submitting ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                      transition: "background 0.15s",
                    }}
                  >
                    {submitting
                      ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Enviando...</>
                      : <><ArrowRight size={16} /> Enviar link de recuperação</>
                    }
                  </button>
                </form>
              </div>
            )}

            {tela === "codigo" && (
              <div style={{ animation: "fadeUp 0.4s ease both", textAlign: "center" }}>
                <div style={{ fontSize: "40px", marginBottom: "16px" }}>📬</div>
                <div style={{ fontSize: "22px", fontWeight: 500, color: "#0F172A", marginBottom: "8px" }}>E-mail enviado!</div>
                <p style={{ fontSize: "14px", color: "#64748B", marginBottom: "28px", lineHeight: 1.6 }}>
                  Verifique sua caixa de entrada e clique no link para redefinir sua senha.
                </p>
                <button
                  onClick={() => setTela("login")}
                  style={{
                    width: "100%", height: "46px", background: "#10B981",
                    border: "none", borderRadius: "9px", fontSize: "14px",
                    fontWeight: 500, color: "#fff", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  }}
                >
                  <ArrowRight size={16} /> Voltar ao login
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
