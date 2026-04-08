import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import TimerBlock from '../../components/exchange/TimerBlock'
import { supabase } from '../../lib/supabase'
import { formatNaira } from '../../lib/helpers'
import { useAuth } from '../../hooks/useAuth'
import { useAppSettings } from '../../hooks/useAppSettings'
import { sendEmail, sendTelegram } from '../../lib/notifications'

import './exchangeScreens.css'

type BankDetails = {
  bankName: string
  bankAccount: string
  bankHolder: string
}

const LIQUID_TRX_WALLET = 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE'

export default function SellStep2Screen() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const { sellRate, minOrderUsdt, maxOrderUsdt, exchangeOpen, loading: settingsLoading } =
    useAppSettings()

  const bankDetails = (location.state as BankDetails | undefined) ?? null

  const [usdtAmount, setUsdtAmount] = useState('')
  const [walletAddress, setWalletAddress] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [copied, setCopied] = useState(false)

  const [orderCreated, setOrderCreated] = useState(false)
  const [createdAt, setCreatedAt] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)

  useEffect(() => {
    if (settingsLoading) return
    if (!exchangeOpen) {
      navigate('/exchange/closed', { replace: true })
      return
    }

    if (!bankDetails?.bankName || !bankDetails?.bankAccount || !bankDetails?.bankHolder) {
      navigate('/exchange/sell/step1', { replace: true })
    }
  }, [bankDetails, exchangeOpen, navigate, settingsLoading])

  const amountValue = useMemo(() => {
    const v = parseFloat(usdtAmount)
    return Number.isFinite(v) ? v : null
  }, [usdtAmount])

  const ngnAmount = useMemo(() => {
    if (amountValue === null) return 0
    return amountValue * sellRate
  }, [amountValue, sellRate])

  const walletTrimmed = walletAddress.trim()

  const isWalletValid = useMemo(() => {
    return walletTrimmed.startsWith('T') && walletTrimmed.length === 34
  }, [walletTrimmed])

  function handleBack() {
    if (!bankDetails) return navigate('/exchange/sell/step1')
    navigate('/exchange/sell/step1', { state: bankDetails })
  }

  async function onCopyWallet() {
    try {
      await navigator.clipboard.writeText(LIQUID_TRX_WALLET)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Ignore clipboard failures; user can still manually copy.
    }
  }

  async function onChooseFile(file: File | null) {
    setProofFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function onSubmit() {
    if (loading) return
    if (settingsLoading) return

    setError(null)

    const hasErrors: string[] = []

    if (amountValue === null) hasErrors.push('Enter your USDT amount')
    else if (amountValue < minOrderUsdt || amountValue > maxOrderUsdt) {
      hasErrors.push(`Amount must be between ${minOrderUsdt} and ${maxOrderUsdt} USDT`)
    }

    if (!isWalletValid)
      hasErrors.push('Wallet must start with T and be 34 characters.')


    if (hasErrors.length > 0) {
      setError(hasErrors.join(' · '))
      return
    }

    setLoading(true)
    try {
      const amountUsdt = amountValue!

      const { data: inserted, error: insertError } = await supabase
        .from('orders')
        .insert({
          type: 'sell',
          amount_usdt: amountUsdt,
          amount_ngn: ngnAmount,
          rate: sellRate,
          user_id: user?.id,
          user_bank_name: bankDetails!.bankName,
          user_bank_account: bankDetails!.bankAccount,
          user_bank_holder: bankDetails!.bankHolder,
          user_wallet_address: walletTrimmed,
          status: 'awaiting_payment',
        })
        .select('*')
        .single()

      if (insertError || !inserted) {
        setError('Could not create order.')
        return
      }

      const orderId = inserted.id as string
      const createdAtISO = inserted.created_at as string

      setOrderCreated(true)
      setCreatedAt(createdAtISO)
      setOrderId(orderId)

      let proofPath: string | null = null

      if (proofFile) {
        const ext =
          proofFile.name.includes('.') && proofFile.name.split('.').length > 1
            ? proofFile.name.split('.').pop()!.toLowerCase()
            : 'pdf'

        proofPath = `${orderId}/proof.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(proofPath, proofFile, { contentType: proofFile.type })

        if (uploadError) {
          setError('Could not upload proof.')
          return
        }

        const { error: updateError } = await supabase
          .from('orders')
          .update({
            payment_proof_url: proofPath,
            status: 'proof_uploaded',
          })
          .eq('id', orderId)

        if (updateError) {
          setError('Could not update order with proof.')
          return
        }
      }

      const displayName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? 'User'
      const telegramMessage = `🔔 NEW SELL ORDER\n💵 ${amountUsdt} USDT\n👤 ${displayName}\n₦${ngnAmount}\n🆔 #${orderId}`

      await sendTelegram(telegramMessage)

      if (user?.email) {
        await sendEmail('order_created', user.email, {
          type: 'sell',
          amount: amountUsdt,
          amountNgn: ngnAmount,
          orderId,
          walletAddress: walletTrimmed,
          proofProvided: Boolean(proofPath),
        })
      }

      navigate(`/exchange/order/${orderId}`)
    } catch {
      setError('Something went wrong while creating your order.')
    } finally {
      setLoading(false)
    }
  }

  if (settingsLoading) {
    return (
      <div className="sell-screen">
        <div className="buy-top">
          <div style={{ padding: 20, textAlign: 'left', color: 'rgba(255,255,255,0.6)' }}>
            Loading...
          </div>
        </div>
      </div>
    )
  }

  const last4 = bankDetails?.bankAccount?.slice(-4) ?? ''

  return (
    <div className="sell-screen">
      <div className="buy-top">
        <div className="screen-nav">
          <div className="back-circle" role="button" tabIndex={0} onClick={handleBack}>
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
            <div className="step-ind-circle active">2</div>
            <div className="step-ind-label active">Amount</div>
          </div>
          <div className="step-ind-line" />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
            <div className="step-ind-circle idle">3</div>
            <div className="step-ind-label idle">Send</div>
          </div>
        </div>

        <div className="rate-bar" style={{ margin: '0 0 16px' }}>
          <div className="rate-left">
            <div className="rate-dot purple" />
            <div className="rate-text">Live sell rate</div>
          </div>
          <div className="rate-val">1 USDT = ₦{formatNaira(sellRate).replace('₦', '')}</div>
        </div>

        <div className="buy-amount-label">You are sending</div>
        <div className="buy-input-row">
          <div className="currency-tag">USDT</div>
          <input
            className="buy-big-input"
            type="number"
            placeholder="0"
            value={usdtAmount}
            disabled={loading}
            onChange={(e) => setUsdtAmount(e.target.value)}
            inputMode="decimal"
          />
        </div>

        <div className="buy-rate" style={{ marginBottom: 16 }}>
          You receive: <span style={{ color: 'var(--purple-ll)' }}>₦{formatNaira(ngnAmount).replace('₦', '')}</span>
          {' · to '}
          {bankDetails?.bankName ?? ''} ••{last4}
        </div>

        {orderCreated ? (
          <TimerBlock
            createdAt={createdAt}
            label="Transfer Window"
            onExpire={() => navigate(`/exchange/expired/${orderId ?? ''}`)}
          />
        ) : (
          <div style={{ margin: '0 20px 12px', color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
            Order window starts when you submit
          </div>
        )}

        <div style={{ margin: '0 20px 12px' }}>
          <div className="field-lbl">Your USDT Wallet Address (TRC-20)</div>
          <input
            className="dark-input"
            style={{
              fontFamily: 'monospace',
              fontSize: 12,
              color: 'rgba(255,255,255,0.5)',
            }}
            placeholder="TRx9... paste your address"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="wallet-block">
          <div className="wb-label">Send USDT to this wallet</div>
          <div className="wb-network">● TRC-20 Network</div>
          <div className="wb-addr">{LIQUID_TRX_WALLET}</div>
          <div className="wb-copy" role="button" tabIndex={0} onClick={onCopyWallet}>
            ⧉ {copied ? '✓ Copied' : 'Copy address'}
          </div>
        </div>

        <div
          className="upload-row"
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Upload transaction hash"
          style={{ opacity: loading ? 0.6 : 1 }}
        >
          <div className="up-ico">📎</div>
          <div className="up-txt">
            <strong>Upload transaction hash</strong>
            <br />
            TxID screenshot or PDF · Max 5MB
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            style={{ display: 'none' }}
            disabled={loading}
            onChange={(e) => onChooseFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {error ? <div className="buy-error">{error}</div> : null}

        <button
          type="button"
          className="primary-btn btn-purple"
          disabled={loading}
          onClick={onSubmit}
        >
          {loading ? 'Submitting...' : 'Submit for Verification'}
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
