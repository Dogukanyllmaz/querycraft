import api from './api'

export interface ReportFilter {
  column: string
  operator: string
  value: string | number | null
}

export interface ReportJoin {
  table: string
  type: 'INNER' | 'LEFT' | 'RIGHT'
  on: { leftColumn: string; rightColumn: string }
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'area' | 'pie'
  xAxis: string
  yAxis: string
}

export interface AggregationConfig {
  fn: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX'
  column: string
  alias: string
}

export interface ReportConfig {
  table: string
  columns: string[]
  filters: ReportFilter[]
  orderBy?: { column: string; direction: 'ASC' | 'DESC' }
  limit: number
  joins: ReportJoin[]
  chart?: ChartConfig
  aggregations: AggregationConfig[]
  columnAliases?: Record<string, string>
}

export interface Report {
  id: string
  name: string
  connection_id: string
  connection_name: string
  connection_type: string
  config: ReportConfig
  created_at: string
  updated_at: string
  last_run: string | null
}

export interface ReportFormData {
  name: string
  connection_id: string
  config: ReportConfig
}

// ── AI Analysis types ──────────────────────────────────────────────────────────

export interface AggEntry {
  [key: string]: string | number
}

export interface AnalyzeRequest {
  aggData:   AggEntry[]
  xAxis:     string
  yAxis:     string
  chartType: ChartConfig['type']
}

export interface AiInsightsResult {
  keyFinding: string
  insights:   string[]
}

// ── Service ────────────────────────────────────────────────────────────────────

export const reportsService = {
  list: () => api.get<{ data: { reports: Report[] } }>('/reports'),

  get: (id: string) => api.get<{ data: { report: Report } }>(`/reports/${id}`),

  create: (data: ReportFormData) =>
    api.post<{ data: { report: Report } }>('/reports', data),

  update: (id: string, data: ReportFormData) =>
    api.put<{ data: { report: Report } }>(`/reports/${id}`, data),

  delete: (id: string) => api.delete(`/reports/${id}`),

  execute: (id: string) =>
    api.post<{ data: { rows: Record<string, unknown>[]; rowCount: number; executedAt: string } }>(`/reports/${id}/execute`),

  preview: (connection_id: string, config: ReportConfig) =>
    api.post<{ data: { rows: Record<string, unknown>[]; rowCount: number } }>('/reports/preview', { connection_id, config }),

  exportUrl: (id: string, format: 'csv' | 'xlsx') => `/api/reports/${id}/export?format=${format}`,

  analyze: (id: string, body: AnalyzeRequest) =>
    api.post<{ data: AiInsightsResult }>(`/reports/${id}/analyze`, body),
}
