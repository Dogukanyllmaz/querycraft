import { useMemo, useRef } from 'react'
import {
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { ChartConfig } from '@/services/reports'

const COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#ea580c', '#84cc16']
const CHART_HEIGHT    = 340
const ANIMATE_LIMIT   = 100   // disable animation above this row count
const SAMPLE_LIMIT    = 500   // downsample above this — charts can't render 1000+ bars usefully

const TICK_STYLE    = { fontSize: 11, fill: '#6b7280' }
const GRID_STYLE    = { strokeDasharray: '3 3', stroke: '#f1f5f9' }
const CHART_MARGIN  = { top: 8, right: 24, left: 0, bottom: 40 }
const TOOLTIP_STYLE = { fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }

// ── Helpers ────────────────────────────────────────────────────────────────

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

/** Convert ALL BigInt values in a row to Number so recharts never sees a BigInt. */
function sanitize(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === 'bigint' ? Number(v) : v
  }
  return out
}

/** Evenly sample arr down to at most maxLen items. */
function sample<T>(arr: T[], maxLen: number): T[] {
  if (arr.length <= maxLen) return arr
  const step = arr.length / maxLen
  return Array.from({ length: maxLen }, (_, i) => arr[Math.floor(i * step)])
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  chartConfig: ChartConfig
  rows: Record<string, unknown>[]
}

export function ReportChart({ chartConfig, rows }: Props) {
  const { type, xAxis, yAxis } = chartConfig

  // Stable gradient ID per component instance (avoids SVG id clash with multiple charts)
  const gradId = useRef(`ag${Math.random().toString(36).slice(2, 8)}`).current

  // Sanitize BigInt, coerce yAxis to number, then sample for performance
  const data = useMemo(() => {
    const clean = rows.map((r) => {
      const s = sanitize(r)
      s[yAxis] = toNum(s[yAxis])   // ensure Y is always numeric
      return s
    })
    return sample(clean, SAMPLE_LIMIT)
  }, [rows, yAxis])

  const animate   = data.length <= ANIMATE_LIMIT
  const sampled   = data.length < rows.length
  const showDots  = type === 'line' && data.length <= 60

  if (!data.length) {
    return <p className="text-center py-8 text-sm text-gray-400">No data to chart.</p>
  }

  const sharedProps = {
    data,
    margin: CHART_MARGIN,
  }

  const xAxisProps = {
    dataKey: xAxis,
    tick: TICK_STYLE,
    angle: -30 as const,
    textAnchor: 'end' as const,
    interval: 'preserveStartEnd' as const,
  }

  const yAxisProps = {
    tick: TICK_STYLE,
    width: 68,
    tickFormatter: fmt,
  }

  // ── Bar ──────────────────────────────────────────────────────────────────

  if (type === 'bar') return (
    <div>
      {sampled && <SampleNote total={rows.length} shown={data.length} />}
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart {...sharedProps}>
          <CartesianGrid {...GRID_STYLE} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [fmt(v), yAxis]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey={yAxis}
            fill={COLORS[0]}
            radius={[4, 4, 0, 0]}
            maxBarSize={72}
            isAnimationActive={animate}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )

  // ── Line ─────────────────────────────────────────────────────────────────

  if (type === 'line') return (
    <div>
      {sampled && <SampleNote total={rows.length} shown={data.length} />}
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart {...sharedProps}>
          <CartesianGrid {...GRID_STYLE} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [fmt(v), yAxis]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey={yAxis}
            stroke={COLORS[0]}
            strokeWidth={2}
            dot={showDots}
            activeDot={{ r: 5 }}
            isAnimationActive={animate}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )

  // ── Area ─────────────────────────────────────────────────────────────────

  if (type === 'area') return (
    <div>
      {sampled && <SampleNote total={rows.length} shown={data.length} />}
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <AreaChart {...sharedProps}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={COLORS[0]} stopOpacity={0.2} />
              <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0}   />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID_STYLE} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [fmt(v), yAxis]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey={yAxis}
            stroke={COLORS[0]}
            fill={`url(#${gradId})`}
            strokeWidth={2}
            isAnimationActive={animate}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )

  // ── Pie ───────────────────────────────────────────────────────────────────
  // recharts 3.x: Cell is deprecated — embed fill in the data record instead.

  const pieData = data.slice(0, 20).map((r, i) => ({
    name:  String(r[xAxis] ?? '(empty)'),
    value: toNum(r[yAxis]),
    fill:  COLORS[i % COLORS.length],
  })).filter((d) => d.value > 0)

  if (!pieData.length) {
    return <p className="text-center py-8 text-sm text-gray-400">No positive values to display as pie chart.</p>
  }

  return (
    <div>
      {rows.length > 20 && (
        <SampleNote total={rows.length} shown={Math.min(20, pieData.length)} label="slices (top 20 by row order)" />
      )}
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="48%"
            outerRadius={120}
            isAnimationActive={animate}
            label={({ name, percent }) => percent > 0.04 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''}
            labelLine={false}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v) => [fmt(v), yAxis]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function SampleNote({ total, shown, label = 'rows shown' }: { total: number; shown: number; label?: string }) {
  return (
    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded px-3 py-1.5 mb-2">
      Showing {shown.toLocaleString()} {label} of {total.toLocaleString()} total — chart sampled for performance.
    </p>
  )
}
