"use client";
import { HOUR_COUNT, HOUR_START } from "@/core/types";
import { WEEKDAY_SHORT } from "@/core/dates";
import { money } from "@/core/format";

/** Day-of-week x hour grid. Single hue, light to dark, by average net sales in that hour. */
export function HourHeatmap({ grid }: { grid: number[][] }) {
  const max = Math.max(1, ...grid.flat());
  const rows = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun
  return (
    <div className="w-full">
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `2.25rem repeat(${HOUR_COUNT}, minmax(0, 1fr))` }}>
        <div />
        {Array.from({ length: HOUR_COUNT }, (_, i) => (
          <div key={i} className="text-muted-foreground tnum text-center text-[10px]">
            {(HOUR_START + i) % 3 === 0 || i === 0 ? `${HOUR_START + i}` : ""}
          </div>
        ))}
        {rows.map((w) => (
          <Row key={w} label={WEEKDAY_SHORT[w]} values={grid[w]} max={max} />
        ))}
      </div>
      <div className="text-muted-foreground mt-2 flex items-center justify-end gap-2 text-[11px]">
        <span>Quiet</span>
        <span className="flex gap-[2px]">
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((o) => (
            <span key={o} className="size-3 rounded-[3px]" style={{ background: CELL, opacity: 0.12 + o * 0.88 }} />
          ))}
        </span>
        <span>Busy</span>
      </div>
    </div>
  );
}

const CELL = "var(--chart-1)";

function Row({ label, values, max }: { label: string; values: number[]; max: number }) {
  return (
    <>
      <div className="text-muted-foreground flex items-center text-[11px]">{label}</div>
      {values.map((v, i) => (
        <div
          key={i}
          className="aspect-square rounded-[3px] md:aspect-auto md:h-7"
          style={{ background: CELL, opacity: v <= 0 ? 0.06 : 0.12 + (v / max) * 0.88 }}
          title={`${label} ${HOUR_START + i}:00 · ${money(v)}`}
          aria-label={`${label} ${HOUR_START + i}:00, ${money(v)}`}
        />
      ))}
    </>
  );
}
