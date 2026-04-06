import { useState, type FormEvent } from 'react'
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

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M15 18l-6-6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function KeyIconPurple() {
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
      <path
        d="M21 2l-2 2m2-2l-5 5m5-5l-7 7"
        stroke="#6700af"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      />
      <path
        d="M7.5 14a4.5 4.5 0 1 1 4-4"
        stroke="#6700af"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      />
      <circle cx="15" cy="9" r="1.2" fill="#6700af" opacity="0.95" />
    </svg>
  )
}

export default function ForgotPasswordScreen() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return

    const nextError = email.trim() ? null : 'Enter your email'
    setEmailError(nextError)
    setToast(null)
    if (nextError) return

    setLoading(true)
    try {
      const redirectTo = window.location.origin + '/reset-password'
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      })

      if (error) {
        setToast(error.message ?? 'Failed to send reset link')
        return
      }

      localStorage.setItem('liquid_reset_email', email.trim())
      navigate('/forgot-password/sent')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="authRoot">
      <div className="authInner">
        <div className="backRow">
          <button
            type="button"
            className="backIconBtn"
            aria-label="Back"
            onClick={() => navigate(-1)}
          >
            <BackIcon />
          </button>
          <LiquidLogo />
        </div>

        <div className="iconCirclePurple" aria-hidden="true">
          <KeyIconPurple />
        </div>

        <div className="authTitle" style={{ marginTop: 14 }}>
          Reset password
        </div>
        <div className="authSubtitle" style={{ marginBottom: 18 }}>
          Enter your email and we&apos;ll send you a link
        </div>

        <form onSubmit={onSubmit}>
          <div className="field">
            <div className="label">Email</div>
            <input
              className={`input ${emailError ? 'inputError' : ''}`}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              disabled={loading}
              autoComplete="email"
            />
            {emailError ? <div className="errorText">{emailError}</div> : null}
          </div>

          <button className="primaryBtn" type="submit" disabled={loading}>
            {loading ? <div className="spinner" aria-hidden="true" /> : null}
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>

          {toast ? (
            <div className="toastCard" role="status" aria-live="polite">
              {toast}
            </div>
          ) : null}

          <div className="footerRow" style={{ marginTop: 18 }}>
            <button
              type="button"
              className="linkPurple"
              onClick={() => navigate('/signin')}
              disabled={loading}
            >
              Back to Sign In
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
