import { useId } from 'react'
import {
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { ChartConfig } from '@/services/reports'

const COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#ea580c', '#84cc16']

interface Props {
  chartConfig: ChartConfig
  rows: Record<string, unknown>[]
}

const TICK_STYLE   = { fontSize: 11, fill: '#6b7280' }
const GRID_STYLE   = { strokeDasharray: '3 3', stroke: '#f1f5f9' }
const MARGIN       = { top: 8, right: 24, left: 0, bottom: 40 }
const TOOLTIP_STYLE = { fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }

function toNum(v: unknown): number {
  if (typeof v === 'bigint')  return Number(v)
  if (typeof v === 'number')  return isNaN(v) ? 0 : v
  if (typeof v === 'string') {
    const n = parseFloat(v)
    return isNaN(n) ? 0 : n
  }
  return 0
}

function fmt(v: number | string): string {
  const n = typeof v === 'number' ? v : toNum(v)
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function ReportChart({ chartConfig, rows }: Props) {
  const { type, xAxis, yAxis } = chartConfig
  // Unique gradient ID per component instance — avoids SVG ID clash when multiple charts render
  const gradId = `area-grad-${useId().replace(/:/g, '')}`

  if (!rows.length) {
    return <p className="text-center py-8 text-sm text-gray-400">No data to chart.</p>
  }

  // Numeric-coerce Y values
  const data = rows.map((r) => ({ ...r, [yAxis]: toNum(r[yAxis]) }))

  if (type === 'bar') return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={data} margin={MARGIN}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey={xAxis} tick={TICK_STYLE} angle={-30} textAnchor="end" interval="preserveStartEnd" />
        <YAxis tick={TICK_STYLE} width={64} tickFormatter={fmt} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [fmt(v), yAxis]} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey={yAxis} fill={COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={80} />
      </BarChart>
    </ResponsiveContainer>
  )

  if (type === 'line') return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={data} margin={MARGIN}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey={xAxis} tick={TICK_STYLE} angle={-30} textAnchor="end" interval="preserveStartEnd" />
        <YAxis tick={TICK_STYLE} width={64} tickFormatter={fmt} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [fmt(v), yAxis]} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone" dataKey={yAxis}
          stroke={COLORS[0]} strokeWidth={2}
          dot={data.length <= 60}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )

  if (type === 'area') return (
    <ResponsiveContainer width="100%" height={340}>
      <AreaChart data={data} margin={MARGIN}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={COLORS[0]} stopOpacity={0.2} />
            <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey={xAxis} tick={TICK_STYLE} angle={-30} textAnchor="end" interval="preserveStartEnd" />
        <YAxis tick={TICK_STYLE} width={64} tickFormatter={fmt} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [fmt(v), yAxis]} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey={yAxis} stroke={COLORS[0]} fill={`url(#${gradId})`} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  )

  // Pie — limit to top 20 slices for readability
  const pieData = data.slice(0, 20).map((r) => ({
    name:  String(r[xAxis] ?? ''),
    value: toNum(r[yAxis]),
  })).filter((d) => d.value > 0)   // zero-value slices hide cleanly

  return (
    <ResponsiveContainer width="100%" height={340}>
      <PieChart>
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="name"
          cx="50%" cy="48%"
          outerRadius={120}
          label={({ name, percent }) =>
            percent > 0.04 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''
          }
          labelLine={false}
        >
          {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v: number) => [fmt(v), yAxis]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
