import { useEffect } from 'react'
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

function DropletShapes() {
  // Geometric art area (CSS draws the blocks; this is just a color icon).
  return (
    <div className="iconWrap" aria-hidden="true">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2s7 8 7 13a7 7 0 1 1-14 0c0-5 7-13 7-13Z"
          fill="#1dcfff"
          opacity="0.95"
        />
      </svg>
    </div>
  )
}

export default function SplashScreen() {
  const navigate = useNavigate()

  useEffect(() => {
    const onboarded = localStorage.getItem('liquid_onboarded') === 'true'

    if (onboarded) {
      navigate('/signin', { replace: true })
      return
    }

    const id = window.setTimeout(() => {
      navigate('/onboarding', { replace: true })
    }, 1500)

    return () => window.clearTimeout(id)
  }, [navigate])

  return (
    <div className="onbRoot">
      <div className="screenPad">
        <div className="artArea">
          <div className="geoBlock geo1" />
          <div className="geoBlock geo2" />
          <div className="geoBlock geo3" />
          <div className="artGlow" />
          <DropletShapes />
        </div>

        <div className="copyWrap">
          <div className="tag">DIGITAL ASSET PLATFORM</div>
          <div className="title">
            <span>Move </span>
            <span className="titleGoldItalic">Liquid.</span>
            <br />
            <span>Stay in</span>
            <br />
            <span>Control.</span>
          </div>
          <p className="body">
            Buy and sell USDT instantly. Grow your capital with expert portfolio
            intelligence — built for serious Nigerian investors.
          </p>

          <button className="primaryBtn" type="button" aria-label="Get Started">
            <div className="primaryBtnRow">
              <span>Get Started</span>
              <span className="chatBubble">
                <ChatIcon />
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
