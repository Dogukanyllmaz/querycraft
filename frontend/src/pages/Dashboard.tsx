import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { connectionsService, type Connection } from '@/services/connections'
import { reportsService, type Report } from '@/services/reports'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Database, FileText, Plus, Play, Clock, ChevronRight, Zap } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const DB_LABELS: Record<string, string> = {
  mysql: 'MySQL', postgresql: 'PostgreSQL', sqlserver: 'SQL Server',
}

const DB_COLORS: Record<string, string> = {
  mysql:      'bg-orange-50 text-orange-700 ring-orange-600/15',
  postgresql: 'bg-blue-50 text-blue-700 ring-blue-600/15',
  sqlserver:  'bg-red-50 text-red-700 ring-red-600/15',
}

export function Dashboard() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [connections, setConnections] = useState<Connection[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetches = isAdmin
      ? [connectionsService.list(), reportsService.list()]
      : [Promise.resolve(null), reportsService.list()]

    Promise.all(fetches)
      .then(([cRes, rRes]) => {
        if (cRes) setConnections((cRes as Awaited<ReturnType<typeof connectionsService.list>>).data.data.connections.slice(0, 5))
        setReports((rRes as Awaited<ReturnType<typeof reportsService.list>>).data.data.reports.slice(0, 5))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const firstName = user?.email?.split('@')[0] ?? ''
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Spinner className="h-8 w-8" />
    </div>
  )

  return (
    <div className="space-y-7 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {greeting}, {firstName}
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            {isAdmin
              ? `${reports.length} report${reports.length !== 1 ? 's' : ''} · ${connections.length} connection${connections.length !== 1 ? 's' : ''}`
              : `${reports.length} report${reports.length !== 1 ? 's' : ''} shared with you`
            }
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => navigate('/reports/new')} className="shrink-0">
            <Plus className="h-4 w-4" /> New Report
          </Button>
        )}
      </div>

      {/* Quick actions — admin only */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/reports/new')}
            className="group flex items-center gap-4 p-5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-150 text-left active:scale-[0.99] shadow-sm hover:shadow-md"
          >
            <div className="bg-blue-500 rounded-lg p-2.5 shrink-0 group-hover:bg-blue-600 transition-colors">
              <Zap className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold">New Report</p>
              <p className="text-blue-200 text-sm mt-0.5">Visual SQL wizard — no code</p>
            </div>
            <ChevronRight className="h-4 w-4 text-blue-300 ml-auto shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <button
            onClick={() => navigate('/connections')}
            className="group flex items-center gap-4 p-5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 text-left active:scale-[0.99] shadow-sm hover:shadow-md"
          >
            <div className="bg-slate-100 rounded-lg p-2.5 shrink-0 group-hover:bg-slate-200 transition-colors">
              <Database className="h-5 w-5 text-slate-600" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">Manage Connections</p>
              <p className="text-slate-500 text-sm mt-0.5">MySQL · PostgreSQL · SQL Server</p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300 ml-auto shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      )}

      <div className={`grid grid-cols-1 gap-5 ${isAdmin ? 'lg:grid-cols-2' : ''}`}>
        {/* Recent connections — admin only */}
        {isAdmin && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle>Recent Connections</CardTitle>
              <Link
                to="/connections"
                className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {connections.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-slate-400 gap-3">
                  <div className="bg-slate-50 rounded-full p-4">
                    <Database className="h-6 w-6 opacity-50" />
                  </div>
                  <p className="text-sm font-medium">No connections yet</p>
                  <Button size="sm" variant="outline" onClick={() => navigate('/connections')}>
                    Add Connection
                  </Button>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 -mx-1">
                  {connections.map((c) => (
                    <li key={c.id} className="flex items-center justify-between py-3 px-1 hover:bg-slate-50 rounded-lg transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-7 w-7 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                          <Database className="h-3.5 w-3.5 text-slate-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                          <p className="text-xs text-slate-400 font-mono truncate">{c.host}/{c.database}</p>
                        </div>
                      </div>
                      <Badge className={`ring-1 shrink-0 ml-2 ${DB_COLORS[c.connection_type] ?? 'bg-slate-100 text-slate-600 ring-slate-500/10'}`}>
                        {DB_LABELS[c.connection_type] ?? c.connection_type}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent reports */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle>Recent Reports</CardTitle>
            <Link
              to="/reports"
              className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-slate-400 gap-3">
                <div className="bg-slate-50 rounded-full p-4">
                  <FileText className="h-6 w-6 opacity-50" />
                </div>
                <p className="text-sm font-medium">
                  {isAdmin ? 'No reports yet' : 'No reports shared with you'}
                </p>
                {isAdmin && (
                  <Button size="sm" variant="outline" onClick={() => navigate('/reports/new')}>
                    Create Report
                  </Button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 -mx-1">
                {reports.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between py-3 px-1 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer group"
                    onClick={() => navigate(`/reports/${r.id}`)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-7 w-7 rounded-md bg-violet-50 flex items-center justify-center shrink-0">
                        <FileText className="h-3.5 w-3.5 text-violet-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{r.name}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {r.last_run
                            ? formatDistanceToNow(new Date(r.last_run), { addSuffix: true })
                            : 'Never run'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/reports/${r.id}`) }}
                      className="text-slate-300 hover:text-blue-500 transition-colors shrink-0 ml-2 group-hover:text-slate-400"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
