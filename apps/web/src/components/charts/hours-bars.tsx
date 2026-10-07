"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { WeekHours } from "@evolv/contracts/labour";
import { int, shortDate } from "@evolv/contracts/format";
import { AXIS_TICK, CHART, tooltipStyle } from "./chart-theme";

const LABEL: Record<string, string> = { regular: "Regular hours", overtime: "Overtime hours" };

export function HoursBars({ weeks, height = 240 }: { weeks: WeekHours[]; height?: number }) {
  const data = weeks.map((w) => ({ weekStart: w.weekStart, regular: Math.round(w.regular), overtime: Math.round(w.overtime) }));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="weekStart" tickFormatter={(d) => `Wk ${shortDate(String(d))}`} tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={16} />
          <YAxis tickFormatter={(v) => int(Number(v))} tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} />
          <Tooltip {...tooltipStyle} cursor={{ fill: "var(--muted)" }} labelFormatter={(l) => `Week of ${shortDate(String(l))}`} formatter={(v, name) => [`${int(Number(v))} h`, LABEL[String(name)] ?? String(name)]} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} formatter={(v) => LABEL[String(v)] ?? String(v)} />
          <Bar dataKey="regular" stackId="h" fill={CHART.series1} maxBarSize={36} isAnimationActive={false} />
          <Bar dataKey="overtime" stackId="h" fill={CHART.series3} maxBarSize={36} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
