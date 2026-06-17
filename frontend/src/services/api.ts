import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && error.response?.data?.error === 'TOKEN_EXPIRED' && !original._retry) {
      original._retry = true
      try {
        await axios.post('/api/auth/refresh', {}, { withCredentials: true })
        return api(original)
      } catch {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
