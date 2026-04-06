import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { supabase } from '../../lib/supabase'

import './authScreens.css'

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

function NigeriaFlag() {
  // Simple 3-stripe approximation.
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="0" y="0" width="18" height="18" fill="#1dcf3a" />
      <rect x="0" y="4" width="18" height="10" fill="#ffffff" />
      <rect x="0" y="0" width="18" height="4" fill="#1dcf3a" />
      <rect x="0" y="14" width="18" height="4" fill="#1dcf3a" />
    </svg>
  )
}

function TermsLinks() {
  return (
    <>
      <button type="button" className="linkPurpleInline">
        Terms of Service
      </button>{' '}
      and{' '}
      <button type="button" className="linkPurpleInline">
        Privacy Policy
      </button>
    </>
  )
}

export default function SignUpScreen() {
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('') // digits only in UI
  const [password, setPassword] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [loading, setLoading] = useState(false)

  const [fullNameError, setFullNameError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [termsError, setTermsError] = useState(false)

  const phoneDigits = phoneNumber.replace(/\D/g, '')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return

    const nextFullNameError = fullName.trim() ? null : 'Enter your full name'
    const nextEmailError = email.trim() ? null : 'Enter your email'
    const nextPhoneError = phoneDigits.length === 11 ? null : 'Enter a valid 11-digit phone number'
    const nextPasswordError = password.length >= 8 ? null : 'Password must be at least 8 characters'
    const nextTermsError = accepted ? false : true

    setFullNameError(nextFullNameError)
    setEmailError(nextEmailError)
    setPhoneError(nextPhoneError)
    setPasswordError(nextPasswordError)
    setTermsError(nextTermsError)

    if (nextFullNameError || nextEmailError || nextPhoneError || nextPasswordError || nextTermsError) return

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim(), phone: '+234' + phoneDigits } },
      })

      if (error) {
        const msg = error.message ?? 'Sign up failed'
        const isAlready = msg.toLowerCase().includes('user already registered')
        if (isAlready) {
          // Inline toast with branded Sign In link.
          setToast({
            tone: 'error',
            message: 'Account exists — sign in instead?',
            actionLabel: 'Sign In',
            action: () => navigate('/signin'),
          })
          return
        }

        setToast({ tone: 'error', message: msg })
        return
      }

      // data.session is optional. Per prompt, we navigate on success.
      void data
      navigate('/home')
    } finally {
      setLoading(false)
    }
  }

  const [toast, setToast] = useState<null | {
    tone: 'error' | 'info'
    message: string
    actionLabel?: string
    action?: () => void
  }>(null)

  return (
    <div className="authRoot">
      <div className="authInner">
        <div className="logo" aria-label="Liquid. logo">
          <span>Liquid</span>
          <span className="logoDot">.</span>
        </div>

        <div className="authTitle">Create account</div>
        <div className="authSubtitle">Join Liquid and start trading USDT.</div>

        <form onSubmit={onSubmit}>
          <div className="field">
            <div className="label">Full name</div>
            <input
              className={`input ${fullNameError ? 'inputError' : ''}`}
              type="text"
              placeholder="Your full name"
              value={fullName}
              onChange={(ev) => setFullName(ev.target.value)}
              disabled={loading}
            />
            {fullNameError ? <div className="errorText">{fullNameError}</div> : null}
          </div>

          <div className="field">
            <div className="label">Email address</div>
            <input
              className={`input ${emailError ? 'inputError' : ''}`}
              type="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              disabled={loading}
              autoComplete="email"
            />
            {emailError ? <div className="errorText">{emailError}</div> : null}
          </div>

          <div className="field">
            <div className="label">Phone number</div>
            <div className={`phoneRow`}>
              <div className="phonePrefix" aria-hidden="true">
                <NigeriaFlag />
                <span>+234</span>
              </div>
              <div className="phoneInput">
                <input
                  className={`input ${phoneError ? 'inputError' : ''}`}
                  type="tel"
                  inputMode="numeric"
                  placeholder="08012345678"
                  value={phoneNumber}
                  onChange={(ev) => setPhoneNumber(ev.target.value)}
                  disabled={loading}
                  autoComplete="tel"
                />
              </div>
            </div>
            {phoneError ? <div className="errorText">{phoneError}</div> : null}
          </div>

          <div className="field">
            <div className="label">Password</div>
            <div className="inputWrap">
              <input
                className={`input ${passwordError ? 'inputError' : ''}`}
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter a password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                disabled={loading}
                style={{ paddingRight: 54 }}
                autoComplete="new-password"
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
            <div className="errorText" style={{ color: 'rgba(139, 47, 224, 0.7)' }}>
              At least 8 characters
            </div>
            {passwordError ? <div className="errorText">{passwordError}</div> : null}
          </div>

          <div className="checkboxBlock">
            <div className="checkboxRow">
              <div
                role="checkbox"
                aria-checked={accepted}
                tabIndex={0}
                className={`checkboxBox ${accepted ? 'checkboxBoxChecked' : ''} ${
                  termsError && !accepted ? 'checkboxPulse' : ''
                }`}
                onClick={() => {
                  setAccepted((v) => !v)
                  setTermsError(false)
                }}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault()
                    setAccepted((v) => !v)
                    setTermsError(false)
                  }
                }}
              >
                {accepted ? <span className="checkboxTick" /> : null}
              </div>
              <div className="checkboxText">
                I agree to the{' '}
                <TermsLinks />
              </div>
            </div>
            {termsError ? (
              <div className="checkboxErrorText">Please accept the terms</div>
            ) : null}
          </div>

          {toast ? (
            <div
              role="status"
              aria-live="polite"
              style={{
                color: 'rgba(224, 82, 82, 0.95)',
                fontSize: 13,
                marginTop: 12,
                marginBottom: 12,
                textAlign: 'center',
              }}
            >
              {toast.message}{' '}
              {toast.actionLabel && toast.action ? (
                <button
                  type="button"
                  className="linkPurpleInline"
                  onClick={() => {
                    const act = toast.action
                    if (act) act()
                  }}
                >
                  {toast.actionLabel}
                </button>
              ) : null}
            </div>
          ) : null}

          <button className="primaryBtn" type="submit" disabled={loading}>
            {loading ? <div className="spinner" aria-hidden="true" /> : null}
            {loading ? 'Creating...' : 'Create Account'}
          </button>

          <div className="footerRow">
            <span>Already have an account?</span>
            <button
              type="button"
              className="linkPurple"
              onClick={() => navigate('/signin')}
              disabled={loading}
            >
              Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
