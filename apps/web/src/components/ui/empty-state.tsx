import { cn } from "@/lib/utils";

export function EmptyState({ title, description, className }: { title: string; description?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-10 text-center", className)}>
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="text-muted-foreground mt-1 max-w-sm text-sm">{description}</p> : null}
    </div>
  );
}
