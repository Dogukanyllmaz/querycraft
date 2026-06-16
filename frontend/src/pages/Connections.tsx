import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { connectionsService, type Connection, type ConnectionFormData } from '@/services/connections'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Plus, Trash2, TestTube, X, Database, CheckCircle, AlertCircle } from 'lucide-react'

const DB_TYPES = [
  { value: 'mysql', label: 'MySQL' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'sqlserver', label: 'SQL Server' },
]

const DEFAULT_PORTS: Record<string, number> = { mysql: 3306, postgresql: 5432, sqlserver: 1433 }

function emptyForm(type: ConnectionFormData['connection_type'] = 'postgresql'): ConnectionFormData {
  return { name: '', connection_type: type, host: '', port: DEFAULT_PORTS[type] ?? 1433, database: '', username: '', password: '' }
}
const empty = emptyForm()

export function Connections() {
  const navigate = useNavigate()
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ConnectionFormData>(empty)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  function load() {
    setLoading(true)
    connectionsService.list()
      .then((r) => setConnections(r.data.data.connections))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function setField<K extends keyof ConnectionFormData>(key: K, value: ConnectionFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setTestResult(null)
  }

  function handleTypeChange(type: string) {
    setForm((f) => ({ ...f, connection_type: type as ConnectionFormData['connection_type'], port: DEFAULT_PORTS[type] ?? f.port }))
    setTestResult(null)
  }

  async function handleTest() {
    setTesting(true); setTestResult(null)
    try {
      await connectionsService.test(form)
      setTestResult({ ok: true, msg: 'Connection successful!' })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setTestResult({ ok: false, msg: msg || 'Connection failed. Check credentials.' })
    } finally {
      setTesting(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      await connectionsService.create(form)
      setShowForm(false); setForm(empty); setTestResult(null)
      load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Failed to save connection.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this connection? All associated reports will also be deleted.')) return
    setDeleting(id)
    try {
      await connectionsService.delete(id)
      setConnections((c) => c.filter((x) => x.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Connections</h2>
          <p className="text-gray-500 mt-1">Manage your database connections.</p>
        </div>
        <Button onClick={() => { setShowForm(true); setError(''); setTestResult(null) }}>
          <Plus className="h-4 w-4" /> Add Connection
        </Button>
      </div>

      {/* Add form */}
      {showForm && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base">New Connection</CardTitle>
            <button onClick={() => { setShowForm(false); setForm(empty); setTestResult(null) }}>
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          </CardHeader>
          <CardContent>
            {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}
            {testResult && (
              <Alert variant={testResult.ok ? 'default' : 'destructive'} className="mb-4">
                <div className="flex items-center gap-2">
                  {testResult.ok ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4" />}
                  <AlertDescription>{testResult.msg}</AlertDescription>
                </div>
              </Alert>
            )}
            <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Connection Name</Label>
                <Input placeholder="My Production DB" value={form.name} onChange={(e) => setField('name', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Database Type</Label>
                <Select value={form.connection_type} onValueChange={handleTypeChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DB_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Host</Label>
                <Input placeholder="localhost" value={form.host} onChange={(e) => setField('host', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Port</Label>
                <Input
                  type="number"
                  value={form.port || ''}
                  placeholder={String(DEFAULT_PORTS[form.connection_type] ?? 1433)}
                  onChange={(e) => {
                    const val = parseInt(e.target.value)
                    setField('port', isNaN(val) ? DEFAULT_PORTS[form.connection_type] ?? 1433 : val)
                  }}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Database</Label>
                <Input placeholder="mydb" value={form.database} onChange={(e) => setField('database', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input placeholder="admin" value={form.username} onChange={(e) => setField('username', e.target.value)} required />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Password</Label>
                <Input type="password" placeholder="••••••••" value={form.password} onChange={(e) => setField('password', e.target.value)} required />
              </div>
              <div className="sm:col-span-2 flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={handleTest} disabled={testing}>
                  {testing ? <Spinner className="h-4 w-4" /> : <TestTube className="h-4 w-4" />}
                  Test Connection
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Spinner className="h-4 w-4" /> : 'Save Connection'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => { setShowForm(false); setForm(empty) }}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div>
      ) : connections.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Database className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No connections yet</p>
          <p className="text-sm mt-1">Add your first database connection to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {connections.map((c) => (
            <Card key={c.id} className="hover:border-blue-200 transition-colors">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="bg-blue-50 rounded-lg p-2 shrink-0">
                    <Database className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <p className="text-sm text-gray-400 truncate">{c.username}@{c.host}:{c.port}/{c.database}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <Badge variant="secondary">{DB_TYPES.find((t) => t.value === c.connection_type)?.label ?? c.connection_type}</Badge>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/connections/${c.id}/browse`)}>
                    Browse
                  </Button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={deleting === c.id}
                    className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                  >
                    {deleting === c.id ? <Spinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
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
