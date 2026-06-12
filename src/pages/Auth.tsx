import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRight, Shield, Cloud, RefreshCw, Lock, Mail } from "lucide-react";

type Tela = "login" | "esqueci" | "codigo";

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

  const inputStyle = (focused: boolean): React.CSSProperties => ({
    width: "100%",
    height: "50px",
    background: focused ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.05)",
    border: `1px solid ${focused ? "rgba(59,130,246,0.5)" : "rgba(255,255,255,0.10)"}`,
    boxShadow: focused ? "0 0 0 3px rgba(59,130,246,0.15)" : "none",
    borderRadius: "12px",
    padding: "0 16px 0 44px",
    fontSize: "15px",
    color: "#fff",
    outline: "none",
    fontFamily: "inherit",
    transition: "border-color 0.15s, box-shadow 0.15s, background 0.15s",
    boxSizing: "border-box" as const,
  });

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes orbit {
          from { transform: rotate(0deg) translateX(160px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(160px) rotate(-360deg); }
        }
        @keyframes orbitReverse {
          from { transform: rotate(0deg) translateX(110px) rotate(0deg); }
          to   { transform: rotate(-360deg) translateX(110px) rotate(360deg); }
        }
        @keyframes orbitSlow {
          from { transform: rotate(0deg) translateX(200px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(200px) rotate(-360deg); }
        }
        @keyframes spin-loader {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow: hidden; }
        .btn-primary:hover {
          background: linear-gradient(135deg, #1D4ED8, #1E40AF) !important;
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(37,99,235,0.5) !important;
        }
        .btn-primary:active { transform: translateY(0); }
        @media (max-width: 960px) {
          .auth-left { display: none !important; }
          .auth-right { width: 100% !important; }
        }
      `}</style>

      <div style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: "#0B1628",
      }}>

        {/* ══════ LADO ESQUERDO ══════ */}
        <div className="auth-left" style={{
          flex: 1,
          background: "linear-gradient(145deg, #0B1628 0%, #0F1E40 50%, #0B1E30 100%)",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          padding: "44px 52px",
        }}>

          {/* Elemento orbital decorativo */}
          <div style={{ position: "absolute", right: "-100px", top: "50%", transform: "translateY(-50%)", width: "500px", height: "500px", pointerEvents: "none" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid rgba(59,130,246,0.12)" }} />
            <div style={{ position: "absolute", inset: "40px", borderRadius: "50%", border: "1px solid rgba(59,130,246,0.10)" }} />
            <div style={{ position: "absolute", inset: "80px", borderRadius: "50%", border: "1px solid rgba(59,130,246,0.08)" }} />
            <div style={{ position: "absolute", inset: "120px", borderRadius: "50%", border: "1px solid rgba(59,130,246,0.15)" }} />
            <div style={{ position: "absolute", inset: "160px", borderRadius: "50%", border: "1px solid rgba(59,130,246,0.12)" }} />
            <div style={{ position: "absolute", inset: "180px", borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)" }} />
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "12px", height: "12px", borderRadius: "50%", background: "#3B82F6", boxShadow: "0 0 20px rgba(59,130,246,0.6)" }} />
            <div style={{ position: "absolute", top: "50%", left: "50%", width: 0, height: 0 }}>
              <div style={{ position: "absolute", transform: "translateX(160px)", width: "8px", height: "8px", borderRadius: "50%", background: "#60A5FA", marginTop: "-4px", marginLeft: "-4px", boxShadow: "0 0 10px rgba(96,165,250,0.5)", animation: "orbit 8s linear infinite" }} />
            </div>
            <div style={{ position: "absolute", top: "50%", left: "50%", width: 0, height: 0 }}>
              <div style={{ position: "absolute", transform: "rotate(120deg) translateX(110px)", width: "6px", height: "6px", borderRadius: "50%", background: "#93C5FD", marginTop: "-3px", marginLeft: "-3px", animation: "orbitReverse 6s linear infinite" }} />
            </div>
            <div style={{ position: "absolute", top: "50%", left: "50%", width: 0, height: 0 }}>
              <div style={{ position: "absolute", transform: "rotate(240deg) translateX(200px)", width: "5px", height: "5px", borderRadius: "50%", background: "#BFDBFE", marginTop: "-2.5px", marginLeft: "-2.5px", animation: "orbitSlow 14s linear infinite reverse" }} />
            </div>
          </div>

          {/* Grid de pontos */}
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" }} />
          {/* Glow inferior esquerdo */}
          <div style={{ position: "absolute", bottom: "-80px", left: "-80px", width: "350px", height: "350px", background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", position: "relative", animation: "fadeUp 0.35s ease both", flexShrink: 0 }}>
            <div style={{ width: "40px", height: "40px", background: "linear-gradient(135deg, #2563EB, #1D4ED8)", borderRadius: "11px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 700, color: "#fff", boxShadow: "0 4px 16px rgba(37,99,235,0.5)" }}>F</div>
            <span style={{ fontSize: "16px", fontWeight: 600, color: "#fff", letterSpacing: "-0.3px" }}>Consultivo Radar</span>
            <div style={{ marginLeft: "8px", display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(37,99,235,0.15)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: "20px", padding: "4px 12px", fontSize: "11px", color: "#60A5FA" }}>
              <span style={{ width: "6px", height: "6px", background: "#3B82F6", borderRadius: "50%", animation: "pulse-dot 2s ease infinite", display: "inline-block" }} />
              Todos os sistemas operacionais
            </div>
          </div>

          {/* Centro */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", gap: "28px", maxWidth: "520px" }}>

            {/* Eyebrow */}
            <div style={{ animation: "fadeUp 0.4s ease 0.06s both" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ width: "28px", height: "1px", background: "rgba(255,255,255,0.15)", display: "block" }} />
                Para contadores consultores
              </span>
            </div>

            {/* Headline */}
            <div style={{ animation: "fadeUp 0.4s ease 0.10s both" }}>
              <h1 style={{ fontSize: "clamp(28px, 2.8vw, 44px)", fontWeight: 700, color: "#fff", lineHeight: 1.14, letterSpacing: "-1.2px", marginBottom: "16px" }}>
                Seu cliente merece<br />
                um contador que<br />
                <span style={{ color: "#3B82F6" }}>está sempre presente.</span>
              </h1>
              <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.5)", lineHeight: 1.75, maxWidth: "400px" }}>
                O Consultivo Radar mostra exatamente quando cada cliente precisa de você — antes que ele perceba que está sendo esquecido.
              </p>
            </div>

            {/* Cards de destaque */}
            <div style={{ animation: "fadeUp 0.4s ease 0.16s both", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              {[
                { icon: "⏰", title: "Último contato", desc: "Saiba há quantos dias você não fala com cada cliente" },
                { icon: "🎯", title: "Alertas proativos", desc: "Notificações antes que o cliente perceba o silêncio" },
                { icon: "📈", title: "Zero perdas", desc: "Carteira 100% saudável, sem clientes esquecidos" },
              ].map(c => (
                <div key={c.title} style={{ background: "rgba(37,99,235,0.10)", border: "1px solid rgba(59,130,246,0.18)", borderRadius: "12px", padding: "16px 14px" }}>
                  <div style={{ fontSize: "22px", marginBottom: "8px" }}>{c.icon}</div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#fff", marginBottom: "4px" }}>{c.title}</div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", lineHeight: 1.55 }}>{c.desc}</div>
                </div>
              ))}
            </div>

            {/* Alerta */}
            <div style={{ animation: "fadeUp 0.4s ease 0.20s both" }}>
              <div style={{ background: "rgba(234,179,8,0.07)", border: "1px solid rgba(234,179,8,0.20)", borderLeft: "3px solid #EAB308", borderRadius: "10px", padding: "14px 18px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase" as const, color: "#EAB308", marginBottom: "6px" }}>⚠ Atenção</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#fff", marginBottom: "4px" }}>Quando foi a última vez que você ligou para seu cliente?</div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>Clientes silenciosos se tornam clientes perdidos. O Radar identifica quem você esqueceu — antes que seja tarde.</div>
              </div>
            </div>
          </div>

          {/* Stats rodapé */}
          <div style={{ display: "flex", position: "relative", animation: "fadeUp 0.4s ease 0.26s both", flexShrink: 0, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", overflow: "hidden" }}>
            {[
              { v: "100%", l: "Clientes acompanhados" },
              { v: "0", l: "Perdas registradas" },
              { v: "24/7", l: "Acesso ao radar" },
            ].map((s, i) => (
              <div key={s.l} style={{ flex: 1, padding: "16px 20px", textAlign: "center" as const, borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
                <div style={{ fontSize: "22px", fontWeight: 700, color: "#fff", letterSpacing: "-0.5px" }}>{s.v}</div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "3px" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ══════ LADO DIREITO ══════ */}
        <div className="auth-right" style={{
          width: "480px",
          flexShrink: 0,
          background: "#111E38",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "56px 48px",
          borderLeft: "1px solid rgba(255,255,255,0.06)",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Glows decorativos */}
          <div style={{ position: "absolute", top: "-60px", right: "-60px", width: "200px", height: "200px", borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "-40px", left: "-40px", width: "150px", height: "150px", borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />

          {tela === "login" && (
            <div style={{ position: "relative", animation: "fadeUp 0.4s ease both" }}>
              <div style={{ marginBottom: "32px" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(37,99,235,0.15)", border: "1px solid rgba(59,130,246,0.20)", borderRadius: "20px", padding: "4px 12px", fontSize: "11px", color: "#60A5FA", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" as const, marginBottom: "16px" }}>
                  <span style={{ width: "5px", height: "5px", background: "#3B82F6", borderRadius: "50%", display: "inline-block" }} />
                  Acesso seguro
                </div>
                <h2 style={{ fontSize: "28px", fontWeight: 700, color: "#fff", letterSpacing: "-0.6px", marginBottom: "6px" }}>Entre na sua conta</h2>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.38)" }}>Bem-vindo de volta ao Consultivo Radar</p>
              </div>

              <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "28px" }} />

              <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.8px", textTransform: "uppercase" as const, marginBottom: "8px" }}>E-mail</label>
                  <div style={{ position: "relative" }}>
                    <Mail size={15} style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: emailFocused ? "#60A5FA" : "rgba(255,255,255,0.25)", transition: "color 0.15s" }} />
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
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.8px", textTransform: "uppercase" as const }}>Senha</label>
                    <button type="button" onClick={() => setTela("esqueci")} style={{ fontSize: "12px", color: "#60A5FA", background: "none", border: "none", cursor: "pointer", fontWeight: 500, padding: 0 }}>
                      Esqueci minha senha
                    </button>
                  </div>
                  <div style={{ position: "relative" }}>
                    <Lock size={15} style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: pwdFocused ? "#60A5FA" : "rgba(255,255,255,0.25)", transition: "color 0.15s" }} />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onFocus={() => setPwdFocused(true)}
                      onBlur={() => setPwdFocused(false)}
                      placeholder="••••••••••••"
                      style={inputStyle(pwdFocused)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                  style={{ width: "100%", height: "52px", background: "linear-gradient(135deg, #2563EB, #1D4ED8)", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 700, color: "#fff", cursor: submitting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginTop: "6px", boxShadow: "0 4px 24px rgba(37,99,235,0.4)", transition: "all 0.2s ease", opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting
                    ? <><Loader2 size={17} style={{ animation: "spin-loader 1s linear infinite" }} /> Entrando...</>
                    : <><ArrowRight size={17} /> Entrar no sistema</>
                  }
                </button>
              </form>

              <div style={{ marginTop: "28px", paddingTop: "24px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "12px", color: "rgba(255,255,255,0.2)", marginBottom: "18px" }}>
                  <Lock size={11} /> Conexão segura · SSL · Dados criptografados
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                  {[
                    { icon: Shield, label: "Dados seguros" },
                    { icon: Cloud, label: "Cloud hospedado" },
                    { icon: RefreshCw, label: "Sempre atualizado" },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", fontSize: "11px", color: "rgba(255,255,255,0.25)", textAlign: "center" }}>
                      <div style={{ width: "34px", height: "34px", background: "rgba(37,99,235,0.12)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon size={15} style={{ color: "#3B82F6" }} />
                      </div>
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tela === "esqueci" && (
            <div style={{ position: "relative", animation: "fadeUp 0.4s ease both" }}>
              <button onClick={() => setTela("login")} style={{ background: "none", border: "none", color: "#60A5FA", fontSize: "13px", cursor: "pointer", marginBottom: "28px", padding: 0, display: "flex", alignItems: "center", gap: "6px", fontWeight: 500 }}>
                ← Voltar ao login
              </button>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(37,99,235,0.15)", border: "1px solid rgba(59,130,246,0.20)", borderRadius: "20px", padding: "4px 12px", fontSize: "11px", color: "#60A5FA", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" as const, marginBottom: "16px" }}>
                Recuperar acesso
              </div>
              <h2 style={{ fontSize: "26px", fontWeight: 700, color: "#fff", letterSpacing: "-0.5px", marginBottom: "6px" }}>Esqueceu sua senha?</h2>
              <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.38)", marginBottom: "28px" }}>Informe seu e-mail para receber o link de redefinição.</p>
              <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "28px" }} />
              <form onSubmit={handleEsqueci} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.8px", textTransform: "uppercase" as const, marginBottom: "8px" }}>E-mail</label>
                  <div style={{ position: "relative" }}>
                    <Mail size={15} style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.25)" }} />
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" style={inputStyle(false)} />
                  </div>
                </div>
                <button type="submit" disabled={submitting} className="btn-primary" style={{ width: "100%", height: "52px", background: "linear-gradient(135deg, #2563EB, #1D4ED8)", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 700, color: "#fff", cursor: submitting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", boxShadow: "0 4px 24px rgba(37,99,235,0.4)", transition: "all 0.2s ease", opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? <><Loader2 size={17} style={{ animation: "spin-loader 1s linear infinite" }} /> Enviando...</> : <><ArrowRight size={17} /> Enviar link de recuperação</>}
                </button>
              </form>
            </div>
          )}

          {tela === "codigo" && (
            <div style={{ position: "relative", animation: "fadeUp 0.4s ease both", textAlign: "center" }}>
              <div style={{ width: "68px", height: "68px", background: "rgba(37,99,235,0.15)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: "18px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: "30px" }}>📬</div>
              <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#fff", marginBottom: "10px" }}>E-mail enviado!</h2>
              <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.38)", marginBottom: "28px", lineHeight: 1.65 }}>Verifique sua caixa de entrada e clique no link para redefinir sua senha.</p>
              <button onClick={() => setTela("login")} className="btn-primary" style={{ width: "100%", height: "52px", background: "linear-gradient(135deg, #2563EB, #1D4ED8)", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 700, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", boxShadow: "0 4px 24px rgba(37,99,235,0.4)", transition: "all 0.2s ease" }}>
                <ArrowRight size={17} /> Voltar ao login
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
