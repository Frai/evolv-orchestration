"use client";
import { Building2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppState } from "@/components/providers/app-state";
import { cn } from "@/lib/utils";

export function TenantSwitcher({ className }: { className?: string }) {
  const { locations, locationId, setLocationId, location, outletId, setOutletId } = useAppState();
  const outlets = location?.outlets;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select value={locationId} onValueChange={setLocationId}>
        <SelectTrigger className="h-9 w-[150px] font-medium sm:w-[220px]" aria-label="Location">
          <Building2 className="text-muted-foreground size-4 shrink-0" />
          <SelectValue placeholder="Location" />
        </SelectTrigger>
        <SelectContent>
          {locations.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              <span className="sm:hidden">{l.shortName}</span>
              <span className="hidden sm:inline">{l.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {outlets ? (
        <Select value={outletId ?? "all"} onValueChange={(v) => setOutletId(v === "all" ? undefined : v)}>
          <SelectTrigger className="h-9 w-[124px] sm:w-[160px]" aria-label="Outlet">
            <SelectValue placeholder="Outlet" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All outlets</SelectItem>
            {outlets.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}
