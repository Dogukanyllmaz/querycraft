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
  '#3b82f6', // blue-500    — primary
  '#10b981', // emerald-500 — secondary
  '#8b5cf6', // violet-500  — tertiary
  '#f59e0b', // amber-500   — quaternary
  '#06b6d4', // cyan-500    — quinary
  '#f43f5e', // rose-500    — sixth
  '#84cc16', // lime-500    — seventh
  '#ec4899', // pink-500    — eighth
]

const CHART_HEIGHT  = 360
const ANIMATE_LIMIT = 100
const SAMPLE_LIMIT  = 500

const TICK_STYLE = { fontSize: 11, fill: '#94a3b8', fontFamily: 'inherit' }

const GRID_STYLE = {
  strokeDasharray: '0',
  stroke: '#f1f5f9',
  strokeWidth: 1,
}

const CHART_MARGIN  = { top: 10, right: 16, left: 0, bottom: 44 }

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

function sanitize(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === 'bigint' ? Number(v) : v
  }
  return out
}

function sample<T>(arr: T[], maxLen: number): T[] {
  if (arr.length <= maxLen) return arr
  const step = arr.length / maxLen
  return Array.from({ length: maxLen }, (_, i) => arr[Math.floor(i * step)])
}

// ── Shared axis props ──────────────────────────────────────────────────────────

function xAxisProps(xAxis: string) {
  return {
    dataKey: xAxis,
    tick: TICK_STYLE,
    angle: -30 as const,
    textAnchor: 'end' as const,
    interval: 'preserveStartEnd' as const,
    tickLine: false,
    axisLine: { stroke: '#e2e8f0' },
  }
}

const yProps = {
  tick: TICK_STYLE,
  width: 64,
  tickFormatter: fmt,
  tickLine: false,
  axisLine: false,
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  chartConfig: ChartConfig
  rows: Record<string, unknown>[]
}

export function ReportChart({ chartConfig, rows }: Props) {
  const { type, xAxis, yAxis } = chartConfig
  const gradId = useRef(`qg${Math.random().toString(36).slice(2, 8)}`).current

  const data = useMemo(() => {
    const clean = rows.map((r) => {
      const s = sanitize(r)
      s[yAxis] = toNum(s[yAxis])
      return s
    })
    return sample(clean, SAMPLE_LIMIT)
  }, [rows, yAxis])

  const animate  = data.length <= ANIMATE_LIMIT
  const sampled  = data.length < rows.length
  const showDots = type === 'line' && data.length <= 60

  if (!data.length) {
    return <EmptyChart />
  }

  const shared = { data, margin: CHART_MARGIN }
  const xProps = xAxisProps(xAxis)
  const tooltipProps = {
    contentStyle: TOOLTIP_STYLE,
    formatter: (v: unknown) => [fmt(v), yAxis],
    cursor: { fill: 'rgba(59,130,246,0.04)' },
  }

  // ── Bar ─────────────────────────────────────────────────────────────────────
  if (type === 'bar') return (
    <div className="animate-fade-in">
      {sampled && <SampleNote total={rows.length} shown={data.length} />}
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart {...shared}>
          <CartesianGrid {...GRID_STYLE} vertical={false} />
          <XAxis {...xProps} />
          <YAxis {...yProps} />
          <Tooltip {...tooltipProps} />
          <Legend wrapperStyle={LEGEND_STYLE} />
          <Bar
            dataKey={yAxis}
            fill={COLORS[0]}
            radius={[5, 5, 0, 0]}
            maxBarSize={56}
            isAnimationActive={animate}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )

  // ── Line ─────────────────────────────────────────────────────────────────────
  if (type === 'line') return (
    <div className="animate-fade-in">
      {sampled && <SampleNote total={rows.length} shown={data.length} />}
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart {...shared}>
          <CartesianGrid {...GRID_STYLE} vertical={false} />
          <XAxis {...xProps} />
          <YAxis {...yProps} />
          <Tooltip {...tooltipProps} />
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

  // ── Area ─────────────────────────────────────────────────────────────────────
  if (type === 'area') return (
    <div className="animate-fade-in">
      {sampled && <SampleNote total={rows.length} shown={data.length} />}
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <AreaChart {...shared}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={COLORS[0]} stopOpacity={0.18} />
              <stop offset="100%" stopColor={COLORS[0]} stopOpacity={0}    />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID_STYLE} vertical={false} />
          <XAxis {...xProps} />
          <YAxis {...yProps} />
          <Tooltip {...tooltipProps} />
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

  // ── Donut / Pie ───────────────────────────────────────────────────────────────
  // Group ALL rows by xAxis key, sum the yAxis values — then show top 12 by value.
  const pieData = (() => {
    const grouped = new Map<string, number>()
    for (const r of rows) {
      const key = String(r[xAxis] ?? '(empty)')
      grouped.set(key, (grouped.get(key) ?? 0) + toNum(r[yAxis]))
    }
    return Array.from(grouped.entries())
      .map(([name, value], i) => ({ name, value, fill: COLORS[i % COLORS.length] }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 12)
  })()

  const uniqueCategories = new Set(rows.map((r) => String(r[xAxis] ?? ''))).size

  if (!pieData.length) {
    return <EmptyChart message="No positive values to display." />
  }

  return (
    <div className="animate-fade-in">
      {uniqueCategories > 12 && (
        <SampleNote total={uniqueCategories} shown={pieData.length} label="categories shown (top 12 by value)" />
      )}
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="46%"
            innerRadius={80}
            outerRadius={130}
            paddingAngle={2}
            isAnimationActive={animate}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v) => [fmt(v), yAxis]}
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

function SampleNote({ total, shown, label = 'rows shown' }: { total: number; shown: number; label?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
      <p className="text-xs text-amber-700">
        Showing {shown.toLocaleString()} {label} of {total.toLocaleString()} total — sampled for performance.
      </p>
    </div>
  )
}
