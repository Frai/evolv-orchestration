"use client";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { pct, shortDate } from "@/lib/construction/format";
import { AXIS_TICK, CHART, tooltipStyle } from "./chart-theme";

/** Weekly forecast margin with margin-at-award and target reference lines. */
export function MarginLine({ points, original, target, height = 220 }: { points: { week: string; margin: number }[]; original: number; target: number; height?: number }) {
  const data = points.map((p) => ({ week: p.week, value: Math.round(p.margin * 1000) / 10 }));
  const values = data.map((d) => d.value).concat([original * 100, target * 100]);
  const lo = Math.floor(Math.min(...values) - 1);
  const hi = Math.ceil(Math.max(...values) + 1);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="week" tickFormatter={shortDate} tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis tickFormatter={(v) => `${v}%`} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} domain={[lo, hi]} allowDecimals={false} />
          <Tooltip {...tooltipStyle} labelFormatter={(l) => `Week of ${shortDate(String(l))}`} formatter={(v) => [`${v}%`, "Forecast margin"]} />
          <ReferenceLine y={original * 100} stroke={CHART.ghost} strokeDasharray="4 4" label={{ value: `At award ${pct(original)}`, position: "insideTopRight", fontSize: 11, fill: CHART.axis }} />
          <ReferenceLine y={target * 100} stroke={CHART.target} strokeDasharray="2 4" label={{ value: `Target ${pct(target)}`, position: "insideBottomLeft", fontSize: 11, fill: CHART.target }} />
          <Line type="monotone" dataKey="value" stroke={CHART.series1} strokeWidth={2.25} dot={{ r: 2.5, fill: CHART.series1, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
