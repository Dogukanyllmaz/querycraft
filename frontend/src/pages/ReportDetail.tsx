import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { reportsService, type Report } from '@/services/reports'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Play, Download, ArrowLeft, Edit } from 'lucide-react'

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
  } catch {
    return ''
  }
}

function safeString(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

export function ReportDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const mounted = useRef(true)

  const [report, setReport] = useState<Report | null>(null)
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [fetchError, setFetchError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setFetchError('')
    reportsService.get(id)
      .then((r) => {
        if (!mounted.current) return
        setReport(r.data.data.report)
      })
      .catch((err: unknown) => {
        if (!mounted.current) return
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        setFetchError(msg || 'Failed to load report.')
      })
      .finally(() => {
        if (mounted.current) setLoading(false)
      })
  }, [id])

  async function handleRun() {
    if (!id) return
    setRunning(true); setError(''); setRows(null)
    try {
      const res = await reportsService.execute(id)
      if (!mounted.current) return
      setRows(res.data.data.rows)
      setReport((r) => r ? { ...r, last_run: res.data.data.executedAt } : r)
    } catch (err: unknown) {
      if (!mounted.current) return
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Report failed. Try adjusting your filters or check the connection.')
    } finally {
      if (mounted.current) setRunning(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/reports')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm">
          <ArrowLeft className="h-4 w-4" /> Back to Reports
        </button>
        <Alert variant="destructive">
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!report) return null

  const config = report.config ?? {}
  const columns = (rows && rows.length > 0) ? Object.keys(rows[0]) : (config.columns ?? [])
  const lastRunLabel = safeDistance(report.last_run)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/reports')} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold text-gray-900 truncate">{report.name}</h2>
          <p className="text-gray-500 text-sm">
            {report.connection_name} · Table: <span className="font-mono">{config.table}</span>
            {lastRunLabel && ` · Last run ${lastRunLabel}`}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={() => navigate(`/reports/${id}/edit`)}>
            <Edit className="h-4 w-4" /> Edit
          </Button>
          <Button onClick={handleRun} disabled={running}>
            {running ? <Spinner className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            Run Report
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
        {(config.columns ?? []).length > 0 && (
          <Badge variant="secondary">{config.columns.length} columns</Badge>
        )}
        {(config.filters ?? []).length > 0 && (
          <Badge variant="outline">{config.filters.length} filters</Badge>
        )}
        {config.orderBy && (
          <Badge variant="outline">Sorted by {config.orderBy.column} {config.orderBy.direction}</Badge>
        )}
        {config.limit && <Badge variant="outline">Limit {config.limit}</Badge>}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results */}
      {rows && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{rows.length} rows returned</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-auto">
            {rows.length === 0 ? (
              <p className="text-center py-8 text-gray-400 text-sm">No rows matched your filters.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {columns.map((col) => (
                      <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {columns.map((col) => {
                        const val = row[col]
                        return (
                          <td key={col} className="px-4 py-2 text-gray-700 whitespace-nowrap max-w-xs truncate">
                            {val === null || val === undefined
                              ? <span className="text-gray-300 italic">null</span>
                              : safeString(val)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {!rows && !running && (
        <div className="text-center py-16 text-gray-400">
          <Play className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Click "Run Report" to fetch data</p>
        </div>
      )}
    </div>
  )
}
