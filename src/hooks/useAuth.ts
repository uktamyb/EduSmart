import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

async function loadUserProfile(
  userId: string,
  setOrg: (org: { id: string; name: string } | null) => void,
  setRole: (role: string | null) => void
): Promise<string | null> {
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('org_id, role')
    .eq('id', userId)
    .single()

  console.log('[useAuth] loadUserProfile:', { profile, error: profileError })

  const role = profile?.role ?? null
  setRole(role)

  if (!profile?.org_id) {
    setOrg(null)
    return role
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
  return role
}

export function useAuth() {
  const { setUser, setOrg, setRole, setLoading } = useAuthStore()
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

          setTimeout(async () => {
            try {
              const role = await loadUserProfile(session.user!.id, setOrg, setRole)
              if (role === 'super_admin' && !window.location.pathname.startsWith('/superadmin')) {
                navigate('/superadmin/dashboard')
              }
            } catch (err) {
              console.error('[useAuth] loadUserProfile error:', err)
            } finally {
              setLoading(false)
            }
          }, 0)
        } else {
          setUser(null)
          setOrg(null)
          setRole(null)
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
  }, [navigate, setLoading, setOrg, setRole, setUser])
}
