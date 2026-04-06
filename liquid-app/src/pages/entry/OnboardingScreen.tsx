import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import './splashOnboarding.css'

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 8h10M7 12h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M20 12c0 4.418-3.582 8-8 8a8.03 8.03 0 0 1-3.584-.837L4 20l.887-4.416A7.97 7.97 0 0 1 4 12c0-4.418 3.582-8 8-8s8 3.582 8 8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DropletIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2s7 8 7 13a7 7 0 1 1-14 0c0-5 7-13 7-13Z"
        fill="#1dcfff"
        opacity="0.95"
      />
    </svg>
  )
}

function ExchangeIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 7h10l-2-2"
        stroke="#2ddf73"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 17H7l2 2"
        stroke="#2ddf73"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 7l-2 2"
        stroke="#2ddf73"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 17l2-2"
        stroke="#2ddf73"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IntelligenceIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3l7 7-7 11L5 10l7-7Z"
        stroke="#6700af"
        strokeWidth="2"
        strokeLinejoin="round"
        opacity="0.95"
      />
    </svg>
  )
}

export default function OnboardingScreen() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0) // 0..2
  const startXRef = useRef<number | null>(null)
  const stepRef = useRef(step)
  stepRef.current = step

  const slides = useMemo(
    () => [
      {
        tag: 'WELCOME TO LIQUID',
        icon: <DropletIcon />,
        title: (
          <>
            <span>Move </span>
            <span className="titlePurpleItalic">USDT.</span>
            <br />
            <span>Stay in</span>
            <br />
            <span>control.</span>
          </>
        ),
        body: (
          'Liquid is a digital asset platform combining instant USDT exchange with professional portfolio intelligence — built for serious Nigerian investors.'
        ),
        primaryLabel: 'Get Started',
        secondary: (
          <>
            Already have an account?{' '}
            <span className="secondaryLinkStrong">Sign in</span>
          </>
        ),
      },
      {
        tag: 'USDT EXCHANGE',
        icon: <ExchangeIcon />,
        title: (
          <>
            <span>Buy &amp; sell </span>
            <span className="titlePurpleItalic">USDT</span>
            <br />
            <span>in minutes.</span>
          </>
        ),
        body: (
          'Acquire USDT by paying Naira to our account. Liquidate USDT by sending to your wallet — we pay Naira directly to your bank. All transactions verified within 20 minutes.'
        ),
        primaryLabel: 'Next',
        secondary: <span className="secondaryLinkStrong">Skip intro</span>,
      },
      {
        tag: 'PORTFOLIO INTELLIGENCE',
        icon: <IntelligenceIcon />,
        title: (
          <>
            <span>Expert insight</span>
            <br />
            <span>to grow</span>
            <br />
            <span>
              <span className="titlePurpleItalic">your</span> capital.
            </span>
          </>
        ),
        body: (
          'Subscribe to receive macro outlooks, liquidity analysis, and portfolio allocation strategies. Three tiers — Basic, Business, and Institutional — each delivering more depth.'
        ),
        primaryLabel: 'Create Account',
        secondary: <span className="secondaryLinkStrong">Skip intro</span>,
      },
    ],
    []
  )

  useEffect(() => {
    const onboarded = localStorage.getItem('liquid_onboarded') === 'true'
    if (onboarded) {
      navigate('/signin', { replace: true })
      return
    }

    // Handle device back button: go to previous slide instead of leaving.
    window.history.pushState({ liquid_onb: true }, '')
    const onPopState = () => {
      if (stepRef.current > 0) {
        setStep((s) => Math.max(0, s - 1))
        window.history.pushState({ liquid_onb: true }, '')
        return
      }
      navigate(-1)
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [navigate])

  function persistOnboardedAndGo(path: string) {
    localStorage.setItem('liquid_onboarded', 'true')
    navigate(path)
  }

  function onPrimary() {
    if (step === 0) setStep(1)
    else if (step === 1) setStep(2)
    else persistOnboardedAndGo('/signup')
  }

  function onSecondary() {
    persistOnboardedAndGo('/signin')
  }

  function onTouchStart(e: TouchEvent) {
    startXRef.current = e.touches[0]?.clientX ?? null
  }

  function onTouchEnd(e: TouchEvent) {
    const startX = startXRef.current
    startXRef.current = null
    if (startX == null) return

    const endX = e.changedTouches[0]?.clientX ?? null
    if (endX == null) return

    const dx = endX - startX
    const threshold = 40

    if (dx <= -threshold && step < 2) setStep((s) => Math.min(2, s + 1))
    if (dx >= threshold && step > 0) setStep((s) => Math.max(0, s - 1))
  }

  return (
    <div
      className="onbRoot"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="screenPad">
        <div className="slideViewport" aria-label="Onboarding">
          <div className="slideTrack" style={{ transform: `translateX(-${step * 33.3333}%)` }}>
            {slides.map((s, idx) => (
              <section className="slidePane" key={idx} aria-hidden={idx !== step}>
                <div className="artArea">
                  <div className="geoBlock geo1" />
                  <div className="geoBlock geo2" />
                  <div className="geoBlock geo3" />
                  <div className="artGlow" />
                  <div className="iconWrap">{s.icon}</div>
                </div>

                <div className="progressRow">
                  {[0, 1, 2].map((p) => (
                    <div
                      key={p}
                      className={`dot ${p === step ? 'dotActive' : ''}`}
                    />
                  ))}
                </div>

                <div className="copyWrap">
                  <div className="tag">{s.tag}</div>
                  <h1 className="title">{s.title}</h1>
                  <p className="body">{s.body}</p>

                  <button
                    className="primaryBtn"
                    type="button"
                    onClick={onPrimary}
                  >
                    <div className="primaryBtnRow">
                      <span>{s.primaryLabel}</span>
                      <span className="chatBubble" aria-hidden="true">
                        <ChatIcon />
                      </span>
                    </div>
                  </button>

                  <button
                    className="secondaryLink"
                    type="button"
                    onClick={onSecondary}
                  >
                    {s.secondary}
                  </button>
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
