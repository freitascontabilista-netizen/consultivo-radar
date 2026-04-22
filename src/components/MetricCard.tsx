import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface MetricCardProps {
  label: string;
  value: number | string;
  tone?: "default" | "critical" | "warning" | "success";
  loading?: boolean;
  icon?: ReactNode;
  accentColor?: string;
}

const tones: Record<NonNullable<MetricCardProps["tone"]>, { dot: string; value: string }> = {
  default:  { dot: "bg-muted-foreground/40", value: "text-foreground" },
  critical: { dot: "bg-red-500",             value: "text-red-600"    },
  warning:  { dot: "bg-orange-400",          value: "text-orange-500" },
  success:  { dot: "bg-green-600",           value: "text-green-600"  },
};

export function MetricCard({ label, value, tone = "default", loading, icon, accentColor }: MetricCardProps) {
  const t = tones[tone];
  return (
    <Card
      className="border-border/60 shadow-none transition-shadow hover:shadow-md"
      style={accentColor ? { borderTop: `3px solid ${accentColor}` } : undefined}
    >
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon
            ? <span style={{ color: accentColor, display: "flex", alignItems: "center" }}>{icon}</span>
            : <span className={cn("h-2 w-2 rounded-full flex-shrink-0", t.dot)} />
          }
          <span>{label}</span>
        </div>
        <div className={cn("mt-3 text-3xl font-semibold tracking-tight tabular-nums", t.value)}>
          {loading ? <span className="inline-block h-8 w-16 animate-pulse rounded bg-muted" /> : value}
        </div>
      </CardContent>
    </Card>
  );
}
