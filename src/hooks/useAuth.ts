import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

async function loadUserProfile(
  userId: string,
  setOrg: (org: { id: string; name: string } | null) => void
) {
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', userId)
    .single()

  console.log('[useAuth] loadUserProfile:', { profile, error: profileError })

  if (!profile?.org_id) {
    setOrg(null)
    return
  }

  console.log('[useAuth] org_id:', profile.org_id)

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', profile.org_id)
    .single()

  console.log('[useAuth] org result:', org)
  console.log('[useAuth] org error:', orgError)
  setOrg(org ? { id: org.id, name: org.name } : null)
}

export function useAuth() {
  const { setUser, setOrg, setLoading } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    const timeout = setTimeout(() => {
      console.warn('[useAuth] timeout — no auth state in 3s')
      setLoading(false)
      navigate('/signin')
    }, 3000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[useAuth] event:', event, 'user:', session?.user?.id ?? null)
        clearTimeout(timeout)

        if (session?.user) {
          setUser(session.user)

          // Defer supabase queries to avoid deadlock with the auth lock
          // held by signInWithPassword / signUp during this callback.
          setTimeout(async () => {
            try {
              await loadUserProfile(session.user!.id, setOrg)
            } catch (err) {
              console.error('[useAuth] loadUserProfile error:', err)
            } finally {
              setLoading(false)
            }
          }, 0)
        } else {
          setUser(null)
          setOrg(null)
          setLoading(false)

          if (event === 'SIGNED_OUT') {
            navigate('/signin')
          }
        }
      }
    )

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [navigate, setLoading, setOrg, setUser])
}
