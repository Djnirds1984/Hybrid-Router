import { create } from 'zustand'

type User = { id: number; username: string; role: string }

type AuthState = {
  token: string | null
  user: User | null
  login: (t: string, u: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  login: (t, u) => set({ token: t, user: u }),
  logout: () => set({ token: null, user: null }),
}))