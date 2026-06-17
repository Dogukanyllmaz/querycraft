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

const TICK_STYLE = { fontSize: 11, fill: '#6b7280' }
const GRID_STYLE = { strokeDasharray: '3 3', stroke: '#f1f5f9' }
const MARGIN = { top: 8, right: 24, left: 0, bottom: 40 }

function toNum(v: unknown): number { return typeof v === 'bigint' ? Number(v) : Number(v) || 0 }

export function ReportChart({ chartConfig, rows }: Props) {
  const { type, xAxis, yAxis } = chartConfig

  if (!rows.length) {
    return <p className="text-center py-8 text-sm text-gray-400">No data to chart.</p>
  }

  // Numeric-coerce Y values so recharts always gets numbers
  const data = rows.map((r) => ({ ...r, [yAxis]: toNum(r[yAxis]) }))

  if (type === 'bar') return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={data} margin={MARGIN}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey={xAxis} tick={TICK_STYLE} angle={-30} textAnchor="end" interval="preserveStartEnd" />
        <YAxis tick={TICK_STYLE} width={56} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey={yAxis} fill={COLORS[0]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )

  if (type === 'line') return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={data} margin={MARGIN}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey={xAxis} tick={TICK_STYLE} angle={-30} textAnchor="end" interval="preserveStartEnd" />
        <YAxis tick={TICK_STYLE} width={56} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey={yAxis} stroke={COLORS[0]} strokeWidth={2} dot={data.length <= 60} />
      </LineChart>
    </ResponsiveContainer>
  )

  if (type === 'area') return (
    <ResponsiveContainer width="100%" height={340}>
      <AreaChart data={data} margin={MARGIN}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.2} />
            <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey={xAxis} tick={TICK_STYLE} angle={-30} textAnchor="end" interval="preserveStartEnd" />
        <YAxis tick={TICK_STYLE} width={56} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey={yAxis} stroke={COLORS[0]} fill="url(#areaGrad)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  )

  // Pie — limit to top 20 slices for readability
  const pieData = data.slice(0, 20).map((r) => ({
    name: String(r[xAxis] ?? ''),
    value: toNum(r[yAxis]),
  }))

  return (
    <ResponsiveContainer width="100%" height={340}>
      <PieChart>
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="48%"
          outerRadius={130}
          label={({ name, percent }) => percent > 0.03 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''}
          labelLine={false}
        >
          {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => v.toLocaleString()} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
