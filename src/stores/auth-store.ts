import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import type { User } from '../types/database'

interface AuthState {
  user: User | null
  isLoading: boolean
  error: string | null
  loginWithPin: (pin: string) => Promise<boolean>
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,
      error: null,

      loginWithPin: async (pin: string) => {
        set({ isLoading: true, error: null })
        try {
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('pin_code', pin)
            .eq('is_active', true)
            .single()

          if (error || !data) {
            set({ error: '등록되지 않은 PIN입니다.', isLoading: false })
            return false
          }

          set({ user: data as User, isLoading: false, error: null })
          return true
        } catch (err: any) {
          set({ error: err.message, isLoading: false })
          return false
        }
      },

      logout: () => {
        set({ user: null, error: null })
      },
    }),
    {
      name: 'haccp-auth',
      partialize: (state) => ({ user: state.user }),
    }
  )
)
