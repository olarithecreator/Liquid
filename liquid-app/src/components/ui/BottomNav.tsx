import { useNavigate } from 'react-router-dom'

import './bottomNav.css'

type NavTab = 'home' | 'exchange' | 'insights' | 'plans' | 'portfolio'

type Props = {
  active: NavTab
  unreadCount?: number
}

export default function BottomNav({ active, unreadCount = 0 }: Props) {
  const navigate = useNavigate()

  function itemClass(tab: NavTab): string {
    return `appBottomNavItem${active === tab ? ' active' : ''}`
  }

  return (
    <nav className="appBottomNav" aria-label="Bottom navigation">
      <button type="button" className={itemClass('home')} onClick={() => navigate('/home')}>
        <span className="appBottomNavIcon" aria-hidden="true">
          ⌂
        </span>
        <span className="appBottomNavLabel">Home</span>
      </button>
      <button type="button" className={itemClass('exchange')} onClick={() => navigate('/exchange/buy')}>
        <span className="appBottomNavIcon" aria-hidden="true">
          ⇄
        </span>
        <span className="appBottomNavLabel">Exchange</span>
      </button>
      <button type="button" className={itemClass('insights')} onClick={() => navigate('/intelligence')}>
        <span className="appBottomNavIcon" aria-hidden="true">
          ◈
        </span>
        <span className="appBottomNavLabel">Insights</span>
      </button>
      <button type="button" className={itemClass('plans')} onClick={() => navigate('/plans')}>
        <span className="appBottomNavIcon" aria-hidden="true">
          ◎
        </span>
        <span className="appBottomNavLabel">Plans</span>
      </button>
      <button type="button" className={itemClass('portfolio')} onClick={() => navigate('/portfolio')}>
        <span className="appBottomNavIcon" aria-hidden="true">
          ▦
        </span>
        <span className="appBottomNavLabel">Portfolio</span>
        {unreadCount > 0 ? (
          <span className="appBottomNavBadge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        ) : null}
      </button>
    </nav>
  )
}
