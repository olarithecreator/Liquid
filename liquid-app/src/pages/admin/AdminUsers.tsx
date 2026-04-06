import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'

import { supabase } from '../../lib/supabase'
import type { OrderStatus, OrderType, User } from '../../types'

import './adminUsers.css'

type ToastKind = 'success' | 'error' | 'info'
type Plan = 'none' | 'basic' | 'business' | 'institutional'

type UserRow = User & { created_at?: string }

type UserStats = {
  totalOrders: number
  totalVolumeNgn: number
}

type RecentOrder = {
  id: string
  type: OrderType
  status: OrderStatus
  amount_ngn: number
  created_at: string
}

function formatDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function durationLabel(v?: string | null): string {
  if (v === '3m') return '3 Months'
  if (v === '6m') return '6 Months'
  if (v === '12m') return '1 Year'
  return '—'
}

function initials(name: string | null, email: string): string {
  const base = (name ?? '').trim()
  if (base) {
    const parts = base.split(/\s+/).filter(Boolean)
    const first = parts[0]?.[0] ?? ''
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
    const res = (first + last).toUpperCase()
    return res || email.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

function planLabel(plan: string): string {
  if (plan === 'institutional') return 'Institutional'
  if (plan === 'business') return 'Business'
  if (plan === 'basic') return 'Basic'
  return 'No Plan'
}

function planTone(plan: string): 'none' | 'basic' | 'business' | 'institutional' {
  if (plan === 'basic') return 'basic'
  if (plan === 'business') return 'business'
  if (plan === 'institutional') return 'institutional'
  return 'none'
}

function statusTone(status: string): 'good' | 'warn' | 'bad' | 'muted' {
  const s = status.toLowerCase()
  if (s === 'completed') return 'good'
  if (s === 'verifying' || s === 'proof_uploaded' || s === 'awaiting_payment') return 'warn'
  if (s === 'expired' || s === 'cancelled') return 'bad'
  return 'muted'
}

export default function AdminUsers() {
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserRow[]>([])
  const [statsByUser, setStatsByUser] = useState<Record<string, UserStats>>({})

  const [query, setQuery] = useState('')
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [panelUser, setPanelUser] = useState<UserRow | null>(null)
  const [panelOrders, setPanelOrders] = useState<RecentOrder[]>([])
  const [panelPlan, setPanelPlan] = useState<Plan>('none')
  const [panelBusy, setPanelBusy] = useState(false)

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(id)
  }, [toast])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const [{ data: usersData, error: usersError }, { data: ordersData, error: ordersError }] =
          await Promise.all([
            supabase
              .from('users')
              .select('id,email,full_name,phone,subscription_plan,subscription_expires_at,subscription_duration,created_at')
              .order('created_at', { ascending: false }),
            supabase.from('orders').select('user_id,amount_ngn'),
          ])

        if (cancelled) return
        if (usersError) throw usersError
        if (ordersError) throw ordersError

        const nextUsers = ((usersData as UserRow[]) ?? []).filter(Boolean)
        setUsers(nextUsers)

        const agg: Record<string, UserStats> = {}
        for (const row of (ordersData as any[]) ?? []) {
          const uid = row.user_id as string | undefined
          if (!uid) continue
          const amount = Number(row.amount_ngn) || 0
          const cur = agg[uid] ?? { totalOrders: 0, totalVolumeNgn: 0 }
          cur.totalOrders += 1
          cur.totalVolumeNgn += amount
          agg[uid] = cur
        }
        setStatsByUser(agg)
      } catch {
        if (!cancelled) {
          setUsers([])
          setStatsByUser({})
          setToast({ kind: 'error', message: 'Could not load users.' })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load().catch(() => undefined)

    let refetchInFlight = false
    async function safeRefetch() {
      if (refetchInFlight) return
      refetchInFlight = true
      try {
        await load()
      } finally {
        refetchInFlight = false
      }
    }

    const channel = supabase
      .channel('admin-users-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        void safeRefetch()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        void safeRefetch()
      })
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (!selectedUserId) return
    const fresh = users.find((u) => u.id === selectedUserId) ?? null
    setPanelUser(fresh)
  }, [selectedUserId, users])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => {
      const name = (u.full_name ?? '').toLowerCase()
      const email = (u.email ?? '').toLowerCase()
      return name.includes(q) || email.includes(q)
    })
  }, [query, users])

  const isPanelOpen = Boolean(selectedUserId && panelUser)

  async function openPanel(userId: string) {
    const u = users.find((x) => x.id === userId) ?? null
    if (!u) return
    setSelectedUserId(userId)
    setPanelUser(u)
    setPanelPlan((u.subscription_plan as Plan) ?? 'none')
    setPanelOrders([])

    const { data } = await supabase
      .from('orders')
      .select('id,type,status,amount_ngn,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(3)

    setPanelOrders(((data as RecentOrder[]) ?? []).filter(Boolean))
  }

  function closePanel() {
    setSelectedUserId(null)
    setPanelUser(null)
    setPanelOrders([])
    setPanelPlan('none')
  }

  async function updatePlan(userId: string, newPlan: Plan) {
    const prevUsers = users
    setUsers((cur) =>
      cur.map((u) => (u.id === userId ? { ...u, subscription_plan: newPlan } : u)),
    )

    try {
      const { error: updateError } = await supabase
        .from('users')
        .update(
          newPlan === 'none'
            ? { subscription_plan: newPlan, subscription_expires_at: null, subscription_duration: null }
            : { subscription_plan: newPlan },
        )
        .eq('id', userId)

      if (updateError) throw updateError

      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Plan Updated',
        message: `Your plan has been updated to ${planLabel(newPlan)}`,
        type: 'subscription',
        is_read: false,
      })

      if (notifError) throw notifError

      setToast({ kind: 'success', message: 'Plan updated ✓' })
    } catch {
      setUsers(prevUsers)
      setToast({ kind: 'error', message: 'Failed to update plan.' })
    }
  }

  async function handlePanelUpdate() {
    if (!panelUser) return
    setPanelBusy(true)
    try {
      await updatePlan(panelUser.id, panelPlan)
      closePanel()
    } finally {
      setPanelBusy(false)
    }
  }

  return (
    <div className="adminUsersRoot" aria-label="Admin users">
      <header className="adminUsersHeader">
        <div className="adminUsersHeaderTitle">
          <h1 className="adminUsersTitle">Users</h1>
          <div className="adminUsersSub">
            {users.length.toLocaleString('en-US')} total ·{' '}
            {users.filter((u) => {
              const d = u.created_at ? new Date(u.created_at) : null
              if (!d || Number.isNaN(d.getTime())) return false
              const now = new Date()
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
            }).length.toLocaleString('en-US')}{' '}
            new this month
          </div>
        </div>
      </header>

      {toast ? <div className={`adminUsersToast ${toast.kind}`}>{toast.message}</div> : null}

      <div className={`adminUsersGrid ${isPanelOpen ? 'withPanel' : ''}`}>
        <section className="adminUsersTableWrap" aria-label="Users table">
          <div className="adminUsersSearchRow">
            <span className="adminUsersSearchIcon">⌕</span>
            <input
              className="adminUsersSearch"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email..."
            />
          </div>

          <div className="adminUsersCard">
            <div className="adminUsersHeadRow">
              <div>User</div>
              <div>Plan</div>
              <div>Orders</div>
              <div>Joined</div>
              <div className="adminUsersHeadActions">Actions</div>
            </div>

            {loading ? (
              <div className="adminUsersEmpty">Loading users…</div>
            ) : filtered.length === 0 ? (
              <div className="adminUsersEmpty">No users found.</div>
            ) : (
              <ul className="adminUsersList">
                {filtered.map((u) => {
                  const selected = selectedUserId === u.id
                  const tone = planTone(u.subscription_plan)
                  const stats = statsByUser[u.id] ?? { totalOrders: 0, totalVolumeNgn: 0 }

                  return (
                    <li key={u.id} className={`adminUsersRow ${selected ? 'selected' : ''}`}>
                      <div className="adminUsersCell user">
                        <div className="adminUsersAvatar">{initials(u.full_name, u.email)}</div>
                        <div className="adminUsersUserText">
                          <div className="adminUsersName">{u.full_name || 'User'}</div>
                          <div className="adminUsersEmail">{u.email}</div>
                        </div>
                      </div>

                      <div className="adminUsersCell plan">
                        <span className={`adminPlanBadge ${tone}`}>{planLabel(u.subscription_plan)}</span>
                      </div>

                      <div className="adminUsersCell orders">{stats.totalOrders.toLocaleString('en-US')}</div>
                      <div className="adminUsersCell joined">{formatDate(u.created_at)}</div>

                      <div className="adminUsersCell actions">
                        <button type="button" className="adminUsersViewBtn" onClick={() => void openPanel(u.id)}>
                          View
                        </button>
                        <select
                          className="adminUsersPlanSelect"
                          value={(u.subscription_plan as Plan) ?? 'none'}
                          onChange={(e) => void updatePlan(u.id, (e.target.value as Plan) ?? 'none')}
                        >
                          <option value="none">No Plan</option>
                          <option value="basic">Basic</option>
                          <option value="business">Business</option>
                          <option value="institutional">Institutional</option>
                        </select>
                      </div>

                      <span style={{ display: 'none' }}>{stats.totalVolumeNgn}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        {isPanelOpen && panelUser ? (
          <>
            <button type="button" className="adminUsersOverlay" onClick={closePanel} aria-label="Close panel" />

            <aside className="adminUserPanel" aria-label="User detail panel">
              <div className="adminUserPanelTop">
                <div className="adminUserPanelTitle">View User</div>
                <button type="button" className="adminUserPanelClose" onClick={closePanel} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <div className="adminUserPanelHero">
                <div className="adminUserPanelAvatar">
                  {initials(panelUser.full_name, panelUser.email)}
                </div>
                <div className="adminUserPanelHeroText">
                  <div className="adminUserPanelName">{panelUser.full_name || 'User'}</div>
                  <div className="adminUserPanelEmail">{panelUser.email}</div>
                  <div className="adminUserPanelPhone">{panelUser.phone || '—'}</div>
                  <div className="adminUserPanelJoined">Joined {formatDate(panelUser.created_at)}</div>
                </div>
                <span className={`adminPlanBadge big ${planTone(panelUser.subscription_plan)}`}>
                  {planLabel(panelUser.subscription_plan)}
                </span>
              </div>

              <div className="adminUserStatsRow">
                <div className="adminUserStatTile">
                  <div className="adminUserStatLabel">Total Orders</div>
                  <div className="adminUserStatValue">
                    {(statsByUser[panelUser.id]?.totalOrders ?? 0).toLocaleString('en-US')}
                  </div>
                </div>
                <div className="adminUserStatTile">
                  <div className="adminUserStatLabel">Total Volume (₦)</div>
                  <div className="adminUserStatValue">
                    {(statsByUser[panelUser.id]?.totalVolumeNgn ?? 0).toLocaleString('en-NG')}
                  </div>
                </div>
                <div className="adminUserStatTile">
                  <div className="adminUserStatLabel">Joined</div>
                  <div className="adminUserStatValue">{formatDate(panelUser.created_at) || '—'}</div>
                </div>
              </div>

              <div className="adminUserPanelSection">
                <div className="adminUserPanelSectionTitle">Change Plan</div>
                <div className="adminUserPlanRow">
                  <select
                    className="adminUsersPlanSelect panel"
                    value={panelPlan}
                    onChange={(e) => setPanelPlan((e.target.value as Plan) ?? 'none')}
                    disabled={panelBusy}
                  >
                    <option value="none">No Plan</option>
                    <option value="basic">Basic</option>
                    <option value="business">Business</option>
                    <option value="institutional">Institutional</option>
                  </select>
                  <button
                    type="button"
                    className="adminUserPanelUpdateBtn"
                    onClick={() => void handlePanelUpdate()}
                    disabled={panelBusy}
                  >
                    {panelBusy ? 'Updating…' : 'Update'}
                  </button>
                </div>
                <div style={{ marginTop: 10, fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
                  Duration: {durationLabel(panelUser.subscription_duration)}
                  <br />
                  Active until: {formatDate(panelUser.subscription_expires_at) || '—'}
                </div>
              </div>

              <div className="adminUserPanelSection">
                <div className="adminUserPanelSectionTitle">Recent Orders</div>
                {panelOrders.length === 0 ? (
                  <div className="adminUserOrdersEmpty">No recent orders.</div>
                ) : (
                  <ul className="adminUserOrdersList">
                    {panelOrders.map((o) => (
                      <li key={o.id} className="adminUserOrderRow">
                        <div className="adminUserOrderLeft">
                          <div className="adminUserOrderRef">
                            {o.id.slice(0, 8)}… · {o.type.toUpperCase()}
                          </div>
                          <div className="adminUserOrderMeta">{formatDate(o.created_at)}</div>
                        </div>
                        <div className={`adminUserOrderStatus ${statusTone(o.status)}`}>
                          {o.status.replace(/_/g, ' ')}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </aside>
          </>
        ) : null}
      </div>
    </div>
  )
}
