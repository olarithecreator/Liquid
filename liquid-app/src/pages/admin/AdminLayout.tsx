import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight,
  LayoutDashboard,
  Layers,
  Menu,
  PenLine,
  Settings,
  Users,
  X,
} from 'lucide-react'

import { supabase } from '../../lib/supabase'
import { ADMIN_EMAIL } from '../../lib/constants'
import { useAuth } from '../../hooks/useAuth'

import './adminLayout.css'

type Props = { children: ReactNode }

const pendingStatuses = ['awaiting_payment', 'proof_uploaded', 'verifying'] as const

function SidebarItem({
  active,
  icon,
  label,
  onClick,
  right,
}: {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
  right?: ReactNode
}) {
  return (
    <button
      type="button"
      className={`adminNavItem ${active ? 'adminNavItemActive' : ''}`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
    >
      <span className="adminNavIcon">{icon}</span>
      <span className="adminNavLabel">{label}</span>
      {right ? <span className="adminNavRight">{right}</span> : null}
    </button>
  )
}

export default function AdminLayout({ children }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading, isAdmin } = useAuth()

  const [pendingCount, setPendingCount] = useState(0)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const pathname = location.pathname

  const isActive = useMemo(() => {
    return {
      dashboard: pathname === '/admin',
      orders: pathname.startsWith('/admin/orders'),
      newPost: pathname === '/admin/post/new',
      allPosts: pathname.startsWith('/admin/posts'),
      users: pathname.startsWith('/admin/users'),
      settings: pathname.startsWith('/admin/settings'),
    }
  }, [pathname])

  useEffect(() => {
    if (loading) return

    if (!user || user.email !== ADMIN_EMAIL || !isAdmin) {
      navigate('/admin/login', { replace: true })
    }
  }, [isAdmin, loading, navigate, user])

  useEffect(() => {
    if (!user || !isAdmin) return

    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function loadCount() {
      try {
        const { count, error } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .in('status', pendingStatuses as unknown as string[])

        if (cancelled) return
        if (error) {
          setPendingCount(0)
          return
        }
        setPendingCount(count ?? 0)
      } catch {
        if (!cancelled) setPendingCount(0)
      }
    }

    let refetchInFlight = false
    async function safeRefetch() {
      if (refetchInFlight) return
      refetchInFlight = true
      try {
        await loadCount()
      } finally {
        refetchInFlight = false
      }
    }

    // Initial fetch.
    void loadCount()

    // Keep badge updated live.
    channel = supabase
      .channel('admin-pending-orders-badge')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        () => void safeRefetch(),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        () => void safeRefetch(),
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'orders' },
        () => void safeRefetch(),
      )
      .subscribe()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [isAdmin, user])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  if (loading || !user || !isAdmin) {
    return null
  }

  return (
    <div className="adminLayoutRoot">
      {mobileNavOpen ? (
        <button
          type="button"
          className="adminMobileBackdrop"
          aria-label="Close menu overlay"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <aside className={`adminSidebar ${mobileNavOpen ? 'mobileOpen' : ''}`}>
        <div className="adminMobileSidebarTop">
          <button
            type="button"
            className="adminMobileCloseBtn"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="adminBrand" aria-label="Liquid admin brand">
          <div className="adminBrandLogo">
            Liquid<span className="logoDot">.</span>
          </div>
          <div className="adminBrandSub">Admin Panel</div>
        </div>

        <nav className="adminNav" aria-label="Admin navigation">
          <SidebarItem
            active={isActive.dashboard}
            icon={<LayoutDashboard size={18} />}
            label="Dashboard"
            onClick={() => {
              navigate('/admin')
              setMobileNavOpen(false)
            }}
          />

          <SidebarItem
            active={isActive.orders}
            icon={<ArrowLeftRight size={18} />}
            label="Orders"
            onClick={() => {
              navigate('/admin/orders')
              setMobileNavOpen(false)
            }}
            right={
              pendingCount > 0 ? (
                <span className="adminOrdersBadge" aria-label={`${pendingCount} pending orders`}>
                  {pendingCount}
                </span>
              ) : null
            }
          />

          <SidebarItem
            active={isActive.newPost}
            icon={<PenLine size={18} />}
            label="New Post"
            onClick={() => {
              navigate('/admin/post/new')
              setMobileNavOpen(false)
            }}
          />

          <SidebarItem
            active={isActive.allPosts}
            icon={<Layers size={18} />}
            label="All Posts"
            onClick={() => {
              navigate('/admin/posts')
              setMobileNavOpen(false)
            }}
          />

          <SidebarItem
            active={isActive.users}
            icon={<Users size={18} />}
            label="Users"
            onClick={() => {
              navigate('/admin/users')
              setMobileNavOpen(false)
            }}
          />

          <SidebarItem
            active={isActive.settings}
            icon={<Settings size={18} />}
            label="Settings"
            onClick={() => {
              navigate('/admin/settings')
              setMobileNavOpen(false)
            }}
          />
        </nav>

        <div className="adminSidebarBottom">
          <div className="adminAvatar" aria-hidden="true">
            AD
          </div>
          <div className="adminSidebarUser">
            <div className="adminSidebarUserName">Admin</div>
            <div className="adminSidebarUserSub">Liquid Owner</div>
          </div>
        </div>
      </aside>

      <main className="adminMain" aria-label="Admin main content">
        <div className="adminMobileTopbar">
          <button
            type="button"
            className="adminMobileMenuBtn"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open admin menu"
          >
            <Menu size={18} />
          </button>
          <div className="adminMobileTitle">Admin Panel</div>
          {pendingCount > 0 ? <span className="adminOrdersBadge">{pendingCount}</span> : <span />}
        </div>
        {children}
      </main>
    </div>
  )
}
