import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { connectionsService, type Connection, type TableColumn } from '@/services/connections'
import { TablePicker } from '@/components/ui/table-picker'
import { reportsService, type ReportConfig, type ReportFilter, type ReportJoin } from '@/services/reports'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { ChevronRight, ChevronLeft, Plus, Trash2, Check, Link } from 'lucide-react'

const STEPS = ['Select Table', 'Add JOINs', 'Choose Columns', 'Add Filters', 'Sort & Limit', 'Preview & Save']
const OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'NOT LIKE', 'IS NULL', 'IS NOT NULL']
const JOIN_TYPES = [
  { value: 'INNER', label: 'INNER JOIN' },
  { value: 'LEFT', label: 'LEFT JOIN' },
  { value: 'RIGHT', label: 'RIGHT JOIN' },
]

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-8 overflow-x-auto pb-1">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-1.5 shrink-0">
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-colors ${
            i < current ? 'bg-blue-600 text-white' :
            i === current ? 'bg-blue-600 text-white ring-2 ring-blue-200' :
            'bg-gray-200 text-gray-500'
          }`}>
            {i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </div>
          <span className={`text-xs font-medium hidden sm:block whitespace-nowrap ${i === current ? 'text-blue-600' : 'text-gray-400'}`}>
            {label}
          </span>
          {i < STEPS.length - 1 && <div className={`h-px w-4 shrink-0 ${i < current ? 'bg-blue-600' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  )
}

interface ColumnItem { id: string; label: string; type: string; group: string }

export function ReportBuilder() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)

  const [step, setStep] = useState(0)
  const [connections, setConnections] = useState<Connection[]>([])
  const [connectionId, setConnectionId] = useState('')
  const [tables, setTables] = useState<string[]>([])
  const [schema, setSchema] = useState<TableColumn[]>([])
  const [joinSchemas, setJoinSchemas] = useState<Map<string, TableColumn[]>>(new Map())
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[] | null>(null)
  const [reportName, setReportName] = useState('')

  const [config, setConfig] = useState<ReportConfig>({
    table: '', columns: [], filters: [], orderBy: undefined, limit: 1000, joins: [],
  })

  const [loadingConn, setLoadingConn] = useState(true)
  const [loadingTables, setLoadingTables] = useState(false)
  const [loadingSchema, setLoadingSchema] = useState(false)
  const [loadingJoinSchema, setLoadingJoinSchema] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function loadTablesFor(cid: string) {
    setLoadingTables(true)
    try {
      const r = await connectionsService.getTables(cid)
      setTables(r.data.data.tables)
    } finally {
      setLoadingTables(false)
    }
  }

  async function loadSchemaFor(cid: string, table: string) {
    setLoadingSchema(true)
    try {
      const r = await connectionsService.getTableSchema(cid, table)
      setSchema(r.data.data.schema)
    } finally {
      setLoadingSchema(false)
    }
  }

  const fetchJoinSchema = useCallback(async (tableName: string) => {
    if (!connectionId || joinSchemas.has(tableName)) return
    setLoadingJoinSchema(tableName)
    try {
      const r = await connectionsService.getTableSchema(connectionId, tableName)
      setJoinSchemas((prev) => new Map(prev).set(tableName, r.data.data.schema))
    } finally {
      setLoadingJoinSchema(null)
    }
  }, [connectionId, joinSchemas])

  // ── Load connections on mount; pre-fill from ?connectionId&table ───────────
  useEffect(() => {
    connectionsService.list().then(async (r) => {
      setConnections(r.data.data.connections)
      const preConn = searchParams.get('connectionId')
      const preTable = searchParams.get('table')
      if (preConn && !id) {
        setConnectionId(preConn)
        await loadTablesFor(preConn)
        if (preTable) {
          setConfig((c) => ({ ...c, table: preTable }))
          await loadSchemaFor(preConn, preTable)
        }
      }
    }).finally(() => setLoadingConn(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Load existing report for edit ──────────────────────────────────────────
  useEffect(() => {
    if (!id) return
    reportsService.get(id).then(async (r) => {
      const report = r.data.data.report
      setReportName(report.name)
      setConnectionId(report.connection_id)
      setConfig({ joins: [], ...report.config })

      await loadTablesFor(report.connection_id)

      if (report.config.table) {
        await loadSchemaFor(report.connection_id, report.config.table)
      }
      // Restore join schemas
      const savedJoins = report.config.joins ?? []
      if (savedJoins.length > 0) {
        const entries = await Promise.all(
          savedJoins.map(async (j: ReportJoin) => {
            const r2 = await connectionsService.getTableSchema(report.connection_id, j.table)
            return [j.table, r2.data.data.schema] as [string, TableColumn[]]
          })
        )
        setJoinSchemas(new Map(entries))
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // ── Connection / table change handlers ────────────────────────────────────

  async function handleConnectionChange(cid: string) {
    if (cid === connectionId && tables.length > 0) return
    setConnectionId(cid)
    setConfig({ table: '', columns: [], filters: [], orderBy: undefined, limit: 1000, joins: [] })
    setSchema([]); setTables([]); setJoinSchemas(new Map())
    await loadTablesFor(cid)
  }

  async function handleTableChange(table: string) {
    setConfig((c) => ({ ...c, table, columns: [], filters: [], orderBy: undefined, joins: [] }))
    setSchema([]); setJoinSchemas(new Map())
    if (table) await loadSchemaFor(connectionId, table)
  }

  // ── JOIN handlers ──────────────────────────────────────────────────────────

  function addJoin() {
    const newJoin: ReportJoin = { table: '', type: 'LEFT', on: { leftColumn: '', rightColumn: '' } }
    setConfig((c) => ({ ...c, joins: [...c.joins, newJoin], columns: [], filters: [], orderBy: undefined }))
  }

  function updateJoin(i: number, patch: Partial<ReportJoin>) {
    setConfig((c) => {
      const joins = [...c.joins]
      joins[i] = { ...joins[i], ...patch }
      return { ...c, joins, columns: [], filters: [], orderBy: undefined }
    })
  }

  function updateJoinOn(i: number, patch: Partial<ReportJoin['on']>) {
    setConfig((c) => {
      const joins = [...c.joins]
      joins[i] = { ...joins[i], on: { ...joins[i].on, ...patch } }
      return { ...c, joins }
    })
  }

  function removeJoin(i: number) {
    setConfig((c) => {
      const joins = c.joins.filter((_, idx) => idx !== i)
      // Drop schema for removed table if no other join uses it
      const removedTable = c.joins[i].table
      if (removedTable && !joins.some((j) => j.table === removedTable)) {
        setJoinSchemas((prev) => { const m = new Map(prev); m.delete(removedTable); return m })
      }
      return { ...c, joins, columns: [], filters: [], orderBy: undefined }
    })
  }

  // ── Column helpers ─────────────────────────────────────────────────────────

  const hasJoins = config.joins.length > 0 && config.joins.some((j) => j.table)

  const allColumns: ColumnItem[] = hasJoins
    ? [
        ...schema.map((c) => ({
          id: `${config.table}.${c.column}`,
          label: c.column,
          type: c.type,
          group: config.table,
        })),
        ...[...joinSchemas.entries()].flatMap(([tbl, cols]) =>
          cols.map((c) => ({ id: `${tbl}.${c.column}`, label: c.column, type: c.type, group: tbl }))
        ),
      ]
    : schema.map((c) => ({ id: c.column, label: c.column, type: c.type, group: config.table }))

  function toggleColumn(colId: string) {
    setConfig((c) => ({
      ...c,
      columns: c.columns.includes(colId) ? c.columns.filter((x) => x !== colId) : [...c.columns, colId],
    }))
  }

  // ── Filter helpers ─────────────────────────────────────────────────────────

  const filterColumnOptions = hasJoins
    ? allColumns.map((c) => c.id)
    : schema.map((c) => c.column)

  function addFilter() {
    setConfig((c) => ({
      ...c,
      filters: [...c.filters, { column: filterColumnOptions[0] ?? '', operator: '=', value: '' }],
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

  // ── Sort column options ────────────────────────────────────────────────────

  const sortColumns = hasJoins ? config.columns : config.columns

  // ── Preview ───────────────────────────────────────────────────────────────

  async function loadPreview() {
    setLoadingPreview(true); setPreviewRows(null); setError('')
    try {
      const res = await reportsService.preview(connectionId, { ...config, limit: 50 })
      setPreviewRows(res.data.data.rows)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Preview failed. Try adjusting your filters or joins.')
    } finally {
      setLoadingPreview(false)
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────

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

  // ── Navigation ────────────────────────────────────────────────────────────

  function canNext() {
    if (step === 0) return Boolean(connectionId && config.table)
    if (step === 1) return true // joins are optional
    if (step === 2) return config.columns.length > 0
    return true
  }

  function goNext() {
    if (step === 4) loadPreview()
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const previewColumns = previewRows && previewRows.length > 0 ? Object.keys(previewRows[0]) : config.columns

  // ── Render ────────────────────────────────────────────────────────────────

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

      {/* ── Step 0: Select connection & table ─────────────────────────── */}
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

      {/* ── Step 1: Add JOINs ─────────────────────────────────────────── */}
      {step === 1 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Add JOINs (Optional)</CardTitle>
              <p className="text-sm text-gray-400 mt-0.5">
                Join other tables from <span className="font-mono text-gray-600">{config.table}</span> to include their columns.
              </p>
            </div>
            <Button size="sm" onClick={addJoin}>
              <Plus className="h-4 w-4" /> Add JOIN
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {config.joins.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-gray-400 gap-2">
                <Link className="h-8 w-8 opacity-20" />
                <p className="text-sm">No joins added. Click "Add JOIN" to link another table, or proceed to choose columns.</p>
              </div>
            ) : (
              config.joins.map((join, i) => (
                <div key={i} className="flex items-center gap-2 flex-wrap p-3 bg-gray-50 rounded-lg border border-gray-100">
                  {/* Join type */}
                  <Select value={join.type} onValueChange={(v) => updateJoin(i, { type: v as ReportJoin['type'] })}>
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {JOIN_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  {/* Join table */}
                  <div className="w-44">
                    <TablePicker
                      tables={tables.filter((t) => t !== config.table)}
                      value={join.table}
                      onChange={(t) => {
                        updateJoin(i, { table: t, on: { leftColumn: '', rightColumn: '' } })
                        fetchJoinSchema(t)
                      }}
                      placeholder="Select table..."
                    />
                  </div>

                  {join.table && (
                    <>
                      <span className="text-xs text-gray-400 font-medium">ON</span>

                      {/* Left column (base table) */}
                      <Select value={join.on.leftColumn} onValueChange={(v) => updateJoinOn(i, { leftColumn: v })}>
                        <SelectTrigger className="w-44 h-8 text-xs">
                          <SelectValue placeholder={`${config.table}.column`} />
                        </SelectTrigger>
                        <SelectContent>
                          {schema.map((c) => (
                            <SelectItem key={c.column} value={`${config.table}.${c.column}`}>
                              <span className="font-mono">{config.table}.{c.column}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <span className="text-gray-400">=</span>

                      {/* Right column (join table) */}
                      {loadingJoinSchema === join.table ? (
                        <Spinner className="h-4 w-4" />
                      ) : (
                        <Select value={join.on.rightColumn} onValueChange={(v) => updateJoinOn(i, { rightColumn: v })}>
                          <SelectTrigger className="w-44 h-8 text-xs">
                            <SelectValue placeholder={`${join.table}.column`} />
                          </SelectTrigger>
                          <SelectContent>
                            {(joinSchemas.get(join.table) ?? []).map((c) => (
                              <SelectItem key={c.column} value={`${join.table}.${c.column}`}>
                                <span className="font-mono">{join.table}.{c.column}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </>
                  )}

                  <button onClick={() => removeJoin(i)} className="text-gray-400 hover:text-red-500 ml-auto">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Choose columns ────────────────────────────────────── */}
      {step === 2 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Select Columns to Display</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline"
                onClick={() => setConfig((c) => ({ ...c, columns: allColumns.map((col) => col.id) }))}>
                All
              </Button>
              <Button size="sm" variant="outline"
                onClick={() => setConfig((c) => ({ ...c, columns: [] }))}>
                None
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingSchema ? <Spinner /> : (
              <>
                {hasJoins ? (
                  // Grouped by table
                  [config.table, ...config.joins.map((j) => j.table).filter(Boolean)].map((tbl) => {
                    const cols = allColumns.filter((c) => c.group === tbl)
                    return cols.length === 0 ? null : (
                      <div key={tbl} className="mb-5">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 font-mono">{tbl}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {cols.map((col) => (
                            <label key={col.id} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                              <input
                                type="checkbox"
                                checked={config.columns.includes(col.id)}
                                onChange={() => toggleColumn(col.id)}
                                className="rounded"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-medium font-mono truncate">{col.label}</p>
                                <p className="text-xs text-gray-400">{col.type}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {allColumns.map((col) => (
                      <label key={col.id} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                          type="checkbox"
                          checked={config.columns.includes(col.id)}
                          onChange={() => toggleColumn(col.id)}
                          className="rounded"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium font-mono truncate">{col.label}</p>
                          <p className="text-xs text-gray-400">{col.type}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                {config.columns.length > 0 && (
                  <p className="text-sm text-gray-500 mt-3">
                    {config.columns.length} of {allColumns.length} columns selected
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Filters ───────────────────────────────────────────── */}
      {step === 3 && (
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
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {filterColumnOptions.map((col) => (
                        <SelectItem key={col} value={col}>
                          <span className="font-mono">{col}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
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

      {/* ── Step 4: Sort & Limit ──────────────────────────────────────── */}
      {step === 4 && (
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
                    {sortColumns.map((col) => <SelectItem key={col} value={col}><span className="font-mono">{col}</span></SelectItem>)}
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

      {/* ── Step 5: Preview & Save ────────────────────────────────────── */}
      {step === 5 && (
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
              <div className="flex gap-2 items-center">
                {config.columns.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {config.columns.slice(0, 4).map((c) => <Badge key={c} variant="secondary" className="font-mono text-xs">{c}</Badge>)}
                    {config.columns.length > 4 && <Badge variant="outline">+{config.columns.length - 4}</Badge>}
                  </div>
                )}
                {config.joins.length > 0 && (
                  <Badge variant="outline"><Link className="h-3 w-3 mr-1" />{config.joins.length} JOIN{config.joins.length > 1 ? 's' : ''}</Badge>
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
                        <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap font-mono">
                          {col}
                        </th>
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

      {/* ── Navigation ────────────────────────────────────────────────── */}
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
