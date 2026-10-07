export const CHART = {
  series1: "var(--chart-1)",
  series2: "var(--chart-2)",
  series3: "var(--chart-3)",
  series4: "var(--chart-4)",
  ghost: "var(--chart-ghost)",
  grid: "oklch(0.93 0.004 80)",
  axis: "oklch(0.55 0.01 60)",
  target: "oklch(0.55 0.2 27)",
};

export const AXIS_TICK = { fontSize: 11, fill: CHART.axis } as const;

export const tooltipStyle = {
  contentStyle: {
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--card)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
    fontSize: 12,
    padding: "8px 10px",
  },
  labelStyle: { color: "var(--muted-foreground)", marginBottom: 4 },
  itemStyle: { padding: 0, color: "var(--foreground)" },
  cursor: { stroke: CHART.axis, strokeWidth: 1, strokeOpacity: 0.4 },
} as const;
