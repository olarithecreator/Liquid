import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { adminSupabase as supabase } from '../../lib/supabase'
import { isAdminEmail } from '../../lib/constants'

import '../entry/authScreens.css'

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7 3.5-7 10-7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 3l18 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10.7 10.7a3 3 0 0 0 3.6 3.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M9.88 5.08A10.77 10.77 0 0 1 12 5c6.5 0 10 7 10 7a18.1 18.1 0 0 1-3.2 4.35"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M6.1 6.1C3.4 8.1 2 12 2 12s3.5 7 10 7c1.5 0 2.9-.4 4.1-1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function AdminSignInScreen() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // If already signed in as admin, redirect immediately.
  useEffect(() => {
    let cancelled = false

    async function run() {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return

      const currentEmail = data.session?.user?.email
      if (isAdminEmail(currentEmail)) {
        navigate('/admin', { replace: true })
      }
    }

    run().catch(() => {
      // ignore
    })

    return () => {
      cancelled = true
    }
  }, [navigate])

  const canSubmit = useMemo(() => {
    if (loading) return false
    return email.trim().length > 0 && password.length > 0
  }, [email, loading, password])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setToast(null)
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error || !data?.user) {
        setToast('Incorrect credentials')
        return
      }

      const signedInEmail = data.user.email
      if (isAdminEmail(signedInEmail)) {
        navigate('/admin')
        return
      }

      // Signed in but not admin: immediately sign out and show denial.
      await supabase.auth.signOut()
      setToast('Access denied. This account does not have admin privileges.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="authRoot">
      <div className="authInner">
        <div
          className="logo"
          aria-label="Liquid. logo"
          style={{
            marginTop: 0,
            background: 'linear-gradient(90deg, #6700af, #8B2FE0)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          Liquid<span className="logoDot">.</span>
        </div>

        <div className="adminBadge">Admin Panel</div>

        <div className="authTitle">Admin access</div>
        <div className="authSubtitle">
          Sign in with your admin credentials. This area is restricted.
        </div>

        <div className="adminNotice">
          Only authorised email addresses can access the admin panel.
          Unauthorised attempts are logged.
        </div>

        <form onSubmit={onSubmit}>
          <div className="field">
            <div className="label">Admin email</div>
            <input
              className="input"
              type="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="field">
            <div className="label">Password</div>
            <div className="inputWrap">
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                disabled={loading}
                style={{ paddingRight: 54 }}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="eyeBtn"
                onClick={() => setShowPassword((s) => !s)}
                disabled={loading}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          {toast ? <div className="toastCard">{toast}</div> : null}

          <button
            className="adminGradientBtn"
            type="submit"
            disabled={!canSubmit}
          >
            {loading ? (
              <div className="spinner" aria-hidden="true" />
            ) : null}
            {loading ? 'Signing in...' : 'Sign In to Admin Panel'}
          </button>
        </form>
      </div>
    </div>
  )
}
