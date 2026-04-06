import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

import './portfolioScreens.css'

type Filter = 'all' | 'buy' | 'sell' | 'pending'
type OrderRow = { id: string; type: 'buy' | 'sell'; amount_usdt: number; status: string; created_at: string }

function dateLabel(dateIso: string): string {
  const d = new Date(dateIso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = Math.round((today.getTime() - day.getTime()) / (24 * 60 * 60 * 1000))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function TransactionHistoryScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [filter, setFilter] = useState<Filter>('all')
  const [orders, setOrders] = useState<OrderRow[]>([])

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!user?.id) return
      const { data } = await supabase
        .from('orders')
        .select('id,type,amount_usdt,status,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (!cancelled) setOrders((data as OrderRow[] | null) ?? [])
    }
    run().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const filtered = useMemo(() => {
    if (filter === 'all') return orders
    if (filter === 'buy') return orders.filter((o) => o.type === 'buy')
    if (filter === 'sell') return orders.filter((o) => o.type === 'sell')
    return orders.filter((o) => ['awaiting_payment', 'proof_uploaded', 'verifying'].includes(o.status))
  }, [filter, orders])

  const grouped = useMemo(() => {
    const map = new Map<string, OrderRow[]>()
    for (const o of filtered) {
      const k = dateLabel(o.created_at)
      const arr = map.get(k) ?? []
      arr.push(o)
      map.set(k, arr)
    }
    return Array.from(map.entries())
  }, [filtered])

  return (
    <div className="pf-screen">
      <div className="pf-main">
        <div className="pf-nav">
          <button type="button" className="pf-back" onClick={() => navigate('/portfolio')}>←</button>
          <div className="pf-title">Transaction History</div>
        </div>

        <div className="hist-pills">
          <button type="button" className={`hist-pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
          <button type="button" className={`hist-pill ${filter === 'buy' ? 'active' : ''}`} onClick={() => setFilter('buy')}>Acquired</button>
          <button type="button" className={`hist-pill ${filter === 'sell' ? 'active' : ''}`} onClick={() => setFilter('sell')}>Liquidated</button>
          <button type="button" className={`hist-pill ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>Pending</button>
        </div>

        {grouped.length === 0 ? (
          <div className="intel-loading">No transactions yet.</div>
        ) : (
          grouped.map(([label, rows]) => (
            <div key={label}>
              <div className="hist-group-label">{label}</div>
              {rows.map((o) => {
                const iconCls = o.status === 'expired' ? 'expired' : o.type === 'buy' ? 'buy' : 'sell'
                const icon = o.status === 'expired' ? '✕' : o.type === 'buy' ? '↓' : '↑'
                return (
                  <button key={o.id} type="button" className="hist-row" onClick={() => navigate(`/exchange/order/${o.id}`)}>
                    <div className="hist-left">
                      <span className={`hist-icon ${iconCls}`}>{icon}</span>
                      <span>{o.type === 'buy' ? 'Acquire' : 'Liquidate'}</span>
                    </div>
                    <span>{o.amount_usdt} USDT</span>
                  </button>
                )
              })}
            </div>
          ))
        )}
      </div>
      <div className="pf-nav-dark" role="navigation" aria-label="Bottom navigation">
        <button type="button" className="pf-nav-item" onClick={() => navigate('/home')}><span className="pf-ico">⌂</span><span className="pf-lbl">Home</span></button>
        <button type="button" className="pf-nav-item" onClick={() => navigate('/exchange/buy')}><span className="pf-ico">↕</span><span className="pf-lbl">Exchange</span></button>
        <button type="button" className="pf-nav-item" onClick={() => navigate('/intelligence')}><span className="pf-ico">◈</span><span className="pf-lbl">Insights</span></button>
        <button type="button" className="pf-nav-item active" onClick={() => navigate('/portfolio')}><span className="pf-ico">▦</span><span className="pf-lbl">Portfolio</span></button>
      </div>
    </div>
  )
}
