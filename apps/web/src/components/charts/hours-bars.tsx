"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LabourDay } from "@evolv/contracts/types";
import { hours, shortDate, shortDateWeekday } from "@evolv/contracts/format";
import { AXIS_TICK, CHART, tooltipStyle } from "./chart-theme";

export function HoursBars({ days, height = 220 }: { days: LabourDay[]; height?: number }) {
  const data = days.map((d) => ({ date: d.date, scheduled: Math.round(d.scheduledHours), actual: Math.round(d.actualHours) }));
  const step = days.length > 14 ? 5 : 1;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="25%">
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="date" tickFormatter={shortDate} interval={step - 1} tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis tickFormatter={(v) => `${v}h`} tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} />
          <Tooltip {...tooltipStyle} cursor={{ fill: "var(--muted)" }} labelFormatter={(l) => shortDateWeekday(String(l))} formatter={(v, name) => [hours(Number(v)), name === "scheduled" ? "Scheduled" : "Actual"]} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} formatter={(v) => (v === "scheduled" ? "Scheduled" : "Actual")} />
          <Bar dataKey="scheduled" fill={CHART.ghost} maxBarSize={18} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="actual" fill={CHART.series1} maxBarSize={18} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
