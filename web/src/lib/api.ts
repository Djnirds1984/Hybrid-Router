import axios from 'axios'
import { useAuthStore } from '../store/auth'

export const api = axios.create({ baseURL: `${location.origin}/api`, timeout: 7000 })

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 || err?.response?.status === 403) {
      try { useAuthStore.getState().logout() } catch {}
      if (location.pathname !== '/login') location.replace('/login')
    }
    return Promise.reject(err)
  }
)