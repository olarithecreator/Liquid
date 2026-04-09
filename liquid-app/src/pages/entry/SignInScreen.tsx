import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { supabase } from '../../lib/supabase'
import { ADMIN_EMAIL } from '../../lib/constants'

import './authScreens.css'

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
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

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.26-.16-1.85H9v3.5h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.63Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.33-1.58-5.04-3.7H.96v2.34A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.96 10.73A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.17.28-1.73V4.93H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.07l3-2.34Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.57c1.33 0 2.52.46 3.46 1.36l2.6-2.6C13.46.84 11.43 0 9 0A9 9 0 0 0 .96 4.93l3 2.34c.71-2.12 2.7-3.7 5.04-3.7Z"
      />
    </svg>
  )
}

export default function SignInScreen() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const canSubmit = useMemo(() => !loading, [loading])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    const nextEmailError = email.trim() ? null : 'Enter your email'
    const nextPasswordError = password ? null : 'Enter your password'

    setEmailError(nextEmailError)
    setPasswordError(nextPasswordError)
    setToast(null)

    if (nextEmailError || nextPasswordError) return

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error || !data?.user) {
        setToast('Incorrect email or password')
        return
      }

      const userEmail = data.user.email ?? ''
      if (userEmail === ADMIN_EMAIL) navigate('/admin')
      else navigate('/home')
    } finally {
      setLoading(false)
    }
  }

  async function onGoogle() {
    // OAuth redirects; we don’t need to show an inline loading state here.
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/home` },
    })
  }

  return (
    <div className="authRoot">
      <div className="authInner">
        <div className="logo" aria-label="Liquid. logo">
          <span>Liquid</span>
          <span className="logoDot">.</span>
        </div>

        <div className="authTitle">Welcome back</div>
        <div className="authSubtitle">Sign in to your account to continue</div>

        <form onSubmit={onSubmit}>
          <div className="field">
            <div className="label">Email address</div>
            <input
              className={`input ${emailError ? 'inputError' : ''}`}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              disabled={loading}
            />
            {emailError ? <div className="errorText">{emailError}</div> : null}
          </div>

          <div className="field">
            <div className="label">Password</div>
            <div className="inputWrap">
              <input
                className={`input ${passwordError ? 'inputError' : ''}`}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                disabled={loading}
                style={{ paddingRight: 54 }}
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
            {passwordError ? (
              <div className="errorText">{passwordError}</div>
            ) : null}
          </div>

          <div className="forgotRow">
            <button
              type="button"
              className="linkPurple"
              onClick={() => navigate('/forgot-password')}
            >
              Forgot password?
            </button>
          </div>

          {toast ? (
            <div
              role="status"
              aria-live="polite"
              style={{
                color: 'rgba(224, 82, 82, 0.95)',
                fontSize: 13,
                marginBottom: 10,
              }}
            >
              {toast}
            </div>
          ) : null}

          <button className="primaryBtn" type="submit" disabled={loading}>
            {loading ? <div className="spinner" aria-hidden="true" /> : null}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="dividerRow">
            <div className="dividerLine" />
            <div className="dividerText">or continue with</div>
            <div className="dividerLine" />
          </div>

          <button
            className="googleBtn"
            type="button"
            onClick={onGoogle}
            disabled={loading}
          >
            <GoogleLogo />
            <span>Continue with Google</span>
          </button>

          <div className="footerRow">
            <span>Don&apos;t have an account?</span>
            <button
              type="button"
              className="linkPurple"
              onClick={() => navigate('/signup')}
            >
              Create one
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
