import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type DurationId = '3m' | '6m' | '12m'
type PlanId = 'basic' | 'business' | 'institutional'

const durationMonths: Record<DurationId, number> = {
  '3m': 3,
  '6m': 6,
  '12m': 12,
}

const planLabel: Record<PlanId, string> = {
  basic: 'Basic',
  business: 'Business',
  institutional: 'Institutional',
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const payload = await req.json()

    const paymentStatus = String(payload.payment_status ?? '').toLowerCase()
    const orderId = String(payload.order_id ?? '')

    if (!orderId.includes('_')) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid order_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const [userId, planIdRaw, durationRaw] = orderId.split('_')
    const planId = planIdRaw as PlanId
    const duration = durationRaw as DurationId

    if (!userId || !planId || !duration || !(duration in durationMonths)) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid webhook metadata' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const successfulStates = new Set(['finished', 'confirmed', 'sending', 'partially_paid'])
    if (!successfulStates.has(paymentStatus)) {
      return new Response(JSON.stringify({ ok: true, skipped: true, status: paymentStatus }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const now = new Date()
    const expiresAt = new Date(now)
    expiresAt.setMonth(expiresAt.getMonth() + durationMonths[duration])
    const expiresAtISO = expiresAt.toISOString()

    const { error: updateError } = await supabase
      .from('users')
      .update({
        subscription_plan: planId,
        subscription_duration: duration,
        subscription_expires_at: expiresAtISO,
      })
      .eq('id', userId)

    if (updateError) {
      return new Response(JSON.stringify({ ok: false, error: updateError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Subscription Activated',
      message: `Your ${planLabel[planId] ?? planId} plan is now active`,
      type: 'subscription',
      is_read: false,
    })

    const { data: userData } = await supabase
      .from('users')
      .select('email,full_name')
      .eq('id', userId)
      .single()

    const paidUsd = Number(payload.price_amount ?? 0)
    const paidText = Number.isFinite(paidUsd) ? paidUsd.toFixed(2) : '0.00'

    await supabase.functions.invoke('send-telegram', {
      body: {
        message: `🎉 NEW SUBSCRIBER\n👤 ${userData?.full_name ?? userData?.email ?? userId}\n📦 ${planId} plan\n⏱ ${duration}\n💵 $${payload.price_amount}`,
      }
    })

    if (userData?.email) {
      await supabase.functions.invoke('send-email', {
        body: {
          type: 'subscription_activated',
          to: userData.email,
          data: {
            planName: planLabel[planId] ?? planId,
            amount: paidText,
            expiresAt: expiresAtISO,
          },
        },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
