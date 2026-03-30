import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'

interface Org {
  id: string
  name: string
}

interface AuthState {
  user: User | null
  org: Org | null
  role: string | null
  fullName: string | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setOrg: (org: Org | null) => void
  setRole: (role: string | null) => void
  setFullName: (fullName: string | null) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  org: null,
  role: null,
  fullName: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setOrg: (org) => set({ org }),
  setRole: (role) => set({ role }),
  setFullName: (fullName) => set({ fullName }),
  setLoading: (isLoading) => set({ isLoading }),
}))
