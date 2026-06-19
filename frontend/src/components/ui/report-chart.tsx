import { useEffect, useMemo, useRef } from 'react'
import {
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'
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

// ── Exported types ─────────────────────────────────────────────────────────────

export type TrendStat =
  | { kind: 'bar';   label: string; pct: number }
  | { kind: 'trend'; pct: number; up: boolean }
  | { kind: 'pie';   label: string; pct: number }

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
  showAvg?: boolean
  onTrendStat?: (stat: TrendStat | null) => void
}

export function ReportChart({ chartConfig, rows, showAvg = false, onTrendStat }: Props) {
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

  // KPI metrics — computed from aggBase (category-level aggregates)
  const kpiValues = useMemo(() => {
    if (!aggBase.length) return null
    const vals = aggBase.map((d) => toNum(d[yAxis])).filter((n) => isFinite(n))
    if (!vals.length) return null
    const total = vals.reduce((s, n) => s + n, 0)
    const avg = total / vals.length
    const sorted = [...vals].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const median = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]
    const minVal = sorted[0]
    const maxVal = sorted[sorted.length - 1]
    const minEntry = aggBase.find((d) => toNum(d[yAxis]) === minVal)
    const maxEntry = aggBase.find((d) => toNum(d[yAxis]) === maxVal)
    return {
      total, avg, median,
      min: minVal, minLabel: String(minEntry?.[xAxis] ?? ''),
      max: maxVal, maxLabel: String(maxEntry?.[xAxis] ?? ''),
    }
  }, [aggBase, xAxis, yAxis])

  // Trend stat — context-aware insight for the card header
  const trendStat = useMemo<TrendStat | null>(() => {
    if (!aggBase.length) return null
    if (type === 'bar') {
      const sorted = [...aggBase].sort((a, b) => toNum(b[yAxis]) - toNum(a[yAxis]))
      const topVal = toNum(sorted[0]?.[yAxis] ?? 0)
      const total = sorted.reduce((s, d) => s + toNum(d[yAxis]), 0)
      const pct = total > 0 ? (topVal / total) * 100 : 0
      return { kind: 'bar', label: String(sorted[0]?.[xAxis] ?? ''), pct }
    }
    if (type === 'line' || type === 'area') {
      const first = toNum(aggBase[0]?.[yAxis] ?? 0)
      const last  = toNum(aggBase[aggBase.length - 1]?.[yAxis] ?? 0)
      const pct   = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0
      return { kind: 'trend', pct, up: pct >= 0 }
    }
    if (type === 'pie') {
      const sorted = [...aggBase]
        .filter((d) => toNum(d[yAxis]) > 0)
        .sort((a, b) => toNum(b[yAxis]) - toNum(a[yAxis]))
      if (!sorted.length) return null
      const topVal = toNum(sorted[0]?.[yAxis] ?? 0)
      const total  = sorted.reduce((s, d) => s + toNum(d[yAxis]), 0)
      const pct    = total > 0 ? (topVal / total) * 100 : 0
      return { kind: 'pie', label: String(sorted[0]?.[xAxis] ?? ''), pct }
    }
    return null
  }, [aggBase, type, xAxis, yAxis])

  // Propagate trend stat to parent (for card header badge)
  // onTrendStat should be a stable ref (e.g. React setState setter)
  useEffect(() => {
    onTrendStat?.(trendStat)
  }, [trendStat, onTrendStat])

  if (!rows.length) return <EmptyChart />

  // Shared avg reference line (bar / line / area only)
  const avgLine = showAvg && kpiValues ? (
    <ReferenceLine
      y={kpiValues.avg}
      stroke="#3b82f6"
      strokeDasharray="5 3"
      strokeWidth={1.5}
      label={{
        value: `Avg: ${fmt(kpiValues.avg)}`,
        position: 'insideTopRight',
        fontSize: 11,
        fill: '#3b82f6',
        fontFamily: 'inherit',
      }}
    />
  ) : null

  // ── Bar ─────────────────────────────────────────────────────────────────────
  // Sort by value desc, take top 30, assign a distinct colour per bar
  if (type === 'bar') {
    const barData = [...aggBase]
      .sort((a, b) => toNum(b[yAxis]) - toNum(a[yAxis]))
      .slice(0, BAR_LIMIT)
      .map((d, i) => ({ ...d, fill: COLORS[i % COLORS.length] }))

    const n      = barData.length
    const angle  = n > 12 ? -40 : n > 6 ? -25 : 0
    const bottom = angle < -30 ? 76 : angle < -10 ? 58 : 36
    const maxW   = n <= 5 ? 96 : n <= 10 ? 72 : n <= 20 ? 56 : 40
    const animate = n <= ANIMATE_LIMIT

    return (
      <div className="animate-fade-in">
        {kpiValues && <KpiStrip {...kpiValues} yAxis={yAxis} />}
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
            <YAxis tick={TICK_STYLE} width={64} tickFormatter={fmt} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v: unknown) => [fmt(v), yAxis]}
              cursor={{ fill: 'rgba(59,130,246,0.04)' }}
            />
            {avgLine}
            <Bar dataKey={yAxis} radius={[5, 5, 0, 0]} maxBarSize={maxW} isAnimationActive={animate} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // ── Line ─────────────────────────────────────────────────────────────────────
  if (type === 'line') {
    const lineData = sampleArr(aggBase, LINE_LIMIT)
    const animate  = lineData.length <= ANIMATE_LIMIT
    const showDots = lineData.length <= 60

    return (
      <div className="animate-fade-in">
        {kpiValues && <KpiStrip {...kpiValues} yAxis={yAxis} />}
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
            <YAxis tick={TICK_STYLE} width={64} tickFormatter={fmt} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v: unknown) => [fmt(v), yAxis]}
              cursor={{ fill: 'rgba(59,130,246,0.04)' }}
            />
            <Legend wrapperStyle={LEGEND_STYLE} />
            {avgLine}
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
        {kpiValues && <KpiStrip {...kpiValues} yAxis={yAxis} />}
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
            <YAxis tick={TICK_STYLE} width={64} tickFormatter={fmt} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v: unknown) => [fmt(v), yAxis]}
              cursor={{ fill: 'rgba(59,130,246,0.04)' }}
            />
            <Legend wrapperStyle={LEGEND_STYLE} />
            {avgLine}
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
  const pieData = [...aggBase]
    .filter((d) => toNum(d[yAxis]) > 0)
    .sort((a, b) => toNum(b[yAxis]) - toNum(a[yAxis]))
    .slice(0, 12)
    .map((d, i) => ({ ...d, fill: COLORS[i % COLORS.length] }))

  if (!pieData.length) return <EmptyChart message="No positive values to display." />

  const animate = pieData.length <= ANIMATE_LIMIT

  return (
    <div className="animate-fade-in">
      {kpiValues && <KpiStrip {...kpiValues} yAxis={yAxis} />}
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

// ── Exported sub-components ────────────────────────────────────────────────────

export function TrendBadge({ stat }: { stat: TrendStat }) {
  if (stat.kind === 'bar') {
    const label = stat.label.length > 12 ? `${stat.label.slice(0, 10)}…` : stat.label
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 whitespace-nowrap">
        Top: {label} = {stat.pct.toFixed(1)}%
      </span>
    )
  }
  if (stat.kind === 'trend') {
    const up = stat.up
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap ${
        up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
      }`}>
        {up
          ? <TrendingUp className="h-3 w-3" />
          : <TrendingDown className="h-3 w-3" />}
        {stat.pct > 0 ? '+' : ''}{stat.pct.toFixed(1)}%
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-violet-50 text-violet-700 whitespace-nowrap">
      Largest: {stat.pct.toFixed(1)}%
    </span>
  )
}

// ── Private sub-components ─────────────────────────────────────────────────────

function EmptyChart({ message = 'No data to chart.' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center h-48 rounded-xl bg-slate-50 border border-slate-100">
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  )
}

interface KpiStripProps {
  total: number; avg: number; median: number
  min: number; minLabel: string
  max: number; maxLabel: string
  yAxis: string
}

function KpiStrip({ total, avg, median, min, minLabel, max, maxLabel }: KpiStripProps) {
  const items = [
    { label: 'Total',   value: fmt(total)                                                      },
    { label: 'Average', value: fmt(avg)                                                        },
    { label: 'Median',  value: fmt(median)                                                     },
    { label: 'Min',     value: fmt(min),  sub: minLabel.length > 16 ? `${minLabel.slice(0, 14)}…` : minLabel },
    { label: 'Max',     value: fmt(max),  sub: maxLabel.length > 16 ? `${maxLabel.slice(0, 14)}…` : maxLabel },
  ]
  return (
    <div className="grid grid-cols-5 divide-x divide-slate-100 mb-4 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {items.map(({ label, value, sub }) => (
        <div key={label} className="px-4 py-3 flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
          <span className="text-base font-bold text-slate-900 tabular-nums leading-tight">{value}</span>
          {sub && <span className="text-[10px] text-slate-400 truncate">{sub}</span>}
        </div>
      ))}
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
