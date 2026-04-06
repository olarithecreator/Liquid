import { useEffect, useMemo, useRef, useState } from 'react'

type TimerBlockProps = {
  createdAt: string | null
  onExpire: () => void
  label: 'Order Window' | 'Transfer Window'
}

const WINDOW_MINUTES = 20
const TOTAL_MS = WINDOW_MINUTES * 60 * 1000 // 20 minutes

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function formatMMSS(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds)
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

function getTimeColour(remainingSeconds: number): string {
  if (remainingSeconds <= 0) return '#888888'
  if (remainingSeconds >= 601) return '#6700af' // 20:00 -> 10:01
  if (remainingSeconds >= 181) return '#D97706' // 10:00 -> 3:01
  return '#E05252' // 3:00 -> 0:01
}

export default function TimerBlock({
  createdAt,
  onExpire,
  label,
}: TimerBlockProps) {
  const createdAtMs = useMemo(() => {
    if (!createdAt) return null
    const ms = new Date(createdAt).getTime()
    return Number.isFinite(ms) ? ms : null
  }, [createdAt])

  const hasExpiredRef = useRef(false)

  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [progressPct, setProgressPct] = useState(0)
  const [expired, setExpired] = useState(false)

  const colour = useMemo(() => getTimeColour(remainingSeconds), [remainingSeconds])
  const fillBackground = useMemo(() => {
    if (remainingSeconds >= 601) return 'linear-gradient(135deg, #6700af, #8B2FE0)'
    return colour
  }, [colour, remainingSeconds])
  const isPulseRed = useMemo(
    () => remainingSeconds > 0 && remainingSeconds <= 180,
    [remainingSeconds],
  )

  useEffect(() => {
    if (!createdAtMs) return

    hasExpiredRef.current = false
    setExpired(false)

    let cancelled = false

    const tick = () => {
      const nowMs = Date.now()
      const remainingMs = createdAtMs + TOTAL_MS - nowMs
      const nextRemainingSeconds = Math.floor(remainingMs / 1000)

      const nextProgressPct = clamp(remainingMs / TOTAL_MS, 0, 1) * 100

      if (!cancelled) {
        setRemainingSeconds(nextRemainingSeconds)
        setProgressPct(nextProgressPct)
      }

      if (!cancelled && nextRemainingSeconds <= 0 && !hasExpiredRef.current) {
        hasExpiredRef.current = true
        setExpired(true)
        // Immediate expiry: source of truth is created_at + window - now().
        onExpire()
      }
    }

    // First tick immediately (no waiting for first interval tick).
    tick()

    const intervalId = window.setInterval(tick, 1000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [createdAtMs, onExpire])

  if (!createdAtMs) return null

  return (
    <div className="timer-compact" aria-label={label}>
      {/* Pulse animation is specific to the red window; keep it local to this component. */}
      <style>
        {`
          @keyframes timerPulse {
            0% { filter: drop-shadow(0 0 0 rgba(224,82,82,0)); transform: scale(1); }
            50% { filter: drop-shadow(0 0 10px rgba(224,82,82,0.35)); transform: scale(1.02); }
            100% { filter: drop-shadow(0 0 0 rgba(224,82,82,0)); transform: scale(1); }
          }
          .timerPulseRed { animation: timerPulse 1s ease-in-out infinite; }
        `}
      </style>

      <div className="tc-left">
        <div className="tc-label">{label}</div>
        <div className="tc-sub">Complete payment before expiry</div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <div
          className={`tc-num ${isPulseRed ? 'timerPulseRed' : ''}`}
          style={{ color: colour }}
        >
          {expired ? '00:00' : formatMMSS(remainingSeconds)}
        </div>
        <div className="tc-bar">
          <div
            className="tc-fill"
            style={{
              width: `${progressPct}%`,
              background: fillBackground,
            }}
          />
        </div>
      </div>
    </div>
  )
}
