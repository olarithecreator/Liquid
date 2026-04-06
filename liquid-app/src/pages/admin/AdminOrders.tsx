import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatNaira, getInitials, getTimerRemaining } from '../../lib/helpers'
import { sendEmail, sendTelegram } from '../../lib/notifications'
import type { Order, OrderStatus, OrderType } from '../../types'

import './adminOrders.css'

type OrderRow = Order & {
  users?: { full_name: string | null; email: string | null } | null
}

type FilterTab = 'pending' | 'all' | 'completed' | 'expired'

const pendingStatuses: OrderStatus[] = ['awaiting_payment', 'proof_uploaded', 'verifying']
const expiredStatuses: OrderStatus[] = ['expired', 'cancelled']

function statusLabel(status: OrderStatus): string {
  switch (status) {
    case 'awaiting_payment':
      return 'Awaiting USDT'
    case 'proof_uploaded':
      return 'Proof Uploaded'
    case 'verifying':
      return 'Verifying'
    case 'completed':
      return 'Completed ✓'
    case 'expired':
      return 'Expired'
    case 'cancelled':
      return 'Cancelled'
    default:
      return status
  }
}

function statusTone(status: OrderStatus): 'blue' | 'purple' | 'green' | 'red' {
  if (status === 'awaiting_payment') return 'blue'
  if (status === 'proof_uploaded' || status === 'verifying') return 'purple'
  if (status === 'completed') return 'green'
  return 'red'
}

function typeLabel(type: OrderType): string {
  return type === 'buy' ? 'Buy' : 'Sell'
}

function formatMMSS(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds)
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

function timerTone(createdAt: string): 'green' | 'purple' | 'red' {
  const remaining = getTimerRemaining(createdAt)
  const elapsedSeconds = Math.max(0, 20 * 60 - remaining)
  const elapsedMinutes = elapsedSeconds / 60

  // Prompt rule: green < 10min, purple 10-18min, red > 18min (elapsed).
  if (elapsedMinutes < 10) return 'green'
  if (elapsedMinutes <= 18) return 'purple'
  return 'red'
}

async function signedProofUrl(path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 60)
    if (error || !data?.signedUrl) return null
    return data.signedUrl
  } catch {
    return null
  }
}

export default function AdminOrders() {
  const [tab, setTab] = useState<FilterTab>('pending')
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = useMemo(() => orders.find((o) => o.id === selectedId) ?? null, [orders, selectedId])

  const [panelOpen, setPanelOpen] = useState(false)

  const [proofUrl, setProofUrl] = useState<string | null>(null)
  const [proofLoading, setProofLoading] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const [notes, setNotes] = useState('')
  const [txHash, setTxHash] = useState('')

  const [actionBusy, setActionBusy] = useState(false)
  const txSaveTimer = useRef<number | null>(null)

  const loadPendingCount = useCallback(async () => {
    const { count } = await supabase
      .from('orders')
      .select('id', { head: true, count: 'exact' })
      .in('status', pendingStatuses as unknown as string[])
    setPendingCount(count ?? 0)
  }, [])

  const loadOrders = useCallback(async (targetTab: FilterTab) => {
    setLoading(true)
    try {
      let q = supabase
        .from('orders')
        .select(
          'id,user_id,type,amount_usdt,amount_ngn,rate,status,user_bank_name,user_bank_account,user_bank_holder,user_wallet_address,payment_proof_url,tx_hash,admin_notes,created_at,completed_at,users(full_name,email)',
        )
        .order('created_at', { ascending: false })

      if (targetTab === 'pending') {
        q = q.in('status', pendingStatuses as unknown as string[])
      } else if (targetTab === 'completed') {
        q = q.eq('status', 'completed')
      } else if (targetTab === 'expired') {
        q = q.in('status', expiredStatuses as unknown as string[])
      }

      const { data, error } = await q
      if (error || !data) {
        setOrders([])
        return
      }

      setOrders(data as unknown as OrderRow[])
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load.
  useEffect(() => {
    void loadPendingCount()
    void loadOrders('pending')
  }, [loadOrders, loadPendingCount])

  // Realtime subscription.
  useEffect(() => {
    let refetchInFlight = false
    const safeRefetch = async () => {
      if (refetchInFlight) return
      refetchInFlight = true
      try {
        await Promise.all([loadPendingCount(), loadOrders(tab)])
      } finally {
        refetchInFlight = false
      }
    }

    const channel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => void safeRefetch())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        const prevStatus = (payload.old as { status?: string } | null)?.status
        const nextStatus = (payload.new as { status?: string; id?: string; user_id?: string } | null)?.status
        if (prevStatus !== 'proof_uploaded' && nextStatus === 'proof_uploaded') {
          const orderId = (payload.new as { id?: string } | null)?.id ?? ''
          const userId = (payload.new as { user_id?: string } | null)?.user_id ?? ''
          if (orderId && userId) {
            void (async () => {
              const { data: userRow } = await supabase
                .from('users')
                .select('full_name,email')
                .eq('id', userId)
                .single()
              const userName = (userRow?.full_name as string | null) ?? (userRow?.email as string | null) ?? 'User'
              await sendTelegram(`📎 PROOF UPLOADED\n🆔 #${orderId}\n👤 ${userName}\n→ Open admin to approve`)
            })()
          }
        }
        void safeRefetch()
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, () => void safeRefetch())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadOrders, loadPendingCount, tab])

  const onChangeTab = useCallback(
    (next: FilterTab) => {
      setTab(next)
      void loadOrders(next)
      if (next === 'pending') void loadPendingCount()
      setPanelOpen(false)
      setSelectedId(null)
    },
    [loadOrders, loadPendingCount],
  )

  // Load selected order detail state.
  useEffect(() => {
    if (!panelOpen || !selected) return

    setNotes(selected.admin_notes ?? '')
    setTxHash(selected.tx_hash ?? '')

    const proofPath = selected.payment_proof_url
    if (!proofPath) {
      setProofUrl(null)
      setProofLoading(false)
      return
    }

    let cancelled = false
    setProofLoading(true)
    signedProofUrl(proofPath).then((url) => {
      if (cancelled) return
      setProofUrl(url)
      setProofLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [panelOpen, selected])

  // Close panel on escape.
  useEffect(() => {
    if (!panelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPanelOpen(false)
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelOpen])

  const pendingLabel = useMemo(() => `Pending (${pendingCount})`, [pendingCount])

  async function updateOrder(orderId: string, patch: Partial<Order>) {
    await supabase.from('orders').update(patch).eq('id', orderId)
  }

  async function notifyUser(userId: string, title: string, message: string) {
    await supabase.from('notifications').insert({
      user_id: userId,
      title,
      message,
      type: 'order',
      is_read: false,
    })
  }

  async function quickApproveToVerifying(order: OrderRow) {
    if (actionBusy) return
    setActionBusy(true)
    try {
      await updateOrder(order.id, { status: 'verifying' })
      await notifyUser(order.user_id, 'Order Update', 'Your order is now under admin verification.')
      await sendTelegram(`🟡 ORDER VERIFYING #${order.id.slice(0, 8).toUpperCase()} ${order.amount_usdt} USDT`)
    } finally {
      setActionBusy(false)
    }
  }

  async function cancelOrder(order: OrderRow) {
    const ok = window.confirm('Cancel this order?')
    if (!ok) return
    if (actionBusy) return
    setActionBusy(true)
    try {
      await updateOrder(order.id, { status: 'cancelled' })
      await notifyUser(order.user_id, 'Order Cancelled', 'Your order has been cancelled by admin.')
      const userName = order.users?.full_name ?? order.users?.email ?? 'User'
      await sendTelegram(`❌ ORDER CANCELLED\n🆔 #${order.id}\n👤 ${userName}`)
      setPanelOpen(false)
      setSelectedId(null)
    } finally {
      setActionBusy(false)
    }
  }

  async function markComplete(order: OrderRow) {
    const ok = window.confirm('Mark this order as complete? This cannot be undone.')
    if (!ok) return
    if (actionBusy) return
    setActionBusy(true)
    try {
      const patch: Partial<Order> = {
        status: 'completed',
        completed_at: new Date().toISOString(),
      }
      if (order.type === 'buy' && txHash.trim()) {
        patch.tx_hash = txHash.trim()
      }

      await updateOrder(order.id, patch)

      await notifyUser(
        order.user_id,
        'Order Complete',
        order.type === 'buy'
          ? 'Your USDT has been sent successfully.'
          : `Your ${formatNaira(order.amount_ngn)} transfer is complete.`,
      )

      const userEmail = order.users?.email ?? null
      if (userEmail) {
        await sendEmail('order_completed', userEmail, {
          type: order.type,
          amount: order.amount_usdt,
          orderId: order.id,
        })
      }

      const userName = order.users?.full_name ?? order.users?.email ?? 'User'
      await sendTelegram(`✅ ORDER COMPLETED\n🆔 #${order.id}\n💵 ${order.amount_usdt} USDT\n👤 ${userName}`)

      setPanelOpen(false)
      setSelectedId(null)

      // Ensure it disappears from Pending without leaving /admin/orders.
      if (tab === 'pending') {
        setOrders((prev) => prev.filter((o) => o.id !== order.id))
      }
    } finally {
      setActionBusy(false)
    }
  }

  async function saveNotesOnBlur(order: OrderRow) {
    const next = notes.trim()
    if ((order.admin_notes ?? '') === next) return
    await updateOrder(order.id, { admin_notes: next })
  }

  function onTxChange(next: string, order: OrderRow) {
    setTxHash(next)
    if (txSaveTimer.current) window.clearTimeout(txSaveTimer.current)
    txSaveTimer.current = window.setTimeout(() => {
      void updateOrder(order.id, { tx_hash: next.trim() })
    }, 450)
  }

  const selectedRef = selected ? `#${selected.id.slice(0, 8).toUpperCase()}` : ''

  return (
    <div className="adminOrdersRoot" aria-label="Admin orders">
      <header className="adminOrdersHeader">
        <div className="adminOrdersHeaderLeft">
          <div className="adminOrdersTitle">Orders</div>
        </div>

        <div className="adminOrdersTabs" role="tablist" aria-label="Order filters">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'pending'}
            className={`adminTabPill ${tab === 'pending' ? 'active' : ''}`}
            onClick={() => onChangeTab('pending')}
          >
            {pendingLabel}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'all'}
            className={`adminTabPill ${tab === 'all' ? 'active' : ''}`}
            onClick={() => onChangeTab('all')}
          >
            All
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'completed'}
            className={`adminTabPill ${tab === 'completed' ? 'active' : ''}`}
            onClick={() => onChangeTab('completed')}
          >
            Completed
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'expired'}
            className={`adminTabPill ${tab === 'expired' ? 'active' : ''}`}
            onClick={() => onChangeTab('expired')}
          >
            Expired
          </button>
        </div>
      </header>

      <div className="adminOrdersLayout">
        <section className="adminOrdersTablePanel" aria-label="Orders table">
          <div className="adminOrdersCard">
            <div className="adminOrdersCardTitle">All {tab === 'pending' ? 'Pending ' : ''}Orders</div>

            <div className="adminOrdersTable">
              <div className="adminOrdersHeaderRow" role="row">
                <div className="c-user">USER</div>
                <div className="c-type">TYPE</div>
                <div className="c-amount">AMOUNT</div>
                <div className="c-naira">NAIRA</div>
                <div className="c-status">STATUS</div>
                <div className="c-timer">TIMER</div>
                <div className="c-actions">ACTIONS</div>
              </div>

              {loading ? (
                <div className="adminOrdersEmpty">Loading orders…</div>
              ) : orders.length === 0 ? (
                <div className="adminOrdersEmpty">No orders found.</div>
              ) : (
                orders.map((o) => {
                  const userName = o.users?.full_name || o.users?.email || 'Trader'
                  const userEmail = o.users?.email || 'Email protected'

                  const showTimer = !['expired', 'completed', 'cancelled'].includes(o.status)
                  const remaining = getTimerRemaining(o.created_at)
                  const timerText = showTimer ? formatMMSS(remaining) : '—'
                  const tone = showTimer ? timerTone(o.created_at) : 'green'

                  const isSelected = panelOpen && selectedId === o.id

                  return (
                    <div
                      key={o.id}
                      className={`adminOrdersRow ${isSelected ? 'selected' : ''}`}
                      role="row"
                    >
                      <div className="c-user">
                        <div className="userCell">
                          <div className="userAvatar">{getInitials(userName)}</div>
                          <div className="userInfo">
                            <div className="userName">{userName}</div>
                            <div className="userEmail">{userEmail}</div>
                          </div>
                        </div>
                      </div>

                      <div className="c-type">
                        <span className={`typeBadge ${o.type}`}>{typeLabel(o.type)}</span>
                      </div>

                      <div className="c-amount">{o.amount_usdt.toLocaleString('en-NG')} USDT</div>
                      <div className="c-naira">{formatNaira(o.amount_ngn)}</div>

                      <div className="c-status">
                        <span className={`statusBadge ${statusTone(o.status)}`}>{statusLabel(o.status)}</span>
                      </div>

                      <div className="c-timer">
                        <span className={`timerText ${tone}`}>{timerText}</span>
                      </div>

                      <div className="c-actions">
                        <button
                          type="button"
                          className="rowAction link"
                          onClick={() => {
                            setSelectedId(o.id)
                            setPanelOpen(true)
                          }}
                        >
                          View
                        </button>

                        {o.status === 'proof_uploaded' ? (
                          <button
                            type="button"
                            className="rowAction approve"
                            disabled={actionBusy}
                            onClick={() => void quickApproveToVerifying(o)}
                          >
                            Approve ✓
                          </button>
                        ) : null}

                        {o.status !== 'completed' ? (
                          <button
                            type="button"
                            className="rowAction cancel"
                            disabled={actionBusy}
                            onClick={() => void cancelOrder(o)}
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </section>

        {/* Slide-in detail panel */}
        {panelOpen && selected ? (
          <>
            <div
              className="adminOrdersOverlay"
              role="button"
              tabIndex={0}
              aria-label="Close order panel"
              onClick={() => {
                setPanelOpen(false)
                setSelectedId(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setPanelOpen(false)
                  setSelectedId(null)
                }
              }}
            />

            <aside className="adminOrderDetail" aria-label="Order details">
              <div className="detailTop">
                <div>
                  <div className="detailAmount">{selected.amount_usdt.toLocaleString('en-NG')} USDT</div>
                  <div className="detailSub">
                    <span className="detailRef">{selectedRef}</span>
                    <span className={`statusBadge ${statusTone(selected.status)}`}>
                      {statusLabel(selected.status)}
                    </span>
                    <span className="detailTime">
                      {new Date(selected.created_at).toLocaleString('en-NG')}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="detailClose"
                  aria-label="Close details"
                  onClick={() => {
                    setPanelOpen(false)
                    setSelectedId(null)
                  }}
                >
                  ✕
                </button>
              </div>

              <div className="detailGrid">
                <div className="detailItem">
                  <div className="detailKey">User</div>
                  <div className="detailVal">{selected.users?.full_name ?? 'Trader'}</div>
                </div>
                <div className="detailItem">
                  <div className="detailKey">Email</div>
                  <div className="detailVal">{selected.users?.email ?? 'Email protected'}</div>
                </div>
                <div className="detailItem">
                  <div className="detailKey">Amount</div>
                  <div className="detailVal">{selected.amount_usdt.toLocaleString('en-NG')} USDT</div>
                </div>
                <div className="detailItem">
                  <div className="detailKey">Rate</div>
                  <div className="detailVal">{formatNaira(selected.rate)}</div>
                </div>
              </div>

              {selected.type === 'buy' ? (
                <div className="detailBlock">
                  <div className="detailBlockTitle">Send USDT to</div>
                  <div className="monoBox">{selected.user_wallet_address ?? '—'}</div>
                </div>
              ) : (
                <div className="detailBlock">
                  <div className="detailBlockTitle">Bank details</div>
                  <div className="bankGrid">
                    <div>
                      <div className="bankKey">Bank</div>
                      <div className="bankVal">{selected.user_bank_name ?? '—'}</div>
                    </div>
                    <div>
                      <div className="bankKey">Account No.</div>
                      <div className="bankVal">{selected.user_bank_account ?? '—'}</div>
                    </div>
                    <div>
                      <div className="bankKey">Account Name</div>
                      <div className="bankVal">{selected.user_bank_holder ?? '—'}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="detailBlock">
                <div className="detailBlockTitle">Payment proof</div>

                {!selected.payment_proof_url ? (
                  <div className="proofPlaceholder">No proof uploaded yet</div>
                ) : proofLoading ? (
                  <div className="proofPlaceholder">Loading proof…</div>
                ) : proofUrl ? (
                  <div className="proofWrap">
                    <button
                      type="button"
                      className="proofImageBtn"
                      onClick={() => setLightboxOpen(true)}
                      aria-label="Open proof image"
                    >
                      {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                      {/* @ts-ignore */}
                      <img className="proofImg" src={proofUrl} alt="Payment proof" />
                    </button>
                    <a className="proofDownload" href={proofUrl} target="_blank" rel="noreferrer">
                      Download
                    </a>
                  </div>
                ) : (
                  <div className="proofPlaceholder">Proof unavailable (signed URL failed)</div>
                )}
              </div>

              <div className="detailBlock">
                <div className="detailBlockTitle">Admin notes</div>
                <textarea
                  className="detailTextarea"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => void saveNotesOnBlur(selected)}
                  placeholder="Add internal notes for this order…"
                />
              </div>

              <div className="detailBlock">
                <div className="detailBlockTitle">TxID</div>
                <input
                  className="detailInput"
                  value={txHash}
                  onChange={(e) => onTxChange(e.target.value, selected)}
                  placeholder="Paste transaction hash…"
                />
              </div>

              <div className="detailActions">
                <button
                  type="button"
                  className="detailBtn verify"
                  disabled={actionBusy || selected.status === 'completed'}
                  onClick={() => void quickApproveToVerifying(selected)}
                >
                  Approve ✓
                </button>

                <button
                  type="button"
                  className="detailBtn complete"
                  disabled={actionBusy || selected.status === 'completed'}
                  onClick={() => void markComplete(selected)}
                >
                  Mark Complete ✓
                </button>

                <button
                  type="button"
                  className="detailBtn cancel"
                  disabled={actionBusy || selected.status === 'completed'}
                  onClick={() => void cancelOrder(selected)}
                >
                  Cancel ✕
                </button>
              </div>
            </aside>

            {lightboxOpen && proofUrl ? (
              <div
                className="adminLightbox"
                role="button"
                tabIndex={0}
                aria-label="Close proof fullscreen"
                onClick={() => setLightboxOpen(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') setLightboxOpen(false)
                }}
              >
                <div className="adminLightboxInner" role="presentation">
                  {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                  {/* @ts-ignore */}
                  <img className="adminLightboxImg" src={proofUrl} alt="Payment proof fullscreen" />
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}
