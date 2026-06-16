import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { connectionsService, type Connection } from '@/services/connections'
import { reportsService, type Report } from '@/services/reports'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Database, FileText, Plus, Play } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const DB_LABELS: Record<string, string> = {
  mysql: 'MySQL', postgresql: 'PostgreSQL', sqlserver: 'SQL Server',
}

export function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [connections, setConnections] = useState<Connection[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([connectionsService.list(), reportsService.list()])
      .then(([cRes, rRes]) => {
        setConnections(cRes.data.data.connections.slice(0, 5))
        setReports(rRes.data.data.reports.slice(0, 5))
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}
        </h2>
        <p className="text-gray-500 mt-1">Build and run SQL reports without writing any code.</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/reports/new')}
          className="flex items-center gap-4 p-5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-left"
        >
          <div className="bg-blue-500 rounded-lg p-2"><Plus className="h-5 w-5" /></div>
          <div>
            <p className="font-semibold">Create New Report</p>
            <p className="text-blue-100 text-sm">Step-by-step wizard, no SQL needed</p>
          </div>
        </button>
        <button
          onClick={() => navigate('/connections')}
          className="flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
        >
          <div className="bg-gray-100 rounded-lg p-2"><Database className="h-5 w-5 text-gray-600" /></div>
          <div>
            <p className="font-semibold text-gray-900">Manage Connections</p>
            <p className="text-gray-500 text-sm">MySQL, PostgreSQL, SQL Server</p>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent connections */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recent Connections</CardTitle>
            <Link to="/connections" className="text-sm text-blue-600 hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            {connections.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Database className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No connections yet</p>
                <Button size="sm" className="mt-3" onClick={() => navigate('/connections/new')}>
                  Add Connection
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {connections.map((c) => (
                  <li key={c.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.host} / {c.database}</p>
                    </div>
                    <Badge variant="secondary">{DB_LABELS[c.connection_type] ?? c.connection_type}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent reports */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recent Reports</CardTitle>
            <Link to="/reports" className="text-sm text-blue-600 hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No reports yet</p>
                <Button size="sm" className="mt-3" onClick={() => navigate('/reports/new')}>
                  Create Report
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {reports.map((r) => (
                  <li key={r.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{r.name}</p>
                      <p className="text-xs text-gray-400">
                        {r.last_run
                          ? `Last run ${formatDistanceToNow(new Date(r.last_run))} ago`
                          : 'Never run'}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(`/reports/${r.id}`)}
                      className="text-blue-600 hover:text-blue-700"
                      title="View report"
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
