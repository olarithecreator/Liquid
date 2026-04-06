import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Session, User } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'
import { ADMIN_EMAIL } from '../lib/constants'

type UseAuthResult = {
  user: User | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
}

export function useAuth(): UseAuthResult {
  const queryClient = useQueryClient()

  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const isAdmin = useMemo(() => user?.email === ADMIN_EMAIL, [user?.email])

  useEffect(() => {
    let mounted = true

    async function loadInitialSession() {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return

      setSession(data.session ?? null)
      setUser(data.session?.user ?? null)
      setLoading(false)
    }

    loadInitialSession().catch(() => {
      if (!mounted) return
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (!mounted) return

        // Prompt requirement: clear all cached data on sign out.
        if (event === 'SIGNED_OUT') {
          queryClient.clear()
        }

        setSession(nextSession)
        setUser(nextSession?.user ?? null)
        setLoading(false)
      },
    )

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [queryClient])

  return { user, session, loading, isAdmin }
}
