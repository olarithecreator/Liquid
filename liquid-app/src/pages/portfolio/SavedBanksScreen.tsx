import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

import './portfolioScreens.css'

type SavedBank = { bank_name: string; account_number: string; account_holder: string; is_default: boolean }
const banksCacheKey = (userId: string) => `liquid_saved_banks_${userId}`
const isMissingSavedBanksColumn = (code?: string, message?: string) =>
  code === 'PGRST204' && (message ?? '').includes("'saved_banks'")

const BANKS = [
  'Opay', 'Access Bank', 'GTBank', 'Zenith Bank', 'First Bank', 'UBA', 'Kuda Bank', 'PalmPay',
  'Sterling Bank', 'Wema Bank', 'Stanbic IBTC', 'FCMB', 'Fidelity Bank', 'Polaris Bank', 'Union Bank',
] as const

function buildAccountHolder(bankName: string): string {
  const firstWord = bankName.trim().split(/\s+/)[0] ?? ''
  return `${firstWord} Account Holder`
}

function AddBankSheet({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (b: SavedBank) => Promise<void>
}) {
  const [bankName, setBankName] = useState<string>('Opay')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)

  useEffect(() => {
    if (accountNumber.length !== 10) {
      setVerified(false)
      setVerifying(false)
      setAccountHolder('')
      return
    }
    setVerifying(true)
    const timer = window.setTimeout(() => {
      setAccountHolder(buildAccountHolder(bankName))
      setVerified(true)
      setVerifying(false)
    }, 900)
    return () => window.clearTimeout(timer)
  }, [accountNumber, bankName])

  return (
    <>
      <button type="button" className="sheet-overlay" aria-label="Close" onClick={onClose} />
      <div className="wallet-sheet" style={{ background: 'var(--ink)' }}>
        <div className="sheet-handle" />
        <div className="wallet-title" style={{ color: '#fff' }}>Add Bank Account</div>

        <div className="sheet-field">
          <label className="wallet-lbl">Bank</label>
          <select className="sheet-select" value={bankName} onChange={(e) => setBankName(e.target.value)}>
            {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className="sheet-field">
          <label className="wallet-lbl">Account Number</label>
          <input className="sheet-input" value={accountNumber} maxLength={10} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))} />
          {verified ? <div className="sheet-verified">✓ {accountHolder}</div> : null}
          {verifying ? <div className="sheet-verified">Verifying account...</div> : null}
        </div>
        <button
          type="button"
          className="sheet-save-bank"
          disabled={!verified}
          onClick={() => verified && onSave({ bank_name: bankName, account_number: accountNumber, account_holder: accountHolder, is_default: true })}
        >
          Save Bank Account
        </button>
      </div>
    </>
  )
}

export default function SavedBanksScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [banks, setBanks] = useState<SavedBank[]>([])
  const [showSheet, setShowSheet] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const normalized = useMemo(() => {
    if (!banks.length) return []
    if (banks.some((b) => b.is_default)) return banks
    return banks.map((b, idx) => ({ ...b, is_default: idx === 0 }))
  }, [banks])

  async function persist(next: SavedBank[]) {
    if (!user?.id) return false
    const previous = banks
    setError(null)
    setSaving(true)
    setBanks(next)
    localStorage.setItem(banksCacheKey(user.id), JSON.stringify(next))

    const { error: updateError } = await supabase
      .from('users')
      .update({ saved_banks: next })
      .eq('id', user.id)

    setSaving(false)
    if (updateError) {
      if (isMissingSavedBanksColumn(updateError.code, updateError.message)) {
        // Keep local value when backend column is not yet provisioned.
        setError('Saved locally on this device. Ask admin to add users.saved_banks in Supabase to sync.')
        return true
      }
      setBanks(previous)
      localStorage.setItem(banksCacheKey(user.id), JSON.stringify(previous))
      const details = `${updateError.message ?? updateError.toString()}${updateError.code ? ` (code: ${updateError.code})` : ''}`
      setError(`Could not save bank details to server: ${details}`)
      return false
    }

    return true
  }

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!user?.id) return
      const cachedRaw = localStorage.getItem(banksCacheKey(user.id))
      if (cachedRaw) {
        try {
          const cached = JSON.parse(cachedRaw) as SavedBank[]
          if (!cancelled && Array.isArray(cached)) setBanks(cached)
        } catch {
          // Ignore corrupted cache.
        }
      }

      const { data, error: fetchError } = await supabase.from('users').select('saved_banks').eq('id', user.id).single()
      if (cancelled) return
      if (fetchError) {
        if (isMissingSavedBanksColumn(fetchError.code, fetchError.message)) {
          setError('Server is missing users.saved_banks. Showing local saved banks only.')
          return
        }
        setError('Could not load saved banks from server. Showing local data if available.')
        return
      }
      const list = (data?.saved_banks as SavedBank[] | null) ?? []
      const normalizedList = Array.isArray(list) ? list : []
      setBanks(normalizedList)
      localStorage.setItem(banksCacheKey(user.id), JSON.stringify(normalizedList))
    }
    run().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [user?.id])

  async function addBank(bank: SavedBank) {
    const next = normalized.length === 0
      ? [{ ...bank, is_default: true }]
      : [...normalized.map((b) => ({ ...b, is_default: b.is_default })), { ...bank, is_default: false }]
    const ok = await persist(next)
    if (ok) setShowSheet(false)
  }

  async function setDefault(target: SavedBank) {
    await persist(normalized.map((b) => ({ ...b, is_default: b.account_number === target.account_number })))
  }

  async function removeBank(target: SavedBank) {
    const filtered = normalized.filter((b) => b.account_number !== target.account_number)
    if (filtered.length > 0 && !filtered.some((b) => b.is_default)) filtered[0].is_default = true
    await persist(filtered)
  }

  return (
    <div className="pf-screen">
      <div className="pf-main">
        <div className="pf-nav">
          <button type="button" className="pf-back" onClick={() => navigate('/account')}>←</button>
          <div className="pf-title">Saved Banks</div>
          <button type="button" className="banks-top-right" onClick={() => setShowSheet(true)}>+ Add Bank</button>
        </div>

        <div className="banks-label">Your Accounts</div>
        {error ? <div className="buy-error" style={{ margin: '8px 0 12px' }}>{error}</div> : null}
        {normalized.map((b) => (
          <div key={`${b.bank_name}-${b.account_number}`} className="bank-row">
            <div className="bank-name">{b.bank_name}</div>
            <div className="bank-acct">{b.account_number}</div>
            <div className="bank-holder">{b.account_holder}</div>
            <div className="bank-actions">
              {b.is_default ? (
                <span className="bank-default">DEFAULT</span>
              ) : (
                <>
                  <button type="button" className="bank-link" disabled={saving} onClick={() => setDefault(b)}>Set default</button>
                  <button type="button" className="bank-link remove" disabled={saving} onClick={() => removeBank(b)}>Remove</button>
                </>
              )}
            </div>
          </div>
        ))}

        <button type="button" className="bank-add-card" disabled={saving} onClick={() => setShowSheet(true)}>
          {saving ? 'Saving...' : 'Add a new bank account'}
        </button>
      </div>

      <div className="pf-nav-dark" role="navigation" aria-label="Bottom navigation">
        <button type="button" className="pf-nav-item" onClick={() => navigate('/home')}><span className="pf-ico">⌂</span><span className="pf-lbl">Home</span></button>
        <button type="button" className="pf-nav-item" onClick={() => navigate('/exchange/buy')}><span className="pf-ico">↕</span><span className="pf-lbl">Exchange</span></button>
        <button type="button" className="pf-nav-item" onClick={() => navigate('/intelligence')}><span className="pf-ico">◈</span><span className="pf-lbl">Insights</span></button>
        <button type="button" className="pf-nav-item active" onClick={() => navigate('/portfolio')}><span className="pf-ico">▦</span><span className="pf-lbl">Portfolio</span></button>
      </div>

      {showSheet ? <AddBankSheet onClose={() => setShowSheet(false)} onSave={addBank} /> : null}
    </div>
  )
}
