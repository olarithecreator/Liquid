import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

type EmailPayload = {
  type?: string
  to: string
  subject?: string
  body?: string
  data?: Record<string, unknown>
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { type, to, data = {}, subject: customSubject, body: customBody } = (await req.json()) as EmailPayload
    if (!to) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Liquid <onboarding@resend.dev>'

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY secret' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let subject = customSubject ?? 'Liquid Notification'
    let html = customBody ?? '<div style="font-family:Inter,sans-serif;">Notification received.</div>'

    switch (type) {
      case 'order_created': {
        subject = `Your Liquid ${String(data.type ?? '').toUpperCase()} order is received`
        html = `
          <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;background:#0C0C0C;color:#fff;padding:32px;border-radius:16px;">
            <h1 style="color:#C8973F;font-size:24px;margin-bottom:8px;">Order Received ✓</h1>
            <p style="color:#888;margin-bottom:24px;">We received your order and it is now being processed.</p>
            <div style="background:#1A1A1A;border-radius:12px;padding:20px;">
              <p style="margin:0 0 10px;">Order ID: <strong>${String(data.orderId ?? '')}</strong></p>
              <p style="margin:0 0 10px;">Type: <strong>${String(data.type ?? '')}</strong></p>
              <p style="margin:0;">Amount: <strong>${String(data.amount ?? '')}</strong></p>
            </div>
          </div>
        `
        break
      }

      case 'proof_received': {
        subject = `Proof received for order ${String(data.orderId ?? '')}`
        html = `
          <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;background:#0C0C0C;color:#fff;padding:32px;border-radius:16px;">
            <h1 style="color:#C8973F;font-size:24px;margin-bottom:8px;">Proof Received ✓</h1>
            <p style="color:#888;margin-bottom:24px;">We received your payment proof and verification is in progress.</p>
            <p style="margin:0;">Order ID: <strong>${String(data.orderId ?? '')}</strong></p>
          </div>
        `
        break
      }

      case 'order_completed': {
        subject = `Your Liquid order ${String(data.orderId ?? '')} is completed`
        html = `
          <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;background:#0C0C0C;color:#fff;padding:32px;border-radius:16px;">
            <h1 style="color:#C8973F;font-size:24px;margin-bottom:8px;">Order Completed ✓</h1>
            <p style="color:#888;margin-bottom:24px;">Your order has been completed successfully.</p>
            <p style="margin:0;">Order ID: <strong>${String(data.orderId ?? '')}</strong></p>
          </div>
        `
        break
      }

      case 'subscription_activated': {
        const expiryFormatted = new Date(String(data.expiresAt ?? '')).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric'
        })
        subject = `Your Liquid ${String(data.planName ?? '')} subscription is active`
        html = `
          <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;
          background:#0C0C0C;color:#fff;padding:32px;border-radius:16px;">
            <h1 style="color:#C8973F;font-size:24px;margin-bottom:8px;">
              Subscription Activated ✓
            </h1>
            <p style="color:#888;margin-bottom:24px;">
              Your crypto payment was received and confirmed.
            </p>
            <div style="background:#1A1A1A;border-radius:12px;padding:20px;margin-bottom:24px;">
              <p style="margin:0 0 4px;color:#888;font-size:12px;text-transform:uppercase;">
                Plan
              </p>
              <p style="margin:0 0 16px;font-size:18px;font-weight:600;
              text-transform:capitalize;">${String(data.planName ?? '')}</p>
              <p style="margin:0 0 4px;color:#888;font-size:12px;text-transform:uppercase;">
                Active Until
              </p>
              <p style="margin:0 0 16px;font-size:18px;font-weight:600;">
                ${expiryFormatted}
              </p>
              <p style="margin:0 0 4px;color:#888;font-size:12px;text-transform:uppercase;">
                Amount Paid
              </p>
              <p style="margin:0;font-size:18px;font-weight:600;">
                $${String(data.amount ?? '')} USD
              </p>
            </div>
            <p style="color:#888;font-size:13px;line-height:1.6;">
              You now have full access to ${String(data.planName ?? '')} intelligence content
              on Liquid. Open the app to start reading.
            </p>
          </div>
        `
        break
      }

      default:
        break
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        html,
      }),
    })

    const resendData = await resendRes.json()
    if (!resendRes.ok) {
      return new Response(JSON.stringify({ error: resendData?.message ?? 'Resend API error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, id: resendData?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
