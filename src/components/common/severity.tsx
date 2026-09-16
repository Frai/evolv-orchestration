import { AlertTriangle, Info, OctagonAlert } from "lucide-react";
import type { AlertSeverity } from "@/core/types";
import { cn } from "@/lib/utils";

export const SEVERITY_META: Record<AlertSeverity, { label: string; Icon: typeof Info; className: string; dot: string }> = {
  critical: { label: "Critical", Icon: OctagonAlert, className: "bg-red-50 text-red-800 border-red-200", dot: "bg-red-600" },
  warning: { label: "Warning", Icon: AlertTriangle, className: "bg-amber-50 text-amber-900 border-amber-200", dot: "bg-amber-500" },
  info: { label: "Info", Icon: Info, className: "bg-sky-50 text-sky-900 border-sky-200", dot: "bg-sky-600" },
};

export function SeverityIcon({ severity, className }: { severity: AlertSeverity; className?: string }) {
  const { Icon } = SEVERITY_META[severity];
  return <Icon className={cn("size-4 shrink-0", severity === "critical" ? "text-red-600" : severity === "warning" ? "text-amber-600" : "text-sky-600", className)} aria-label={SEVERITY_META[severity].label} />;
}
