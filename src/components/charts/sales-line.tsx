"use client";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SalesDay } from "@/core/types";
import { money, moneyCompact, shortDate, shortDateWeekday } from "@/core/format";
import { AXIS_TICK, CHART, tooltipStyle } from "./chart-theme";

export function SalesLine({ days, height = 240 }: { days: SalesDay[]; height?: number }) {
  const data = days.map((d) => ({ date: d.date, net: d.netSales, lastYear: d.lastYearNetSales }));
  const step = days.length > 60 ? 14 : days.length > 14 ? 7 : 1;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="date" tickFormatter={shortDate} interval={step - 1} tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis tickFormatter={moneyCompact} tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} />
          <Tooltip
            {...tooltipStyle}
            labelFormatter={(l) => shortDateWeekday(String(l))}
            formatter={(v, name) => [money(Number(v)), name === "net" ? "Net sales" : "Same day last year"]}
          />
          <Line type="monotone" dataKey="lastYear" stroke={CHART.ghost} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="net" stroke={CHART.series1} strokeWidth={2} dot={days.length <= 14 ? { r: 3, fill: CHART.series1, strokeWidth: 0 } : false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
