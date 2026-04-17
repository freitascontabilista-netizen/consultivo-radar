import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface MetricCardProps {
  label: string;
  value: number | string;
  tone?: "default" | "critical" | "warning" | "success";
  loading?: boolean;
}

const tones: Record<NonNullable<MetricCardProps["tone"]>, { dot: string; value: string; bg: string }> = {
    default: { dot: "bg-muted-foreground/40", value: "text-foreground", bg: "" },
    critical: { dot: "bg-red-500", value: "text-white", bg: "bg-red-500" },
    warning: { dot: "bg-orange-400", value: "text-white", bg: "bg-orange-400" },
    success: { dot: "bg-green-600", value: "text-white", bg: "bg-green-600" },
  };

export function MetricCard({ label, value, tone = "default", loading }: MetricCardProps) {
  const t = tones[tone];
  return (
    <Card className={cn("border-border/60 shadow-none transition-shadow hover:shadow-sm", t.bg)}>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className={cn("h-2 w-2 rounded-full", t.dot)} />
          {label}
        </div>
        <div className={cn("mt-3 text-3xl font-semibold tracking-tight tabular-nums", t.value)}>
          {loading ? <span className="inline-block h-8 w-16 animate-pulse rounded bg-muted" /> : value}
        </div>
      </CardContent>
    </Card>
  );
}
