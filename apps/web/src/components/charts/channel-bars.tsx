"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHANNELS, CHANNEL_LABEL, type Channel, type SalesDay } from "@evolv/contracts/types";
import { money, moneyCompact, shortDate } from "@evolv/contracts/format";
import { AXIS_TICK, CHART, tooltipStyle } from "./chart-theme";

const COLOR: Record<Channel, string> = { dine_in: CHART.series1, takeout: CHART.series2, delivery: CHART.series3, room_service: CHART.series4 };

/** Stacked by day (≤ 30 days) or by week (90 days). Channels with no sales are dropped. */
export function ChannelBars({ days, height = 240 }: { days: SalesDay[]; height?: number }) {
  const weekly = days.length > 31;
  const buckets: { label: string; values: Record<Channel, number> }[] = [];
  if (weekly) {
    for (let i = 0; i < days.length; i += 7) {
      const chunk = days.slice(i, i + 7);
      const values = Object.fromEntries(CHANNELS.map((c) => [c, chunk.reduce((a, d) => a + d.channels[c], 0)])) as Record<Channel, number>;
      buckets.push({ label: `${shortDate(chunk[0].date)}`, values });
    }
  } else {
    for (const d of days) buckets.push({ label: shortDate(d.date), values: d.channels });
  }
  const active = CHANNELS.filter((c) => buckets.some((b) => b.values[c] > 0));
  const data = buckets.map((b) => ({ label: b.label, ...b.values }));
  const step = weekly ? 1 : days.length > 14 ? 5 : 1;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="label" tick={AXIS_TICK} interval={step - 1} axisLine={false} tickLine={false} minTickGap={20} />
          <YAxis tickFormatter={moneyCompact} tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} />
          <Tooltip {...tooltipStyle} cursor={{ fill: "var(--muted)" }} formatter={(v, name) => [money(Number(v)), CHANNEL_LABEL[name as Channel]]} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} formatter={(v) => CHANNEL_LABEL[v as Channel]} />
          {active.map((c, i) => (
            <Bar key={c} dataKey={c} stackId="a" fill={COLOR[c]} stroke="var(--card)" strokeWidth={1} maxBarSize={24} radius={i === active.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
