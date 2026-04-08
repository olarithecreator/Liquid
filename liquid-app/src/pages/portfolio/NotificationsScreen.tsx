import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import type { Notification } from '../../types'

import './portfolioScreens.css'

type NotificationRow = Notification & { order_id?: string | null }

export default function NotificationsScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [items, setItems] = useState<NotificationRow[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  async function refetch() {
    if (!user?.id) {
      setItems([])
      setUnreadCount(0)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (fetchError) throw fetchError
      const list = (data as NotificationRow[] | null) ?? []
      setItems(list)
      setUnreadCount(list.filter((n) => !n.is_read).length)
    } catch {
      setError('Could not load notifications. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refetch().catch(() => undefined)
  }, [user?.id])

  async function onTap(item: NotificationRow) {
    if (!item.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', item.id)
      await refetch()
    }

    if (item.type === 'order' && item.order_id) navigate(`/exchange/order/${item.order_id}`)
    else if (item.type === 'subscription') navigate('/plans')
    else navigate('/intelligence')
  }

  async function markAllRead() {
    if (!user?.id || unreadCount === 0 || markingAll) return
    setMarkingAll(true)
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
      if (updateError) throw updateError
      await refetch()
    } catch {
      setError('Could not mark all as read. Please retry.')
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <div className="pf-screen">
      <div className="pf-main">
        <div className="pf-nav">
          <button type="button" className="pf-back" onClick={() => navigate('/portfolio')}>←</button>
          <div className="pf-title">Notifications</div>
          <button
            type="button"
            className="pf-adjust"
            style={{ marginLeft: 'auto' }}
            onClick={markAllRead}
            disabled={markingAll || unreadCount === 0}
          >
            {markingAll ? 'Marking...' : 'Mark all read'}
          </button>
        </div>

        {loading ? (
          <div className="intel-loading">Loading notifications...</div>
        ) : error ? (
          <div className="intel-loading">
            {error}
            <div style={{ marginTop: 10 }}>
              <button type="button" className="pf-adjust" onClick={() => void refetch()}>
                Retry
              </button>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="intel-loading">No notifications yet.</div>
        ) : (
          items.map((n) => (
            <button key={n.id} type="button" className="notif-row" onClick={() => onTap(n)}>
              <div className="notif-title">{n.title}</div>
              <div className="notif-msg">{n.message}</div>
              <div className="notif-time">{new Date(n.created_at).toLocaleString()}</div>
              {!n.is_read ? <span className="notif-dot" /> : null}
            </button>
          ))
        )}
      </div>

      <div className="pf-nav-dark" role="navigation" aria-label="Bottom navigation">
        <button type="button" className="pf-nav-item" onClick={() => navigate('/home')}><span className="pf-ico">⌂</span><span className="pf-lbl">Home</span></button>
        <button type="button" className="pf-nav-item" onClick={() => navigate('/exchange/buy')}><span className="pf-ico">↕</span><span className="pf-lbl">Exchange</span></button>
        <button type="button" className="pf-nav-item" onClick={() => navigate('/intelligence')}><span className="pf-ico">◈</span><span className="pf-lbl">Insights</span></button>
        <button type="button" className="pf-nav-item active" onClick={() => navigate('/portfolio')}>
          <span className="pf-ico">▦</span><span className="pf-lbl">Portfolio</span>
          {unreadCount > 0 ? <span className="pf-unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
        </button>
      </div>
    </div>
  )
}
