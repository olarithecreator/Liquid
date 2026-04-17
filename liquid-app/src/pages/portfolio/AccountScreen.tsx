import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

import './portfolioScreens.css'

type NotificationPrefs = { orderUpdates: boolean; insights: boolean }
type SavedBank = { bank_name: string; account_number: string; account_holder: string; is_default: boolean }
const walletCacheKey = (userId: string) => `liquid_wallet_${userId}`
const banksCacheKey = (userId: string) => `liquid_saved_banks_${userId}`

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U'
}

function truncateWallet(addr: string | null): string {
  if (!addr) return 'Not set'
  if (addr.length < 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`
}

function WalletBottomSheet({
  initialAddress,
  onClose,
  onSaved,
}: {
  initialAddress: string
  onClose: () => void
  onSaved: (newValue: string) => void
}) {
  const [value, setValue] = useState(initialAddress)
  const valid = value.startsWith('T') && value.length === 34

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'ArrowLeft') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <button type="button" className="sheet-overlay" aria-label="Close" onClick={onClose} />
      <div className="wallet-sheet">
        <div className="sheet-handle" />
        <div className="wallet-title">USDT Wallet Address</div>
        <div className="wallet-copy">Use a TRC-20 address only to avoid failed transfers.</div>
        <label className="wallet-lbl">TRC-20 Address</label>
        <div className="wallet-input-wrap">
          <input className="wallet-input" value={value} onChange={(e) => setValue(e.target.value.trim())} />
          {value ? <button type="button" className="wallet-clear" onClick={() => setValue('')}>✕</button> : null}
        </div>
        {valid ? <div className="wallet-valid">✓ Valid TRC-20 address</div> : null}
        <div className="wallet-actions">
          <button type="button" className="wallet-save" onClick={() => valid && onSaved(value)}>Save Address</button>
          <button type="button" className="wallet-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </>
  )
}

export default function AccountScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [fullName, setFullName] = useState('')
  const [plan, setPlan] = useState('none')
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null)
  const [wallet, setWallet] = useState<string>('')
  const [savedBanks, setSavedBanks] = useState<SavedBank[]>([])
  const [prefs, setPrefs] = useState<NotificationPrefs>({ orderUpdates: true, insights: true })
  const [showWalletSheet, setShowWalletSheet] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [savingWallet, setSavingWallet] = useState(false)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!user?.id) return
      const cachedWallet = localStorage.getItem(walletCacheKey(user.id))
      if (cachedWallet && !cancelled) setWallet(cachedWallet)

      const { data, error: fetchError } = await supabase
        .from('users')
        .select('full_name,email,subscription_plan,subscription_expires_at,usdt_wallet_address,notification_prefs')
        .eq('id', user.id)
        .single()
      if (fetchError) {
        setToast('Could not load account details')
        return
      }
      if (cancelled || !data) return
      setFullName((data.full_name as string | null) ?? '')
      setPlan((data.subscription_plan as string | null) ?? 'none')
      setSubscriptionExpiresAt((data.subscription_expires_at as string | null) ?? null)
      const walletFromDb = (data.usdt_wallet_address as string | null) ?? ''
      setWallet(walletFromDb || cachedWallet || '')
      localStorage.setItem(walletCacheKey(user.id), walletFromDb || cachedWallet || '')
      const cachedBanksRaw = localStorage.getItem(banksCacheKey(user.id))
      if (cachedBanksRaw) {
        try {
          const cachedBanks = JSON.parse(cachedBanksRaw) as SavedBank[]
          setSavedBanks(Array.isArray(cachedBanks) ? cachedBanks : [])
        } catch {
          setSavedBanks([])
        }
      } else {
        setSavedBanks([])
      }
      const rawPrefs = data.notification_prefs as NotificationPrefs | null
      if (rawPrefs) setPrefs({ orderUpdates: Boolean(rawPrefs.orderUpdates), insights: Boolean(rawPrefs.insights) })
    }
    run().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const defaultBank = useMemo(() => savedBanks.find((b) => b.is_default) ?? savedBanks[0] ?? null, [savedBanks])
  const formattedPlan = useMemo(
    () => (plan ? `${plan.charAt(0).toUpperCase()}${plan.slice(1).toLowerCase()}` : 'None'),
    [plan],
  )
  const formattedExpiry = useMemo(() => {
    if (!subscriptionExpiresAt) return null
    return new Date(subscriptionExpiresAt).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }, [subscriptionExpiresAt])
  const expiringSoon = useMemo(() => {
    if (!subscriptionExpiresAt) return false
    const diff = new Date(subscriptionExpiresAt).getTime() - Date.now()
    return diff > 0 && diff < 14 * 24 * 60 * 60 * 1000
  }, [subscriptionExpiresAt])

  async function persistPrefs(next: NotificationPrefs) {
    if (savingPrefs) return
    const previous = prefs
    setPrefs(next)
    if (!user?.id) return
    setSavingPrefs(true)
    const { error } = await supabase.from('users').update({ notification_prefs: next }).eq('id', user.id)
    setSavingPrefs(false)
    if (error) {
      setPrefs(previous)
      setToast('Could not save notification settings')
      return
    }
    setToast('Notification settings saved ✓')
  }

  async function saveWallet(newValue: string) {
    if (!user?.id || savingWallet) return
    const previous = wallet
    setWallet(newValue)
    localStorage.setItem(walletCacheKey(user.id), newValue)
    setSavingWallet(true)
    const { error } = await supabase.from('users').update({ usdt_wallet_address: newValue }).eq('id', user.id)
    setSavingWallet(false)
    if (error) {
      setWallet(previous)
      localStorage.setItem(walletCacheKey(user.id), previous)
      setToast('Could not save wallet to server')
      return
    }
    setWallet(newValue)
    setShowWalletSheet(false)
    setToast('Address saved ✓')
  }

  async function signOut() {
    const ok = window.confirm('Sign out now?')
    if (!ok) return
    await supabase.auth.signOut()
    navigate('/signin', { replace: true })
  }

  return (
    <div className="pf-screen">
      <div className="pf-main">
        <div className="pf-nav">
          <button type="button" className="pf-back" onClick={() => navigate('/portfolio')}>←</button>
          <div className="pf-title">Account</div>
        </div>

        {toast ? <div className="plan-toast success">{toast}</div> : null}

        <div className="acc-card">
          <div className="acc-head">
            <div className="acc-avatar">{getInitials(fullName || user?.email || '')}</div>
            <div>
              <div className="acc-name">{fullName || 'User'}</div>
              <div className="acc-email">{user?.email}</div>
            </div>
            <div className="acc-plan">{plan}</div>
          </div>
        </div>

        <div className="acc-section-title">Exchange</div>
        <button type="button" className="acc-row" onClick={() => navigate('/account/banks')}>
          <span>Saved Bank Accounts<br /><span className="acc-row-sub">{defaultBank ? `${defaultBank.bank_name} ••${defaultBank.account_number.slice(-4)}` : 'No bank saved'}</span></span>
          <span>›</span>
        </button>
        <button type="button" className="acc-row" onClick={() => setShowWalletSheet(true)}>
          <span>USDT Wallet Address<br /><span className="acc-row-sub">{truncateWallet(wallet)}</span></span>
          <span>›</span>
        </button>

        <div className="acc-section-title">Subscription</div>
        <div className="acc-row">
          <span>
            Current Plan
            <br />
            <span className="acc-row-sub">
              {formattedPlan}
              {formattedExpiry ? ` · Active until ${formattedExpiry}` : ''}
            </span>
            {expiringSoon ? (
              <>
                <br />
                <span style={{ color: '#FFB74D', fontSize: 12 }}>⚠ Expires soon</span>
              </>
            ) : null}
          </span>
          <button type="button" className="pf-adjust" onClick={() => navigate('/plans')}>
            {expiringSoon ? 'Renew Plan' : 'Upgrade Plan'}
          </button>
        </div>

        <div className="acc-section-title">Notifications</div>
        <div className="acc-row">
          <span>Order updates</span>
          <button type="button" disabled={savingPrefs} className={`acc-toggle ${prefs.orderUpdates ? 'on' : 'off'}`} onClick={() => persistPrefs({ ...prefs, orderUpdates: !prefs.orderUpdates })} />
        </div>
        <div className="acc-row">
          <span>Insights & news</span>
          <button type="button" disabled={savingPrefs} className={`acc-toggle ${prefs.insights ? 'on' : 'off'}`} onClick={() => persistPrefs({ ...prefs, insights: !prefs.insights })} />
        </div>

        <div className="acc-section-title">Support</div>
        <button type="button" className="acc-row" onClick={() => window.open('mailto:support@stayliquid.app', '_blank')}>Email Support <span>↗</span></button>
        <button type="button" className="acc-row" onClick={() => navigate('/legal?tab=terms')}>Terms & Privacy <span>›</span></button>

        <button type="button" className="acc-signout" onClick={signOut}>Sign Out</button>
      </div>

      <div className="pf-nav-dark" role="navigation" aria-label="Bottom navigation">
        <button type="button" className="pf-nav-item" onClick={() => navigate('/home')}><span className="pf-ico">⌂</span><span className="pf-lbl">Home</span></button>
        <button type="button" className="pf-nav-item" onClick={() => navigate('/exchange/buy')}><span className="pf-ico">↕</span><span className="pf-lbl">Exchange</span></button>
        <button type="button" className="pf-nav-item" onClick={() => navigate('/intelligence')}><span className="pf-ico">◈</span><span className="pf-lbl">Insights</span></button>
        <button type="button" className="pf-nav-item active" onClick={() => navigate('/portfolio')}><span className="pf-ico">▦</span><span className="pf-lbl">Portfolio</span></button>
      </div>

      {showWalletSheet ? (
        <WalletBottomSheet
          initialAddress={wallet}
          onClose={() => setShowWalletSheet(false)}
          onSaved={saveWallet}
        />
      ) : null}
    </div>
  )
}
