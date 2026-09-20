"use client";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SalesDay } from "@evolv/contracts/types";
import { hourLabel } from "@evolv/contracts/dates";
import { KITCHEN_RULES } from "@evolv/contracts/kitchen";
import { int } from "@evolv/contracts/format";
import { AXIS_TICK, CHART, tooltipStyle } from "./chart-theme";

/** Tickets by hour for a single day, against the kitchen's comfortable pace. Trims hours with no activity. */
export function KitchenLoadChart({ day, capacity, height = 220 }: { day: SalesDay; capacity: number; height?: number }) {
  let first = 0;
  let last = day.hourlyOrders.length - 1;
  while (first < last && day.hourlyOrders[first] === 0) first++;
  while (last > first && day.hourlyOrders[last] === 0) last--;
  const data = day.hourlyOrders.slice(first, last + 1).map((orders, i) => ({
    hour: hourLabel(first + i),
    orders,
    ratio: capacity ? orders / capacity : 0,
  }));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="hour" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={16} />
          <YAxis tickFormatter={(v) => `${v}`} tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
          <Tooltip
            {...tooltipStyle}
            formatter={(v, name, p) => [`${v} tickets (${Math.round((p.payload as { ratio: number }).ratio * 100)}% of pace)`, name]}
            labelFormatter={(l) => `${l} hour`}
          />
          <ReferenceLine
            y={capacity}
            stroke={CHART.target}
            strokeDasharray="4 4"
            label={{ value: `Comfortable pace, ${int(capacity)}/hr`, position: "insideTopRight", fontSize: 11, fill: CHART.target }}
          />
          <Bar dataKey="orders" name="Tickets" maxBarSize={28} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.ratio >= KITCHEN_RULES.criticalRatio ? "var(--danger)" : d.ratio >= KITCHEN_RULES.warningRatio ? "var(--warning)" : CHART.series1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
