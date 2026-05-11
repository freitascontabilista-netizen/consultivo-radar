import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, FileText, CheckCircle2, CalendarDays, Settings, LogOut,
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
        paddingLeft: isActive ? "9px" : "12px",
        borderLeft: isActive ? "3px solid #1D4ED8" : "3px solid transparent",
        borderRadius: "9px",
        fontSize: "13px",
        fontWeight: isActive ? 600 : 500,
        color: isActive ? "#1D4ED8" : hover ? "#0F172A" : "#475569",
        background: isActive
          ? "linear-gradient(90deg, #EFF6FF, #DBEAFE)"
          : hover ? "#F8FAFC" : "transparent",
        textDecoration: "none",
        transition: "all 0.15s",
        marginBottom: "2px",
      }}
    >
      <span style={{ color: isActive ? "#1D4ED8" : "#94A3B8", display: "flex", flexShrink: 0 }}>
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const userEmail = user?.email ?? "";
  const emailInitials = userEmail
    ? userEmail.split("@")[0].slice(0, 2).toUpperCase()
    : "TF";

  return (
    <aside
      className={`app-sidebar${isOpen ? " open" : ""}`}
      style={{
        position: "fixed",
        top: 0, left: 0,
        width: "240px",
        height: "100vh",
        background: "#fff",
        borderRight: "0.5px solid rgba(15,23,42,0.06)",
        display: "flex",
        flexDirection: "column",
        padding: "16px 12px",
        boxShadow: "1px 0 2px rgba(15,23,42,0.04)",
        zIndex: 50,
        overflowY: "auto",
      }}
    >
      {/* ── Logo header ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: "10px",
        paddingBottom: "16px",
        borderBottom: "0.5px solid #F1F5F9",
        marginBottom: "12px",
        flexShrink: 0,
      }}>
        <div style={{ width: "32px", height: "32px", background: "#10b981", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 800, color: "#fff", flexShrink: 0 }}>F</div>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>Freitas</div>
          <div style={{ fontSize: "10px", color: "#94A3B8", lineHeight: 1.4 }}>CRM Consultivo</div>
        </div>
      </div>

      {/* ── Seção Operação ── */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "10px", fontWeight: 600, color: "#94A3B8", letterSpacing: "0.06em", textTransform: "uppercase" as const, margin: "12px 8px 6px" }}>
          Operação
        </div>
        <NavItem to="/"            icon={<LayoutDashboard size={15} />} label="Dashboard" />
        <NavItem to="/clientes"    icon={<Users size={15} />}            label="Clientes" />
        <NavItem to="/orientacoes" icon={<FileText size={15} />}         label="Orientações" />
        <NavItem to="/followups"   icon={<CheckCircle2 size={15} />}     label="Acompanhamentos" />
        <NavItem to="/agenda"      icon={<CalendarDays size={15} />}     label="Agenda" />

        <div style={{ fontSize: "10px", fontWeight: 600, color: "#94A3B8", letterSpacing: "0.06em", textTransform: "uppercase" as const, margin: "12px 8px 6px" }}>
          Sistema
        </div>
        <NavItem to="/admin" icon={<Settings size={15} />} label="Administração" />
      </div>

      {/* ── Footer: user pill ── */}
      <div style={{ paddingTop: "14px", borderTop: "0.5px solid #F1F5F9", flexShrink: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          background: "#F8FAFC",
          border: "0.5px solid #E2E8F0",
          borderRadius: "999px",
          padding: "5px 10px 5px 5px",
        }}>
          <div style={{
            width: "24px", height: "24px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #1D4ED8, #1E40AF)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "9px", fontWeight: 700, color: "#fff",
            flexShrink: 0,
          }}>
            {emailInitials}
          </div>
          <span style={{
            fontSize: "11px", color: "#374151", fontWeight: 500,
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
              color: "#94A3B8", display: "flex", alignItems: "center",
              padding: "2px", borderRadius: "4px", flexShrink: 0,
              transition: "color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#DC2626")}
            onMouseLeave={e => (e.currentTarget.style.color = "#94A3B8")}
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
