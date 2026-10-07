"use client";
import { Building2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppState } from "@/components/providers/app-state";
import { cn } from "@/lib/utils";

export function TenantSwitcher({ className }: { className?: string }) {
  const { companies, companyId, setCompanyId, jobs, jobId, setJobId } = useAppState();
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select value={companyId} onValueChange={setCompanyId}>
        <SelectTrigger className="h-9 w-[150px] font-medium sm:w-[260px]" aria-label="Company">
          <Building2 className="text-muted-foreground size-4 shrink-0" />
          <SelectValue placeholder="Company" />
        </SelectTrigger>
        <SelectContent>
          {companies.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <span className="sm:hidden">{c.shortName}</span>
              <span className="hidden sm:inline">{c.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {jobs.length ? (
        <Select value={jobId ?? "all"} onValueChange={(v) => setJobId(v === "all" ? undefined : v)}>
          <SelectTrigger className="h-9 w-[124px] sm:w-[240px]" aria-label="Job">
            <SelectValue placeholder="Job" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All jobs</SelectItem>
            {jobs.map((j) => (
              <SelectItem key={j.id} value={j.id}>
                {j.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}
