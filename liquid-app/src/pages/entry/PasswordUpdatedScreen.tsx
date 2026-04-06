import { useNavigate } from 'react-router-dom'

import './authScreens.css'

function CheckCircle() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="rgba(29,185,84,0.12)" />
      <circle cx="12" cy="12" r="9" stroke="rgba(29,185,84,0.35)" strokeWidth="1" />
      <path
        d="M8.5 12.5l2.2 2.2L16 9.4"
        stroke="#1db954"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function PasswordUpdatedScreen() {
  const navigate = useNavigate()

  return (
    <div className="authRoot">
      <div className="authInner">
        <div className="iconCircleGreen" aria-hidden="true" style={{ margin: '18px auto 10px' }}>
          <CheckCircle />
        </div>

        <div className="authTitle" style={{ fontSize: 26, marginBottom: 6 }}>
          Password updated!
        </div>
        <div className="authSubtitle" style={{ marginBottom: 18 }}>
          Your password has been changed. You can now sign in.
        </div>

        <button
          type="button"
          className="primaryBtn"
          onClick={() => navigate('/signin')}
        >
          Back to Sign In
        </button>
      </div>
    </div>
  )
}
