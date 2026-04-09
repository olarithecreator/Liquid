import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

import { adminSupabase as supabase } from '../../lib/supabase'
import { useAppSettings } from '../../hooks/useAppSettings'
import { formatNaira, getInitials, getTimerRemaining } from '../../lib/helpers'
import type { OrderStatus, OrderType } from '../../types'

import './adminDashboard.css'

type DashboardStats = {
  todayVolumeNgn: number
  todayOrdersCount: number
  spreadEarnedNgn: number
  activeSubscribers: number
  monthlyRevenueNgn: number
  completedToday: number
  pendingCount: number
}

type PendingOrderPreview = {
  id: string
  type: OrderType
  status: OrderStatus
  amountUsdt: number
  amountNgn: number
  createdAt: string
  userName: string
  userEmail: string | null
}

const pendingStatuses: OrderStatus[] = ['awaiting_payment', 'proof_uploaded', 'verifying']

const PLAN_PRICES: Record<string, number> = {
  basic: 15_000,
  business: 45_000,
  institutional: 120_000,
}

async function updateAppSetting(field: string, value: string | number | boolean): Promise<void> {
  // Path A: single-row schema with dedicated columns.
  const single = await supabase.from('app_settings').update({ [field]: value })
  if (!single.error) return

  // Path B: key/value schema (key, value) rows.
  const kv = await supabase.from('app_settings').upsert({ key: field, value }, { onConflict: 'key' })
  if (kv.error) {
    throw kv.error
  }
}

function formatCountdown(createdAt: string): string {
  const remaining = getTimerRemaining(createdAt)
  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const mm = String(mins).padStart(2, '0')
  const ss = String(secs).padStart(2, '0')
  return `${mm}:${ss}`
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const {
    buyRate,
    sellRate,
    exchangeOpen,
    exchangeMessage,
    minOrderUsdt,
    maxOrderUsdt,
    loading: settingsLoading,
  } = useAppSettings()

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const [pendingOrders, setPendingOrders] = useState<PendingOrderPreview[]>([])
  const [pendingLoading, setPendingLoading] = useState(true)

  const [buyInput, setBuyInput] = useState('')
  const [sellInput, setSellInput] = useState('')
  const [minInput, setMinInput] = useState('')
  const [maxInput, setMaxInput] = useState('')
  const [messageInput, setMessageInput] = useState('')
  const [exchangeOpenLocal, setExchangeOpenLocal] = useState(false)

  const [savingBuy, setSavingBuy] = useState(false)
  const [savingSell, setSavingSell] = useState(false)
  const [savingLimits, setSavingLimits] = useState(false)
  const [savingMessage, setSavingMessage] = useState(false)
  const [savingToggle, setSavingToggle] = useState(false)

  const [savedBuy, setSavedBuy] = useState(false)
  const [savedSell, setSavedSell] = useState(false)
  const [savedLimits, setSavedLimits] = useState(false)
  const [savedMessage, setSavedMessage] = useState(false)
  const [savedToggle, setSavedToggle] = useState(false)

  const [nowTick, setNowTick] = useState(Date.now())

  // Seed form fields from app settings once they are loaded.
  useEffect(() => {
    if (settingsLoading) return
    setBuyInput(String(buyRate || ''))
    setSellInput(String(sellRate || ''))
    setMinInput(String(minOrderUsdt || ''))
    setMaxInput(String(maxOrderUsdt || ''))
    setMessageInput(exchangeMessage ?? '')
    setExchangeOpenLocal(Boolean(exchangeOpen))
  }, [buyRate, exchangeMessage, exchangeOpen, maxOrderUsdt, minOrderUsdt, sellRate, settingsLoading])

  // Basic 1-second tick to keep countdown timers feeling live.
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // Load dashboard stats.
  useEffect(() => {
    let cancelled = false
    let refetchInFlight = false

    async function loadStats() {
      setStatsLoading(true)
      try {
        const start = new Date()
        start.setHours(0, 0, 0, 0)
        const end = new Date(start)
        end.setDate(end.getDate() + 1)

        const [{ data: orders, error: ordersError }, basicRes, businessRes, institutionalRes, subsRes] =
          await Promise.all([
            supabase
              .from('orders')
              .select('type,amount_ngn,amount_usdt,status,created_at,rate')
              .gte('created_at', start.toISOString())
              .lt('created_at', end.toISOString()),
            supabase
              .from('users')
              .select('id', { count: 'exact', head: true })
              .eq('subscription_plan', 'basic'),
            supabase
              .from('users')
              .select('id', { count: 'exact', head: true })
              .eq('subscription_plan', 'business'),
            supabase
              .from('users')
              .select('id', { count: 'exact', head: true })
              .eq('subscription_plan', 'institutional'),
            supabase
              .from('users')
              .select('id', { count: 'exact', head: true })
              .neq('subscription_plan', 'none'),
          ])

        if (cancelled) return

        if (ordersError) {
          setStats({
            todayVolumeNgn: 0,
            todayOrdersCount: 0,
            spreadEarnedNgn: 0,
            activeSubscribers: subsRes.count ?? 0,
            monthlyRevenueNgn: 0,
            completedToday: 0,
            pendingCount: 0,
          })
          return
        }

        const allOrders = (orders as any[]) ?? []

        let todayVolumeNgn = 0
        let todayOrdersCount = allOrders.length
        let spreadEarnedNgn = 0
        let completedToday = 0
        let pendingCount = 0
        const spreadPerUsdt = Math.max(0, Number(buyRate) - Number(sellRate))

        for (const row of allOrders) {
          const amountNgn = Number(row.amount_ngn) || 0
          const amountUsdt = Number(row.amount_usdt) || 0
          const status = row.status as OrderStatus
          const type = row.type as OrderType

          if (status === 'completed') {
            // Dashboard should reflect approved/completed transactions.
            todayVolumeNgn += amountNgn
          }

          if (status === 'completed') {
            completedToday += 1
          }

          if (pendingStatuses.includes(status)) {
            pendingCount += 1
          }

          if (status === 'completed' && amountUsdt > 0) {
            const rateAtOrder = Number(row.rate) || 0
            const spread =
              type === 'buy'
                ? Math.max(0, rateAtOrder - Number(sellRate)) * amountUsdt
                : Math.max(0, Number(buyRate) - rateAtOrder) * amountUsdt
            const fallbackSpread = spreadPerUsdt * amountUsdt
            const resolvedSpread = Number.isFinite(spread) && spread > 0 ? spread : fallbackSpread
            if (Number.isFinite(resolvedSpread)) spreadEarnedNgn += resolvedSpread
          }
        }

        const basicCount = basicRes.count ?? 0
        const businessCount = businessRes.count ?? 0
        const institutionalCount = institutionalRes.count ?? 0

        const monthlyRevenueNgn =
          basicCount * PLAN_PRICES.basic +
          businessCount * PLAN_PRICES.business +
          institutionalCount * PLAN_PRICES.institutional

        setStats({
          todayVolumeNgn,
          todayOrdersCount,
          spreadEarnedNgn,
          activeSubscribers: subsRes.count ?? 0,
          monthlyRevenueNgn,
          completedToday,
          pendingCount,
        })
      } catch {
        if (!cancelled) {
          setStats({
            todayVolumeNgn: 0,
            todayOrdersCount: 0,
            spreadEarnedNgn: 0,
            activeSubscribers: 0,
            monthlyRevenueNgn: 0,
            completedToday: 0,
            pendingCount: 0,
          })
        }
      } finally {
        if (!cancelled) setStatsLoading(false)
      }
    }

    loadStats().catch(() => undefined)

    async function safeRefetch() {
      if (refetchInFlight) return
      refetchInFlight = true
      try {
        await loadStats()
      } finally {
        refetchInFlight = false
      }
    }

    const channel = supabase
      .channel('admin-dashboard-live-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        void safeRefetch()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        void safeRefetch()
      })
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [buyRate, sellRate])

  // Load latest pending orders preview.
  useEffect(() => {
    let cancelled = false

    async function loadPending() {
      setPendingLoading(true)
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('id,type,status,amount_usdt,amount_ngn,created_at,users(full_name,email)')
          .in('status', pendingStatuses as unknown as string[])
          .order('created_at', { ascending: false })
          .limit(3)

        if (cancelled) return

        if (error || !data) {
          setPendingOrders([])
          return
        }

        const mapped: PendingOrderPreview[] = (data as any[]).map((row) => {
          const user = row.users ?? {}
          const fullName = (user.full_name as string | null) ?? null

          return {
            id: row.id as string,
            type: row.type as OrderType,
            status: row.status as OrderStatus,
            amountUsdt: Number(row.amount_usdt) || 0,
            amountNgn: Number(row.amount_ngn) || 0,
            createdAt: row.created_at as string,
            userName: fullName || (user.email as string | null) || 'Trader',
            userEmail: (user.email as string | null) ?? null,
          }
        })

        setPendingOrders(mapped)
      } catch {
        if (!cancelled) setPendingOrders([])
      } finally {
        if (!cancelled) setPendingLoading(false)
      }
    }

    loadPending().catch(() => undefined)

    let refetchInFlight = false
    async function safeRefetch() {
      if (refetchInFlight) return
      refetchInFlight = true
      try {
        await loadPending()
      } finally {
        refetchInFlight = false
      }
    }

    const channel = supabase
      .channel('admin-pending-orders-preview')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        void safeRefetch()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
        void safeRefetch()
        // Stats are handled by dedicated live stats channel.
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, () => {
        void safeRefetch()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      cancelled = true
    }
  }, [queryClient])

  const liveSpread = useMemo(() => {
    const buyVal = Number(buyInput)
    const sellVal = Number(sellInput)
    if (!Number.isFinite(buyVal) || !Number.isFinite(sellVal)) return 0
    return buyVal - sellVal
  }, [buyInput, sellInput])

  async function handleSaveBuy() {
    const next = Number(buyInput)
    if (!Number.isFinite(next) || next <= 0) return
    setSavingBuy(true)
    try {
      await updateAppSetting('buy_rate', next)
      queryClient.invalidateQueries({ queryKey: ['app_settings'] }).catch(() => undefined)
      setSavedBuy(true)
      window.setTimeout(() => setSavedBuy(false), 2000)
    } finally {
      setSavingBuy(false)
    }
  }

  async function handleSaveSell() {
    const next = Number(sellInput)
    if (!Number.isFinite(next) || next <= 0) return
    setSavingSell(true)
    try {
      await updateAppSetting('sell_rate', next)
      queryClient.invalidateQueries({ queryKey: ['app_settings'] }).catch(() => undefined)
      setSavedSell(true)
      window.setTimeout(() => setSavedSell(false), 2000)
    } finally {
      setSavingSell(false)
    }
  }

  async function handleToggleExchange() {
    const next = !exchangeOpenLocal
    setExchangeOpenLocal(next)
    setSavingToggle(true)
    try {
      await updateAppSetting('exchange_open', next)
      queryClient.invalidateQueries({ queryKey: ['app_settings'] }).catch(() => undefined)
      setSavedToggle(true)
      window.setTimeout(() => setSavedToggle(false), 2000)
    } catch {
      // Revert on failure.
      setExchangeOpenLocal(!next)
    } finally {
      setSavingToggle(false)
    }
  }

  async function handleSaveMessage() {
    setSavingMessage(true)
    try {
      await updateAppSetting('exchange_message', messageInput)
      queryClient.invalidateQueries({ queryKey: ['app_settings'] }).catch(() => undefined)
      setSavedMessage(true)
      window.setTimeout(() => setSavedMessage(false), 2000)
    } finally {
      setSavingMessage(false)
    }
  }

  async function handleSaveLimits() {
    const minVal = Number(minInput)
    const maxVal = Number(maxInput)
    if (!Number.isFinite(minVal) || !Number.isFinite(maxVal) || minVal <= 0 || maxVal <= 0) return
    setSavingLimits(true)
    try {
      await Promise.all([
        updateAppSetting('min_order_usdt', minVal),
        updateAppSetting('max_order_usdt', maxVal),
      ])
      queryClient.invalidateQueries({ queryKey: ['app_settings'] }).catch(() => undefined)
      setSavedLimits(true)
      window.setTimeout(() => setSavedLimits(false), 2000)
    } finally {
      setSavingLimits(false)
    }
  }

  async function handleApproveOrder(orderId: string) {
    await supabase
      .from('orders')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', orderId)

    // Refresh preview and stats.
    setPendingOrders((prev) => prev.filter((o) => o.id !== orderId))
    setStats((prev) => (prev ? { ...prev, pendingCount: Math.max(0, prev.pendingCount - 1) } : prev))
  }

  const hasPending = pendingOrders.length > 0

  return (
    <div className="adminDashboardRoot" aria-label="Admin dashboard">
      <header className="adminDashHeader">
        <div className="adminDashTitleBlock">
          <h1 className="adminDashTitle">Dashboard</h1>
          <p className="adminDashSubtitle">Monitor today&apos;s flow, spreads and control the exchange.</p>
        </div>
        <button
          type="button"
          className="adminDashOrdersLink"
          onClick={() => navigate('/admin/orders')}
        >
          View all orders →
        </button>
      </header>

      <section className="adminDashTopStats" aria-label="Today stats">
        <article className="adminStatCard">
          <div className="adminStatLabel">Today&apos;s Volume</div>
          <div className="adminStatValue">
            {statsLoading || !stats ? '—' : formatNaira(stats.todayVolumeNgn)}
          </div>
          <div className="adminStatHint">Sum of all order Naira amounts today.</div>
        </article>
        <article className="adminStatCard">
          <div className="adminStatLabel">Orders Received Today</div>
          <div className="adminStatValue">
            {statsLoading || !stats ? '—' : stats.todayOrdersCount.toLocaleString('en-NG')}
          </div>
          <div className="adminStatHint">All new orders submitted today.</div>
        </article>
        <article className="adminStatCard">
          <div className="adminStatLabel">Spread Earned Today</div>
          <div className="adminStatValue">
            {statsLoading || !stats ? '—' : formatNaira(stats.spreadEarnedNgn)}
          </div>
          <div className="adminStatHint">Calculated from today&apos;s completed volume.</div>
        </article>
        <article className="adminStatCard">
          <div className="adminStatLabel">Active Subscribers</div>
          <div className="adminStatValue">
            {statsLoading || !stats ? '—' : stats.activeSubscribers.toLocaleString('en-NG')}
          </div>
          <div className="adminStatHint">Users on any paid plan.</div>
        </article>
        <article className="adminStatCard">
          <div className="adminStatLabel">Subscription Revenue</div>
          <div className="adminStatValue">
            {statsLoading || !stats ? '—' : formatNaira(stats.monthlyRevenueNgn)}
          </div>
          <div className="adminStatHint">Monthly recurring from all plans.</div>
        </article>
      </section>

      <section className="adminDashGrid">
        <article className="adminPanel adminRateCard" aria-label="Exchange rates">
          <header className="adminPanelHeader">
            <h2 className="adminPanelTitle">Exchange Rates</h2>
            <span className="adminPanelSub">Set live buy and sell rates</span>
          </header>

          <div className="adminRateRow">
            <div className="adminRateLeft">
              <div className="adminRateLabel">Buy Rate (users pay per USDT)</div>
              <div className="adminRateInputWrap">
                <span className="adminRatePrefix">₦</span>
                <input
                  className="adminRateInput"
                  type="number"
                  inputMode="decimal"
                  value={buyInput}
                  onChange={(e) => setBuyInput(e.target.value)}
                  disabled={savingBuy || settingsLoading}
                />
              </div>
            </div>
            <div className="adminRateRight">
              <button
                type="button"
                className="adminSmallBtn"
                onClick={handleSaveBuy}
                disabled={savingBuy || settingsLoading}
              >
                {savingBuy ? 'Saving…' : 'Save'}
              </button>
              {savedBuy ? <span className="adminSavedText">Saved ✓</span> : null}
            </div>
          </div>

          <div className="adminRateRow">
            <div className="adminRateLeft">
              <div className="adminRateLabel">Sell Rate (users receive per USDT)</div>
              <div className="adminRateInputWrap">
                <span className="adminRatePrefix">₦</span>
                <input
                  className="adminRateInput"
                  type="number"
                  inputMode="decimal"
                  value={sellInput}
                  onChange={(e) => setSellInput(e.target.value)}
                  disabled={savingSell || settingsLoading}
                />
              </div>
            </div>
            <div className="adminRateRight">
              <button
                type="button"
                className="adminSmallBtn"
                onClick={handleSaveSell}
                disabled={savingSell || settingsLoading}
              >
                {savingSell ? 'Saving…' : 'Save'}
              </button>
              {savedSell ? <span className="adminSavedText">Saved ✓</span> : null}
            </div>
          </div>

          <div className="adminSpreadRow">
            <span className="adminSpreadLabel">Your spread per USDT</span>
            <span className="adminSpreadValue">
              Spread = {formatNaira(liveSpread || 0)}
            </span>
          </div>
        </article>

        <article className="adminPanel adminPendingCard" aria-label="Pending orders">
          <header className="adminPanelHeader adminPendingHeader">
            <div>
              <h2 className="adminPanelTitle">Pending Orders</h2>
              <span className="adminPanelSub">
                Live window of what needs your attention.
              </span>
            </div>
            <button
              type="button"
              className="adminLinkBtn"
              onClick={() => navigate('/admin/orders')}
            >
              View all →
            </button>
          </header>

          {pendingLoading ? (
            <div className="adminPendingEmpty">Loading pending orders…</div>
          ) : hasPending ? (
            <ul className="adminPendingList">
              {pendingOrders.map((order) => (
                <li key={order.id} className="adminPendingItem">
                  <div className="adminPendingLeft">
                    <div className="adminAvatarCircle">
                      {getInitials(order.userName || 'Trader')}
                    </div>
                    <div>
                      <div className="adminPendingName">{order.userName}</div>
                      <div className="adminPendingMeta">
                        <span className={`adminTypePill ${order.type === 'buy' ? 'buy' : 'sell'}`}>
                          {order.type === 'buy' ? 'Buy' : 'Sell'} order
                        </span>
                        <span className="adminPendingAmount">
                          {order.amountUsdt.toLocaleString('en-NG')} USDT ·{' '}
                          {formatNaira(order.amountNgn)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="adminPendingRight">
                    <div className="adminPendingTimer" aria-label="Time remaining">
                      {formatCountdown(order.createdAt)} left
                    </div>
                    <button
                      type="button"
                      className="adminApproveBtn"
                      onClick={() => handleApproveOrder(order.id)}
                    >
                      Approve
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="adminAllClear" aria-label="All clear state">
              <div className="adminAllClearIcon">✓</div>
              <h3 className="adminAllClearTitle">All clear</h3>
              <p className="adminAllClearBody">No pending orders right now.</p>

              <div className="adminAllClearStats">
                <div className="adminAllClearStat">
                  <div className="adminAllClearStatLabel">Completed today</div>
                  <div className="adminAllClearStatValue">
                    {statsLoading || !stats ? '—' : stats.completedToday.toLocaleString('en-NG')}
                  </div>
                </div>
                <div className="adminAllClearStat">
                  <div className="adminAllClearStatLabel">Pending</div>
                  <div className="adminAllClearStatValue">0</div>
                </div>
                <div className="adminAllClearStat">
                  <div className="adminAllClearStatLabel">Today&apos;s volume</div>
                  <div className="adminAllClearStatValue">
                    {statsLoading || !stats ? '—' : formatNaira(stats.todayVolumeNgn)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </article>
      </section>

      <section className="adminDashBottom">
        <article className="adminPanel adminControlsCard" aria-label="Exchange controls">
          <header className="adminPanelHeader">
            <h2 className="adminPanelTitle">Exchange Controls</h2>
            <span className="adminPanelSub">Open and close the book in one tap.</span>
          </header>

          <div className="adminToggleRow">
            <div>
              <div className="adminToggleLabel">Exchange Status</div>
              <div className="adminToggleHint">Toggle to open or close trading for all users.</div>
            </div>
            <button
              type="button"
              className={`adminToggle ${exchangeOpenLocal ? 'on' : 'off'}`}
              onClick={handleToggleExchange}
              disabled={savingToggle || settingsLoading}
              aria-pressed={exchangeOpenLocal}
            >
              <span className="adminToggleThumb" />
              <span className="adminToggleText">
                {exchangeOpenLocal ? 'OPEN' : 'CLOSED'}
              </span>
            </button>
            {savedToggle ? <span className="adminSavedText">Saved ✓</span> : null}
          </div>

          <div className="adminFieldBlock">
            <div className="adminFieldLabel">Closed message (shown to users)</div>
            <textarea
              className="adminTextarea"
              rows={2}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              disabled={savingMessage}
              placeholder="This message appears on the red status bar when the exchange is closed."
            />
            <div className="adminFieldActions">
              <button
                type="button"
                className="adminSmallBtn"
                onClick={handleSaveMessage}
                disabled={savingMessage}
              >
                {savingMessage ? 'Saving…' : 'Save'}
              </button>
              {savedMessage ? <span className="adminSavedText">Saved ✓</span> : null}
            </div>
          </div>

          <div className="adminFieldBlock adminLimitsRow">
            <div>
              <div className="adminFieldLabel">Order Limits (USDT)</div>
              <div className="adminToggleHint">Min and max USDT per order. Protects your liquidity.</div>
            </div>

            <div className="adminLimitsInputs">
              <label className="adminLimitInputWrap">
                <span className="adminLimitLabel">Min</span>
                <input
                  className="adminLimitInput"
                  type="number"
                  inputMode="decimal"
                  value={minInput}
                  onChange={(e) => setMinInput(e.target.value)}
                  disabled={savingLimits}
                />
              </label>
              <label className="adminLimitInputWrap">
                <span className="adminLimitLabel">Max</span>
                <input
                  className="adminLimitInput"
                  type="number"
                  inputMode="decimal"
                  value={maxInput}
                  onChange={(e) => setMaxInput(e.target.value)}
                  disabled={savingLimits}
                />
              </label>
              <button
                type="button"
                className="adminSmallBtn"
                onClick={handleSaveLimits}
                disabled={savingLimits}
              >
                {savingLimits ? 'Saving…' : 'Save'}
              </button>
              {savedLimits ? <span className="adminSavedText">Saved ✓</span> : null}
            </div>
          </div>
        </article>
      </section>

      {/* keep tick state referenced so countdown updates */}
      <span style={{ display: 'none' }}>{nowTick}</span>
    </div>
  )
}
