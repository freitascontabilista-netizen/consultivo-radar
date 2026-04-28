import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Menu, X } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F4F5F7" }}>
      {/* Desktop sidebar */}
      <div className="sidebar-desktop">
        <Sidebar isOpen={true} onClose={() => {}} />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(15,23,42,0.35)",
            zIndex: 49,
          }}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className="sidebar-mobile"
        style={{
          transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.2s ease",
          position: "fixed", top: 0, left: 0,
          zIndex: 50,
        }}
      >
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          marginLeft: 0,
          minWidth: 0,
          overflowY: "auto",
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}
        className="main-content"
      >
        {/* Mobile hamburger bar */}
        <div className="mobile-topbar" style={{
          display: "none",
          alignItems: "center",
          height: "50px",
          padding: "0 16px",
          background: "#fff",
          borderBottom: "0.5px solid rgba(15,23,42,0.06)",
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#475569", display: "flex", alignItems: "center",
              padding: "4px",
            }}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <img src="/logo_freitas.png" alt="Freitas" style={{ height: "22px", objectFit: "contain", marginLeft: "12px" }} />
        </div>

        {children}
      </main>

      <style>{`
        @media (min-width: 768px) {
          .sidebar-desktop { display: block; }
          .sidebar-mobile  { display: none !important; }
          .mobile-topbar   { display: none !important; }
          .main-content    { margin-left: 240px; }
        }
        @media (max-width: 767px) {
          .sidebar-desktop { display: none; }
          .sidebar-mobile  { display: block; }
          .mobile-topbar   { display: flex !important; }
          .main-content    { margin-left: 0; }
        }
      `}</style>
    </div>
  );
}
