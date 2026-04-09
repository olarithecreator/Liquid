import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { supabase } from '../../lib/supabase'
import { formatNaira, formatUsdt } from '../../lib/helpers'
import { useAuth } from '../../hooks/useAuth'
import { useAppSettings } from '../../hooks/useAppSettings'
import BottomNav from '../../components/ui/BottomNav'

import './homeScreen.css'

type RecentOrder = {
  id: string
  type: 'buy' | 'sell'
  amount_usdt: number
  created_at: string
  status: string
}

type PendingOrder = {
  id: string
} | null

function getDateLabel(dateISO: string): string {
  const d = new Date(dateISO)
  if (Number.isNaN(d.getTime())) return ''

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate())

  const diffDays = Math.round((that.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays === 0) return 'Today'
  if (diffDays === -1) return 'Yesterday'

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function HomeScreen() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const appSettings = useAppSettings()

  const userId = user?.id ?? null

  const [fullName, setFullName] = useState<string>('')
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [pendingOrder, setPendingOrder] = useState<PendingOrder>(null)
  const [portfolioValueNaira, setPortfolioValueNaira] = useState<number>(0)

  const [dataLoading, setDataLoading] = useState(true)
  const [announcementDismissed, setAnnouncementDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!userId) return

      setDataLoading(true)
      try {
        const pendingStatuses = ['awaiting_payment', 'proof_uploaded', 'verifying']

        const [
          profileRes,
          recentOrdersRes,
          pendingRes,
          completedOrdersRes,
        ] = await Promise.all([
          supabase.from('users').select('full_name').eq('id', userId).single(),
          supabase
            .from('orders')
            .select('id,type,amount_usdt,created_at,status')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(4),
          supabase
            .from('orders')
            .select('id')
            .eq('user_id', userId)
            .in('status', pendingStatuses)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('orders')
            .select('type,amount_usdt')
            .eq('user_id', userId)
            .eq('status', 'completed'),
        ])

        if (cancelled) return

        const profile = profileRes.data
        setFullName(profile?.full_name ?? '')

        const recent = recentOrdersRes.data as unknown as RecentOrder[] | null
        setRecentOrders(Array.isArray(recent) ? recent : [])

        setPendingOrder(pendingRes.data ? ({ id: pendingRes.data.id } as PendingOrder) : null)

        const completedOrders =
          completedOrdersRes.data as unknown as { type: 'buy' | 'sell'; amount_usdt: number }[] | null

        const { buysUsdt, sellsUsdt } = Array.isArray(completedOrders)
          ? completedOrders.reduce(
              (acc, row) => {
                const amt = Number(row.amount_usdt) || 0
                if (row.type === 'buy') acc.buysUsdt += amt
                else acc.sellsUsdt += amt
                return acc
              },
              { buysUsdt: 0, sellsUsdt: 0 },
            )
          : { buysUsdt: 0, sellsUsdt: 0 }

        const usdtHeld = Math.max(0, buysUsdt - sellsUsdt)
        const valueNgn = usdtHeld * (appSettings.buyRate || 0)
        setPortfolioValueNaira(valueNgn)
      } finally {
        if (!cancelled) setDataLoading(false)
      }
    }

    run().catch(() => {
      // If loading fails, keep skeleton short and fall back to empty state.
      setDataLoading(false)
    })

    let refetchInFlight = false
    async function safeRefetch() {
      if (refetchInFlight || !userId) return
      refetchInFlight = true
      try {
        await run()
      } finally {
        refetchInFlight = false
      }
    }

    const channel = userId
      ? supabase
          .channel(`home-orders-live-${userId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
            void safeRefetch()
          })
          .subscribe()
      : null

    return () => {
      cancelled = true
      if (channel) {
        void supabase.removeChannel(channel)
      }
    }
  }, [appSettings.buyRate, userId])

  const firstName = useMemo(() => {
    const first = fullName.trim().split(/\s+/).filter(Boolean)[0] ?? ''
    return first
  }, [fullName])

  const isLoading = authLoading || appSettings.loading || dataLoading

  const approxUsdtText = useMemo(() => {
    if (!appSettings.buyRate) return '0'
    const usdt = portfolioValueNaira / appSettings.buyRate
    const rounded = Math.round(usdt)
    return new Intl.NumberFormat('en-US').format(rounded)
  }, [appSettings.buyRate, portfolioValueNaira])

  const recentGrouped = useMemo(() => {
    const map = new Map<string, RecentOrder[]>() // key: label
    for (const o of recentOrders) {
      const label = getDateLabel(o.created_at)
      if (!label) continue
      const prev = map.get(label) ?? []
      prev.push(o)
      map.set(label, prev)
    }

    // Preserve insertion order (newest group first since we loop newest->oldest)
    return Array.from(map.entries()).map(([label, orders]) => ({ label, orders }))
  }, [recentOrders])

  function handleAcquire() {
    if (!appSettings.exchangeOpen) navigate('/exchange/closed')
    else navigate('/exchange/buy')
  }

  function handleLiquidate() {
    if (!appSettings.exchangeOpen) navigate('/exchange/closed')
    else navigate('/exchange/sell/step1')
  }

  const showAnnouncementBanner =
    !announcementDismissed && appSettings.announcement.trim().length > 0

  const actionOpacity = appSettings.exchangeOpen ? 1 : 0.6

  return (
    <div className="homePageRoot">
      {showAnnouncementBanner ? (
        <div className="homeAnnouncementBanner" role="status" aria-live="polite">
          <div className="homeAnnouncementIcon">📢</div>
          <div className="homeAnnouncementText">{appSettings.announcement}</div>
          <button className="homeAnnouncementDismiss" type="button" onClick={() => setAnnouncementDismissed(true)} aria-label="Dismiss announcement">
            ✕
          </button>
        </div>
      ) : null}

      <div className="homeMain">
        <div className="homeTopRow">
          <div className="homeGreeting">
            {isLoading ? (
              <div className="homeSkeletonSmall" aria-hidden="true" />
            ) : (
              <>
                <span className="homeGreetingMuted">Good morning, </span>
                <span className="homeGreetingName">{firstName}</span>
              </>
            )}
          </div>

          <button
            type="button"
            className="homeSettingsBtn"
            onClick={() => navigate('/account')}
            aria-label="Settings"
          >
            ⚙
          </button>
        </div>

        <div className="homePortfolioBlock">
          <div className="homePortfolioLabel">Portfolio Value</div>
          <div className="homePortfolioValue">
            {isLoading ? (
              <div className="homeSkeletonText" aria-hidden="true" />
            ) : (
              formatNaira(portfolioValueNaira)
            )}
          </div>

          <div className="homeUsdtApproxRow">
            {isLoading ? (
              <div className="homeSkeletonSmall" aria-hidden="true" />
            ) : (
              <span>≈ {approxUsdtText} USDT</span>
            )}
          </div>

          <div className="homeChangeRow">
            {isLoading ? (
              <div className="homeSkeletonSmall" aria-hidden="true" />
            ) : (
              <span>▲ 12.4%</span>
            )}
          </div>
        </div>

        <div className="homeRatePill" aria-label="Live USDT rate">
          {isLoading ? (
            <div className="homeSkeletonPill" aria-hidden="true" />
          ) : (
            <>
              <span className="homeLiveDot" aria-hidden="true" />
              <span className="homeRatePillLabel">Live USDT rate</span>
              <span className="homeRatePillValue">{appSettings.buyRate}</span>
            </>
          )}
        </div>
        <div className="homeOrderLimits" aria-label="Current order limits">
          Min {appSettings.minOrderUsdt} USDT · Max {appSettings.maxOrderUsdt} USDT
        </div>

        {appSettings.exchangeOpen ? null : isLoading ? (
          <div className="homeClosedStatusSkeleton" aria-hidden="true" />
        ) : (
          <div className="homeClosedStatusBar">
            <span className="homeRedDot" aria-hidden="true" />
            <span>
              Exchange currently closed — {appSettings.exchangeMessage}
            </span>
          </div>
        )}

        <div
          className="homeActionsGrid"
          style={{ opacity: isLoading ? 1 : actionOpacity }}
        >
          {isLoading ? (
            <>
              <div className="homeActionSkeletonCard" aria-hidden="true" />
              <div className="homeActionSkeletonCard" aria-hidden="true" />
            </>
          ) : (
            <>
              <button
                type="button"
                className="homeActionCard homeActionCardAcquire"
                onClick={handleAcquire}
                aria-label="Acquire"
              >
                <div className="homeActionArrow homeActionArrowGreen">↓</div>
                <div className="homeActionText">Acquire</div>
              </button>

              <button
                type="button"
                className="homeActionCard homeActionCardLiquidate"
                onClick={handleLiquidate}
                aria-label="Liquidate"
              >
                <div className="homeActionArrow homeActionArrowGold">↑</div>
                <div className="homeActionText">Liquidate</div>
              </button>
            </>
          )}
        </div>

        <div className="homeRecentPanel">
          <div className="homeRecentHeader">
            <div className="homeRecentTitle">Recent Activity</div>
            <button
              type="button"
              className="homeViewAllBtn"
              onClick={() => navigate('/history')}
            >
              View all
            </button>
          </div>

          {isLoading ? (
            <div className="homeRecentSkeletonBody" aria-hidden="true">
              <div className="homeSkeletonRow" />
              <div className="homeSkeletonGroupLabel" />
              <div className="homeSkeletonRow" />
              <div className="homeSkeletonRow" />
            </div>
          ) : pendingOrder ? (
            <button
              type="button"
              className="homePendingOrderRow"
              onClick={() => navigate(`/exchange/order/${pendingOrder.id}`)}
            >
              <span className="homePendingIcon" aria-hidden="true">
                ⏱
              </span>
              <span>You have a pending order →</span>
            </button>
          ) : null}

          <div className="homeRecentList">
            {isLoading
              ? null
              : recentGrouped.map((group) => (
                  <div key={group.label} className="homeRecentGroup">
                    <div className="homeDateLabel">{group.label}</div>
                    {group.orders.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        className="homeActivityRow"
                        onClick={() => navigate(`/exchange/order/${o.id}`)}
                      >
                        <div className="homeActivityLeft">
                          <span className="homeActivityType">
                            {o.type === 'buy' ? 'Acquire' : 'Liquidate'}
                          </span>
                        </div>
                        <div className="homeActivityRight">
                          {o.amount_usdt ? formatUsdt(o.amount_usdt).replace(' USDT', '') : ''}{' '}
                          USDT
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
          </div>
        </div>
      </div>

      <BottomNav active="home" />
    </div>
  )
}
