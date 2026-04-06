import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { supabase } from '../../lib/supabase'

import './authScreens.css'

function LiquidLogo() {
  return (
    <div className="logo" aria-label="Liquid. logo" style={{ marginTop: 0 }}>
      <span>Liquid</span>
      <span className="logoDot">.</span>
    </div>
  )
}

function LockIconGreen() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 11V8a5 5 0 0 1 10 0v3"
        stroke="#1db954"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.95"
      />
      <path
        d="M6 11h12v10H6V11Z"
        stroke="#1db954"
        strokeWidth="2"
        opacity="0.95"
      />
      <path
        d="M12 15v3"
        stroke="#1db954"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.95"
      />
    </svg>
  )
}

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

type Strength = {
  bars: number
  label: 'Weak' | 'Fair' | 'Strong' | 'Very strong'
}

function computeStrength(pw: string): Strength {
  const len = pw.length
  if (len < 8) return { bars: 1, label: 'Weak' }
  if (len <= 10) return { bars: 2, label: 'Fair' }
  if (len <= 14) return { bars: 3, label: 'Strong' }
  return { bars: 4, label: 'Very strong' }
}

export default function NewPasswordScreen() {
  const navigate = useNavigate()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const [newError, setNewError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const strength = useMemo(() => computeStrength(newPassword), [newPassword])

  useEffect(() => {
    let cancelled = false

    async function checkSession() {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (!data.session) navigate('/signin', { replace: true })
    }

    checkSession().catch(() => navigate('/signin', { replace: true }))

    return () => {
      cancelled = true
    }
  }, [navigate])

  function validate() {
    const nextNewError =
      newPassword.length === 0
        ? 'Enter your new password'
        : newPassword.length < 8
          ? 'Password must be at least 8 characters'
          : null

    const nextConfirmError =
      confirmPassword.length === 0
        ? 'Enter confirm password'
        : newPassword !== confirmPassword
          ? 'Passwords do not match'
          : null

    setNewError(nextNewError)
    setConfirmError(nextConfirmError)
    return !nextNewError && !nextConfirmError
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return
    setToast(null)

    const ok = validate()
    if (!ok) return

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setToast(error.message ?? 'Failed to update password')
        return
      }

      navigate('/reset-password/success')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="authRoot">
      <div className="authInner">
        <LiquidLogo />

        <div className="iconCircleGreen" aria-hidden="true" style={{ margin: '12px auto 6px' }}>
          <LockIconGreen />
        </div>

        <div className="authTitle" style={{ fontSize: 26, marginBottom: 6 }}>
          New password
        </div>
        <div className="authSubtitle" style={{ marginBottom: 18 }}>
          Must be 8+ characters, different from previous
        </div>

        <form onSubmit={onSubmit}>
          <div className="field">
            <div className="label">New Password</div>
            <div className="inputWrap">
              <input
                className={`input ${newError ? 'inputError' : ''}`}
                type={showNew ? 'text' : 'password'}
                placeholder="New Password"
                value={newPassword}
                onChange={(ev) => setNewPassword(ev.target.value)}
                disabled={loading}
                style={{ paddingRight: 54 }}
              />
              <button
                type="button"
                className="eyeBtn"
                onClick={() => setShowNew((s) => !s)}
                disabled={loading}
                aria-label={showNew ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showNew} />
              </button>
            </div>
            {newError ? <div className="errorText">{newError}</div> : null}

            <div className="strengthWrap">
              <div className="strengthBar" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`strengthSeg ${i < strength.bars ? 'strengthSegOn' : ''}`}
                  />
                ))}
              </div>
              <div className="strengthLabel">{strength.label}</div>
            </div>
          </div>

          <div className="field">
            <div className="label">Confirm New Password</div>
            <div className="inputWrap">
              <input
                className={`input ${confirmError ? 'inputError' : ''}`}
                type={showConfirm ? 'text' : 'password'}
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(ev) => setConfirmPassword(ev.target.value)}
                disabled={loading}
                style={{ paddingRight: 54 }}
              />
              <button
                type="button"
                className="eyeBtn"
                onClick={() => setShowConfirm((s) => !s)}
                disabled={loading}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showConfirm} />
              </button>
            </div>
            {confirmError ? <div className="errorText">{confirmError}</div> : null}
          </div>

          <button className="primaryBtn" type="submit" disabled={loading}>
            {loading ? <div className="spinner" aria-hidden="true" /> : null}
            {loading ? 'Saving...' : 'Set New Password'}
          </button>

          {toast ? <div className="toastCard">{toast}</div> : null}
        </form>
      </div>
    </div>
  )
}
