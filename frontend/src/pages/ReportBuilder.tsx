import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { connectionsService, type Connection, type TableColumn, type TableEntry } from '@/services/connections'
import { TablePicker } from '@/components/ui/table-picker'
import { reportsService, type ReportConfig, type ReportFilter, type ReportJoin, type AggregationConfig } from '@/services/reports'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { ReportChart } from '@/components/ui/report-chart'
import type { ChartConfig } from '@/services/reports'
import {
  ChevronRight, ChevronLeft, Plus, Trash2, Check,
  Link, BarChart2, LineChart, AreaChart, PieChart, Layers, AlertCircle,
} from 'lucide-react'

const STEPS = ['Select Table', 'Add JOINs', 'Choose Columns', 'Add Filters', 'Sort & Limit', 'Configure Chart', 'Preview & Save']

const NUMERIC_TYPES = /int|float|double|decimal|numeric|real|money|bigint|number|bit/i
function isNumeric(type: string) { return NUMERIC_TYPES.test(type) }

/** Returns the actual result-set key for a column: alias if set, or unqualified col name. */
function getResultKey(colId: string, aliases: Record<string, string> = {}): string {
  const alias = (aliases[colId] ?? '').trim()
  if (alias) return alias
  return colId.includes('.') ? colId.split('.')[1] : colId
}

interface AxisColMeta { id: string; label: string; type: string; isAgg: boolean }

function AxisPicker({
  cols, selected, hint, onSelect,
}: {
  cols: AxisColMeta[]
  selected: string
  hint: 'numeric' | 'categorical'
  onSelect: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const filtered = search
    ? cols.filter((c) => c.label.toLowerCase().includes(search.toLowerCase()))
    : cols

  // Sort recommended columns first (no dimming — just ordering)
  const sorted = [...filtered].sort((a, b) => {
    const aNum = a.isAgg || isNumeric(a.type)
    const bNum = b.isAgg || isNumeric(b.type)
    const aFit = hint === 'numeric' ? aNum : !aNum
    const bFit = hint === 'numeric' ? bNum : !bNum
    if (aFit === bFit) return 0
    return aFit ? -1 : 1
  })

  return (
    <div className="space-y-2">
      {cols.length > 6 && (
        <input
          type="text"
          placeholder="Filter columns…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-xs px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      )}
      <div className="max-h-52 overflow-y-auto pr-0.5 space-y-1">
        {sorted.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">No columns match.</p>
        )}
        {sorted.map((col) => {
          const numeric    = col.isAgg || isNumeric(col.type)
          const isSelected = selected === col.id
          return (
            <button
              key={col.id}
              type="button"
              onClick={() => onSelect(col.id)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-left transition-all ${
                isSelected
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                  : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 bg-white'
              }`}
            >
              <span className={`text-sm font-mono font-medium truncate ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                {col.label}
              </span>
              <span className={`text-[11px] shrink-0 px-1.5 py-0.5 rounded font-medium ${
                isSelected ? 'bg-blue-500 text-blue-100' :
                col.isAgg  ? 'bg-violet-100 text-violet-600' :
                numeric    ? 'bg-green-100 text-green-700' :
                             'bg-gray-100 text-gray-500'
              }`}>
                {col.isAgg ? col.type : (col.type || 'text')}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
const OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'NOT LIKE', 'IS NULL', 'IS NOT NULL', 'IN']
const JOIN_TYPES: { value: ReportJoin['type']; label: string; desc: string; color: string }[] = [
  { value: 'INNER', label: 'INNER', desc: 'Only matching rows', color: 'bg-blue-600 text-white' },
  { value: 'LEFT',  label: 'LEFT',  desc: 'All left rows',     color: 'bg-violet-600 text-white' },
  { value: 'RIGHT', label: 'RIGHT', desc: 'All right rows',    color: 'bg-emerald-600 text-white' },
]
const AGG_FNS: AggregationConfig['fn'][] = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX']

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-8 overflow-x-auto pb-1">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-1.5 shrink-0">
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-colors ${
            i < current  ? 'bg-blue-600 text-white' :
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

const EMPTY_CONFIG: ReportConfig = {
  table: '', columns: [], filters: [], orderBy: undefined, limit: 1000,
  joins: [], chart: undefined, aggregations: [], columnAliases: {},
}

export function ReportBuilder() {
  const navigate  = useNavigate()
  const { id }    = useParams<{ id?: string }>()
  const [searchParams] = useSearchParams()
  const isEdit    = Boolean(id)
  const mounted   = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const [step,       setStep]       = useState(0)
  const [aggTab,     setAggTab]     = useState<'columns' | 'aggregations'>('columns')
  const [connections, setConnections] = useState<Connection[]>([])
  const [connectionId, setConnectionId] = useState('')
  const [tables,     setTables]     = useState<TableEntry[]>([])
  const [schema,     setSchema]     = useState<TableColumn[]>([])
  const [joinSchemas, setJoinSchemas] = useState<Map<string, TableColumn[]>>(new Map())
  const [loadingJoinSchemas, setLoadingJoinSchemas] = useState<Set<string>>(new Set())
  const [joinConnTables, setJoinConnTables] = useState<Map<string, TableEntry[]>>(new Map())
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[] | null>(null)
  const [reportName, setReportName] = useState('')
  const [config,     setConfig]     = useState<ReportConfig>(EMPTY_CONFIG)

  const [loadingConn,    setLoadingConn]    = useState(true)
  const [loadingTables,  setLoadingTables]  = useState(false)
  const [loadingSchema,  setLoadingSchema]  = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState('')

  // ── Data loading ──────────────────────────────────────────────────────────

  async function loadTablesFor(cid: string) {
    setLoadingTables(true)
    try {
      const r = await connectionsService.getTables(cid)
      if (mounted.current) setTables(r.data.data.tables)
    } finally {
      if (mounted.current) setLoadingTables(false)
    }
  }

  async function loadSchemaFor(cid: string, table: string) {
    setLoadingSchema(true)
    try {
      const r = await connectionsService.getTableSchema(cid, table)
      if (mounted.current) setSchema(r.data.data.schema)
    } finally {
      if (mounted.current) setLoadingSchema(false)
    }
  }

  async function loadJoinConnTables(connId: string) {
    if (joinConnTables.has(connId)) return
    try {
      const r = await connectionsService.getTables(connId)
      if (mounted.current) setJoinConnTables((prev) => new Map(prev).set(connId, r.data.data.tables))
    } catch { /* ignore — user will see empty picker */ }
  }

  function getTablesForJoin(join: ReportJoin): TableEntry[] {
    if (!join.connectionId || join.connectionId === connectionId) return tables
    return joinConnTables.get(join.connectionId) ?? []
  }

  // fetchJoinSchema: no joinSchemas dep — uses functional state update to avoid stale closure
  // connIdOverride: used for cross-connection JOINs
  const fetchJoinSchema = useCallback(async (tableName: string, connIdOverride?: string) => {
    const connId = connIdOverride ?? connectionId
    if (!tableName || !connId) return
    setLoadingJoinSchemas((prev) => { const s = new Set(prev); s.add(tableName); return s })
    try {
      const r = await connectionsService.getTableSchema(connId, tableName)
      if (mounted.current) {
        setJoinSchemas((prev) => new Map(prev).set(tableName, r.data.data.schema))
      }
    } finally {
      if (mounted.current) {
        setLoadingJoinSchemas((prev) => { const s = new Set(prev); s.delete(tableName); return s })
      }
    }
  }, [connectionId])

  // ── Load on mount ─────────────────────────────────────────────────────────

  useEffect(() => {
    connectionsService.list().then(async (r) => {
      if (!mounted.current) return
      setConnections(r.data.data.connections)
      const preConn  = searchParams.get('connectionId')
      const preTable = searchParams.get('table')
      if (preConn && !id) {
        setConnectionId(preConn)
        await loadTablesFor(preConn)
        if (preTable) {
          setConfig((c) => ({ ...c, table: preTable }))
          await loadSchemaFor(preConn, preTable)
        }
      }
    }).finally(() => { if (mounted.current) setLoadingConn(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Load existing report for edit ─────────────────────────────────────────

  useEffect(() => {
    if (!id) return
    reportsService.get(id).then(async (r) => {
      if (!mounted.current) return
      const report = r.data.data.report
      setReportName(report.name)
      setConnectionId(report.connection_id)
      setConfig({ ...EMPTY_CONFIG, ...report.config })
      await loadTablesFor(report.connection_id)
      if (report.config.table) await loadSchemaFor(report.connection_id, report.config.table)
      const savedJoins = report.config.joins ?? []
      if (savedJoins.length > 0) {
        const entries = await Promise.all(
          savedJoins.map(async (j: ReportJoin) => {
            const r2 = await connectionsService.getTableSchema(report.connection_id, j.table)
            return [j.table, r2.data.data.schema] as [string, TableColumn[]]
          })
        )
        if (mounted.current) setJoinSchemas(new Map(entries))
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // ── Connection / table handlers ───────────────────────────────────────────

  async function handleConnectionChange(cid: string) {
    if (cid === connectionId && tables.length > 0) return
    setConnectionId(cid)
    setConfig(EMPTY_CONFIG)
    setSchema([]); setTables([]); setJoinSchemas(new Map()); setPreviewRows(null)
    await loadTablesFor(cid)
  }

  async function handleTableChange(table: string) {
    setConfig((c) => ({ ...c, table, columns: [], filters: [], orderBy: undefined, joins: [], aggregations: [], chart: undefined, columnAliases: {} }))
    setSchema([]); setJoinSchemas(new Map()); setPreviewRows(null)
    if (table) await loadSchemaFor(connectionId, table)
  }

  // ── JOIN handlers ─────────────────────────────────────────────────────────

  function addJoin() {
    const newJoin: ReportJoin = { table: '', type: 'LEFT', on: { leftColumn: '', rightColumn: '' } }
    // Don't reset columns yet — user hasn't picked a join table
    setConfig((c) => ({ ...c, joins: [...c.joins, newJoin] }))
  }

  function updateJoin(i: number, patch: Partial<ReportJoin>) {
    const tableChanged = 'table' in patch
    setConfig((c) => {
      const joins = [...c.joins]
      joins[i] = { ...joins[i], ...patch }
      // Only reset cols/filters when the joined table changes — type/ON changes are harmless
      if (tableChanged) {
        return { ...c, joins, columns: [], filters: [], orderBy: undefined, aggregations: [], chart: undefined, columnAliases: {} }
      }
      return { ...c, joins }
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
      const removedTable = c.joins[i].table
      const joins = c.joins.filter((_, idx) => idx !== i)
      if (removedTable) {
        setJoinSchemas((prev) => { const m = new Map(prev); m.delete(removedTable); return m })
      }
      // Filter out columns from the removed table; unqualify if no joins left
      let columns = c.columns
      if (removedTable) {
        columns = columns.filter((col) => !col.startsWith(`${removedTable}.`))
        if (joins.length === 0) {
          // Strip table-qualifier from remaining cols
          columns = columns.map((col) => col.includes('.') ? col.split('.')[1] : col)
        }
      }
      // Keep only aliases for columns that still exist
      const newAliases: Record<string, string> = {}
      for (const col of columns) {
        if (c.columnAliases?.[col]) newAliases[col] = c.columnAliases[col]
      }
      return { ...c, joins, columns, aggregations: [], chart: undefined, columnAliases: newAliases }
    })
  }

  // ── Aggregation helpers ───────────────────────────────────────────────────

  function addAgg() {
    const firstCol = allColumns[0]?.id ?? '*'
    const newAgg: AggregationConfig = { fn: 'COUNT', column: firstCol, alias: `count_1` }
    setConfig((c) => ({ ...c, aggregations: [...c.aggregations, newAgg] }))
  }

  function updateAgg(i: number, patch: Partial<AggregationConfig>) {
    setConfig((c) => {
      const aggregations = [...c.aggregations]
      aggregations[i] = { ...aggregations[i], ...patch }
      return { ...c, aggregations }
    })
  }

  function removeAgg(i: number) {
    setConfig((c) => ({ ...c, aggregations: c.aggregations.filter((_, idx) => idx !== i) }))
  }

  // ── Derived data (memoised) ───────────────────────────────────────────────

  const hasJoins = config.joins.length > 0 && config.joins.some((j) => j.table)

  const allColumns = useMemo<ColumnItem[]>(() => {
    if (!hasJoins) return schema.map((c) => ({ id: c.column, label: c.column, type: c.type, group: config.table }))
    return [
      ...schema.map((c) => ({ id: `${config.table}.${c.column}`, label: c.column, type: c.type, group: config.table })),
      ...[...joinSchemas.entries()].flatMap(([tbl, cols]) =>
        cols.map((c) => ({ id: `${tbl}.${c.column}`, label: c.column, type: c.type, group: tbl }))
      ),
    ]
  }, [hasJoins, schema, config.table, joinSchemas])

  const filterColumnOptions = useMemo(
    () => hasJoins ? allColumns.map((c) => c.id) : schema.map((c) => c.column),
    [hasJoins, allColumns, schema]
  )

  // Sort options: value = original col ID (for ORDER BY), label = alias or short name (for display)
  const sortOptions = useMemo(() => {
    const aliases = config.columnAliases ?? {}
    return [
      ...config.columns.map((col) => ({ value: col, label: getResultKey(col, aliases) })),
      ...config.aggregations.map((a) => ({ value: a.alias, label: a.alias })),
    ]
  }, [config.columns, config.aggregations, config.columnAliases])

  // Result keys used for initial chart axis selection
  const allAxisCols = useMemo(() => {
    const aliases = config.columnAliases ?? {}
    return [
      ...config.columns.map((col) => getResultKey(col, aliases)),
      ...config.aggregations.map((a) => a.alias),
    ]
  }, [config.columns, config.aggregations, config.columnAliases])

  // Rich metadata for axis pickers: id = result key, label = alias/short name, data type, isAgg flag
  const axisColsMeta = useMemo(() => {
    const colMap = new Map(allColumns.map((c) => [c.id, c]))
    const aliases = config.columnAliases ?? {}
    const cols = config.columns.map((colId) => {
      const meta = colMap.get(colId)
      const resultKey = getResultKey(colId, aliases)
      return { id: resultKey, label: resultKey, type: meta?.type ?? '', isAgg: false }
    })
    const aggs = config.aggregations.map((a) => ({
      id: a.alias, label: a.alias, type: `${a.fn}(${a.column})`, isAgg: true,
    }))
    return [...cols, ...aggs]
  }, [config.columns, config.aggregations, config.columnAliases, allColumns])

  // ── Filter helpers ────────────────────────────────────────────────────────

  function toggleColumn(colId: string) {
    setConfig((c) => {
      if (c.columns.includes(colId)) {
        const aliases = { ...(c.columnAliases ?? {}) }
        delete aliases[colId]
        return { ...c, columns: c.columns.filter((x) => x !== colId), columnAliases: aliases }
      }
      return { ...c, columns: [...c.columns, colId] }
    })
  }

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

  // ── Preview ───────────────────────────────────────────────────────────────

  async function loadPreview() {
    setLoadingPreview(true); setPreviewRows(null); setError('')
    try {
      const res = await reportsService.preview(connectionId, { ...config, limit: 50 })
      if (mounted.current) setPreviewRows(res.data.data.rows)
    } catch (err: unknown) {
      if (!mounted.current) return
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Preview failed. Try adjusting your filters or joins.')
    } finally {
      if (mounted.current) setLoadingPreview(false)
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
    if (step === 1) {
      // All joins must be complete
      return config.joins.every((j) => j.table && j.on.leftColumn && j.on.rightColumn)
    }
    if (step === 2) return config.columns.length > 0 || config.aggregations.length > 0
    return true
  }

  function goNext() {
    if (step === 5) loadPreview()
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const previewColumns = previewRows && previewRows.length > 0
    ? Object.keys(previewRows[0])
    : [
        ...config.columns.map((col) => getResultKey(col, config.columnAliases ?? {})),
        ...config.aggregations.map((a) => a.alias),
      ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/reports')} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit Report' : 'New Report'}</h2>
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
              <CardTitle className="text-base">Add JOINs <span className="text-gray-400 font-normal">(Optional)</span></CardTitle>
              <p className="text-sm text-gray-400 mt-0.5">
                Combine <span className="font-mono text-gray-600 font-medium">{config.table}</span> with other tables.
              </p>
            </div>
            <Button size="sm" onClick={addJoin}>
              <Plus className="h-4 w-4" /> Add JOIN
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* JOIN type legend */}
            <div className="flex flex-wrap gap-3 text-xs text-gray-500 bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
              {JOIN_TYPES.map((t) => (
                <span key={t.value} className="flex items-center gap-1.5">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold ${t.color}`}>{t.value}</span>
                  {t.desc}
                </span>
              ))}
            </div>

            {config.joins.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-gray-400 gap-2">
                <Link className="h-9 w-9 opacity-20" />
                <p className="text-sm">No joins added. Click "Add JOIN" or go to the next step.</p>
              </div>
            ) : (
              config.joins.map((join, i) => {
                const incomplete = join.table && (!join.on.leftColumn || !join.on.rightColumn)
                return (
                  <div
                    key={i}
                    className={`rounded-xl border p-4 space-y-3 transition-colors ${
                      incomplete ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    {/* Row 1: type toggle + connection + table + delete */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* JOIN type toggle */}
                      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-bold">
                        {JOIN_TYPES.map((t) => (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => updateJoin(i, { type: t.value })}
                            className={`px-3 py-1.5 transition-colors ${
                              join.type === t.value ? t.color : 'text-gray-400 hover:bg-gray-100'
                            }`}
                          >
                            {t.value}
                          </button>
                        ))}
                      </div>

                      {/* Cross-connection selector */}
                      {connections.length > 1 && (
                        <select
                          value={join.connectionId ?? connectionId}
                          onChange={(e) => {
                            const newConn = e.target.value === connectionId ? undefined : e.target.value
                            updateJoin(i, { connectionId: newConn, table: '', on: { leftColumn: '', rightColumn: '' } })
                            if (newConn) loadJoinConnTables(newConn)
                          }}
                          className="h-9 text-xs border border-gray-200 rounded-lg px-2 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 max-w-[160px]"
                          title="Connection for this JOIN"
                        >
                          {connections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.id === connectionId ? `${c.name} (main)` : `🔗 ${c.name}`}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Join table */}
                      <div className="flex-1 min-w-40">
                        <TablePicker
                          tables={getTablesForJoin(join).filter((t) =>
                            !join.connectionId || join.connectionId !== connectionId ? true : t.name !== config.table
                          )}
                          value={join.table}
                          onChange={(t) => {
                            updateJoin(i, { table: t, on: { leftColumn: '', rightColumn: '' } })
                            if (t) fetchJoinSchema(t, join.connectionId)
                          }}
                          placeholder="Select table..."
                        />
                      </div>

                      <button onClick={() => removeJoin(i)} className="text-gray-400 hover:text-red-500 p-1 rounded">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Row 2: ON condition */}
                    {join.table && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide w-6 text-center">ON</span>

                        {/* Left column (base table) */}
                        <Select value={join.on.leftColumn} onValueChange={(v) => updateJoinOn(i, { leftColumn: v })}>
                          <SelectTrigger className="flex-1 min-w-36 h-8 text-xs">
                            <SelectValue placeholder={`${config.table}.column`} />
                          </SelectTrigger>
                          <SelectContent>
                            {schema.map((c) => (
                              <SelectItem key={c.column} value={`${config.table}.${c.column}`}>
                                <span className="font-mono">{config.table}.{c.column}</span>
                                {c.type && <span className="ml-2 text-gray-400 text-[11px]">{c.type}</span>}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <span className="text-gray-400 font-mono text-sm">=</span>

                        {/* Right column (join table) */}
                        {loadingJoinSchemas.has(join.table) ? (
                          <div className="flex items-center gap-2 text-sm text-gray-400 flex-1 min-w-36">
                            <Spinner className="h-4 w-4" /> Loading schema…
                          </div>
                        ) : (
                          <Select value={join.on.rightColumn} onValueChange={(v) => updateJoinOn(i, { rightColumn: v })}>
                            <SelectTrigger className="flex-1 min-w-36 h-8 text-xs">
                              <SelectValue placeholder={`${join.table}.column`} />
                            </SelectTrigger>
                            <SelectContent>
                              {(joinSchemas.get(join.table) ?? []).map((c) => (
                                <SelectItem key={c.column} value={`${join.table}.${c.column}`}>
                                  <span className="font-mono">{join.table}.{c.column}</span>
                                  {c.type && <span className="ml-2 text-gray-400 text-[11px]">{c.type}</span>}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}

                    {/* Validation hint */}
                    {incomplete && (
                      <p className="flex items-center gap-1.5 text-xs text-amber-600">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Select both columns to complete the ON condition.
                      </p>
                    )}
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Choose columns / aggregations ─────────────────────── */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Columns &amp; Aggregations</CardTitle>
              {aggTab === 'columns' && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline"
                    onClick={() => setConfig((c) => ({ ...c, columns: allColumns.map((col) => col.id) }))}>
                    All
                  </Button>
                  <Button size="sm" variant="outline"
                    onClick={() => setConfig((c) => ({ ...c, columns: [], columnAliases: {} }))}>
                    None
                  </Button>
                </div>
              )}
              {aggTab === 'aggregations' && (
                <Button size="sm" onClick={addAgg}><Plus className="h-4 w-4" /> Add</Button>
              )}
            </div>
            <div className="flex border-b border-gray-200 mt-3 -mx-6 px-6">
              {(['columns', 'aggregations'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setAggTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    aggTab === tab
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'columns'
                    ? `Columns${config.columns.length > 0 ? ` (${config.columns.length})` : ''}`
                    : `Aggregations${config.aggregations.length > 0 ? ` (${config.aggregations.length})` : ''}`
                  }
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent>
            {/* Columns tab */}
            {aggTab === 'columns' && (
              loadingSchema ? <Spinner /> : (
                <>
                  {hasJoins ? (
                    [config.table, ...config.joins.map((j) => j.table).filter(Boolean)].map((tbl) => {
                      const cols = allColumns.filter((c) => c.group === tbl)
                      return cols.length === 0 ? null : (
                        <div key={tbl} className="mb-5">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 font-mono">{tbl}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {cols.map((col) => (
                              <label key={col.id} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                <input type="checkbox" className="rounded"
                                  checked={config.columns.includes(col.id)}
                                  onChange={() => toggleColumn(col.id)} />
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
                          <input type="checkbox" className="rounded"
                            checked={config.columns.includes(col.id)}
                            onChange={() => toggleColumn(col.id)} />
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

                  {/* Display name / alias editor */}
                  {config.columns.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Display Names
                        <span className="font-normal text-gray-400 normal-case ml-2">— rename columns in results &amp; charts (optional)</span>
                      </p>
                      <div className="mt-3 space-y-2">
                        {config.columns.map((col) => {
                          const shortName = col.includes('.') ? col.split('.')[1] : col
                          return (
                            <div key={col} className="flex items-center gap-3">
                              <span className="font-mono text-xs text-gray-400 w-44 truncate shrink-0" title={col}>{col}</span>
                              <span className="text-gray-300 shrink-0 text-xs">→</span>
                              <input
                                type="text"
                                className="flex-1 max-w-xs h-7 text-xs px-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder={shortName}
                                value={config.columnAliases?.[col] ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setConfig((c) => {
                                    const aliases = { ...(c.columnAliases ?? {}) }
                                    if (val) aliases[col] = val
                                    else delete aliases[col]
                                    return { ...c, columnAliases: aliases }
                                  })
                                }}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )
            )}

            {/* Aggregations tab */}
            {aggTab === 'aggregations' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">
                  Selected columns become GROUP BY keys. Each aggregation produces a computed result column.
                </p>
                {config.aggregations.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-gray-400 gap-2">
                    <BarChart2 className="h-9 w-9 opacity-20" />
                    <p className="text-sm">No aggregations yet. Click "Add" to create one.</p>
                  </div>
                ) : (
                  config.aggregations.map((agg, i) => (
                    <div key={i} className="flex items-center gap-2 flex-wrap p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <Select value={agg.fn} onValueChange={(v) => updateAgg(i, { fn: v as AggregationConfig['fn'] })}>
                        <SelectTrigger className="w-24 h-8 text-xs font-mono font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AGG_FNS.map((fn) => <SelectItem key={fn} value={fn}>{fn}</SelectItem>)}
                        </SelectContent>
                      </Select>

                      <span className="text-gray-400 text-sm font-mono">(</span>

                      <Select value={agg.column} onValueChange={(v) => updateAgg(i, { column: v })}>
                        <SelectTrigger className="w-48 h-8 text-xs">
                          <SelectValue placeholder="Column" />
                        </SelectTrigger>
                        <SelectContent>
                          {agg.fn === 'COUNT' && (
                            <SelectItem value="*"><span className="font-mono">* (all rows)</span></SelectItem>
                          )}
                          {allColumns.map((col) => (
                            <SelectItem key={col.id} value={col.id}>
                              <span className="font-mono">{col.id}</span>
                              <span className="ml-2 text-gray-400 text-[11px]">{col.type}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <span className="text-gray-400 text-sm font-mono">) AS</span>

                      <Input
                        className="h-8 w-32 text-xs font-mono"
                        placeholder="alias"
                        value={agg.alias}
                        onChange={(e) => updateAgg(i, { alias: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^([0-9])/, '_$1') })}
                      />

                      <button onClick={() => removeAgg(i)} className="text-gray-400 hover:text-red-500 p-1 rounded ml-auto">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Filters ───────────────────────────────────────────── */}
      {step === 3 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Add Filters <span className="text-gray-400 font-normal">(Optional)</span></CardTitle>
            <Button size="sm" onClick={addFilter}><Plus className="h-4 w-4" /> Add Filter</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {config.filters.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No filters — report will return all rows.</p>
            ) : (
              config.filters.map((f, i) => (
                <div key={i} className="flex items-center gap-2 flex-wrap p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <Select value={f.column} onValueChange={(v) => updateFilter(i, { column: v })}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {filterColumnOptions.map((col) => (
                        <SelectItem key={col} value={col}><span className="font-mono">{col}</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={f.operator} onValueChange={(v) => updateFilter(i, { operator: v })}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((op) => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {!['IS NULL', 'IS NOT NULL'].includes(f.operator) && (
                    <Input
                      className="w-40"
                      placeholder={f.operator === 'IN' ? 'a, b, c' : 'Value'}
                      value={f.value as string}
                      onChange={(e) => updateFilter(i, { value: e.target.value })}
                    />
                  )}
                  <button onClick={() => removeFilter(i)} className="text-gray-400 hover:text-red-500 ml-auto p-1 rounded">
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
                  onValueChange={(v) => setConfig((c) => ({
                    ...c,
                    orderBy: v ? { column: v, direction: c.orderBy?.direction ?? 'ASC' } : undefined,
                  }))}
                >
                  <SelectTrigger><SelectValue placeholder="No sorting" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No sorting</SelectItem>
                    {sortOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}><span className="font-mono">{opt.label}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Direction</Label>
                <Select
                  value={config.orderBy?.direction ?? 'ASC'}
                  onValueChange={(v) => setConfig((c) => ({
                    ...c,
                    orderBy: c.orderBy ? { ...c.orderBy, direction: v as 'ASC' | 'DESC' } : undefined,
                  }))}
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
                type="number" min={1} max={10000}
                value={config.limit}
                onChange={(e) => setConfig((c) => ({ ...c, limit: Math.min(10000, parseInt(e.target.value) || 1000) }))}
                className="w-40"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 5: Configure Chart ───────────────────────────────────── */}
      {step === 5 && (() => {
        const CHART_TYPES: { value: ChartConfig['type']; label: string; icon: React.ReactNode }[] = [
          { value: 'bar',         label: 'Bar',         icon: <BarChart2 className="h-4 w-4" /> },
          { value: 'line',        label: 'Line',        icon: <LineChart className="h-4 w-4" />  },
          { value: 'area',        label: 'Area',        icon: <AreaChart className="h-4 w-4" />  },
          { value: 'pie',         label: 'Pie',         icon: <PieChart className="h-4 w-4" />   },
          { value: 'stacked-bar', label: 'Stacked Bar', icon: <Layers className="h-4 w-4" />    },
        ]
        const chart = config.chart
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configure Chart <span className="text-gray-400 font-normal">(Optional)</span></CardTitle>
              <p className="text-sm text-gray-400 mt-0.5">Add a chart to visualise the report data after running it.</p>
            </CardHeader>
            <CardContent className="space-y-5">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={Boolean(chart)}
                  onChange={(e) => setConfig((c) => ({
                    ...c,
                    chart: e.target.checked
                      ? { type: 'bar', xAxis: allAxisCols[0] ?? '', yAxis: allAxisCols[1] ?? allAxisCols[0] ?? '' }
                      : undefined,
                  }))}
                />
                <span className="text-sm font-medium text-gray-700">Include a chart in this report</span>
              </label>

              {chart && (
                <>
                  <div className="space-y-1.5">
                    <Label>Chart Type</Label>
                    <div className="flex gap-2 flex-wrap">
                      {CHART_TYPES.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setConfig((c) => {
                            if (!c.chart) return c
                            if (t.value === 'stacked-bar') {
                              const defaultSeries = axisColsMeta
                                .filter((col) => col.id !== (c.chart?.xAxis ?? ''))
                                .map((col) => col.id)
                              return { ...c, chart: { ...c.chart, type: 'stacked-bar', yAxis: '', series: defaultSeries } }
                            }
                            return { ...c, chart: { ...c.chart, type: t.value, series: undefined } }
                          })}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                            chart.type === t.value
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
                          }`}
                        >
                          {t.icon} {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* X Axis picker */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-semibold">
                          {chart.type === 'pie' ? 'Name Column' : 'X Axis'}
                        </Label>
                        <span className="text-xs text-gray-400">{chart.type === 'pie' ? 'categories' : 'labels / categories'}</span>
                      </div>
                      <AxisPicker
                        cols={axisColsMeta}
                        selected={chart.xAxis}
                        hint="categorical"
                        onSelect={(v) => setConfig((c) => ({ ...c, chart: c.chart ? { ...c.chart, xAxis: v } : undefined }))}
                      />
                    </div>

                    {/* Y Axis picker OR Series multi-select for stacked-bar */}
                    {chart.type === 'stacked-bar' ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm font-semibold">Series Columns</Label>
                          <span className="text-xs text-gray-400">stacked</span>
                        </div>
                        <div className="grid grid-cols-1 gap-1.5 max-h-52 overflow-y-auto pr-1">
                          {axisColsMeta.filter((col) => col.id !== chart.xAxis).map((col) => (
                            <label key={col.id} className="flex items-center gap-2.5 px-3 py-2 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors text-sm">
                              <input
                                type="checkbox"
                                className="rounded shrink-0"
                                checked={(chart.series ?? []).includes(col.id)}
                                onChange={() => {
                                  setConfig((c) => {
                                    const series = c.chart?.series ?? []
                                    const newSeries = series.includes(col.id)
                                      ? series.filter((s) => s !== col.id)
                                      : [...series, col.id]
                                    return { ...c, chart: c.chart ? { ...c.chart, series: newSeries } : undefined }
                                  })
                                }}
                              />
                              <span className="font-mono text-xs truncate flex-1">{col.label}</span>
                              <span className="text-[10px] text-gray-400 shrink-0">{col.type || 'text'}</span>
                            </label>
                          ))}
                        </div>
                        {(chart.series?.length ?? 0) < 2 && (
                          <p className="text-xs text-amber-600">Select at least 2 columns to stack.</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm font-semibold">
                            {chart.type === 'pie' ? 'Value Column' : 'Y Axis'}
                          </Label>
                          <span className="text-xs text-gray-400">numeric</span>
                        </div>
                        <AxisPicker
                          cols={axisColsMeta}
                          selected={chart.yAxis}
                          hint="numeric"
                          onSelect={(v) => setConfig((c) => ({ ...c, chart: c.chart ? { ...c.chart, yAxis: v } : undefined }))}
                        />
                      </div>
                    )}
                  </div>

                  {/* Live preview from sampled data */}
                  {previewRows && previewRows.length > 0 && chart.xAxis && (chart.yAxis || (chart.series?.length ?? 0) >= 2) && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <p className="text-xs text-gray-400 px-4 pt-3 pb-1">Preview (sample data)</p>
                      <ReportChart chartConfig={chart} rows={previewRows} />
                    </div>
                  )}

                  {(!previewRows || previewRows.length === 0) && chart.xAxis && (chart.yAxis || (chart.series?.length ?? 0) >= 1) && (
                    <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
                      {chart.type === 'stacked-bar' ? (
                        <>Chart will show <strong>{chart.series?.length ?? 0} series</strong> stacked per <span className="font-mono font-medium text-gray-600">{chart.xAxis}</span>.</>
                      ) : (
                        <>Chart will show <span className="font-mono font-medium text-gray-600">{chart.yAxis}</span> (Y) per <span className="font-mono font-medium text-gray-600">{chart.xAxis}</span> (X) as a <strong>{chart.type}</strong> chart.</>
                      )}
                      <span className="ml-1 text-gray-300">Run preview in Step 7 to see a sample.</span>
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )
      })()}

      {/* ── Step 6: Preview & Save ────────────────────────────────────── */}
      {step === 6 && (
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
              <div className="flex gap-2 items-center flex-wrap">
                {config.columns.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {config.columns.slice(0, 3).map((c) => (
                      <Badge key={c} variant="secondary" className="font-mono text-xs">{c}</Badge>
                    ))}
                    {config.columns.length > 3 && <Badge variant="outline">+{config.columns.length - 3}</Badge>}
                  </div>
                )}
                {config.aggregations.length > 0 && (
                  <Badge variant="outline">
                    <BarChart2 className="h-3 w-3 mr-1 inline" />
                    {config.aggregations.length} agg{config.aggregations.length > 1 ? 's' : ''}
                  </Badge>
                )}
                {config.joins.length > 0 && (
                  <Badge variant="outline">
                    <Link className="h-3 w-3 mr-1 inline" />
                    {config.joins.length} JOIN{config.joins.length > 1 ? 's' : ''}
                  </Badge>
                )}
                {config.chart && <Badge variant="success">{config.chart.type} chart</Badge>}
                <Button size="sm" variant="outline" onClick={loadPreview} disabled={loadingPreview}>
                  {loadingPreview ? <Spinner className="h-3.5 w-3.5" /> : 'Refresh'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-auto">
              {loadingPreview ? (
                <div className="flex justify-center py-12"><Spinner className="h-6 w-6" /></div>
              ) : previewRows === null ? (
                <p className="text-center py-8 text-gray-400 text-sm">Loading preview…</p>
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
                            {row[col] == null
                              ? <span className="text-gray-300 italic">null</span>
                              : String(row[col])}
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
