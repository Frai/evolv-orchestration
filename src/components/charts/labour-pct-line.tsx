"use client";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { pct, shortDate, shortDateWeekday } from "@/core/format";
import { AXIS_TICK, CHART, tooltipStyle } from "./chart-theme";

export function LabourPctLine({ points, target, height = 220 }: { points: { date: string; value: number | null }[]; target: number; height?: number }) {
  const data = points.map((p) => ({ date: p.date, value: p.value === null ? null : Math.round(p.value * 1000) / 10 }));
  const step = points.length > 14 ? 5 : 1;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="date" tickFormatter={shortDate} interval={step - 1} tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis tickFormatter={(v) => `${v}%`} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} domain={[0, (max: number) => Math.max(45, Math.ceil(max / 5) * 5)]} />
          <Tooltip {...tooltipStyle} labelFormatter={(l) => shortDateWeekday(String(l))} formatter={(v) => [`${v}%`, "Labour % of sales"]} />
          <ReferenceLine y={target * 100} stroke={CHART.target} strokeDasharray="4 4" label={{ value: `Target ${pct(target, 0)}`, position: "insideBottomLeft", fontSize: 11, fill: CHART.target }} />
          <Line type="monotone" dataKey="value" stroke={CHART.series1} strokeWidth={2} dot={points.length <= 14 ? { r: 3, fill: CHART.series1, strokeWidth: 0 } : false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
