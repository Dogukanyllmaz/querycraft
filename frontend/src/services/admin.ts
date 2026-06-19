import api from './api'
import type { User, Session } from './auth'

export interface ReportPermission {
  id: string
  email: string
  role: 'admin' | 'viewer'
  granted_at: string
  granted_by_email: string
}

export interface Group {
  id: string
  name: string
  description?: string | null
  created_at: string
  member_count?: number
}

export interface GroupMember {
  id: string
  email: string
  role: 'admin' | 'viewer'
  display_name?: string | null
  added_at: string
}

export interface AuditLog {
  id: string
  user_id: string | null
  user_email: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  resource_name: string | null
  metadata: Record<string, unknown> | null
  ip: string | null
  created_at: string
}

export interface SystemSettings {
  [key: string]: string
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

  getUserSessions: (userId: string) =>
    api.get<{ data: { sessions: Session[] } }>(`/admin/users/${userId}/sessions`),

  revokeUserSessions: (userId: string) =>
    api.delete(`/admin/users/${userId}/sessions`),

  // Groups
  listGroups: () =>
    api.get<{ data: { groups: Group[] } }>('/admin/groups'),

  getGroup: (id: string) =>
    api.get<{ data: { group: Group; members: GroupMember[] } }>(`/admin/groups/${id}`),

  createGroup: (name: string, description?: string) =>
    api.post<{ data: { group: Group } }>('/admin/groups', { name, description }),

  updateGroup: (id: string, name: string, description?: string) =>
    api.put<{ data: { group: Group } }>(`/admin/groups/${id}`, { name, description }),

  deleteGroup: (id: string) =>
    api.delete(`/admin/groups/${id}`),

  addGroupMember: (groupId: string, userId: string) =>
    api.post(`/admin/groups/${groupId}/members`, { userId }),

  removeGroupMember: (groupId: string, userId: string) =>
    api.delete(`/admin/groups/${groupId}/members/${userId}`),

  // Report permissions
  getPermissions: (reportId: string) =>
    api.get<{ data: { permissions: ReportPermission[] } }>(`/reports/${reportId}/permissions`),

  grantPermission: (reportId: string, email: string) =>
    api.post(`/reports/${reportId}/permissions`, { email }),

  revokePermission: (reportId: string, userId: string) =>
    api.delete(`/reports/${reportId}/permissions/${userId}`),

  getGroupPermissions: (reportId: string) =>
    api.get<{ data: { groups: Group[] } }>(`/reports/${reportId}/permissions/groups`),

  grantGroupPermission: (reportId: string, groupId: string) =>
    api.post(`/reports/${reportId}/permissions/groups`, { groupId }),

  revokeGroupPermission: (reportId: string, groupId: string) =>
    api.delete(`/reports/${reportId}/permissions/groups/${groupId}`),

  // System settings
  getSettings: () =>
    api.get<{ data: { settings: SystemSettings } }>('/admin/settings'),

  updateSettings: (settings: SystemSettings) =>
    api.put<{ data: { settings: SystemSettings } }>('/admin/settings', settings),

  testSmtp: () =>
    api.post('/admin/settings/test-smtp'),

  // Audit log
  getAuditLog: (params: {
    userId?: string; action?: string; from?: string; to?: string;
    limit?: number; offset?: number;
  }) =>
    api.get<{ data: { logs: AuditLog[]; total: number } }>('/admin/audit-log', { params }),
}
