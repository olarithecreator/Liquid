export type OrderType = 'buy' | 'sell'

export type OrderStatus =
  | 'awaiting_payment'
  | 'proof_uploaded'
  | 'verifying'
  | 'completed'
  | 'cancelled'
  | 'expired'

export interface User {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  subscription_plan: string
  subscription_expires_at: string | null
  subscription_duration: string | null
  usdt_wallet_address: string | null
}

export interface Order {
  id: string
  user_id: string
  type: OrderType
  amount_usdt: number
  amount_ngn: number
  rate: number
  status: OrderStatus
  user_bank_name: string | null
  user_bank_account: string | null
  user_bank_holder: string | null
  user_wallet_address: string | null
  payment_proof_url: string | null
  tx_hash: string | null
  admin_notes: string | null
  created_at: string
  completed_at: string | null
}

export interface Insight {
  id: string
  title: string
  content: string
  tag: string
  tier_access: string
  is_published: boolean
  published_at: string | null
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: string
  is_read: boolean
  created_at: string
}

export interface AppSettings {
  key: string
  value: string
}
