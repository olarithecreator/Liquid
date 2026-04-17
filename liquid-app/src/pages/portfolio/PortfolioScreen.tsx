import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { useAppSettings } from '../../hooks/useAppSettings'
import { formatNaira } from '../../lib/helpers'
import { supabase } from '../../lib/supabase'
import BottomNav from '../../components/ui/BottomNav'

import './portfolioScreens.css'

type OrderLite = {
  id: string
  type: 'buy' | 'sell'
  amount_usdt: number
  amount_ngn: number
  status: string
  created_at: string
}

export default function PortfolioScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { buyRate, allocStable, allocBtc, allocEth } = useAppSettings()

  const [orders, setOrders] = useState<OrderLite[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!user?.id) return
      const [ordersRes, notifRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id,type,amount_usdt,amount_ngn,status,created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
      ])
      if (cancelled) return
      setOrders((ordersRes.data as OrderLite[] | null) ?? [])
      setUnreadCount(notifRes.count ?? 0)
    }
    run().catch(() => undefined)

    let refetchInFlight = false
    async function safeRefetch() {
      if (refetchInFlight || !user?.id) return
      refetchInFlight = true
      try {
        await run()
      } finally {
        refetchInFlight = false
      }
    }

    const channel = user?.id
      ? supabase
          .channel(`portfolio-live-${user.id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` },
            () => {
              void safeRefetch()
            },
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
            () => {
              void safeRefetch()
            },
          )
          .subscribe()
      : null

    return () => {
      cancelled = true
      if (channel) {
        void supabase.removeChannel(channel)
      }
    }
  }, [user?.id])

  const completed = useMemo(() => orders.filter((o) => o.status === 'completed'), [orders])
  const completedBuysUsdt = useMemo(() => completed.filter((o) => o.type === 'buy').reduce((a, b) => a + (Number(b.amount_usdt) || 0), 0), [completed])
  const completedSellsUsdt = useMemo(() => completed.filter((o) => o.type === 'sell').reduce((a, b) => a + (Number(b.amount_usdt) || 0), 0), [completed])
  const usdtHeld = Math.max(0, completedBuysUsdt - completedSellsUsdt)
  const portfolioValue = usdtHeld * (buyRate || 0)

  const monthlyRoi = useMemo(() => {
    const now = new Date()
    const thisMonth = completed
      .filter((o) => {
        const d = new Date(o.created_at)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
      .reduce((sum, o) => sum + (Number(o.amount_ngn) || 0), 0)

    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMonth = completed
      .filter((o) => {
        const d = new Date(o.created_at)
        return d.getMonth() === prevMonthDate.getMonth() && d.getFullYear() === prevMonthDate.getFullYear()
      })
      .reduce((sum, o) => sum + (Number(o.amount_ngn) || 0), 0)
    if (prevMonth <= 0) return thisMonth > 0 ? 100 : 0
    return Math.round(((thisMonth - prevMonth) / prevMonth) * 100)
  }, [completed])

  const activeSince = useMemo(() => {
    if (!orders.length) return '—'
    const oldest = orders[orders.length - 1]
    const d = new Date(oldest.created_at)
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }, [orders])

  const allocTotal = Math.max(100, allocStable + allocBtc + allocEth)

  return (
    <div className="pf-screen">
      <div className="pf-main">
        <div className="pf-value-card">
          <div className="pf-value-label">Portfolio Value</div>
          <div className="pf-value-amount">{formatNaira(portfolioValue)}</div>
        </div>

        <div className="pf-metrics">
          <div className="pf-metric"><div className="pf-metric-k">USDT Held</div><div className="pf-metric-v">{usdtHeld.toFixed(2)} USDT</div></div>
          <div className="pf-metric"><div className="pf-metric-k">Total Orders</div><div className="pf-metric-v">{orders.length}</div></div>
          <div className="pf-metric"><div className="pf-metric-k">Monthly ROI</div><div className="pf-metric-v">{monthlyRoi}%</div></div>
          <div className="pf-metric"><div className="pf-metric-k">Active Since</div><div className="pf-metric-v">{activeSince}</div></div>
        </div>

        <div className="pf-alloc">
          <div className="pf-alloc-top">
            <div style={{ fontFamily: 'var(--font-heading)' }}>Allocation</div>
            <button type="button" className="pf-adjust" onClick={() => navigate('/plans')}>
              Adjust
            </button>
          </div>
          <div className="pf-bar">
            <span className="pf-seg-stable" style={{ width: `${(allocStable / allocTotal) * 100}%` }} />
            <span className="pf-seg-btc" style={{ width: `${(allocBtc / allocTotal) * 100}%` }} />
            <span className="pf-seg-eth" style={{ width: `${(allocEth / allocTotal) * 100}%` }} />
          </div>
          <div className="pf-row"><span className="pf-dot pf-seg-stable" />Stable <b>{allocStable}%</b></div>
          <div className="pf-row"><span className="pf-dot pf-seg-btc" />BTC <b>{allocBtc}%</b></div>
          <div className="pf-row"><span className="pf-dot pf-seg-eth" />ETH <b>{allocEth}%</b></div>
        </div>
      </div>

      <BottomNav active="portfolio" unreadCount={unreadCount} />
    </div>
  )
}
