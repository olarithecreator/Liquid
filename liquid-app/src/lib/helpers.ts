import { ORDER_TIMER_MINUTES } from './constants'

export function formatNaira(amount: number): string {
  const rounded = Math.round(amount)
  const formatted = new Intl.NumberFormat('en-NG').format(rounded)
  return `₦${formatted}`
}

export function formatUsdt(amount: number): string {
  const rounded = Math.round(amount)
  const formatted = new Intl.NumberFormat('en-US').format(rounded)
  return `${formatted} USDT`
}

export function getTimerRemaining(createdAt: string): number {
  const createdMs = new Date(createdAt).getTime()
  if (Number.isNaN(createdMs)) return 0

  const expiresMs = createdMs + ORDER_TIMER_MINUTES * 60 * 1000
  const remainingMs = expiresMs - Date.now()
  if (remainingMs <= 0) return 0

  return Math.floor(remainingMs / 1000)
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return (first + last).toUpperCase()
}
