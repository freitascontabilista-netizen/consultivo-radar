import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, FileText, CheckCircle2, CalendarDays, BarChart3, Settings, LogOut,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function NavItem({
  to,
  icon,
  label,
  badge,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  const { pathname } = useLocation();
  const [hover, setHover] = useState(false);
  const isActive = to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");

  return (
    <Link
      to={to}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "9px 12px",
        borderRadius: "10px",
        fontSize: "13px",
        fontWeight: isActive ? 600 : 500,
        color: isActive ? "#fff" : hover ? "#fff" : "rgba(255,255,255,0.55)",
        background: isActive
          ? "linear-gradient(135deg, #2563EB, #1D4ED8)"
          : hover ? "rgba(255,255,255,0.07)" : "transparent",
        textDecoration: "none",
        transition: "all 0.15s",
        marginBottom: "2px",
        boxShadow: isActive ? "0 4px 12px rgba(37,99,235,0.35)" : "none",
      }}
    >
      <span style={{
        color: isActive ? "#fff" : hover ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.35)",
        display: "flex",
        flexShrink: 0,
        transition: "color 0.15s",
      }}>
        {icon}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span style={{
          fontSize: "10px", fontWeight: 700,
          background: "#EF4444", color: "#fff",
          borderRadius: "999px", padding: "1px 6px",
          minWidth: "18px", textAlign: "center" as const,
        }}>
          {badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, perfil } = useAuth();
  const navigate = useNavigate();
  const userEmail = user?.email ?? "";
  const emailInitials = userEmail
    ? userEmail.split("@")[0].slice(0, 2).toUpperCase()
    : "TF";

  return (
    <>
      <style>{`
        @keyframes pulse-sidebar {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.85); }
        }
        .app-sidebar::-webkit-scrollbar { width: 0px; }
      `}</style>

      <aside
        className={`app-sidebar${isOpen ? " open" : ""}`}
        style={{
          position: "fixed",
          top: 0, left: 0,
          width: "240px",
          height: "100vh",
          background: "linear-gradient(160deg, #0B1628 0%, #0F1E40 60%, #0B1E30 100%)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: "column",
          padding: "20px 14px",
          zIndex: 50,
          overflowY: "auto",
        }}
      >
        {/* Grid decorativo sutil */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }} />

        {/* Glow decorativo */}
        <div style={{
          position: "absolute", bottom: "-40px", right: "-40px",
          width: "200px", height: "200px", pointerEvents: "none",
          background: "radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)",
        }} />

        {/* ── Logo ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: "10px",
          paddingBottom: "18px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          marginBottom: "8px",
          flexShrink: 0,
          position: "relative",
        }}>
          <div style={{
            width: "34px", height: "34px",
            background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
            borderRadius: "9px",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "15px", fontWeight: 800, color: "#fff",
            flexShrink: 0,
            boxShadow: "0 4px 12px rgba(37,99,235,0.45)",
          }}>F</div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>Freitas</div>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", lineHeight: 1.4 }}>CRM Consultivo</div>
          </div>
          {/* Status dot */}
          <div style={{
            marginLeft: "auto",
            display: "flex", alignItems: "center", gap: "4px",
            background: "rgba(16,185,129,0.12)",
            border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: "20px", padding: "3px 8px",
          }}>
            <span style={{
              width: "5px", height: "5px", borderRadius: "50%",
              background: "#10B981", display: "inline-block",
              animation: "pulse-sidebar 2s ease infinite",
            }} />
            <span style={{ fontSize: "9px", color: "#10B981", fontWeight: 600 }}>ON</span>
          </div>
        </div>

        {/* ── Navegação ── */}
        <div style={{ flex: 1, position: "relative" }}>
          <div style={{
            fontSize: "10px", fontWeight: 600,
            color: "rgba(255,255,255,0.25)",
            letterSpacing: "0.08em", textTransform: "uppercase" as const,
            margin: "10px 10px 8px",
          }}>
            Operação
          </div>

          <NavItem to="/"            icon={<LayoutDashboard size={15} />} label="Dashboard" />
          <NavItem to="/clientes"    icon={<Users size={15} />}           label="Clientes" />
          <NavItem to="/orientacoes" icon={<FileText size={15} />}        label="Orientações" />
          <NavItem to="/followups"   icon={<CheckCircle2 size={15} />}    label="Acompanhamentos" />
          <NavItem to="/relatorios"  icon={<BarChart3 size={15} />}       label="Relatórios" />
          <NavItem to="/agenda"      icon={<CalendarDays size={15} />}    label="Agenda" />

          <div style={{
            fontSize: "10px", fontWeight: 600,
            color: "rgba(255,255,255,0.25)",
            letterSpacing: "0.08em", textTransform: "uppercase" as const,
            margin: "16px 10px 8px",
          }}>
            Sistema
          </div>

          {perfil === "administrador" && (
            <NavItem to="/admin" icon={<Settings size={15} />} label="Administração" />
          )}
        </div>

        {/* ── Footer: user pill ── */}
        <div style={{
          paddingTop: "14px",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          flexShrink: 0,
          position: "relative",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "12px",
            padding: "8px 10px",
          }}>
            <div style={{
              width: "28px", height: "28px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "10px", fontWeight: 700, color: "#fff",
              flexShrink: 0,
              boxShadow: "0 2px 8px rgba(37,99,235,0.4)",
            }}>
              {emailInitials}
            </div>
            <span style={{
              fontSize: "11px", color: "rgba(255,255,255,0.6)", fontWeight: 500,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
              flex: 1,
            }}>
              {userEmail || "Usuário"}
            </span>
            <button
              title="Sair da conta"
              onClick={async () => { await supabase.auth.signOut(); navigate("/auth"); }}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center",
                padding: "4px", borderRadius: "6px", flexShrink: 0,
                transition: "color 0.15s, background 0.15s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = "#F87171";
                e.currentTarget.style.background = "rgba(248,113,113,0.1)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = "rgba(255,255,255,0.3)";
                e.currentTarget.style.background = "none";
              }}
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
