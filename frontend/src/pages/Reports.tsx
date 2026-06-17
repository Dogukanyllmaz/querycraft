import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { reportsService, type Report } from '@/services/reports'
import { useAuth } from '@/context/AuthContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { FileText, Plus, Trash2, Play, Download, Edit, Share2, Clock, Columns3, Filter } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export function Reports() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    reportsService.list()
      .then((r) => setReports(r.data.data.reports))
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Delete this report? This cannot be undone.')) return
    setDeleting(id)
    try {
      await reportsService.delete(id)
      setReports((r) => r.filter((x) => x.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <Spinner className="h-7 w-7" />
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reports</h1>
          <p className="text-slate-500 mt-1 text-sm">
            {isAdmin ? 'Build and manage SQL reports.' : 'Reports shared with you.'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => navigate('/reports/new')} className="shrink-0">
            <Plus className="h-4 w-4" /> New Report
          </Button>
        )}
      </div>

      {/* Empty state */}
      {reports.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-16 px-6 text-center gap-4">
            <div className="bg-slate-50 rounded-2xl p-5">
              <FileText className="h-8 w-8 text-slate-300" />
            </div>
            <div className="space-y-1.5">
              <p className="font-semibold text-slate-800">
                {isAdmin ? 'No reports yet' : 'No reports shared with you'}
              </p>
              <p className="text-sm text-slate-400 max-w-sm">
                {isAdmin
                  ? 'Create your first report using the step-by-step visual wizard.'
                  : 'Contact your administrator to get access to reports.'}
              </p>
            </div>
            {isAdmin && (
              <Button onClick={() => navigate('/reports/new')}>
                <Plus className="h-4 w-4" /> Create Report
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-2.5">
          {reports.map((r) => (
            <Card
              key={r.id}
              className="hover:border-blue-200 hover:shadow-md transition-all duration-150 cursor-pointer group"
              onClick={() => navigate(`/reports/${r.id}`)}
            >
              <div className="flex items-center gap-4 p-4">
                {/* Icon */}
                <div className="bg-violet-50 rounded-lg p-2.5 shrink-0 group-hover:bg-violet-100 transition-colors">
                  <FileText className="h-4.5 w-4.5 text-violet-600" style={{ height: '1.125rem', width: '1.125rem' }} />
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900 text-sm truncate">{r.name}</p>
                    {!isAdmin && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10">
                        <Share2 className="h-2.5 w-2.5" /> Shared
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-slate-400 font-mono">{r.connection_name}</span>
                    <span className="text-slate-200 text-xs">·</span>
                    <span className="text-xs text-slate-400 font-mono">{r.config.table}</span>
                    <span className="text-slate-200 text-xs">·</span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock className="h-3 w-3" />
                      {r.last_run
                        ? formatDistanceToNow(new Date(r.last_run), { addSuffix: true })
                        : 'Never run'}
                    </span>
                  </div>
                </div>

                {/* Badges */}
                <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                  <Badge variant="secondary" className="gap-1">
                    <Columns3 className="h-3 w-3" /> {r.config.columns.length}
                  </Badge>
                  {r.config.filters.length > 0 && (
                    <Badge variant="outline" className="gap-1">
                      <Filter className="h-3 w-3" /> {r.config.filters.length}
                    </Badge>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={(e) => { e.stopPropagation(); navigate(`/reports/${r.id}`) }}
                  >
                    <Play className="h-3.5 w-3.5" /> Run
                  </Button>

                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      title="Edit report"
                      onClick={(e) => { e.stopPropagation(); navigate(`/reports/${r.id}/edit`) }}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  <a
                    href={reportsService.exportUrl(r.id, 'csv')}
                    download
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Export CSV">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </a>

                  {isAdmin && (
                    <button
                      onClick={(e) => handleDelete(r.id, e)}
                      disabled={deleting === r.id}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-150 disabled:opacity-40"
                      title="Delete report"
                    >
                      {deleting === r.id
                        ? <Spinner className="h-3.5 w-3.5" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
