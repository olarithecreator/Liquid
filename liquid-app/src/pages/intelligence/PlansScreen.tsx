import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { sendEmail, sendTelegram } from '../../lib/notifications'
import { supabase } from '../../lib/supabase'

import './intelligenceScreens.css'

type PlanId = 'basic' | 'business' | 'institutional'
type DurationId = '3m' | '6m' | '12m'

type DurationOption = {
  id: DurationId
  label: string
  months: number
  discount: number
  badge: string
}

type PlanOption = {
  id: PlanId
  name: string
  monthlyUsd: number
  desc: string
  features: string[]
  popular?: boolean
}

type UserSubscription = {
  subscription_plan: PlanId | 'none'
  subscription_expires_at: string | null
  subscription_duration?: DurationId | null
}

const plans: PlanOption[] = [
  {
    id: 'basic',
    name: 'Basic',
    monthlyUsd: 20,
    desc: 'Weekly market outlook for the individual building their portfolio.',
    features: [
      'Weekly macro outlook',
      'Portfolio allocation guidance',
      'Market direction signals',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    monthlyUsd: 50,
    popular: true,
    desc: 'Institutional-level analysis and liquidity insights.',
    features: [
      'Everything in Basic',
      'Liquidity flow analysis',
      'Cycle positioning strategy',
      'Priority support',
    ],
  },
  {
    id: 'institutional',
    name: 'Institutional',
    monthlyUsd: 100,
    desc: 'Private briefings and capital allocation frameworks.',
    features: [
      'Everything in Business',
      'Private strategy briefings',
      '1-on-1 consultation',
    ],
  },
]

const durations: DurationOption[] = [
  { id: '3m', label: '3 Months', months: 3, discount: 0.15, badge: '15% off' },
  { id: '6m', label: '6 Months', months: 6, discount: 0.2, badge: '20% off' },
  { id: '12m', label: '1 Year', months: 12, discount: 0.3, badge: '30% off' },
]

const getPrice = (monthlyUsd: number, duration: DurationOption) => {
  const base = monthlyUsd * duration.months
  return (base * (1 - duration.discount)).toFixed(2)
}

const getOriginalPrice = (monthlyUsd: number, duration: DurationOption) => {
  return (monthlyUsd * duration.months).toFixed(2)
}

const getSavings = (monthlyUsd: number, duration: DurationOption) => {
  const base = monthlyUsd * duration.months
  return (base * duration.discount).toFixed(2)
}

const isExpiringSoon = (expiresAt: string | null) => {
  if (!expiresAt) return false
  const diff = new Date(expiresAt).getTime() - Date.now()
  return diff > 0 && diff < 14 * 24 * 60 * 60 * 1000
}

const planRank: Record<UserSubscription['subscription_plan'], number> = {
  none: 0,
  basic: 1,
  business: 2,
  institutional: 3,
}

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return '—'
  return new Date(expiresAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function PlansScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [selectedDurationId, setSelectedDurationId] = useState<DurationId>('12m')
  const [subscription, setSubscription] = useState<UserSubscription>({
    subscription_plan: 'none',
    subscription_expires_at: null,
  })
  const [loading, setLoading] = useState(true)
  const [busyPlanId, setBusyPlanId] = useState<PlanId | null>(null)
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' | 'info' } | null>(null)

  const selectedDuration = useMemo(
    () => durations.find((d) => d.id === selectedDurationId) ?? durations[2],
    [selectedDurationId],
  )

  async function refetchSubscription() {
    if (!user?.id) return
    const { data } = await supabase
      .from('users')
      .select('subscription_plan, subscription_expires_at, subscription_duration')
      .eq('id', user.id)
      .single()

    setSubscription({
      subscription_plan: (data?.subscription_plan as UserSubscription['subscription_plan'] | null) ?? 'none',
      subscription_expires_at: (data?.subscription_expires_at as string | null) ?? null,
      subscription_duration: (data?.subscription_duration as DurationId | null) ?? null,
    })
  }

  function showToast(message: string, kind: 'success' | 'error' | 'info') {
    setToast({ message, kind })
  }

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    let mounted = true

    async function run() {
      if (!user?.id) {
        if (mounted) setLoading(false)
        return
      }
      await refetchSubscription()
      if (mounted) setLoading(false)
    }

    run().catch(() => {
      if (mounted) {
        setLoading(false)
        showToast('Could not load subscription details.', 'error')
      }
    })

    return () => {
      mounted = false
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return

    const run = async () => {
      const params = new URLSearchParams(window.location.search)
      const paymentStatus = params.get('payment')

      if (paymentStatus === 'success') {
        const { data } = await supabase
          .from('users')
          .select('subscription_plan, subscription_expires_at, subscription_duration')
          .eq('id', user.id)
          .single()

        const nextPlan = (data?.subscription_plan as UserSubscription['subscription_plan'] | null) ?? 'none'
        const nextExpiry = (data?.subscription_expires_at as string | null) ?? null

        setSubscription({
          subscription_plan: nextPlan,
          subscription_expires_at: nextExpiry,
          subscription_duration: (data?.subscription_duration as DurationId | null) ?? null,
        })

        if (nextPlan !== 'none') {
          const activePlan = plans.find((p) => p.id === nextPlan)
          const durationFromDb = ((data?.subscription_duration as DurationId | null) ?? selectedDuration.id)
          const durationObj = durations.find((d) => d.id === durationFromDb) ?? selectedDuration
          const price = activePlan ? getPrice(activePlan.monthlyUsd, durationObj) : '0'
          if (user?.email) {
            await sendEmail('subscription_activated', user.email, {
              planName: activePlan?.name ?? nextPlan,
              price,
            })
          }
          const displayName =
            (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? 'User'
          await sendTelegram(`🎉 NEW SUBSCRIBER\n${displayName} → ${activePlan?.name ?? nextPlan}\n$${price}`)
          showToast(`Subscription activated 🎉 Welcome to ${activePlan?.name ?? 'your plan'}!`, 'success')
        } else {
          showToast('Payment received. Subscription update is processing.', 'info')
        }

        window.history.replaceState({}, '', '/plans')
      }

      if (paymentStatus === 'cancelled') {
        showToast('Payment cancelled.', 'info')
        window.history.replaceState({}, '', '/plans')
      }
    }

    run().catch(() => undefined)
  }, [user?.id])

  const subscriptionExpired = Boolean(
    subscription.subscription_expires_at &&
    new Date(subscription.subscription_expires_at).getTime() < Date.now(),
  )

  function getActionForPlan(planId: PlanId) {
    const currentPlan = subscription.subscription_plan
    const currentRank = planRank[currentPlan]
    const targetRank = planRank[planId]

    if (currentPlan === planId && !subscriptionExpired && !isExpiringSoon(subscription.subscription_expires_at)) {
      return { kind: 'current' as const }
    }

    if (currentPlan === planId && isExpiringSoon(subscription.subscription_expires_at)) {
      return { kind: 'renew' as const }
    }

    if (currentPlan === 'none' || subscriptionExpired) {
      return { kind: 'subscribe' as const }
    }

    if (targetRank > currentRank) {
      return { kind: 'upgrade' as const }
    }

    return { kind: 'subscribe' as const }
  }

  async function onPlanAction(plan: PlanOption) {
    if (!user?.id || busyPlanId) return
    setBusyPlanId(plan.id)

    try {
      const { data, error } = await supabase.functions.invoke('create-nowpayments-invoice', {
        body: {
          userId: user.id,
          planId: plan.id,
          duration: selectedDuration.id,
          amount: parseFloat(getPrice(plan.monthlyUsd, selectedDuration)),
        },
      })

      if (error || !data?.payment_url) {
        showToast('Could not create payment. Please try again.', 'error')
        setBusyPlanId(null)
        return
      }

      window.location.href = data.payment_url
    } catch {
      showToast('Could not create payment. Please try again.', 'error')
      setBusyPlanId(null)
    }
  }

  return (
    <div className="intel-screen">
      <div className="intel-main">
        <div className="intel-detail-nav">
          <button type="button" className="intel-back-btn" onClick={() => navigate(-1)}>
            ←
          </button>
          <div className="intel-detail-nav-title">Subscription Plans</div>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.62)', margin: '0 20px 16px' }}>
          Pay with crypto. Access unlocks instantly.
        </div>

        {toast ? <div className={`plan-toast ${toast.kind}`}>{toast.message}</div> : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '0 20px 16px' }}>
          {durations.map((duration) => {
            const active = duration.id === selectedDuration.id
            return (
              <button
                key={duration.id}
                type="button"
                onClick={() => setSelectedDurationId(duration.id)}
                style={{
                  background: active ? '#6700af' : '#1A1A1A',
                  color: active ? '#fff' : 'rgba(255,255,255,0.72)',
                  border: 'none',
                  borderRadius: 999,
                  padding: '10px 8px',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 12 }}>{duration.label}</div>
                <div style={{ fontSize: 11, opacity: active ? 1 : 0.8 }}>{duration.badge}</div>
              </button>
            )
          })}
        </div>

        <div className="plans-stack">
          {plans.map((plan) => {
            const action = getActionForPlan(plan.id)
            const busy = busyPlanId === plan.id
            const isCurrent = subscription.subscription_plan === plan.id && !subscriptionExpired
            const expiryText = formatExpiry(subscription.subscription_expires_at)

            return (
              <article
                key={plan.id}
                className={`plan-card ${plan.popular ? 'popular' : ''}`}
                style={plan.id === 'business' ? { boxShadow: '0 0 0 1px rgba(103,0,175,0.45), 0 8px 32px rgba(103,0,175,0.15)' } : undefined}
              >
                {plan.popular ? <div className="plan-popular">POPULAR</div> : null}

                <h2 className="plan-name" style={{ fontWeight: 800 }}>{plan.name}</h2>
                <div className="plan-desc">{plan.desc}</div>

                <div style={{ margin: '10px 0 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 30, fontWeight: 800, color: '#fff' }}>${plan.monthlyUsd}</span>
                    <span style={{ color: 'rgba(255,255,255,0.66)', fontSize: 12 }}>/ month</span>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.74)', fontSize: 13, marginTop: 4 }}>
                    Pay ${getPrice(plan.monthlyUsd, selectedDuration)} for {selectedDuration.label}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                    <span style={{ color: 'rgba(255,255,255,0.42)', textDecoration: 'line-through', fontSize: 12 }}>
                      was ${getOriginalPrice(plan.monthlyUsd, selectedDuration)}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: '#1B5E20',
                        background: 'rgba(67, 160, 71, 0.2)',
                        borderRadius: 999,
                        padding: '2px 8px',
                        fontWeight: 700,
                      }}
                    >
                      Save ${getSavings(plan.monthlyUsd, selectedDuration)}
                    </span>
                  </div>
                </div>

                <ul className="plan-features">
                  {plan.features.map((f) => (
                    <li key={f}>
                      <span style={{ color: 'var(--purple-ll)' }}>✓</span> {f}
                    </li>
                  ))}
                </ul>

                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.58)', marginTop: 8, marginBottom: 10 }}>
                  Pay with BTC · ETH · USDT · USDC
                </div>

                {isCurrent && action.kind === 'current' ? (
                  <>
                    <div style={{ color: 'var(--purple-ll)', fontWeight: 700 }}>Current Plan ✓</div>
                    <div style={{ color: 'rgba(255,255,255,0.54)', fontSize: 12, marginTop: 4 }}>
                      Expires {expiryText}
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`plan-action ${action.kind === 'renew' ? '' : 'muted'}`}
                      onClick={() => onPlanAction(plan)}
                      disabled={loading || busy}
                    >
                      {busy
                        ? 'Processing...'
                        : action.kind === 'renew'
                          ? 'Renew Plan'
                          : action.kind === 'upgrade'
                            ? `Upgrade to ${plan.name}`
                            : 'Subscribe Now'}
                    </button>

                    {isCurrent && action.kind === 'renew' ? (
                      <div style={{ color: '#FFB74D', fontSize: 12, marginTop: 8 }}>
                        ⚠ Expires {expiryText} — renew now
                      </div>
                    ) : null}
                  </>
                )}
              </article>
            )
          })}
        </div>

        <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '14px 20px 20px', lineHeight: 1.5 }}>
          Payments processed securely via NOWPayments.
          <br />
          Accepted: BTC, ETH, USDT, USDC and 50+ cryptocurrencies.
          <br />
          Subscriptions renew manually — you will not be auto-charged.
        </div>
      </div>

      <div className="intel-bottom-nav" role="navigation" aria-label="Bottom navigation">
        <button type="button" className="intel-nav-item" onClick={() => navigate('/home')}>
          <span className="intel-nav-ico">⌂</span>
          <span className="intel-nav-lbl">Home</span>
        </button>
        <button type="button" className="intel-nav-item" onClick={() => navigate('/exchange/buy')}>
          <span className="intel-nav-ico">↕</span>
          <span className="intel-nav-lbl">Exchange</span>
        </button>
        <button type="button" className="intel-nav-item" onClick={() => navigate('/intelligence')}>
          <span className="intel-nav-ico">◈</span>
          <span className="intel-nav-lbl">Insights</span>
        </button>
        <button type="button" className="intel-nav-item active" onClick={() => navigate('/plans')}>
          <span className="intel-nav-ico">◎</span>
          <span className="intel-nav-lbl">Plans</span>
        </button>
      </div>
    </div>
  )
}
