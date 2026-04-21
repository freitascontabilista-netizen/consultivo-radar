import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404: rota não encontrada:", location.pathname);
  }, [location.pathname]);

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4ff", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ textAlign: "center", maxWidth: "360px" }}>
        <div style={{ fontSize: "72px", fontWeight: 700, color: "#e2e8f0", lineHeight: 1 }}>404</div>
        <div style={{ fontSize: "18px", fontWeight: 600, color: "#0f172a", marginTop: "12px" }}>Página não encontrada</div>
        <div style={{ fontSize: "13px", color: "#64748b", marginTop: "6px" }}>A rota <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", fontSize: "12px" }}>{location.pathname}</code> não existe.</div>
        <button
          onClick={() => navigate("/")}
          style={{ marginTop: "24px", background: "#0f172a", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 24px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#1e293b")}
          onMouseLeave={e => (e.currentTarget.style.background = "#0f172a")}
        >
          Voltar ao dashboard
        </button>
      </div>
    </div>
  );
}
