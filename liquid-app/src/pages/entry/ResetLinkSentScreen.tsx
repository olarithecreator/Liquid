import { useEffect, useMemo, useState } from 'react'
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

function EmailIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 6h16v12H4V6Z"
        stroke="#1db954"
        strokeWidth="2"
        opacity="0.95"
      />
      <path
        d="M4 7l8 6 8-6"
        stroke="#1db954"
        strokeWidth="2"
        opacity="0.95"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function ResetLinkSentScreen() {
  const navigate = useNavigate()
  const email = useMemo(() => localStorage.getItem('liquid_reset_email') ?? '', [])
  const [resending, setResending] = useState(false)
  const [sentConfirm, setSentConfirm] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!email) navigate('/forgot-password')
  }, [email, navigate])

  async function resend() {
    if (resending) return
    setToast(null)
    setResending(true)
    try {
      const redirectTo = window.location.origin + '/reset-password'
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) {
        setToast(error.message ?? 'Failed to resend reset link')
        return
      }

      setSentConfirm(true)
      window.setTimeout(() => setSentConfirm(false), 3000)
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="authRoot">
      <div className="authInner">
        <LiquidLogo />

        <div className="iconCircleGreen" aria-hidden="true" style={{ margin: '12px auto 6px' }}>
          <EmailIcon />
        </div>

        <div className="authTitle" style={{ fontSize: 26, marginBottom: 6 }}>
          Check your email
        </div>

        <div className="authSubtitle" style={{ marginBottom: 10 }}>
          We sent a reset link to
        </div>

        <div
          style={{
            color: 'rgba(255,255,255,0.92)',
            fontWeight: 700,
            marginBottom: 14,
            textAlign: 'center',
          }}
        >
          {email}
        </div>

        <div className="infoCard">
          Check your spam folder. Link expires in 1 hour.
        </div>

        <button
          className="primaryBtn"
          type="button"
          onClick={() => window.open(`mailto:${email}`)}
          style={{ marginTop: 18 }}
          disabled={resending}
        >
          Open Email App
        </button>

        <div style={{ marginTop: 18, textAlign: 'center' }}>
          <button type="button" className="linkPurple" onClick={resend} disabled={resending}>
            {sentConfirm ? 'Sent!' : "Didn't receive it? Resend link"}
          </button>
        </div>

        {toast ? <div className="toastCard">{toast}</div> : null}
      </div>
    </div>
  )
}
