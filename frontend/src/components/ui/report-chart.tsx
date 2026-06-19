import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { TrendingUp, TrendingDown, Search } from 'lucide-react'
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

// Stacked bar palette — 10 distinct colors for multi-series charts
const STACK_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#64748b',
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

  // GROUP BY xAxis, SUM yAxis — single-series charts only
  const aggBase = useMemo(() => {
    if (type === 'stacked-bar') return []
    const grouped = new Map<string, number>()
    for (const r of rows) {
      const key = String(r[xAxis] ?? '(empty)')
      grouped.set(key, (grouped.get(key) ?? 0) + toNum(r[yAxis]))
    }
    return Array.from(grouped.entries()).map(([key, val]) => ({
      [xAxis]: key,
      [yAxis]: val,
    }))
  }, [rows, xAxis, yAxis, type])

  // KPI metrics — computed from aggBase (category-level aggregates)
  const kpiValues = useMemo(() => {
    if (type === 'stacked-bar' || !aggBase.length) return null
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
  }, [aggBase, xAxis, yAxis, type])

  // Trend stat — context-aware insight for the card header
  const trendStat = useMemo<TrendStat | null>(() => {
    if (type === 'stacked-bar' || !aggBase.length) return null
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
  useEffect(() => {
    onTrendStat?.(trendStat)
  }, [trendStat, onTrendStat])

  // GROUP BY xAxis, SUM each series column — stacked-bar only
  const [stackedData, stackedTotal] = useMemo<[Record<string, string | number>[], number]>(() => {
    if (type !== 'stacked-bar' || !chartConfig.series?.length) return [[], 0]
    const seriesCols = chartConfig.series
    const grouped = new Map<string, Record<string, string | number>>()
    for (const r of rows) {
      const key = String(r[xAxis] ?? '(empty)')
      if (!grouped.has(key)) {
        const entry: Record<string, string | number> = { [xAxis]: key }
        for (const s of seriesCols) entry[s] = 0
        grouped.set(key, entry)
      }
      const entry = grouped.get(key)!
      for (const s of seriesCols) {
        entry[s] = (entry[s] as number) + toNum(r[s])
      }
    }
    const totalCats = grouped.size
    const sorted = [...grouped.values()]
      .sort((a, b) => {
        const sumA = seriesCols.reduce((acc, s) => acc + (a[s] as number), 0)
        const sumB = seriesCols.reduce((acc, s) => acc + (b[s] as number), 0)
        return sumB - sumA
      })
      .slice(0, BAR_LIMIT)
    return [sorted, totalCats]
  }, [rows, xAxis, type, chartConfig.series])

  // Interactive series filter — stacked-bar only (must be before early returns)
  const [activeSeries, setActiveSeries] = useState<Set<string>>(
    () => new Set(chartConfig.series ?? [])
  )
  const seriesKey = (chartConfig.series ?? []).join('\x00')
  useEffect(() => {
    setActiveSeries(new Set(chartConfig.series ?? []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesKey])

  // Customer (X-axis) filter — stacked-bar only (must be before early returns)
  const [hiddenCustomers, setHiddenCustomers] = useState<Set<string>>(new Set())
  const [customerSearch,  setCustomerSearch]  = useState('')
  useEffect(() => {
    setHiddenCustomers(new Set())
    setCustomerSearch('')
  }, [stackedData])

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

  // ── Stacked Bar ──────────────────────────────────────────────────────────────
  if (type === 'stacked-bar') {
    const allSeries = chartConfig.series ?? []
    if (!allSeries.length) return <EmptyChart message="No series columns configured." />

    // Apply customer (X-axis) filter on top of stackedData
    const filteredStackedData = hiddenCustomers.size > 0
      ? stackedData.filter((d) => !hiddenCustomers.has(String(d[xAxis])))
      : stackedData

    const visibleSeries  = allSeries.filter((s) => activeSeries.has(s))
    const allSeriesActive = activeSeries.size === allSeries.length
    const n              = filteredStackedData.length
    const angle          = n > 14 ? -45 : n > 8 ? -30 : 0
    const bottom         = angle < -30 ? 80 : angle < -10 ? 60 : 40

    const toggleSeries = (s: string) => {
      setActiveSeries((prev) => {
        if (prev.has(s)) {
          if (prev.size === 1) return new Set(allSeries)
          const next = new Set(prev); next.delete(s); return next
        }
        return new Set([...prev, s])
      })
    }

    const toggleCustomer = (key: string) => {
      setHiddenCustomers((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key); else next.add(key)
        return next
      })
    }

    // Customers visible in panel = all top-N entries, filtered by search
    const searchLo       = customerSearch.toLowerCase()
    const panelCustomers = stackedData.filter((d) =>
      !searchLo || String(d[xAxis]).toLowerCase().includes(searchLo)
    )
    const visibleCount   = stackedData.length - hiddenCustomers.size
    const allCusActive   = hiddenCustomers.size === 0

    return (
      <div className="animate-fade-in">
        <DataNote totalRows={rows.length} totalCategories={stackedTotal} shown={stackedData.length} grouped />
        <div className="flex gap-5">
          {/* ── Chart ──────────────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            <ResponsiveContainer width="100%" height={CHART_HEIGHT + 20}>
              <BarChart data={filteredStackedData} margin={{ top: 10, right: 8, left: 0, bottom }}>
                <CartesianGrid {...GRID_STYLE} vertical={false} />
                <XAxis
                  dataKey={xAxis}
                  tick={{ ...TICK_STYLE, fontSize: 10 }}
                  angle={angle}
                  textAnchor={angle !== 0 ? 'end' : 'middle'}
                  interval={0}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickFormatter={(v: unknown) => {
                    const s = String(v)
                    return s.length > 14 ? `${s.slice(0, 12)}…` : s
                  }}
                />
                <YAxis tick={TICK_STYLE} width={60} tickFormatter={fmt} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: unknown, name: string) => [fmt(v), name]}
                  cursor={{ fill: 'rgba(59,130,246,0.04)' }}
                />
                {visibleSeries.map((s) => {
                  const idx = allSeries.indexOf(s)
                  return (
                    <Bar
                      key={s}
                      dataKey={s}
                      stackId="a"
                      fill={STACK_COLORS[idx % STACK_COLORS.length]}
                      name={s}
                      maxBarSize={52}
                      isAnimationActive={false}
                      radius={s === visibleSeries[visibleSeries.length - 1] ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    />
                  )
                })}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Right panel: Seriler + Cariler ─────────────────────────────── */}
          <div className="w-52 shrink-0 flex flex-col gap-4 pt-2">

            {/* Seriler bölümü */}
            <div>
              <div className="flex items-center justify-between mb-1.5 px-1">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Seriler</span>
                {!allSeriesActive && (
                  <button onClick={() => setActiveSeries(new Set(allSeries))}
                    className="text-[10px] text-blue-500 hover:text-blue-700 font-medium">
                    Tümü
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                {allSeries.map((s, i) => {
                  const active = activeSeries.has(s)
                  const color  = STACK_COLORS[i % STACK_COLORS.length]
                  return (
                    <button key={s} onClick={() => toggleSeries(s)}
                      className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all text-xs ${
                        active
                          ? 'bg-white border border-slate-200 text-slate-700 shadow-sm'
                          : 'text-slate-400 hover:bg-slate-50 hover:text-slate-500 border border-transparent'
                      }`}
                    >
                      <span className="h-2.5 w-2.5 rounded-sm shrink-0 transition-colors"
                        style={{ background: active ? color : '#d1d5db' }} />
                      <span className="flex-1 truncate" title={s}>{s}</span>
                      {active && activeSeries.size > 1 && (
                        <span className="opacity-0 group-hover:opacity-50 text-[10px] text-slate-500 shrink-0">✕</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100" />

            {/* Cariler bölümü */}
            <div className="flex flex-col min-h-0 flex-1">
              <div className="flex items-center justify-between mb-1.5 px-1">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Cariler
                  <span className="ml-1 font-normal normal-case text-slate-300">
                    {allCusActive ? stackedData.length : `${visibleCount}/${stackedData.length}`}
                  </span>
                </span>
                {!allCusActive && (
                  <button onClick={() => setHiddenCustomers(new Set())}
                    className="text-[10px] text-blue-500 hover:text-blue-700 font-medium">
                    Tümü
                  </button>
                )}
              </div>

              {/* Arama */}
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-slate-200 bg-white mb-1.5">
                <Search className="h-3 w-3 text-slate-400 shrink-0" />
                <input
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Cari ara..."
                  className="flex-1 text-xs outline-none bg-transparent text-slate-700 placeholder:text-slate-400 min-w-0"
                />
                {customerSearch && (
                  <button onClick={() => setCustomerSearch('')} className="text-slate-300 hover:text-slate-500 shrink-0">
                    <span className="text-[10px]">✕</span>
                  </button>
                )}
              </div>

              {/* Liste */}
              <div className="overflow-y-auto flex flex-col gap-0.5" style={{ maxHeight: 220 }}>
                {panelCustomers.length === 0 && (
                  <p className="text-xs text-slate-400 px-2 py-2">Sonuç yok</p>
                )}
                {panelCustomers.map((d) => {
                  const key     = String(d[xAxis])
                  const visible = !hiddenCustomers.has(key)
                  return (
                    <button key={key} onClick={() => toggleCustomer(key)}
                      className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all text-xs ${
                        visible
                          ? 'bg-white border border-slate-200 text-slate-700'
                          : 'text-slate-400 hover:bg-slate-50 hover:text-slate-500 border border-transparent'
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-sm shrink-0 border transition-colors ${
                        visible ? 'bg-blue-500 border-blue-500' : 'border-slate-300 bg-white'
                      }`} />
                      <span className="flex-1 truncate font-mono text-[11px]" title={key}>{key}</span>
                    </button>
                  )
                })}
              </div>
            </div>

          </div>{/* end right panel */}
        </div>
      </div>
    )
  }

  // ── Bar ─────────────────────────────────────────────────────────────────────
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
  grouped = false,
}: {
  totalRows: number
  totalCategories: number
  shown: number
  grouped?: boolean  // stacked-bar: group-by (not sampling)
}) {
  const aggregated = grouped || totalCategories < totalRows
  const truncated  = shown < totalCategories
  if (!aggregated && !truncated) return null

  let text: string
  if (truncated && aggregated) {
    text = `Top ${shown.toLocaleString()} of ${totalCategories.toLocaleString()} categories · grouped from ${totalRows.toLocaleString()} rows`
  } else if (aggregated) {
    text = `${shown.toLocaleString()} ${shown === 1 ? 'category' : 'categories'} · grouped from ${totalRows.toLocaleString()} rows`
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
