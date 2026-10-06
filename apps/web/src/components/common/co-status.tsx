import type { ChangeOrderStatus } from "@/lib/construction/types";
import { cn } from "@/lib/utils";

export const CO_STAGES: { id: ChangeOrderStatus; label: string; className: string }[] = [
  { id: "unpriced", label: "Unpriced", className: "bg-red-50 text-red-800" },
  { id: "pricing", label: "Pricing", className: "bg-amber-50 text-amber-900" },
  { id: "submitted", label: "Submitted", className: "bg-sky-50 text-sky-900" },
  { id: "approved", label: "Approved", className: "bg-emerald-50 text-emerald-800" },
  { id: "billed", label: "Billed", className: "bg-muted text-muted-foreground" },
];

export function CoStatus({ status, className }: { status: ChangeOrderStatus; className?: string }) {
  const s = CO_STAGES.find((x) => x.id === status) ?? { label: "Rejected", className: "bg-muted text-muted-foreground" };
  return <span className={cn("inline-flex w-fit shrink-0 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", s.className, className)}>{s.label}</span>;
}
