const rawAdminEmail =
  (import.meta.env.VITE_ADMIN_EMAIL as string | undefined) ?? 'morganhersly@gmail.com'
export const ADMIN_EMAIL = rawAdminEmail.trim().toLowerCase()

export function isAdminEmail(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase() === ADMIN_EMAIL
}

// Default order size limits (can be overridden by app_settings on startup).
export const MIN_ORDER_USDT = 50
export const MAX_ORDER_USDT = 2000

export const ORDER_TIMER_MINUTES = 20
