import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { reportsService, type Report, type AggEntry } from '@/services/reports'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ReportChart, TrendBadge, type TrendStat } from '@/components/ui/report-chart'
import { PermissionsModal } from '@/components/ui/permissions-modal'
import { AiInsights } from '@/components/ui/ai-insights'
import {
  Play, Download, ArrowLeft, Edit, BarChart2,
  Table, ChevronLeft, ChevronRight, Link as LinkIcon, Users, Minus,
  Search, Filter, X, Plus,
} from 'lucide-react'

const PAGE_SIZE = 100

function safeDistance(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    const diffMs = Date.now() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    return `${Math.floor(diffHr / 24)}d ago`
  } catch { return '' }
}

function safeString(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

export function ReportDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const mounted = useRef(true)

  const [report, setReport] = useState<Report | null>(null)
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [fetchError, setFetchError] = useState('')
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'table' | 'chart'>('table')
  const [page, setPage] = useState(1)
  const [permissionsOpen, setPermissionsOpen] = useState(false)
  const [showAvg,     setShowAvg]     = useState(false)
  const [trendStat,   setTrendStat]   = useState<TrendStat | null>(null)
  const [tableSearch, setTableSearch] = useState('')
  const [colFilters,  setColFilters]  = useState<{ col: string; op: string; val: string }[]>([])
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true); setFetchError('')
    reportsService.get(id)
      .then((r) => { if (mounted.current) setReport(r.data.data.report) })
      .catch((err: unknown) => {
        if (!mounted.current) return
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        setFetchError(msg || 'Failed to load report.')
      })
      .finally(() => { if (mounted.current) setLoading(false) })
  }, [id])

  // Aggregated chart data — mirrors ReportChart's aggBase for AI panel
  // Uses report state (not the `config` const below the guards) to avoid TDZ
  const aggData = useMemo<AggEntry[]>(() => {
    const chart = report?.config?.chart
    if (!rows || !chart) return []
    const { xAxis, yAxis } = chart
    const grouped = new Map<string, number>()
    for (const r of rows) {
      const key = String(r[xAxis] ?? '(empty)')
      const val = typeof r[yAxis] === 'bigint' ? Number(r[yAxis])
        : typeof r[yAxis] === 'number' ? r[yAxis]
        : parseFloat(String(r[yAxis] ?? '0')) || 0
      grouped.set(key, (grouped.get(key) ?? 0) + val)
    }
    return Array.from(grouped.entries()).map(([k, v]) => ({
      [xAxis]: k,
      [yAxis]: v,
    }))
  }, [rows, report?.config?.chart?.xAxis, report?.config?.chart?.yAxis])

  async function handleRun() {
    if (!id) return
    setRunning(true); setError(''); setRows(null); setPage(1); setShowAvg(false)
    setTableSearch(''); setColFilters([])
    try {
      const res = await reportsService.execute(id)
      if (!mounted.current) return
      setRows(res.data.data.rows)
      setReport((r) => r ? { ...r, last_run: res.data.data.executedAt } : r)
      if (report?.config?.chart) setView('chart')
    } catch (err: unknown) {
      if (!mounted.current) return
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Query failed. Check your filters or connection.')
    } finally {
      if (mounted.current) setRunning(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Spinner className="h-7 w-7" />
    </div>
  )

  if (fetchError) return (
    <div className="space-y-4 animate-fade-in">
      <button onClick={() => navigate('/reports')} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Reports
      </button>
      <Alert variant="destructive"><AlertDescription>{fetchError}</AlertDescription></Alert>
    </div>
  )

  if (!report) return null

  const config = report.config ?? {}
  const columns = (rows && rows.length > 0) ? Object.keys(rows[0]) : (config.columns ?? [])
  const lastRunLabel = safeDistance(report.last_run)
  const hasChart = Boolean(config.chart)

  // Client-side filtering on already-fetched rows
  const filteredRows = useMemo(() => {
    if (!rows) return null
    let result = rows
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase()
      result = result.filter((r) => Object.values(r).some((v) => safeString(v).toLowerCase().includes(q)))
    }
    for (const f of colFilters) {
      if (!f.col || !f.val) continue
      result = result.filter((r) => {
        const cell = safeString(r[f.col])
        const cellLo = cell.toLowerCase()
        const valLo  = f.val.toLowerCase()
        switch (f.op) {
          case 'contains':     return cellLo.includes(valLo)
          case 'not contains': return !cellLo.includes(valLo)
          case '=':            return cell === f.val
          case '!=':           return cell !== f.val
          case '>':            return parseFloat(cell) > parseFloat(f.val)
          case '>=':           return parseFloat(cell) >= parseFloat(f.val)
          case '<':            return parseFloat(cell) < parseFloat(f.val)
          case '<=':           return parseFloat(cell) <= parseFloat(f.val)
          default:             return true
        }
      })
    }
    return result
  }, [rows, tableSearch, colFilters])

  const activeFilters = tableSearch.trim() !== '' || colFilters.some((f) => f.col && f.val)

  const totalPages = filteredRows ? Math.ceil(filteredRows.length / PAGE_SIZE) : 1
  const pageRows   = filteredRows ? filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : []

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate('/reports')}
          className="mt-1 text-slate-400 hover:text-slate-600 transition-colors shrink-0 h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-900 truncate tracking-tight">{report.name}</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            <span className="font-mono">{report.connection_name}</span>
            <span className="mx-1.5 text-slate-300">·</span>
            <span className="font-mono">{config.table}</span>
            {(config.joins ?? []).length > 0 && (
              <span className="ml-1.5 text-slate-400">
                + {config.joins.length} JOIN{config.joins.length > 1 ? 's' : ''}
              </span>
            )}
            {lastRunLabel && (
              <>
                <span className="mx-1.5 text-slate-300">·</span>
                <span className="text-slate-400">{lastRunLabel}</span>
              </>
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => setPermissionsOpen(true)}>
                <Users className="h-3.5 w-3.5" /> Access
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate(`/reports/${id}/edit`)}>
                <Edit className="h-3.5 w-3.5" /> Edit
              </Button>
            </>
          )}
          <Button onClick={handleRun} disabled={running} size="sm">
            {running ? <Spinner className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            Run
          </Button>
          {rows && (
            <>
              <a href={reportsService.exportUrl(report.id, 'csv')} download>
                <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5" /> CSV</Button>
              </a>
              <a href={reportsService.exportUrl(report.id, 'xlsx')} download>
                <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5" /> Excel</Button>
              </a>
            </>
          )}
        </div>
      </div>

      {/* Config badges */}
      <div className="flex flex-wrap gap-1.5">
        {(config.columns ?? []).length > 0 && (
          <Badge variant="secondary">{config.columns.length} columns</Badge>
        )}
        {(config.filters ?? []).length > 0 && (
          <Badge variant="outline">{config.filters.length} filters</Badge>
        )}
        {(config.joins ?? []).length > 0 && (
          <Badge variant="outline">
            <LinkIcon className="h-3 w-3" />
            {config.joins.length} JOIN{config.joins.length > 1 ? 's' : ''}
          </Badge>
        )}
        {config.orderBy && (
          <Badge variant="outline">
            Sorted by <span className="font-mono ml-1">{config.orderBy.column}</span>
            <span className="ml-1 text-slate-400">{config.orderBy.direction}</span>
          </Badge>
        )}
        {config.limit && <Badge variant="outline">Limit {config.limit}</Badge>}
        {config.chart && (
          <Badge variant="default">
            <BarChart2 className="h-3 w-3" /> {config.chart.type} chart
          </Badge>
        )}
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {/* Results */}
      {rows && (
        <Card>
          <CardHeader className="pb-0 border-b border-slate-100">
            <div className="flex items-center justify-between pb-4">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-slate-700">
                  {activeFilters
                    ? <>{(filteredRows?.length ?? 0).toLocaleString()} <span className="font-normal text-slate-400">of {rows.length.toLocaleString()} rows</span></>
                    : <>{rows.length.toLocaleString()} rows</>
                  }
                  {totalPages > 1 && (
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      page {page}/{totalPages}
                    </span>
                  )}
                </CardTitle>
                {view === 'chart' && trendStat && <TrendBadge stat={trendStat} />}
              </div>

              <div className="flex items-center gap-2">
                {/* Table filter toggle */}
                {view === 'table' && (
                  <button
                    onClick={() => setShowFilters((v) => !v)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all duration-150 ${
                      showFilters || activeFilters
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
                    }`}
                  >
                    <Filter className="h-3 w-3" />
                    Filter
                    {colFilters.filter((f) => f.col && f.val).length > 0 && (
                      <span className="ml-0.5 bg-white/30 rounded px-1">{colFilters.filter((f) => f.col && f.val).length}</span>
                    )}
                  </button>
                )}
                {/* Avg reference line toggle — bar/line/area only */}
                {view === 'chart' && hasChart && config.chart?.type !== 'pie' && config.chart?.type !== 'stacked-bar' && (
                  <button
                    onClick={() => setShowAvg((v) => !v)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all duration-150 ${
                      showAvg
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
                    }`}
                    title="Toggle average reference line"
                  >
                    <Minus className="h-3 w-3" /> Avg line
                  </button>
                )}

              {hasChart && (
                <div className="flex rounded-lg border border-slate-200 overflow-hidden p-0.5 gap-0.5 bg-slate-50">
                  <button
                    onClick={() => setView('table')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                      view === 'table'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Table className="h-3.5 w-3.5" /> Table
                  </button>
                  <button
                    onClick={() => setView('chart')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                      view === 'chart'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <BarChart2 className="h-3.5 w-3.5" /> Chart
                  </button>
                </div>
              )}
              </div>
            </div>
          </CardHeader>

          {/* Filter panel — shown when toggled and in table view */}
          {view === 'table' && showFilters && (
            <div className="border-b border-slate-100 px-4 py-3 space-y-2 bg-slate-50/60">
              {/* Global search */}
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => { setTableSearch(e.target.value); setPage(1) }}
                  placeholder="Search across all columns..."
                  className="flex-1 text-sm outline-none bg-transparent text-slate-700 placeholder:text-slate-400"
                />
                {tableSearch && (
                  <button onClick={() => { setTableSearch(''); setPage(1) }} className="text-slate-400 hover:text-slate-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Column filters */}
              {colFilters.map((f, i) => (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                  <select
                    value={f.col}
                    onChange={(e) => { const a = [...colFilters]; a[i] = { ...a[i], col: e.target.value }; setColFilters(a); setPage(1) }}
                    className="h-8 text-xs border border-slate-200 rounded-lg px-2 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Column...</option>
                    {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select
                    value={f.op}
                    onChange={(e) => { const a = [...colFilters]; a[i] = { ...a[i], op: e.target.value }; setColFilters(a); setPage(1) }}
                    className="h-8 text-xs border border-slate-200 rounded-lg px-2 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {['contains', 'not contains', '=', '!=', '>', '>=', '<', '<='].map((op) => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={f.val}
                    onChange={(e) => { const a = [...colFilters]; a[i] = { ...a[i], val: e.target.value }; setColFilters(a); setPage(1) }}
                    placeholder="Value..."
                    className="h-8 text-xs border border-slate-200 rounded-lg px-2.5 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 w-40"
                  />
                  <button onClick={() => { setColFilters((prev) => prev.filter((_, idx) => idx !== i)); setPage(1) }} className="text-slate-400 hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setColFilters((prev) => [...prev, { col: columns[0] ?? '', op: 'contains', val: '' }])}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Plus className="h-3.5 w-3.5" /> Add condition
                </button>
                {activeFilters && (
                  <button
                    onClick={() => { setTableSearch(''); setColFilters([]); setPage(1) }}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
          )}

          <CardContent className={view === 'chart' ? 'pt-5 pb-5 px-5' : 'p-0 overflow-x-auto'}>
            {view === 'chart' && config.chart ? (
              <ReportChart
                chartConfig={config.chart}
                rows={rows}
                showAvg={showAvg}
                onTrendStat={setTrendStat}
              />
            ) : rows.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No rows matched your filters.
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 w-10 tabular-nums">#</th>
                      {columns.map((col) => (
                        <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap font-mono">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row, i) => (
                      <tr
                        key={i}
                        className={`border-b border-slate-50 hover:bg-blue-50/40 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}
                      >
                        <td className="px-4 py-2.5 text-xs text-slate-300 select-none tabular-nums">
                          {(page - 1) * PAGE_SIZE + i + 1}
                        </td>
                        {columns.map((col) => {
                          const val = row[col]
                          return (
                            <td key={col} className="px-4 py-2.5 text-slate-700 whitespace-nowrap max-w-xs truncate text-sm" title={safeString(val)}>
                              {val === null || val === undefined
                                ? <span className="text-slate-300 text-xs italic">null</span>
                                : safeString(val)}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/60">
                    <p className="text-xs text-slate-500 tabular-nums">
                      {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–
                      {Math.min(page * PAGE_SIZE, filteredRows?.length ?? 0).toLocaleString()} of {(filteredRows?.length ?? 0).toLocaleString()}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                        className="px-2 py-1 text-xs rounded-md border border-slate-200 text-slate-500 hover:bg-white transition-colors disabled:opacity-35"
                      >«</button>
                      <button
                        onClick={() => setPage((p) => p - 1)}
                        disabled={page === 1}
                        className="h-7 w-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-white transition-colors disabled:opacity-35"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const start = Math.max(1, Math.min(page - 2, totalPages - 4))
                        const p = start + i
                        return (
                          <button
                            key={p}
                            onClick={() => setPage(p)}
                            className={`h-7 min-w-[28px] px-2 text-xs rounded-md border transition-all duration-100 ${
                              p === page
                                ? 'bg-blue-600 text-white border-blue-600 font-medium shadow-sm'
                                : 'border-slate-200 text-slate-500 hover:bg-white'
                            }`}
                          >{p}</button>
                        )
                      })}
                      <button
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page === totalPages}
                        className="h-7 w-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-white transition-colors disabled:opacity-35"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setPage(totalPages)}
                        disabled={page === totalPages}
                        className="px-2 py-1 text-xs rounded-md border border-slate-200 text-slate-500 hover:bg-white transition-colors disabled:opacity-35"
                      >»</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* AI Insights panel — shown after run when a chart is configured */}
      {rows && config.chart && config.chart.type !== 'stacked-bar' && id && (
        <AiInsights
          reportId={id}
          reportName={report.name}
          aggData={aggData}
          chartConfig={config.chart}
        />
      )}

      {/* Empty run state */}
      {!rows && !running && (
        <div className="flex flex-col items-center py-20 text-slate-400 gap-4">
          <div className="bg-slate-100 rounded-2xl p-5">
            <Play className="h-8 w-8 opacity-40" />
          </div>
          <div className="text-center space-y-1">
            <p className="font-medium text-slate-600">Ready to run</p>
            <p className="text-sm text-slate-400">Click <span className="font-mono text-slate-500">Run</span> to fetch data</p>
            {hasChart && <p className="text-xs text-slate-400">Chart will appear automatically</p>}
          </div>
          <Button onClick={handleRun} disabled={running}>
            <Play className="h-4 w-4" /> Run Report
          </Button>
        </div>
      )}

      {id && (
        <PermissionsModal
          reportId={id}
          reportName={report.name}
          open={permissionsOpen}
          onClose={() => setPermissionsOpen(false)}
        />
      )}
    </div>
  )
}
