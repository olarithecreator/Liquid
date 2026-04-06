import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { formatNaira } from '../../lib/helpers'
import { supabase } from '../../lib/supabase'
import type { Order } from '../../types'

import './exchangeScreens.css'

export default function OrderExpiredScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { orderId } = useParams()
  const [order, setOrder] = useState<Order | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!user?.id || !orderId) return
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!cancelled) setOrder((data as Order | null) ?? null)
    }
    run().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [orderId, user?.id])

  const tryAgainPath = useMemo(() => {
    if (order?.type === 'sell') return '/exchange/sell/step1'
    return '/exchange/buy'
  }, [order?.type])

  return (
    <div className="buy-screen">
      <div className="buy-top">
        <div className="oe-icon-box">⏰</div>
        <div className="oe-time">00:00</div>
        <h1 className="oe-title">Order Expired</h1>
        <p className="oe-body">
          Your 20-minute window passed. No payment detected. Order auto-cancelled. No funds were
          deducted.
        </p>

        <div className="oe-dark-card">
          <div className="bc-row" style={{ borderBottomColor: 'rgba(255,255,255,0.09)' }}>
            <span className="bc-key">Cancelled amount</span>
            <span className="bc-val" style={{ color: '#fff' }}>
              {order ? `${order.amount_usdt} USDT` : '-'}
            </span>
          </div>
          <div className="bc-row" style={{ borderBottomColor: 'rgba(255,255,255,0.09)' }}>
            <span className="bc-key">Reference</span>
            <span className="bc-val" style={{ color: '#fff' }}>
              {order ? `#${order.id.slice(0, 8).toUpperCase()}` : '-'}
            </span>
          </div>
          <div className="bc-row" style={{ borderBottom: 'none' }}>
            <span className="bc-key">Time</span>
            <span className="bc-val" style={{ color: '#fff' }}>
              {order?.created_at ? new Date(order.created_at).toLocaleString() : '--'}
            </span>
          </div>
          {order ? (
            <div className="oe-ngn">{formatNaira(order.amount_ngn)}</div>
          ) : null}
        </div>

        <button type="button" className="primary-btn btn-white" onClick={() => navigate(tryAgainPath)}>
          Try Again
        </button>
        <button type="button" className="primary-btn btn-outline" onClick={() => navigate('/home')}>
          Back to Home
        </button>
      </div>
    </div>
  )
}
