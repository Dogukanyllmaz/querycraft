import api from './api'

export interface User {
  id: string
  email: string
  role: 'admin' | 'viewer'
  display_name?: string | null
  created_at: string
}

export interface Session {
  id: string
  user_agent: string | null
  ip: string | null
  created_at: string
  expires_at: string
}

export interface Group {
  id: string
  name: string
  description?: string | null
}

export const authService = {
  signup: (email: string, password: string) =>
    api.post<{ data: { user: User } }>('/auth/signup', { email, password }),

  login: (email: string, password: string) =>
    api.post<{ data: { user: User } }>('/auth/login', { email, password }),

  logout: () => api.post('/auth/logout'),

  me: () => api.get<{ data: { user: User } }>('/auth/me'),

  setupStatus: () =>
    api.get<{ data: { registrationOpen: boolean } }>('/auth/setup-status'),

  getProfile: () =>
    api.get<{ data: { user: User; groups: Group[]; sessions: Session[] } }>('/auth/profile'),

  updateProfile: (display_name: string) =>
    api.put<{ data: { user: User } }>('/auth/profile', { display_name }),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, newPassword }),
}
