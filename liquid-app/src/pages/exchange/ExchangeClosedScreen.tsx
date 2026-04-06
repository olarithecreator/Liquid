import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { supabase } from '../../lib/supabase'

import './exchangeScreens.css'

function readMessageFromRow(row: Record<string, unknown> | null): string {
  if (!row) return ''
  const direct = row.exchange_message
  if (typeof direct === 'string' && direct.trim()) return direct.trim()
  if (row.key === 'exchange_message' && typeof row.value === 'string') return row.value.trim()
  return ''
}

export default function ExchangeClosedScreen() {
  const navigate = useNavigate()
  const [adminMessage, setAdminMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    async function run() {
      const [singleRes, keyedRes] = await Promise.all([
        supabase.from('app_settings').select('*').single(),
        supabase.from('app_settings').select('key,value').eq('key', 'exchange_message').maybeSingle(),
      ])

      if (cancelled) return
      const fromSingle = readMessageFromRow((singleRes.data as Record<string, unknown>) ?? null)
      const fromKeyed =
        typeof keyedRes.data?.value === 'string' ? keyedRes.data.value.trim() : ''
      setAdminMessage(fromSingle || fromKeyed)
    }
    run().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="buy-screen">
      <div className="buy-top">
        <div className="screen-nav">
          <div className="back-circle" role="button" tabIndex={0} onClick={() => navigate('/home')}>
            ←
          </div>
          <div className="screen-nav-title">Exchange</div>
        </div>

        <div className="ec-icon-box">🔒</div>
        <h1 className="ec-title">Exchange is currently closed</h1>
        <p className="ec-body">Our exchange operates within set hours.</p>

        <div className="ec-badge">Mon-Fri 9am-8pm · Sat 10am-4pm</div>
        {adminMessage ? <div className="ec-badge admin">{adminMessage}</div> : null}

        <button
          type="button"
          className="primary-btn btn-outline"
          onClick={() => navigate('/intelligence')}
        >
          Browse Intelligence →
        </button>
      </div>
    </div>
  )
}
