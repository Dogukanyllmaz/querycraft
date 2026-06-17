import { useMemo, useRef } from 'react'
import {
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { ChartConfig } from '@/services/reports'

// Professional enterprise data-viz palette — WCAG AA contrast, hue-varied, colorblind-safe
const COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#8b5cf6', // violet-500
  '#f59e0b', // amber-500
  '#06b6d4', // cyan-500
  '#f43f5e', // rose-500
  '#84cc16', // lime-500
  '#ec4899', // pink-500
]

const CHART_HEIGHT  = 360
const ANIMATE_LIMIT = 100
const BAR_LIMIT     = 30
const LINE_LIMIT    = 500

const TICK_STYLE = { fontSize: 11, fill: '#94a3b8', fontFamily: 'inherit' }

const GRID_STYLE = {
  strokeDasharray: '0',
  stroke: '#f1f5f9',
  strokeWidth: 1,
}

const TOOLTIP_STYLE: React.CSSProperties = {
  fontSize: 12,
  fontFamily: 'inherit',
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.08)',
  padding: '8px 12px',
  color: '#0f172a',
  backgroundColor: '#ffffff',
}

const LEGEND_STYLE: React.CSSProperties = {
  fontSize: 12,
  color: '#64748b',
  paddingTop: 8,
  fontFamily: 'inherit',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function toNum(v: unknown): number {
  if (typeof v === 'bigint') return Number(v)
  if (typeof v === 'number') return isNaN(v) ? 0 : v
  if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? 0 : n }
  return 0
}

function fmt(v: unknown): string {
  const n = toNum(v)
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function sampleArr<T>(arr: T[], maxLen: number): T[] {
  if (arr.length <= maxLen) return arr
  const step = arr.length / maxLen
  return Array.from({ length: maxLen }, (_, i) => arr[Math.floor(i * step)])
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  chartConfig: ChartConfig
  rows: Record<string, unknown>[]
}

export function ReportChart({ chartConfig, rows }: Props) {
  const { type, xAxis, yAxis } = chartConfig
  const gradId = useRef(`qg${Math.random().toString(36).slice(2, 8)}`).current

  // GROUP BY xAxis, SUM yAxis across ALL rows — preserves insertion order
  const aggBase = useMemo(() => {
    const grouped = new Map<string, number>()
    for (const r of rows) {
      const key = String(r[xAxis] ?? '(empty)')
      grouped.set(key, (grouped.get(key) ?? 0) + toNum(r[yAxis]))
    }
    return Array.from(grouped.entries()).map(([key, val]) => ({
      [xAxis]: key,
      [yAxis]: val,
    }))
  }, [rows, xAxis, yAxis])

  if (!rows.length) return <EmptyChart />

  // ── Bar ─────────────────────────────────────────────────────────────────────
  // Sort by value desc, take top 30, assign a distinct colour per bar
  if (type === 'bar') {
    const barData = [...aggBase]
      .sort((a, b) => toNum(b[yAxis]) - toNum(a[yAxis]))
      .slice(0, BAR_LIMIT)
      .map((d, i) => ({ ...d, fill: COLORS[i % COLORS.length] }))

    const n = barData.length
    const angle  = n > 12 ? -40 : n > 6 ? -25 : 0
    const bottom = angle < -30 ? 76 : angle < -10 ? 58 : 36
    const maxW   = n <= 5 ? 96 : n <= 10 ? 72 : n <= 20 ? 56 : 40
    const animate = n <= ANIMATE_LIMIT

    return (
      <div className="animate-fade-in">
        <DataNote totalRows={rows.length} totalCategories={aggBase.length} shown={n} />
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <BarChart data={barData} margin={{ top: 10, right: 16, left: 0, bottom: bottom }}>
            <CartesianGrid {...GRID_STYLE} vertical={false} />
            <XAxis
              dataKey={xAxis}
              tick={TICK_STYLE}
              angle={angle}
              textAnchor={angle !== 0 ? 'end' : 'middle'}
              interval={0}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              tickFormatter={(v: unknown) => {
                const s = String(v)
                return s.length > 16 ? `${s.slice(0, 14)}…` : s
              }}
            />
            <YAxis
              tick={TICK_STYLE}
              width={64}
              tickFormatter={fmt}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v: unknown) => [fmt(v), yAxis]}
              cursor={{ fill: 'rgba(59,130,246,0.04)' }}
            />
            <Bar
              dataKey={yAxis}
              radius={[5, 5, 0, 0]}
              maxBarSize={maxW}
              isAnimationActive={animate}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // ── Line ─────────────────────────────────────────────────────────────────────
  // Aggregate (preserves order for time-series), sample if > 500 unique x values
  if (type === 'line') {
    const lineData = sampleArr(aggBase, LINE_LIMIT)
    const animate  = lineData.length <= ANIMATE_LIMIT
    const showDots = lineData.length <= 60

    return (
      <div className="animate-fade-in">
        <DataNote totalRows={rows.length} totalCategories={aggBase.length} shown={lineData.length} />
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={lineData} margin={{ top: 10, right: 16, left: 0, bottom: 44 }}>
            <CartesianGrid {...GRID_STYLE} vertical={false} />
            <XAxis
              dataKey={xAxis}
              tick={TICK_STYLE}
              angle={-30}
              textAnchor="end"
              interval="preserveStartEnd"
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              tick={TICK_STYLE}
              width={64}
              tickFormatter={fmt}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v: unknown) => [fmt(v), yAxis]}
              cursor={{ fill: 'rgba(59,130,246,0.04)' }}
            />
            <Legend wrapperStyle={LEGEND_STYLE} />
            <Line
              type="monotone"
              dataKey={yAxis}
              stroke={COLORS[0]}
              strokeWidth={2.5}
              dot={showDots ? { r: 3.5, fill: COLORS[0], strokeWidth: 0 } : false}
              activeDot={{ r: 5, fill: COLORS[0], strokeWidth: 0 }}
              isAnimationActive={animate}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // ── Area ─────────────────────────────────────────────────────────────────────
  if (type === 'area') {
    const areaData = sampleArr(aggBase, LINE_LIMIT)
    const animate  = areaData.length <= ANIMATE_LIMIT

    return (
      <div className="animate-fade-in">
        <DataNote totalRows={rows.length} totalCategories={aggBase.length} shown={areaData.length} />
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <AreaChart data={areaData} margin={{ top: 10, right: 16, left: 0, bottom: 44 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={COLORS[0]} stopOpacity={0.18} />
                <stop offset="100%" stopColor={COLORS[0]} stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid {...GRID_STYLE} vertical={false} />
            <XAxis
              dataKey={xAxis}
              tick={TICK_STYLE}
              angle={-30}
              textAnchor="end"
              interval="preserveStartEnd"
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              tick={TICK_STYLE}
              width={64}
              tickFormatter={fmt}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v: unknown) => [fmt(v), yAxis]}
              cursor={{ fill: 'rgba(59,130,246,0.04)' }}
            />
            <Legend wrapperStyle={LEGEND_STYLE} />
            <Area
              type="monotone"
              dataKey={yAxis}
              stroke={COLORS[0]}
              fill={`url(#${gradId})`}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: COLORS[0], strokeWidth: 0 }}
              isAnimationActive={animate}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // ── Donut / Pie ───────────────────────────────────────────────────────────────
  // Sort desc by value, take top 12, assign colours
  const pieData = [...aggBase]
    .filter((d) => toNum(d[yAxis]) > 0)
    .sort((a, b) => toNum(b[yAxis]) - toNum(a[yAxis]))
    .slice(0, 12)
    .map((d, i) => ({ ...d, fill: COLORS[i % COLORS.length] }))

  if (!pieData.length) return <EmptyChart message="No positive values to display." />

  const animate = pieData.length <= ANIMATE_LIMIT

  return (
    <div className="animate-fade-in">
      <DataNote totalRows={rows.length} totalCategories={aggBase.length} shown={pieData.length} />
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <PieChart>
          <Pie
            data={pieData}
            dataKey={yAxis}
            nameKey={xAxis}
            cx="50%"
            cy="46%"
            innerRadius={80}
            outerRadius={130}
            paddingAngle={2}
            isAnimationActive={animate}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v: unknown) => [fmt(v), yAxis]}
          />
          <Legend
            wrapperStyle={LEGEND_STYLE}
            formatter={(value: string) =>
              value.length > 24 ? `${value.slice(0, 22)}…` : value
            }
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function EmptyChart({ message = 'No data to chart.' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center h-48 rounded-xl bg-slate-50 border border-slate-100">
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  )
}

function DataNote({
  totalRows,
  totalCategories,
  shown,
}: {
  totalRows: number
  totalCategories: number
  shown: number
}) {
  const aggregated = totalCategories < totalRows
  const truncated  = shown < totalCategories
  if (!aggregated && !truncated) return null

  let text: string
  if (truncated && aggregated) {
    text = `Top ${shown.toLocaleString()} of ${totalCategories.toLocaleString()} categories · summed from ${totalRows.toLocaleString()} rows`
  } else if (aggregated) {
    text = `${shown.toLocaleString()} ${shown === 1 ? 'category' : 'categories'} · summed from ${totalRows.toLocaleString()} rows`
  } else {
    text = `Showing ${shown.toLocaleString()} of ${totalCategories.toLocaleString()} data points · sampled for performance`
  }

  return (
    <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
      <p className="text-xs text-amber-700">{text}</p>
    </div>
  )
}
