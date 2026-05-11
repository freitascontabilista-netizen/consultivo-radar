import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

type Tela = "carregando" | "formulario" | "sucesso" | "link_invalido";

export default function RedefinirSenha() {
  const navigate = useNavigate();
  const [tela, setTela] = useState<Tela>("carregando");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.title = "Redefinir senha | CRM Consultivo";

    // Verificação imediata via hash da URL
    if (window.location.hash.includes("type=recovery")) {
      setTela("formulario");
    }

    // Escuta evento PASSWORD_RECOVERY do Supabase (dispara após processar o hash)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setTela("formulario");
        if (timerRef.current) clearTimeout(timerRef.current);
      }
    });

    // Se após 2 s nenhum sinal de recovery chegou, o link é inválido/expirado
    timerRef.current = setTimeout(() => {
      setTela(t => t === "carregando" ? "link_invalido" : t);
    }, 2000);

    return () => {
      subscription.unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro("");

    if (novaSenha !== confirmarSenha) {
      setErro("As senhas não coincidem.");
      return;
    }
    if (novaSenha.length < 6) {
      setErro("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setSubmitting(false);

    if (error) {
      setErro(error.message);
      return;
    }

    setTela("sucesso");
    setTimeout(() => navigate("/", { replace: true }), 2000);
  };

  // ── estilos ────────────────────────────────────────────────────────────────

  const s: Record<string, React.CSSProperties> = {
    wrap:  { minHeight: "100vh", background: "#f0f4ff", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" },
    box:   { width: "100%", maxWidth: "400px" },
    logo:  { textAlign: "center", marginBottom: "28px" },
    card:  { background: "#fff", borderRadius: "16px", border: "1px solid #e8eaed", padding: "32px" },
    title: { fontSize: "18px", fontWeight: 600, color: "#0f172a", marginBottom: "6px", textAlign: "center" },
    sub:   { fontSize: "13px", color: "#64748b", marginBottom: "24px", textAlign: "center" },
    label: { display: "block", fontSize: "12px", fontWeight: 500, color: "#374151", marginBottom: "6px" },
    input: { width: "100%", height: "40px", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0 12px", fontSize: "13px", color: "#0f172a", outline: "none", marginBottom: "16px", boxSizing: "border-box" },
    btn:   { width: "100%", height: "42px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "4px" },
    erro:  { fontSize: "12px", color: "#ef4444", marginTop: "-10px", marginBottom: "12px" },
  };

  return (
    <div style={s.wrap}>
      <div style={s.box}>

        {/* Logo */}
        <div style={s.logo}>
          <img src="/logo_freitas.png" alt="Freitas" style={{ height: "60px", objectFit: "contain" }} />
          <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "6px" }}>CRM Consultivo</p>
        </div>

        <div style={s.card}>

          {/* ── CARREGANDO ── */}
          {tela === "carregando" && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <Loader2 style={{ width: "28px", height: "28px", color: "#1D4ED8", margin: "0 auto 12px", animation: "spin 1s linear infinite" }} />
              <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>Verificando link de recuperação…</p>
            </div>
          )}

          {/* ── FORMULÁRIO ── */}
          {tela === "formulario" && (
            <form onSubmit={handleSubmit}>
              <div style={s.title}>Criar nova senha</div>
              <div style={s.sub}>Escolha uma senha segura com pelo menos 6 caracteres.</div>

              <label style={s.label}>Nova senha</label>
              <input
                style={s.input}
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />

              <label style={s.label}>Confirmar nova senha</label>
              <input
                style={{
                  ...s.input,
                  borderColor: confirmarSenha && novaSenha !== confirmarSenha ? "#ef4444" : "#e2e8f0",
                }}
                type="password"
                required
                autoComplete="new-password"
                value={confirmarSenha}
                onChange={e => setConfirmarSenha(e.target.value)}
                placeholder="Repita a senha"
              />

              {confirmarSenha && novaSenha !== confirmarSenha && (
                <div style={s.erro}>As senhas não coincidem.</div>
              )}

              {erro && <div style={s.erro}>{erro}</div>}

              <button
                type="submit"
                disabled={submitting || (!!confirmarSenha && novaSenha !== confirmarSenha)}
                style={{ ...s.btn, opacity: submitting ? 0.7 : 1 }}
                onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = "#1E40AF"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#1D4ED8"; }}
              >
                {submitting && <Loader2 style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />}
                Salvar nova senha
              </button>
            </form>
          )}

          {/* ── SUCESSO ── */}
          {tela === "sucesso" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>✅</div>
              <div style={s.title}>Senha alterada com sucesso!</div>
              <p style={{ fontSize: "13px", color: "#64748b", margin: "8px 0 0" }}>
                Redirecionando para o sistema…
              </p>
            </div>
          )}

          {/* ── LINK INVÁLIDO ── */}
          {tela === "link_invalido" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>⚠️</div>
              <div style={s.title}>Link inválido ou expirado</div>
              <p style={{ fontSize: "13px", color: "#64748b", margin: "8px 0 24px" }}>
                Este link de recuperação não é mais válido. Solicite um novo link de redefinição de senha.
              </p>
              <button
                type="button"
                onClick={() => navigate("/auth", { replace: true })}
                style={s.btn}
              >
                Ir para o login
              </button>
            </div>
          )}

        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
