import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'

interface Org {
  id: string
  name: string
}

interface AuthState {
  user: User | null
  org: Org | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setOrg: (org: Org | null) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  org: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setOrg: (org) => set({ org }),
  setLoading: (isLoading) => set({ isLoading }),
}))
