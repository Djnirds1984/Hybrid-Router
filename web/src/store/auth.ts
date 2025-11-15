import { create } from 'zustand'

type User = { id: number; username: string; role: string }

type AuthState = {
  token: string | null
  user: User | null
  login: (t: string, u: User) => void
  logout: () => void
}

const saved = typeof window !== 'undefined' ? window.localStorage.getItem('auth') : null
const initial = saved ? JSON.parse(saved) as { token: string|null, user: User|null } : { token: null, user: null }

export const useAuthStore = create<AuthState>((set) => ({
  token: initial.token,
  user: initial.user,
  login: (t, u) => {
    window.localStorage.setItem('auth', JSON.stringify({ token: t, user: u }))
    set({ token: t, user: u })
  },
  logout: () => {
    window.localStorage.removeItem('auth')
    set({ token: null, user: null })
  },
}))