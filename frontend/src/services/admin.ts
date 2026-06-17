import api from './api'
import type { User } from './auth'

export interface ReportPermission {
  id: string
  email: string
  role: 'admin' | 'viewer'
  granted_at: string
  granted_by_email: string
}

export const adminService = {
  // User management
  listUsers: () =>
    api.get<{ data: { users: User[] } }>('/admin/users'),

  createUser: (email: string, password: string, role: 'admin' | 'viewer') =>
    api.post<{ data: { user: User } }>('/admin/users', { email, password, role }),

  updateUserRole: (id: string, role: 'admin' | 'viewer') =>
    api.put<{ data: { user: User } }>(`/admin/users/${id}/role`, { role }),

  deleteUser: (id: string) =>
    api.delete(`/admin/users/${id}`),

  // Report permissions
  getPermissions: (reportId: string) =>
    api.get<{ data: { permissions: ReportPermission[] } }>(`/reports/${reportId}/permissions`),

  grantPermission: (reportId: string, email: string) =>
    api.post(`/reports/${reportId}/permissions`, { email }),

  revokePermission: (reportId: string, userId: string) =>
    api.delete(`/reports/${reportId}/permissions/${userId}`),
}
