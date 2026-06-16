import api from './api'
import { cache } from '@/lib/cache'

export interface Connection {
  id: string
  name: string
  connection_type: 'mysql' | 'postgresql' | 'sqlserver'
  host: string
  port: number
  database: string
  username: string
  created_at: string
  updated_at: string
}

export interface ConnectionFormData {
  name: string
  connection_type: 'mysql' | 'postgresql' | 'sqlserver'
  host: string
  port: number
  database: string
  username: string
  password: string
}

export interface TableColumn { column: string; type: string; nullable: boolean }

export const connectionsService = {
  list: () => api.get<{ data: { connections: Connection[] } }>('/connections'),

  get: (id: string) => api.get<{ data: { connection: Connection } }>(`/connections/${id}`),

  create: (data: ConnectionFormData) =>
    api.post<{ data: { connection: Connection } }>('/connections', data),

  update: (id: string, data: ConnectionFormData) => {
    cache.invalidate(`conn:${id}`)
    return api.put<{ data: { connection: Connection } }>(`/connections/${id}`, data)
  },

  delete: (id: string) => {
    cache.invalidate(`conn:${id}`)
    return api.delete(`/connections/${id}`)
  },

  test: (data: ConnectionFormData) => api.post('/connections/test', data),

  testExisting: (id: string) => api.post(`/connections/${id}/test`),

  getTables: async (id: string): Promise<{ data: { data: { tables: string[] } } }> => {
    const key = `conn:${id}:tables`
    const cached = cache.get<string[]>(key)
    if (cached) return { data: { data: { tables: cached } } }

    const res = await api.get<{ data: { tables: string[] } }>(`/connections/${id}/tables`)
    cache.set(key, res.data.data.tables, 60_000)
    return res as unknown as { data: { data: { tables: string[] } } }
  },

  getTableSchema: async (id: string, tableName: string): Promise<{ data: { data: { schema: TableColumn[] } } }> => {
    const key = `conn:${id}:schema:${tableName}`
    const cached = cache.get<TableColumn[]>(key)
    if (cached) return { data: { data: { schema: cached } } }

    const res = await api.get<{ data: { schema: TableColumn[] } }>(
      `/connections/${id}/tables/${encodeURIComponent(tableName)}`
    )
    cache.set(key, res.data.data.schema, 300_000)
    return res as unknown as { data: { data: { schema: TableColumn[] } } }
  },

  getTableData: (id: string, tableName: string, page = 1, limit = 100) =>
    api.get(`/connections/${id}/tables/${encodeURIComponent(tableName)}/data`, { params: { page, limit } }),
}
