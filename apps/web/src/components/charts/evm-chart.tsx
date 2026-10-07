"use client";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EvmPoint } from "@evolv/contracts/evm";
import { money, moneyCompact, shortDate, shortDateWeekday } from "@evolv/contracts/format";
import { AXIS_TICK, CHART, tooltipStyle } from "./chart-theme";

const LABEL: Record<string, string> = { pv: "Planned value", ev: "Earned value", ac: "Actual cost" };

/** The S-curve: where the budget said the job would be, what has been earned, and what it cost to get there. */
export function EvmChart({ points, height = 260 }: { points: EvmPoint[]; height?: number }) {
  const step = points.length > 60 ? 14 : points.length > 14 ? 7 : 1;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="date" tickFormatter={shortDate} interval={step - 1} tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis tickFormatter={moneyCompact} tick={AXIS_TICK} axisLine={false} tickLine={false} width={52} />
          <Tooltip {...tooltipStyle} labelFormatter={(l) => shortDateWeekday(String(l))} formatter={(v, name) => [money(Number(v)), LABEL[String(name)] ?? String(name)]} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} formatter={(v) => LABEL[String(v)] ?? String(v)} />
          <Line type="monotone" dataKey="pv" stroke={CHART.ghost} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="ev" stroke={CHART.series1} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }} isAnimationActive={false} />
          <Line type="monotone" dataKey="ac" stroke={CHART.series3} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
