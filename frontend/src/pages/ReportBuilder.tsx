import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { connectionsService, type Connection, type TableColumn } from '@/services/connections'
import { TablePicker } from '@/components/ui/table-picker'
import { reportsService, type ReportConfig, type ReportFilter } from '@/services/reports'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { ChevronRight, ChevronLeft, Plus, Trash2, Check } from 'lucide-react'

const STEPS = ['Select Table', 'Choose Columns', 'Add Filters', 'Sort & Limit', 'Preview & Save']
const OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'NOT LIKE', 'IS NULL', 'IS NOT NULL']

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${
            i < current ? 'bg-blue-600 text-white' :
            i === current ? 'bg-blue-600 text-white ring-2 ring-blue-200' :
            'bg-gray-200 text-gray-500'
          }`}>
            {i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </div>
          <span className={`text-xs font-medium hidden sm:block ${i === current ? 'text-blue-600' : 'text-gray-400'}`}>
            {label}
          </span>
          {i < STEPS.length - 1 && <div className={`h-px w-6 ${i < current ? 'bg-blue-600' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  )
}

export function ReportBuilder() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const isEdit = Boolean(id)

  const [step, setStep] = useState(0)
  const [connections, setConnections] = useState<Connection[]>([])
  const [connectionId, setConnectionId] = useState('')
  const [tables, setTables] = useState<string[]>([])
  const [schema, setSchema] = useState<TableColumn[]>([])
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[] | null>(null)
  const [reportName, setReportName] = useState('')

  const [config, setConfig] = useState<ReportConfig>({
    table: '', columns: [], filters: [], orderBy: undefined, limit: 1000,
  })

  const [loadingConn, setLoadingConn] = useState(true)
  const [loadingTables, setLoadingTables] = useState(false)
  const [loadingSchema, setLoadingSchema] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Load connections on mount
  useEffect(() => {
    connectionsService.list()
      .then((r) => setConnections(r.data.data.connections))
      .finally(() => setLoadingConn(false))
  }, [])

  // Load existing report for edit
  useEffect(() => {
    if (!id) return
    reportsService.get(id).then((r) => {
      const report = r.data.data.report
      setReportName(report.name)
      setConnectionId(report.connection_id)
      setConfig(report.config)
    })
  }, [id])

  async function handleConnectionChange(cid: string) {
    if (cid === connectionId && tables.length > 0) return // already loaded
    setConnectionId(cid)
    setConfig((c) => ({ ...c, table: '', columns: [], filters: [], orderBy: undefined }))
    setTables([]); setSchema([])
    setLoadingTables(true)
    try {
      const r = await connectionsService.getTables(cid)
      setTables(r.data.data.tables)
    } finally {
      setLoadingTables(false)
    }
  }

  async function handleTableChange(table: string) {
    if (table === config.table && schema.length > 0) {
      setConfig((c) => ({ ...c, table }))
      return // schema already loaded for this table
    }
    setConfig((c) => ({ ...c, table, columns: [], filters: [], orderBy: undefined }))
    setSchema([])
    setLoadingSchema(true)
    try {
      const r = await connectionsService.getTableSchema(connectionId, table)
      setSchema(r.data.data.schema)
    } finally {
      setLoadingSchema(false)
    }
  }

  function toggleColumn(col: string) {
    setConfig((c) => ({
      ...c,
      columns: c.columns.includes(col) ? c.columns.filter((x) => x !== col) : [...c.columns, col],
    }))
  }

  function addFilter() {
    setConfig((c) => ({
      ...c,
      filters: [...c.filters, { column: schema[0]?.column ?? '', operator: '=', value: '' }],
    }))
  }

  function updateFilter(i: number, patch: Partial<ReportFilter>) {
    setConfig((c) => {
      const filters = [...c.filters]
      filters[i] = { ...filters[i], ...patch }
      return { ...c, filters }
    })
  }

  function removeFilter(i: number) {
    setConfig((c) => ({ ...c, filters: c.filters.filter((_, idx) => idx !== i) }))
  }

  async function loadPreview() {
    setLoadingPreview(true); setPreviewRows(null); setError('')
    try {
      const res = await reportsService.preview(connectionId, { ...config, limit: 50 })
      setPreviewRows(res.data.data.rows)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Preview failed. Try adjusting your filters.')
    } finally {
      setLoadingPreview(false)
    }
  }

  async function handleSave() {
    if (!reportName.trim()) { setError('Please enter a report name.'); return }
    setSaving(true); setError('')
    try {
      if (isEdit && id) {
        await reportsService.update(id, { name: reportName, connection_id: connectionId, config })
        navigate(`/reports/${id}`)
      } else {
        const res = await reportsService.create({ name: reportName, connection_id: connectionId, config })
        navigate(`/reports/${res.data.data.report.id}`)
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Failed to save report.')
    } finally {
      setSaving(false)
    }
  }

  function canNext() {
    if (step === 0) return Boolean(connectionId && config.table)
    if (step === 1) return config.columns.length > 0
    return true
  }

  function goNext() {
    if (step === 3) { loadPreview() }
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const previewColumns = previewRows && previewRows.length > 0 ? Object.keys(previewRows[0]) : config.columns

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/reports')} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Edit Report' : 'New Report'}
        </h2>
      </div>

      <StepIndicator current={step} />

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {/* Step 0: Select connection & table */}
      {step === 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Select Connection & Table</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Database Connection</Label>
              {loadingConn ? <Spinner /> : (
                <Select value={connectionId} onValueChange={handleConnectionChange}>
                  <SelectTrigger><SelectValue placeholder="Choose a connection..." /></SelectTrigger>
                  <SelectContent>
                    {connections.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name} ({c.connection_type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {connectionId && (
              <div className="space-y-1.5">
                <Label>Table</Label>
                {loadingTables ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Spinner className="h-4 w-4" /> Loading tables...
                  </div>
                ) : (
                  <TablePicker
                    tables={tables}
                    value={config.table}
                    onChange={handleTableChange}
                    placeholder="Search and select a table..."
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 1: Choose columns */}
      {step === 1 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Select Columns to Display</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfig((c) => ({ ...c, columns: schema.map((s) => s.column) }))}>
                All
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfig((c) => ({ ...c, columns: [] }))}>
                None
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingSchema ? <Spinner /> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {schema.map((col) => (
                  <label key={col.column} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={config.columns.includes(col.column)}
                      onChange={() => toggleColumn(col.column)}
                      className="rounded"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium font-mono truncate">{col.column}</p>
                      <p className="text-xs text-gray-400">{col.type}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
            {config.columns.length > 0 && (
              <p className="text-sm text-gray-500 mt-3">{config.columns.length} of {schema.length} columns selected</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Filters */}
      {step === 2 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Add Filters (Optional)</CardTitle>
            <Button size="sm" onClick={addFilter}><Plus className="h-4 w-4" /> Add Filter</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {config.filters.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No filters. Report will return all rows.</p>
            ) : (
              config.filters.map((f, i) => (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                  <Select value={f.column} onValueChange={(v) => updateFilter(i, { column: v })}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>{schema.map((s) => <SelectItem key={s.column} value={s.column}>{s.column}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={f.operator} onValueChange={(v) => updateFilter(i, { operator: v })}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>{OPERATORS.map((op) => <SelectItem key={op} value={op}>{op}</SelectItem>)}</SelectContent>
                  </Select>
                  {!['IS NULL', 'IS NOT NULL'].includes(f.operator) && (
                    <Input
                      className="w-40"
                      placeholder="Value"
                      value={f.value as string}
                      onChange={(e) => updateFilter(i, { value: e.target.value })}
                    />
                  )}
                  <button onClick={() => removeFilter(i)} className="text-gray-400 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Sort & Limit */}
      {step === 3 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Sort & Row Limit</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Sort By (Optional)</Label>
                <Select
                  value={config.orderBy?.column ?? ''}
                  onValueChange={(v) => setConfig((c) => ({ ...c, orderBy: v ? { column: v, direction: c.orderBy?.direction ?? 'ASC' } : undefined }))}
                >
                  <SelectTrigger><SelectValue placeholder="No sorting" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No sorting</SelectItem>
                    {config.columns.map((col) => <SelectItem key={col} value={col}>{col}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Direction</Label>
                <Select
                  value={config.orderBy?.direction ?? 'ASC'}
                  onValueChange={(v) => setConfig((c) => ({ ...c, orderBy: c.orderBy ? { ...c.orderBy, direction: v as 'ASC' | 'DESC' } : undefined }))}
                  disabled={!config.orderBy}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ASC">Ascending (A → Z)</SelectItem>
                    <SelectItem value="DESC">Descending (Z → A)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Row Limit (max 10,000)</Label>
              <Input
                type="number"
                min={1} max={10000}
                value={config.limit}
                onChange={(e) => setConfig((c) => ({ ...c, limit: Math.min(10000, parseInt(e.target.value) || 1000) }))}
                className="w-40"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Preview & Save */}
      {step === 4 && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Report Name</CardTitle></CardHeader>
            <CardContent>
              <Input
                placeholder="e.g. Active Customers Report"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                className="max-w-sm"
                autoFocus
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">
                Data Preview {previewRows ? `(${previewRows.length} rows)` : ''}
              </CardTitle>
              <div className="flex gap-2">
                {config.columns.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {config.columns.slice(0, 4).map((c) => <Badge key={c} variant="secondary" className="font-mono text-xs">{c}</Badge>)}
                    {config.columns.length > 4 && <Badge variant="outline">+{config.columns.length - 4}</Badge>}
                  </div>
                )}
                <Button size="sm" variant="outline" onClick={loadPreview} disabled={loadingPreview}>
                  {loadingPreview ? <Spinner className="h-3.5 w-3.5" /> : 'Refresh'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-auto">
              {loadingPreview ? (
                <div className="flex justify-center py-12"><Spinner className="h-6 w-6" /></div>
              ) : previewRows === null ? (
                <p className="text-center py-8 text-gray-400 text-sm">Loading preview...</p>
              ) : previewRows.length === 0 ? (
                <p className="text-center py-8 text-gray-400 text-sm">No rows matched your filters.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {previewColumns.map((col) => (
                        <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewRows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {previewColumns.map((col) => (
                          <td key={col} className="px-4 py-2 text-gray-700 whitespace-nowrap max-w-xs truncate">
                            {row[col] == null ? <span className="text-gray-300 italic">null</span> : String(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={() => setStep((s) => Math.max(s - 1, 0))} disabled={step === 0}>
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={goNext} disabled={!canNext()}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSave} disabled={saving || !reportName.trim()}>
            {saving ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {isEdit ? 'Update Report' : 'Save Report'}
          </Button>
        )}
      </div>
    </div>
  )
}
