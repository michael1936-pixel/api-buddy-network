import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function StatCard({ label, value, subValue, icon: Icon, trend, className }: StatCardProps) {
  return (
    <div className={cn("bg-card rounded-lg border border-border p-4", className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "text-2xl font-semibold font-mono",
            trend === "up" && "text-trading-profit",
            trend === "down" && "text-trading-loss",
            !trend && "text-foreground"
          )}
        >
          {value}
        </span>
        {subValue && (
          <span className="text-xs text-muted-foreground">{subValue}</span>
        )}
      </div>
    </div>
  );
}

export function PnlBadge({ value }: { value: number }) {
  const isPositive = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium",
        isPositive ? "bg-trading-profit/15 text-trading-profit" : "bg-trading-loss/15 text-trading-loss"
      )}
    >
      {isPositive ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}

export function StatusDot({ status }: { status: "online" | "warning" | "error" | "offline" }) {
  const colors = {
    online: "bg-trading-profit",
    warning: "bg-trading-warning",
    error: "bg-trading-loss",
    offline: "bg-muted-foreground",
  };
  return <div className={cn("h-2 w-2 rounded-full", colors[status])} />;
}
