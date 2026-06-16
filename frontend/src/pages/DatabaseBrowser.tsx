import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { connectionsService, type Connection, type TableColumn } from '@/services/connections'
import { TablePicker } from '@/components/ui/table-picker'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Database, Table, Plus, ChevronLeft, ChevronRight, RefreshCw, FileText } from 'lucide-react'

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const LIMITS = [25, 50, 100, 200]

export function DatabaseBrowser() {
  const { id: urlConnectionId } = useParams<{ id?: string }>()
  const navigate = useNavigate()

  const [connections, setConnections] = useState<Connection[]>([])
  const [connectionId, setConnectionId] = useState(urlConnectionId ?? '')
  const [tables, setTables] = useState<string[]>([])
  const [selectedTable, setSelectedTable] = useState('')
  const [schema, setSchema] = useState<TableColumn[]>([])
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)

  const [loadingConns, setLoadingConns] = useState(true)
  const [loadingTables, setLoadingTables] = useState(false)
  const [loadingSchema, setLoadingSchema] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState('')

  // Load connections
  useEffect(() => {
    connectionsService.list()
      .then((r) => setConnections(r.data.data.connections))
      .finally(() => setLoadingConns(false))
  }, [])

  // Load tables when connection changes
  useEffect(() => {
    if (!connectionId) return
    setTables([]); setSelectedTable(''); setSchema([]); setRows(null)
    setLoadingTables(true); setError('')
    connectionsService.getTables(connectionId)
      .then((r) => setTables(r.data.data.tables))
      .catch(() => setError('Failed to load tables. Check the connection.'))
      .finally(() => setLoadingTables(false))
  }, [connectionId])

  // Load schema + data when table changes
  const loadTable = useCallback(async (table: string, pg = 1, lim = limit) => {
    if (!connectionId || !table) return
    setSelectedTable(table); setRows(null); setPage(pg); setError('')

    setLoadingSchema(true)
    setLoadingData(true)

    const [schemaRes, dataRes] = await Promise.allSettled([
      connectionsService.getTableSchema(connectionId, table),
      connectionsService.getTableData(connectionId, table, pg, lim),
    ])

    if (schemaRes.status === 'fulfilled') {
      setSchema(schemaRes.value.data.data.schema)
    }
    setLoadingSchema(false)

    if (dataRes.status === 'fulfilled') {
      const d = (dataRes.value as { data: { data: { rows: Record<string, unknown>[]; pagination: Pagination } } }).data.data
      setRows(d.rows)
      setPagination(d.pagination)
    } else {
      setError('Failed to load table data.')
    }
    setLoadingData(false)
  }, [connectionId, limit])

  async function handlePageChange(newPage: number) {
    setPage(newPage)
    await loadTable(selectedTable, newPage, limit)
  }

  async function handleLimitChange(newLimit: string) {
    const l = parseInt(newLimit)
    setLimit(l)
    await loadTable(selectedTable, 1, l)
  }

  async function handleRefresh() {
    await loadTable(selectedTable, page, limit)
  }

  function handleCreateReport() {
    navigate(`/reports/new?connectionId=${connectionId}&table=${encodeURIComponent(selectedTable)}`)
  }

  const activeConn = connections.find((c) => c.id === connectionId)
  const columns = schema.length > 0 ? schema.map((s) => s.column) : (rows && rows.length > 0 ? Object.keys(rows[0]) : [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Database Browser</h2>
          <p className="text-gray-500 mt-1">Explore tables and preview data from your connections.</p>
        </div>
        {selectedTable && (
          <Button onClick={handleCreateReport}>
            <Plus className="h-4 w-4" /> New Report from this Table
          </Button>
        )}
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left panel — connection + table list */}
        <div className="lg:col-span-1 space-y-4">
          {/* Connection selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Connection</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {loadingConns ? <Spinner /> : (
                <Select value={connectionId} onValueChange={setConnectionId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select connection..." />
                  </SelectTrigger>
                  <SelectContent>
                    {connections.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <div className="flex flex-col">
                          <span>{c.name}</span>
                          <span className="text-xs text-gray-400">{c.connection_type}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {activeConn && (
                <p className="text-xs text-gray-400 mt-2 truncate">{activeConn.host} / {activeConn.database}</p>
              )}
            </CardContent>
          </Card>

          {/* Table list */}
          {connectionId && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center justify-between">
                  Tables
                  {tables.length > 0 && <Badge variant="secondary">{tables.length}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {loadingTables ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-gray-400">
                    <Spinner className="h-4 w-4" /> Loading...
                  </div>
                ) : (
                  <TablePicker
                    tables={tables}
                    value={selectedTable}
                    onChange={(t) => loadTable(t, 1, limit)}
                    placeholder="Search table..."
                  />
                )}
              </CardContent>
            </Card>
          )}

          {/* Schema panel */}
          {selectedTable && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Table className="h-3.5 w-3.5" /> Schema
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {loadingSchema ? <Spinner className="h-4 w-4" /> : (
                  <ul className="space-y-1 max-h-80 overflow-y-auto">
                    {schema.map((col) => (
                      <li key={col.column} className="flex items-start justify-between gap-2 py-1 border-b border-gray-50 last:border-0">
                        <span className="text-xs font-mono text-gray-700 truncate">{col.column}</span>
                        <span className="text-xs text-gray-400 shrink-0">{col.type}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right panel — data table */}
        <div className="lg:col-span-3">
          {!connectionId ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Database className="h-12 w-12 mb-3 opacity-20" />
              <p className="font-medium">Select a connection to start browsing</p>
            </div>
          ) : !selectedTable ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <FileText className="h-12 w-12 mb-3 opacity-20" />
              <p className="font-medium">Select a table to preview its data</p>
            </div>
          ) : (
            <Card className="overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-gray-800">{selectedTable}</span>
                  {pagination && (
                    <Badge variant="secondary">{pagination.total.toLocaleString()} rows</Badge>
                  )}
                  {schema.length > 0 && (
                    <Badge variant="outline">{schema.length} cols</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <span>Rows:</span>
                    <Select value={String(limit)} onValueChange={handleLimitChange}>
                      <SelectTrigger className="h-7 w-20 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LIMITS.map((l) => <SelectItem key={l} value={String(l)}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <button
                    onClick={handleRefresh}
                    disabled={loadingData}
                    className="text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingData ? 'animate-spin' : ''}`} />
                  </button>
                  <Button size="sm" onClick={handleCreateReport}>
                    <Plus className="h-3.5 w-3.5" /> Report
                  </Button>
                </div>
              </div>

              {/* Data */}
              {loadingData ? (
                <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>
              ) : !rows || rows.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">No data in this table.</div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 sticky top-0">
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 w-10">#</th>
                        {columns.map((col) => (
                          <th key={col} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((row, i) => (
                        <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                          <td className="px-3 py-2 text-xs text-gray-300 select-none">
                            {(page - 1) * limit + i + 1}
                          </td>
                          {columns.map((col) => {
                            const val = row[col]
                            const isNull = val === null || val === undefined
                            const str = isNull ? '' : String(val)
                            return (
                              <td
                                key={col}
                                className="px-3 py-2 text-gray-700 max-w-[200px] truncate"
                                title={str}
                              >
                                {isNull
                                  ? <span className="text-gray-300 italic text-xs">null</span>
                                  : str}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                  <p className="text-xs text-gray-500">
                    {((page - 1) * limit + 1).toLocaleString()}–{Math.min(page * limit, pagination.total).toLocaleString()} of {pagination.total.toLocaleString()} rows
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handlePageChange(1)}
                      disabled={page === 1 || loadingData}
                      className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      «
                    </button>
                    <button
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page === 1 || loadingData}
                      className="p-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>

                    {/* Page number buttons */}
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      const start = Math.max(1, Math.min(page - 2, pagination.totalPages - 4))
                      const p = start + i
                      return (
                        <button
                          key={p}
                          onClick={() => handlePageChange(p)}
                          disabled={loadingData}
                          className={`px-2.5 py-1 text-xs rounded border transition-colors disabled:opacity-40 ${
                            p === page
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-200 text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    })}

                    <button
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page === pagination.totalPages || loadingData}
                      className="p-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handlePageChange(pagination.totalPages)}
                      disabled={page === pagination.totalPages || loadingData}
                      className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      »
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
