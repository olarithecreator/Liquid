import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { formatNaira } from '../../lib/helpers'
import { supabase } from '../../lib/supabase'
import type { Order } from '../../types'

import './exchangeScreens.css'

export default function OrderCompleteScreen() {
  const navigate = useNavigate()
  const { orderId } = useParams()
  const { user } = useAuth()

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!user?.id || !orderId) return
      setLoading(true)
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!cancelled) {
        setOrder((data as Order | null) ?? null)
        setLoading(false)
      }
    }
    run().catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [orderId, user?.id])

  const bankLast4 = useMemo(() => order?.user_bank_account?.slice(-4) ?? '', [order])
  const ref = useMemo(() => (order ? `#${order.id.slice(0, 8).toUpperCase()}` : '-'), [order])

  if (loading) {
    return (
      <div className="buy-screen">
        <div className="buy-top">Loading completion details...</div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="buy-screen">
        <div className="buy-top">
          <div className="buy-error">Order not found.</div>
          <button type="button" className="primary-btn btn-white" onClick={() => navigate('/home')}>
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  const isBuy = order.type === 'buy'
  return (
    <div className="buy-screen">
      <div className="buy-top">
        <div className="oc-success">✓</div>
        <h1 className="oc-title">{isBuy ? 'Order Complete' : 'Naira Sent'}</h1>
        <p className="oc-body">
          {isBuy
            ? 'Your USDT has been sent successfully. Check your wallet.'
            : `${formatNaira(order.amount_ngn)} has been sent to your ${order.user_bank_name ?? 'bank'} account ••${bankLast4}`}
        </p>

        <div className="buy-card">
          {isBuy ? (
            <>
              <div className="bc-row">
                <span className="bc-key">Amount sent</span>
                <span className="bc-val">{order.amount_usdt} USDT</span>
              </div>
              <div className="bc-row">
                <span className="bc-key">Naira paid</span>
                <span className="bc-val">{formatNaira(order.amount_ngn)}</span>
              </div>
            </>
          ) : (
            <>
              <div className="bc-row">
                <span className="bc-key">USDT received</span>
                <span className="bc-val">{order.amount_usdt} USDT</span>
              </div>
              <div className="bc-row">
                <span className="bc-key">Naira sent to</span>
                <span className="bc-val">
                  {order.user_bank_name ?? 'Bank'} ••{bankLast4}
                </span>
              </div>
              <div className="bc-row">
                <span className="bc-key">Amount</span>
                <span className="bc-val">{formatNaira(order.amount_ngn)}</span>
              </div>
            </>
          )}
          <div className="bc-row">
            <span className="bc-key">Rate</span>
            <span className="bc-val">{formatNaira(order.rate)}</span>
          </div>
          <div className="bc-row">
            <span className="bc-key">Reference</span>
            <span className="bc-val">{ref}</span>
          </div>
          <div className="bc-row">
            <span className="bc-key">Status</span>
            <span className="bc-val green">Completed ✓</span>
          </div>
        </div>

        <div className="oc-email">📧 Confirmation sent to {user?.email ?? 'your email'}</div>

        <button type="button" className="primary-btn btn-white" onClick={() => navigate('/home')}>
          Back to Home
        </button>
      </div>
    </div>
  )
}
