import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { reportsService, type Report } from '@/services/reports'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { FileText, Plus, Trash2, Play, Download } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export function Reports() {
  const navigate = useNavigate()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    reportsService.list()
      .then((r) => setReports(r.data.data.reports))
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: string) {
    if (!confirm('Delete this report?')) return
    setDeleting(id)
    try {
      await reportsService.delete(id)
      setReports((r) => r.filter((x) => x.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reports</h2>
          <p className="text-gray-500 mt-1">View and manage your saved reports.</p>
        </div>
        <Button onClick={() => navigate('/reports/new')}>
          <Plus className="h-4 w-4" /> New Report
        </Button>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No reports yet</p>
          <p className="text-sm mt-1">Create your first report using the step-by-step wizard.</p>
          <Button className="mt-4" onClick={() => navigate('/reports/new')}>Create Report</Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {reports.map((r) => (
            <Card key={r.id} className="hover:border-blue-200 transition-colors">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="bg-purple-50 rounded-lg p-2 shrink-0">
                    <FileText className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{r.name}</p>
                    <p className="text-sm text-gray-400">
                      {r.connection_name} · Table: <span className="font-mono">{r.config.table}</span> ·{' '}
                      {r.last_run
                        ? `Last run ${formatDistanceToNow(new Date(r.last_run))} ago`
                        : 'Never run'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <Badge variant="secondary">{r.config.columns.length} cols</Badge>
                  {r.config.filters.length > 0 && (
                    <Badge variant="outline">{r.config.filters.length} filters</Badge>
                  )}
                  <Button size="sm" variant="outline" onClick={() => navigate(`/reports/${r.id}`)}>
                    <Play className="h-3.5 w-3.5" /> Run
                  </Button>
                  <a href={reportsService.exportUrl(r.id, 'csv')} download>
                    <Button size="sm" variant="ghost" title="Export CSV">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                  <button
                    onClick={() => handleDelete(r.id)}
                    disabled={deleting === r.id}
                    className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                  >
                    {deleting === r.id ? <Spinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
