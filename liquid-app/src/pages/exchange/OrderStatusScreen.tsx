import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import OrderStepTracker from '../../components/exchange/OrderStepTracker'
import { useAuth } from '../../hooks/useAuth'
import { formatNaira } from '../../lib/helpers'
import { sendEmail } from '../../lib/notifications'
import { supabase } from '../../lib/supabase'
import type { Order, OrderStatus } from '../../types'

import './exchangeScreens.css'

function statusPill(status: OrderStatus): { label: string; cls: string } {
  switch (status) {
    case 'awaiting_payment':
      return { label: 'Awaiting Payment', cls: 'blue' }
    case 'proof_uploaded':
      return { label: 'Proof Uploaded — Pending Review', cls: 'purple' }
    case 'verifying':
      return { label: 'Admin Verification', cls: 'purple' }
    case 'completed':
      return { label: 'Completed ✓', cls: 'green' }
    case 'cancelled':
      return { label: 'Order Cancelled', cls: 'red' }
    case 'expired':
      return { label: 'Expired', cls: 'red' }
    default:
      return { label: 'Unknown', cls: 'blue' }
  }
}

export default function OrderStatusScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { orderId } = useParams()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const completedHandledRef = useRef(false)

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadOrder() {
      if (!user?.id || !orderId) return
      setLoading(true)
      setError(null)
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (cancelled) return
        if (error || !data) {
          setError('Order not found.')
          setOrder(null)
          return
        }
        setOrder(data as Order)
      } catch {
        if (!cancelled) setError('Failed to load order.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadOrder()

    return () => {
      cancelled = true
    }
  }, [orderId, user?.id])

  useEffect(() => {
    if (!orderId) return
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => {
          const next = payload.new as Order
          setOrder(next)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orderId])

  useEffect(() => {
    if (!order) return
    if (order.status === 'expired') {
      navigate(`/exchange/expired/${order.id}`, { replace: true })
      return
    }

    if (order.status === 'completed' && !completedHandledRef.current) {
      completedHandledRef.current = true
      if (user?.email) {
        sendEmail('order_completed', user.email, {
          orderId: order.id,
          type: order.type,
          amountUsdt: order.amount_usdt,
          amountNgn: order.amount_ngn,
        }).catch(() => undefined)
      }

      void (async () => {
        try {
          await supabase.from('notifications').insert({
            user_id: order.user_id,
            title: 'Order Complete',
            message:
              order.type === 'buy'
                ? 'Your USDT has been sent successfully.'
                : `Your ${formatNaira(order.amount_ngn)} transfer is complete.`,
            type: 'order_completed',
            is_read: false,
          })
        } catch {
          // Non-blocking notification write.
        }
      })()

      const timer = window.setTimeout(() => {
        navigate(`/exchange/complete/${order.id}`, { replace: true })
      }, 1500)

      return () => {
        window.clearTimeout(timer)
      }
    }
  }, [navigate, order, user?.email])

  const statusInfo = useMemo(
    () => (order ? statusPill(order.status) : { label: '', cls: 'blue' }),
    [order],
  )
  const canCancelOrder = useMemo(() => {
    if (!order) return false
    return (
      order.status === 'awaiting_payment' ||
      order.status === 'proof_uploaded' ||
      order.status === 'verifying'
    )
  }, [order])

  async function handleUpload(file: File | null) {
    if (!file || !order) return
    setUploading(true)
    setError(null)
    try {
      const ext =
        file.name.includes('.') && file.name.split('.').length > 1
          ? file.name.split('.').pop()!.toLowerCase()
          : 'png'
      const proofPath = `${order.id}/proof.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(proofPath, file, { upsert: true, contentType: file.type })

      if (uploadError) {
        setError('Could not upload proof.')
        return
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update({ payment_proof_url: proofPath, status: 'proof_uploaded' })
        .eq('id', order.id)

      if (updateError) {
        setError('Could not update order status.')
        return
      }
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleCancelOrder() {
    if (!order || !user?.id || cancelling) return
    if (!canCancelOrder) return

    const ok = window.confirm('Cancel this order? This action cannot be undone.')
    if (!ok) return

    setCancelling(true)
    setError(null)
    try {
      const { error: cancelError } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', order.id)
        .eq('user_id', user.id)
        .in('status', ['awaiting_payment', 'proof_uploaded', 'verifying'])

      if (cancelError) {
        setError('Could not cancel order. Please try again.')
        return
      }

      navigate('/home', { replace: true })
    } catch {
      setError('Could not cancel order. Please try again.')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className="buy-screen">
        <div className="buy-top">Loading order...</div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="buy-screen">
        <div className="buy-top">
          <div className="buy-error">{error ?? 'Order not available.'}</div>
          <button type="button" className="primary-btn btn-white" onClick={() => navigate('/home')}>
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="buy-screen">
      <div className="buy-top">
        <div className="screen-nav">
          <div className="back-circle" role="button" tabIndex={0} onClick={() => navigate('/home')}>
            ←
          </div>
          <div className="screen-nav-title">Order Status</div>
        </div>

        {order.status === 'awaiting_payment' && !order.payment_proof_url ? (
          <div className="os-upload-card">
            <div className="os-upload-title">Upload your payment proof</div>
            <div className="os-upload-body">
              You have not uploaded proof yet. Upload your payment screenshot to continue processing.
            </div>
            <div
              className="upload-row"
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload payment proof"
              style={{ margin: '12px 0 0' }}
            >
              <div className="up-ico">📎</div>
              <div className="up-txt">
                <strong>{uploading ? 'Uploading...' : 'Upload payment screenshot'}</strong>
                <br />
                JPG, PNG, WEBP or PDF
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                style={{ display: 'none' }}
                disabled={uploading}
                onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
        ) : null}

        <OrderStepTracker status={order.status} />

        <div className="os-pill-wrap">
          <span className={`os-pill ${statusInfo.cls}`}>{statusInfo.label}</span>
        </div>

        <div className="buy-card" style={{ marginTop: 10 }}>
          <div className="bc-row">
            <span className="bc-key">Type</span>
            <span className="bc-val">{order.type.toUpperCase()}</span>
          </div>
          <div className="bc-row">
            <span className="bc-key">Amount</span>
            <span className="bc-val">{order.amount_usdt} USDT</span>
          </div>
          <div className="bc-row">
            <span className="bc-key">Naira</span>
            <span className="bc-val">{formatNaira(order.amount_ngn)}</span>
          </div>
          <div className="bc-row">
            <span className="bc-key">Rate</span>
            <span className="bc-val">{formatNaira(order.rate)}</span>
          </div>
          <div className="bc-row">
            <span className="bc-key">Reference</span>
            <span className="bc-val">#{order.id.slice(0, 8).toUpperCase()}</span>
          </div>
        </div>

        {order.status === 'cancelled' ? (
          <button type="button" className="primary-btn btn-white" onClick={() => navigate('/home')}>
            Back to Home
          </button>
        ) : null}

        {canCancelOrder ? (
          <button
            type="button"
            className="primary-btn btn-outline"
            onClick={handleCancelOrder}
            disabled={cancelling || uploading}
            style={{ marginTop: 10 }}
          >
            {cancelling ? 'Cancelling...' : 'Cancel Order'}
          </button>
        ) : null}

        {error ? <div className="buy-error">{error}</div> : null}
      </div>
    </div>
  )
}
