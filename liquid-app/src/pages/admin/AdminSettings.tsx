import { useEffect, useMemo, useState } from 'react'

import { supabase } from '../../lib/supabase'
import { ADMIN_EMAIL } from '../../lib/constants'

import './adminSettings.css'

type ToastKind = 'success' | 'error' | 'info'

type AppSettingsRow = Record<string, any>

async function getSettings(): Promise<AppSettingsRow | null> {
  const { data, error } = await supabase.from('app_settings').select('*').single()
  if (error) return null
  return (data as AppSettingsRow) ?? null
}

async function updateSettings(patch: Record<string, any>): Promise<void> {
  await supabase.from('app_settings').update(patch)
}

export default function AdminSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)

  const [announcement, setAnnouncement] = useState('')

  const [newPassword, setNewPassword] = useState('')

  const [triggers, setTriggers] = useState({
    notify_new_order: true,
    notify_proof_uploaded: true,
    notify_order_expired: false,
    notify_new_subscriber: true,
  })

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(id)
  }, [toast])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const row = await getSettings()
      if (cancelled) return
      setAnnouncement((row?.announcement as string) ?? '')
      setTriggers({
        notify_new_order: Boolean(row?.notify_new_order ?? true),
        notify_proof_uploaded: Boolean(row?.notify_proof_uploaded ?? true),
        notify_order_expired: Boolean(row?.notify_order_expired ?? false),
        notify_new_subscriber: Boolean(row?.notify_new_subscriber ?? true),
      })
      setLoading(false)
    }
    load().catch(() => setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const bannerPreview = useMemo(() => announcement.trim(), [announcement])

  async function handleSaveBanner() {
    setSaving(true)
    try {
      await updateSettings({ announcement })
      setToast({ kind: 'success', message: 'Saved ✓' })
    } catch {
      setToast({ kind: 'error', message: 'Could not save.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleClearBanner() {
    setSaving(true)
    try {
      await updateSettings({ announcement: '' })
      setAnnouncement('')
      setToast({ kind: 'success', message: 'Saved ✓' })
    } catch {
      setToast({ kind: 'error', message: 'Could not save.' })
    } finally {
      setSaving(false)
    }
  }

  async function handlePasswordUpdate() {
    if (!newPassword.trim()) {
      setToast({ kind: 'error', message: 'Enter a new password.' })
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword.trim() })
      if (error) throw error
      setNewPassword('')
      setToast({ kind: 'success', message: 'Password updated ✓' })
    } catch {
      setToast({ kind: 'error', message: 'Failed to update password.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleTestTelegram() {
    setSaving(true)
    try {
      const { error } = await supabase.functions.invoke('send-telegram', {
        body: { message: '✅ Liquid admin Telegram alerts are active!' }
      })
      if (error) {
        setToast({ kind: 'error', message: 'Failed — check your Supabase secrets' })
      } else {
        setToast({ kind: 'success', message: '✓ Test message sent to your Telegram' })
      }
    } finally {
      setSaving(false)
    }
  }

  async function toggleTrigger(key: keyof typeof triggers) {
    const next = !triggers[key]
    setTriggers((cur) => ({ ...cur, [key]: next }))
    try {
      await updateSettings({ [key]: next })
    } catch {
      setTriggers((cur) => ({ ...cur, [key]: !next }))
      setToast({ kind: 'error', message: 'Could not save trigger.' })
    }
  }

  return (
    <div className="adminSettingsRoot" aria-label="Admin settings">
      <header className="adminSettingsHeader">
        <h1 className="adminSettingsTitle">Settings</h1>
      </header>

      {toast ? <div className={`adminSettingsToast ${toast.kind}`}>{toast.message}</div> : null}

      <div className="adminSettingsGrid" aria-busy={loading}>
        <section className="adminSettingsCol" aria-label="Left column">
          <article className="adminSettingsCard">
            <div className="adminSettingsCardTitle">Announcement Banner</div>
            <div className="adminSettingsLabel">Message (shown at top of user app)</div>
            <input
              className="adminSettingsInput"
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              placeholder="Write an announcement…"
              disabled={saving || loading}
            />
            <div className="adminSettingsActionsRow">
              <button
                type="button"
                className="adminSettingsPrimaryBtn"
                onClick={() => void handleSaveBanner()}
                disabled={saving || loading}
              >
                Publish Banner
              </button>
              <button
                type="button"
                className="adminSettingsGhostBtn"
                onClick={() => void handleClearBanner()}
                disabled={saving || loading}
              >
                Clear
              </button>
            </div>

            {bannerPreview ? <div className="adminBannerPreview">{bannerPreview}</div> : null}
          </article>

          <article className="adminSettingsCard">
            <div className="adminSettingsCardTitle">Admin Account</div>
            <div className="adminSettingsLabel">Admin email</div>
            <input className="adminSettingsInput" value={ADMIN_EMAIL} readOnly />

            <div className="adminSettingsLabel" style={{ marginTop: 10 }}>
              Change password
            </div>
            <input
              className="adminSettingsInput"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              type="password"
              disabled={saving || loading}
            />
            <button
              type="button"
              className="adminSettingsPrimaryBtn wide"
              onClick={() => void handlePasswordUpdate()}
              disabled={saving || loading}
            >
              Save Changes
            </button>
          </article>
        </section>

        <section className="adminSettingsCol" aria-label="Right column">
          <article className="adminSettingsCard">
            <div className="adminSettingsCardTitle">Telegram Notifications</div>
            <div className="adminSettingsHint" style={{ marginBottom: 14 }}>
              Your bot token and chat ID are stored securely as Supabase secrets. Tap below to send a test message and confirm alerts are working.
            </div>

            <button
              type="button"
              className="adminSettingsPrimaryBtn wide"
              onClick={() => void handleTestTelegram()}
              disabled={saving || loading}
            >
              Send Test Message
            </button>
          </article>

          <article className="adminSettingsCard">
            <div className="adminSettingsCardTitle">Notification Triggers</div>

            <div className="adminToggleList">
              <div className="adminToggleRow">
                <div className="adminToggleTextBlock">
                  <div className="adminToggleTitle">New order placed</div>
                </div>
                <button
                  type="button"
                  className={`adminMiniToggle ${triggers.notify_new_order ? 'on' : 'off'}`}
                  onClick={() => void toggleTrigger('notify_new_order')}
                  aria-pressed={triggers.notify_new_order}
                >
                  <span className="thumb" />
                </button>
              </div>

              <div className="adminToggleRow">
                <div className="adminToggleTextBlock">
                  <div className="adminToggleTitle">Proof uploaded</div>
                </div>
                <button
                  type="button"
                  className={`adminMiniToggle ${triggers.notify_proof_uploaded ? 'on' : 'off'}`}
                  onClick={() => void toggleTrigger('notify_proof_uploaded')}
                  aria-pressed={triggers.notify_proof_uploaded}
                >
                  <span className="thumb" />
                </button>
              </div>

              <div className="adminToggleRow">
                <div className="adminToggleTextBlock">
                  <div className="adminToggleTitle">Order expired (no action)</div>
                </div>
                <button
                  type="button"
                  className={`adminMiniToggle ${triggers.notify_order_expired ? 'on' : 'off'}`}
                  onClick={() => void toggleTrigger('notify_order_expired')}
                  aria-pressed={triggers.notify_order_expired}
                >
                  <span className="thumb" />
                </button>
              </div>

              <div className="adminToggleRow">
                <div className="adminToggleTextBlock">
                  <div className="adminToggleTitle">New subscriber</div>
                </div>
                <button
                  type="button"
                  className={`adminMiniToggle ${triggers.notify_new_subscriber ? 'on' : 'off'}`}
                  onClick={() => void toggleTrigger('notify_new_subscriber')}
                  aria-pressed={triggers.notify_new_subscriber}
                >
                  <span className="thumb" />
                </button>
              </div>
            </div>
          </article>
        </section>
      </div>
    </div>
  )
}
