import type { SemaforoStatus } from "@/lib/supabase";

const config: Record<
  SemaforoStatus,
  { label: string; bg: string; color: string; border: string; icon: React.ReactNode }
> = {
  critico: {
    label: "Crítico",
    bg: "#fef2f2",
    color: "#dc2626",
    border: "#fecaca",
    icon: (
      <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
  atencao: {
    label: "Em atenção",
    bg: "#fffbeb",
    color: "#d97706",
    border: "#fde68a",
    icon: (
      <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  verde: {
    label: "Em dia",
    bg: "#f0fdf4",
    color: "#16a34a",
    border: "#bbf7d0",
    icon: (
      <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    ),
  },
};

export function StatusBadge({ status }: { status: SemaforoStatus; className?: string }) {
  const c = config[status] ?? config.verde;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      padding: "4px 10px",
      borderRadius: "20px",
      fontSize: "11px",
      fontWeight: 600,
      background: c.bg,
      color: c.color,
      border: `1px solid ${c.border}`,
      whiteSpace: "nowrap",
      boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
    }}>
      {c.icon}
      {c.label}
    </span>
  );
}
