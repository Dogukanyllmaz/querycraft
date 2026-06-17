import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { reportsService, type Report } from '@/services/reports'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ReportChart } from '@/components/ui/report-chart'
import { PermissionsModal } from '@/components/ui/permissions-modal'
import { Play, Download, ArrowLeft, Edit, BarChart2, Table, ChevronLeft, ChevronRight, Link, Users } from 'lucide-react'

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

  async function handleRun() {
    if (!id) return
    setRunning(true); setError(''); setRows(null); setPage(1)
    try {
      const res = await reportsService.execute(id)
      if (!mounted.current) return
      setRows(res.data.data.rows)
      setReport((r) => r ? { ...r, last_run: res.data.data.executedAt } : r)
      if (report?.config?.chart) setView('chart')
    } catch (err: unknown) {
      if (!mounted.current) return
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Report failed. Try adjusting your filters or check the connection.')
    } finally {
      if (mounted.current) setRunning(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner className="h-8 w-8" /></div>

  if (fetchError) return (
    <div className="space-y-4">
      <button onClick={() => navigate('/reports')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm">
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

  const totalPages = rows ? Math.ceil(rows.length / PAGE_SIZE) : 1
  const pageRows = rows ? rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/reports')} className="text-gray-400 hover:text-gray-600 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold text-gray-900 truncate">{report.name}</h2>
          <p className="text-gray-500 text-sm">
            {report.connection_name} · <span className="font-mono">{config.table}</span>
            {(config.joins ?? []).length > 0 && (
              <span className="ml-1 text-gray-400">+ {config.joins.length} JOIN{config.joins.length > 1 ? 's' : ''}</span>
            )}
            {lastRunLabel && <span className="ml-2 text-gray-400">· {lastRunLabel}</span>}
          </p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          {isAdmin && (
            <>
              <Button variant="outline" onClick={() => setPermissionsOpen(true)}>
                <Users className="h-4 w-4" /> Manage Access
              </Button>
              <Button variant="outline" onClick={() => navigate(`/reports/${id}/edit`)}>
                <Edit className="h-4 w-4" /> Edit
              </Button>
            </>
          )}
          <Button onClick={handleRun} disabled={running}>
            {running ? <Spinner className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            Run
          </Button>
          {rows && (
            <>
              <a href={reportsService.exportUrl(report.id, 'csv')} download>
                <Button variant="outline"><Download className="h-4 w-4" /> CSV</Button>
              </a>
              <a href={reportsService.exportUrl(report.id, 'xlsx')} download>
                <Button variant="outline"><Download className="h-4 w-4" /> Excel</Button>
              </a>
            </>
          )}
        </div>
      </div>

      {/* Config summary */}
      <div className="flex flex-wrap gap-2">
        {(config.columns ?? []).length > 0 && <Badge variant="secondary">{config.columns.length} columns</Badge>}
        {(config.filters ?? []).length > 0 && <Badge variant="outline">{config.filters.length} filters</Badge>}
        {(config.joins ?? []).length > 0 && (
          <Badge variant="outline"><Link className="h-3 w-3 mr-1 inline" />{config.joins.length} JOIN{config.joins.length > 1 ? 's' : ''}</Badge>
        )}
        {config.orderBy && <Badge variant="outline">Sorted by <span className="font-mono ml-1">{config.orderBy.column}</span> {config.orderBy.direction}</Badge>}
        {config.limit && <Badge variant="outline">Limit {config.limit}</Badge>}
        {config.chart && <Badge variant="success"><BarChart2 className="h-3 w-3 mr-1 inline" />{config.chart.type} chart</Badge>}
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {/* Results */}
      {rows && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {rows.length.toLocaleString()} rows returned
                {totalPages > 1 && <span className="ml-2 text-sm font-normal text-gray-400">(page {page}/{totalPages})</span>}
              </CardTitle>

              {hasChart && (
                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setView('table')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                      view === 'table' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <Table className="h-3.5 w-3.5" /> Table
                  </button>
                  <button
                    onClick={() => setView('chart')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                      view === 'chart' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <BarChart2 className="h-3.5 w-3.5" /> Chart
                  </button>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className={view === 'chart' ? 'pt-2 pb-4 px-4' : 'p-0 overflow-auto'}>
            {view === 'chart' && config.chart ? (
              <ReportChart chartConfig={config.chart} rows={rows} />
            ) : rows.length === 0 ? (
              <p className="text-center py-8 text-gray-400 text-sm px-4">No rows matched your filters.</p>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 sticky top-0">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 w-10">#</th>
                      {columns.map((col) => (
                        <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap font-mono">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pageRows.map((row, i) => (
                      <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                        <td className="px-3 py-2 text-xs text-gray-300 select-none">
                          {(page - 1) * PAGE_SIZE + i + 1}
                        </td>
                        {columns.map((col) => {
                          const val = row[col]
                          return (
                            <td key={col} className="px-4 py-2 text-gray-700 whitespace-nowrap max-w-xs truncate" title={safeString(val)}>
                              {val === null || val === undefined
                                ? <span className="text-gray-300 italic text-xs">null</span>
                                : safeString(val)}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                    <p className="text-xs text-gray-500">
                      {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–{Math.min(page * PAGE_SIZE, rows.length).toLocaleString()} of {rows.length.toLocaleString()} rows
                    </p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40">«</button>
                      <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} className="p-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40">
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const start = Math.max(1, Math.min(page - 2, totalPages - 4))
                        const p = start + i
                        return (
                          <button key={p} onClick={() => setPage(p)} className={`px-2.5 py-1 text-xs rounded border transition-colors ${p === page ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-500 hover:bg-gray-100'}`}>{p}</button>
                        )
                      })}
                      <button onClick={() => setPage((p) => p + 1)} disabled={page === totalPages} className="p-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40">
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40">»</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {!rows && !running && (
        <div className="text-center py-16 text-gray-400">
          <Play className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Click "Run" to fetch data</p>
          {hasChart && <p className="text-sm mt-1 text-gray-300">Chart will appear automatically after running</p>}
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
