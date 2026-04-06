import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { supabase } from '../../lib/supabase'
import { formatNaira } from '../../lib/helpers'
import { useAuth } from '../../hooks/useAuth'
import { useAppSettings } from '../../hooks/useAppSettings'
import { sendEmail, sendTelegram } from '../../lib/notifications'
import TimerBlock from '../../components/exchange/TimerBlock'
import type { Order } from '../../types'

import './exchangeScreens.css'

type AmountErrors = {
  amount?: string
  wallet?: string
}

export default function AcquireScreen() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const { user } = useAuth()
  const { buyRate, minOrderUsdt, maxOrderUsdt, exchangeOpen, loading: settingsLoading } =
    useAppSettings()

  const [usdtAmount, setUsdtAmount] = useState('')
  const ngnAmount = useMemo(() => {
    const v = parseFloat(usdtAmount)
    if (!Number.isFinite(v)) return 0
    return v * buyRate
  }, [buyRate, usdtAmount])

  const [walletAddress, setWalletAddress] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formErrors, setFormErrors] = useState<AmountErrors | null>(null)
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)

  function parseAmount() {
    const v = parseFloat(usdtAmount)
    if (!Number.isFinite(v)) return null
    return v
  }

  const amountValue = useMemo(() => {
    return parseAmount()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usdtAmount])

  const isAmountWithinLimits = useMemo(() => {
    if (amountValue === null) return false
    return amountValue >= minOrderUsdt && amountValue <= maxOrderUsdt
  }, [amountValue, maxOrderUsdt, minOrderUsdt])

  const trimmedWallet = walletAddress.trim()
  const isWalletValid = useMemo(() => {
    return trimmedWallet.startsWith('T') && trimmedWallet.length === 34
  }, [trimmedWallet])

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!user) return
      if (settingsLoading) return

      if (!exchangeOpen) {
        navigate('/exchange/closed', { replace: true })
        return
      }

      setLoading(true)
      setError(null)
      try {
        const pendingStatuses = ['awaiting_payment', 'proof_uploaded'] as const

        const { data } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', user.id)
          .in('status', pendingStatuses as unknown as string[])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (cancelled) return
        setActiveOrder((data as Order | null) ?? null)
      } catch (e) {
        if (cancelled) return
        setError('Failed to load your active order.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [exchangeOpen, navigate, settingsLoading, user])

  function handleBack() {
    if (!activeOrder) {
      navigate('/home')
      return
    }

    const ok = window.confirm('Leave? Your order is still active')
    if (ok) navigate('/home')
  }

  async function onChooseFile(file: File | null) {
    setProofFile(file)
    if (fileInputRef.current) {
      // Allow re-selecting the same file again by clearing the value.
      fileInputRef.current.value = ''
    }
  }

  async function onSubmit() {
    if (loading) return
    setError(null)

    const errors: AmountErrors = {}

    const amount = parseAmount()
    if (!amount || !Number.isFinite(amount)) {
      errors.amount = 'Enter a valid USDT amount.'
    } else if (amount < minOrderUsdt) {
      errors.amount = `Minimum is ${minOrderUsdt} USDT.`
    } else if (amount > maxOrderUsdt) {
      errors.amount = `Maximum is ${maxOrderUsdt} USDT.`
    }

    if (!trimmedWallet) {
      errors.wallet = 'Wallet address is required.'
    } else if (!isWalletValid) {
      errors.wallet = 'Wallet address must start with T and be 34 characters.'
    }

    const hasErrors = Object.keys(errors).length > 0
    setFormErrors(hasErrors ? errors : null)
    if (hasErrors) return

    setLoading(true)
    try {
      const orderAmountUsdt = amount!
      const amountNgn = ngnAmount

      const { data: inserted, error: insertError } = await supabase
        .from('orders')
        .insert({
          type: 'buy',
          amount_usdt: orderAmountUsdt,
          amount_ngn: amountNgn,
          rate: buyRate,
          user_id: user!.id,
          status: 'awaiting_payment',
          user_wallet_address: trimmedWallet,
        })
        .select('*')
        .single()

      if (insertError || !inserted) {
        setError('Could not create order.')
        return
      }

      const orderId = inserted.id as string

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

      const telegramMessage = `🔔 NEW BUY ORDER\n💵 ${orderAmountUsdt} USDT\n👤 ${user?.full_name ?? user?.email ?? 'User'}\n₦${amountNgn}\n🆔 #${orderId}`

      // Notifications run server-side via Supabase edge functions.
      await sendTelegram(telegramMessage)
      if (user?.email) {
        await sendEmail('order_created', user.email, {
          type: 'buy',
          amount: orderAmountUsdt,
          amountNgn: amountNgn,
          orderId,
          walletAddress: trimmedWallet,
          proofProvided: Boolean(proofPath),
        })
      }

      navigate(`/exchange/order/${orderId}`)
    } catch (e) {
      setError('Something went wrong while creating your order.')
    } finally {
      setLoading(false)
    }
  }

  if (settingsLoading) {
    return (
      <div className="buy-screen">
        <div style={{ padding: 20, textAlign: 'left', color: 'rgba(255,255,255,0.6)' }}>
          Loading...
        </div>
      </div>
    )
  }

  const showTimer = activeOrder?.status === 'awaiting_payment'

  return (
    <div className="buy-screen">
      <div className="buy-top" style={{ paddingBottom: 10 }}>
        <div className="screen-nav">
          <div className="back-circle" role="button" tabIndex={0} onClick={handleBack} aria-label="Back">
            ←
          </div>
          <div className="screen-nav-title">Acquire USDT</div>
        </div>

        <div className="rate-bar" style={{ margin: '0 0 16px' }}>
          <div className="rate-left">
            <div className="rate-dot" />
            <div className="rate-text">Live buy rate</div>
          </div>
          <div className="rate-val">1 USDT = ₦{formatNaira(buyRate).replace('₦', '')}</div>
        </div>

        {!activeOrder ? (
          <>
            <div className="buy-amount-label">You want</div>
            <div className="buy-input-row">
              <div className="currency-tag">USDT</div>
              <input
                className="buy-big-input"
                type="number"
                placeholder="0"
                value={usdtAmount}
                onChange={(e) => setUsdtAmount(e.target.value)}
                disabled={loading}
                inputMode="decimal"
              />
            </div>

            <div className="buy-rate">
              You pay: <span>{formatNaira(ngnAmount)}</span>
              {' · Min '}
              {minOrderUsdt}
              {' · Max '}
              {maxOrderUsdt} USDT
            </div>

            {formErrors?.amount ? (
              <div className="buy-error">{formErrors.amount}</div>
            ) : null}

            <div className="buy-card">
              <div className="bc-row">
                <span className="bc-key">Bank</span>
                <span className="bc-val">Opay</span>
              </div>
              <div className="bc-row">
                <span className="bc-key">Account No.</span>
                <span className="bc-val green">8143 2750 91</span>
              </div>
              <div className="bc-row">
                <span className="bc-key">Account Name</span>
                <span className="bc-val">Liquid Assets Ltd</span>
              </div>
              <div className="bc-row">
                <span className="bc-key">Total to pay</span>
                <span className="bc-val purple">{formatNaira(ngnAmount)}</span>
              </div>
            </div>

            <div style={{ margin: '0 0 10px' }}>
              <div className="field-lbl">Your USDT Wallet Address (TRC-20)</div>
              <input
                className="dark-input"
                style={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(255,255,255,0.9)' }}
                placeholder="TRx9... paste your address"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                disabled={loading}
              />
              {formErrors?.wallet ? (
                <div className="buy-error">{formErrors.wallet}</div>
              ) : null}
            </div>

            <div
              className="upload-row"
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload payment proof"
            >
              <div className="up-ico">📎</div>
              <div className="up-txt">
                <strong>Upload payment proof</strong>
                <br />
                Screenshot or PDF · Max 5MB
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
              className="primary-btn btn-white"
              onClick={onSubmit}
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Confirm Order'}
            </button>
          </>
        ) : (
          <>
            {showTimer ? (
              <TimerBlock
                createdAt={activeOrder.created_at}
                label="Order Window"
                onExpire={() => navigate(`/exchange/expired/${activeOrder.id}`)}
              />
            ) : null}

            <div className="buy-card">
              <div className="bc-row">
                <span className="bc-key">Amount</span>
                <span className="bc-val purple">{activeOrder.amount_usdt} USDT</span>
              </div>
              <div className="bc-row">
                <span className="bc-key">Rate</span>
                <span className="bc-val">{formatNaira(activeOrder.rate)}</span>
              </div>
              <div className="bc-row">
                <span className="bc-key">Status</span>
                <span className="bc-val green">
                  {activeOrder.status === 'proof_uploaded'
                    ? 'Proof Uploaded'
                    : 'Awaiting Payment'}
                </span>
              </div>
              <div className="bc-row">
                <span className="bc-key">Wallet</span>
                <span className="bc-val">{activeOrder.user_wallet_address}</span>
              </div>
              <div className="bc-row">
                <span className="bc-key">Total to pay</span>
                <span className="bc-val purple">{formatNaira(activeOrder.amount_ngn)}</span>
              </div>
            </div>

            <button
              type="button"
              className="primary-btn btn-white"
              onClick={() => navigate(`/exchange/order/${activeOrder.id}`)}
              disabled={loading}
            >
              View Order Status
            </button>
          </>
        )}
      </div>

      <div className="bottom-nav-dark" role="navigation" aria-label="Bottom navigation">
        <div className="nav-it-dark" onClick={() => navigate('/home')}>
          <div className="nav-ico-dark">⌂</div>
          <div className="nav-lbl-dark">Home</div>
        </div>
        <div
          className="nav-it-dark"
          onClick={() => navigate('/exchange/buy')}
          role="button"
        >
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
        <div className="nav-it-dark" />
      </div>
    </div>
  )
}
