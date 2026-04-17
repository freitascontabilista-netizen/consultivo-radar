import { cn } from "@/lib/utils";
import type { SemaforoStatus } from "@/lib/supabase";

const config: Record<SemaforoStatus, { label: string; classes: string; dot: string }> = {
  critico: {
    label: "Crítico",
    classes: "bg-status-critical-soft text-status-critical",
    dot: "bg-status-critical",
  },
  atencao: {
    label: "Em atenção",
    classes: "bg-status-warning-soft text-status-warning",
    dot: "bg-status-warning",
  },
  verde: {
    label: "Em dia",
    classes: "bg-status-success-soft text-status-success",
    dot: "bg-status-success",
  },
};

export function StatusBadge({ status, className }: { status: SemaforoStatus; className?: string }) {
  const c = config[status] ?? config.verde;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        c.classes,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {c.label}
    </span>
  );
}
