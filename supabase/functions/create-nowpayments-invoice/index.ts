import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId, planId, duration, amount } = await req.json()

    const response = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('NOWPAYMENTS_API_KEY') ?? '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: 'usd',
        order_id: `${userId}_${planId}_${duration}`,
        order_description: `Liquid ${planId} plan - ${duration}`,
        ipn_callback_url: Deno.env.get('WEBHOOK_URL'),
        success_url: `${Deno.env.get('APP_URL')}/plans?payment=success`,
        cancel_url: `${Deno.env.get('APP_URL')}/plans?payment=cancelled`,
        is_fixed_rate: false,
        is_fee_paid_by_user: false
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message ?? 'NOWPayments API error')
    }

    return new Response(
      JSON.stringify({ payment_url: data.invoice_url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
