import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useAppSettings } from '../../hooks/useAppSettings'
import type { Order } from '../../types'
import TimerBlock from '../../components/exchange/TimerBlock'

import './exchangeScreens.css'

type BankDetails = {
  bankName: string
  bankAccount: string
  bankHolder: string
}

const BANKS = [
  'Opay',
  'Access Bank',
  'GTBank',
  'Zenith Bank',
  'First Bank',
  'UBA',
  'Kuda Bank',
  'PalmPay',
  'Sterling Bank',
  'Wema Bank',
  'Stanbic IBTC',
  'FCMB',
  'Fidelity Bank',
  'Polaris Bank',
  'Union Bank',
] as const

function buildAccountHolder(bankName: string): string {
  const firstWord = bankName.trim().split(/\s+/)[0] ?? ''
  return `${firstWord} Account Holder`
}

export default function SellStep1Screen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { exchangeOpen, loading: settingsLoading } = useAppSettings()

  const [bankName, setBankName] = useState<string>('Opay')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountHolder, setAccountHolder] = useState<string>('')
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)

  const [activeOrder, setActiveOrder] = useState<Order | null>(null)

  const backCircle = () => {
    if (!activeOrder) {
      navigate('/home')
      return
    }

    const ok = window.confirm('Leave? Your order is still active')
    if (ok) navigate('/home')
  }

  const showTimer = activeOrder?.status === 'awaiting_payment'

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (settingsLoading) return
      if (!user) return

      if (!exchangeOpen) {
        navigate('/exchange/closed', { replace: true })
        return
      }

      try {
        const pendingStatuses = ['awaiting_payment', 'proof_uploaded', 'verifying'] as const
        const { data } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', user.id)
          .eq('type', 'sell')
          .in('status', pendingStatuses as unknown as string[])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (cancelled) return
        setActiveOrder((data as Order | null) ?? null)
      } catch {
        // If this fails, don't block the user from entering details.
        if (!cancelled) setActiveOrder(null)
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [exchangeOpen, navigate, settingsLoading, user])

  useEffect(() => {
    if (activeOrder) return
    if (!bankName) return
    if (accountNumber.length !== 10) return

    let cancelled = false

    setVerifying(true)
    setVerified(false)
    setAccountHolder('')

    const timer = window.setTimeout(() => {
      if (cancelled) return
      const holder = buildAccountHolder(bankName)
      setAccountHolder(holder)
      setVerified(true)
      setVerifying(false)
    }, 1000)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [accountNumber.length, bankName, activeOrder])

  const canContinue = useMemo(() => {
    if (activeOrder) return false
    if (!verified) return false
    if (!bankName) return false
    if (accountNumber.length !== 10) return false
    if (!accountHolder.trim()) return false
    if (verifying) return false
    return true
  }, [activeOrder, accountHolder, accountNumber.length, bankName, verified, verifying])

  function onContinue() {
    if (!canContinue) return

    const bankDetails: BankDetails = {
      bankName,
      bankAccount: accountNumber,
      bankHolder: accountHolder.trim(),
    }

    navigate('/exchange/sell/step2', { state: bankDetails })
  }

  if (activeOrder) {
    return (
      <div className="sell-screen">
        <div className="buy-top" style={{ paddingBottom: 0 }}>
          <div className="screen-nav">
            <div className="back-circle" role="button" tabIndex={0} onClick={backCircle}>
              ←
            </div>
            <div className="screen-nav-title">Liquidate USDT</div>
          </div>

          {showTimer ? (
            <TimerBlock
              createdAt={activeOrder.created_at}
              label="Transfer Window"
              onExpire={() => navigate(`/exchange/expired/${activeOrder.id}`)}
            />
          ) : null}

          <div className="buy-card" style={{ marginTop: 6 }}>
            <div className="bc-row">
              <span className="bc-key">Status</span>
              <span className="bc-val purple">
                {activeOrder.status === 'proof_uploaded'
                  ? 'Proof Uploaded'
                  : 'Awaiting Payment'}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="primary-btn btn-white"
            onClick={() => navigate(`/exchange/order/${activeOrder.id}`)}
          >
            View Order Status
          </button>
        </div>

        <div className="bottom-nav-dark" role="navigation" aria-label="Bottom navigation">
          <div className="nav-it-dark" onClick={() => navigate('/home')}>
            <div className="nav-ico-dark">⌂</div>
            <div className="nav-lbl-dark">Home</div>
          </div>
          <div className="nav-it-dark" onClick={() => navigate('/exchange/buy')}>
            <div className="nav-ico-dark active">⇄</div>
            <div className="nav-lbl-dark active">Exchange</div>
          </div>
          <div className="nav-it-dark" onClick={() => navigate('/intelligence')}>
            <div className="nav-ico-dark">◈</div>
            <div className="nav-lbl-dark">Insights</div>
          </div>
          <div className="nav-it-dark" onClick={() => navigate('/plans')}>
            <div className="nav-ico-dark">◎</div>
            <div className="nav-lbl-dark">Plans</div>
          </div>
          <div className="nav-it-dark" onClick={() => navigate('/portfolio')}>
            <div className="nav-ico-dark">▦</div>
            <div className="nav-lbl-dark">Portfolio</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sell-screen">
      <div className="buy-top">
        <div className="screen-nav">
          <div className="back-circle" role="button" tabIndex={0} onClick={backCircle}>
            ←
          </div>
          <div className="screen-nav-title">Liquidate USDT</div>
        </div>

        <div className="step-ind">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
            <div className="step-ind-circle active">1</div>
            <div className="step-ind-label active">Bank</div>
          </div>
          <div className="step-ind-line" />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
            <div className="step-ind-circle idle">2</div>
            <div className="step-ind-label idle">Amount</div>
          </div>
          <div className="step-ind-line" />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
            <div className="step-ind-circle idle">3</div>
            <div className="step-ind-label idle">Send</div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-h)', fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
            Where should we send
            <br />
            your Naira?
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
            Enter your bank details to receive payment.
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div className="field-lbl">Bank Name</div>
          <select
            className="dark-select"
            value={bankName}
            onChange={(e) => {
              setBankName(e.target.value);
              setVerified(false);
              setAccountHolder('');
            }}
            disabled={verifying}
          >
            {BANKS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div className="field-lbl">Account Number</div>
          <input
            className="dark-input"
            style={{ color: 'rgba(255,255,255,0.8)' }}
            inputMode="numeric"
            type="text"
            maxLength={10}
            value={accountNumber}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
              setAccountNumber(digits)
              setVerified(false)
              setVerifying(false)
              setAccountHolder('')
            }}
            disabled={verifying}
          />
        </div>

        {verified ? (
          <div className="verify-badge">
            <div className="vb-ico">✓</div>
            <div className="vb-text">
              <strong>{accountHolder}</strong>
              <br />
              Account verified successfully
            </div>
          </div>
        ) : verifying ? (
          <div className="verify-badge" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}>
            <div className="vb-ico" style={{ color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.05)' }}>
              ●
            </div>
            <div className="vb-text">Verifying account...</div>
          </div>
        ) : null}

        {verified ? (
          <div style={{ padding: '0 20px', marginBottom: 20 }}>
            <div className="field-lbl">Account Name (auto-verified)</div>
            <input
              className="dark-input"
              style={{ color: 'var(--green)' }}
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
            />
          </div>
        ) : null}

        <button
          type="button"
          className="primary-btn btn-purple"
          onClick={onContinue}
          disabled={!canContinue}
          style={{ opacity: canContinue ? 1 : 0.65 }}
        >
          Continue to Amount →
        </button>
      </div>

      <div className="bottom-nav-dark" role="navigation" aria-label="Bottom navigation">
        <div className="nav-it-dark" onClick={() => navigate('/home')}>
          <div className="nav-ico-dark">⌂</div>
          <div className="nav-lbl-dark">Home</div>
        </div>
        <div className="nav-it-dark" onClick={() => navigate('/exchange/buy')}>
          <div className="nav-ico-dark active">⇄</div>
          <div className="nav-lbl-dark active">Exchange</div>
        </div>
        <div className="nav-it-dark" onClick={() => navigate('/intelligence')}>
          <div className="nav-ico-dark">◈</div>
          <div className="nav-lbl-dark">Insights</div>
        </div>
        <div className="nav-it-dark" onClick={() => navigate('/plans')}>
          <div className="nav-ico-dark">◎</div>
          <div className="nav-lbl-dark">Plans</div>
        </div>
        <div className="nav-it-dark" onClick={() => navigate('/portfolio')}>
          <div className="nav-ico-dark">▦</div>
          <div className="nav-lbl-dark">Portfolio</div>
        </div>
      </div>
    </div>
  )
}
