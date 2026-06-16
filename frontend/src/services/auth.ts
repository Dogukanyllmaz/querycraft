import api from './api'

export interface User { id: string; email: string; created_at: string }

export const authService = {
  signup: (email: string, password: string) =>
    api.post<{ data: { user: User } }>('/auth/signup', { email, password }),

  login: (email: string, password: string) =>
    api.post<{ data: { user: User } }>('/auth/login', { email, password }),

  logout: () => api.post('/auth/logout'),

  me: () => api.get<{ data: { user: User } }>('/auth/me'),
}
