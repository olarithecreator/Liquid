import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { adminSupabase as supabase } from '../../lib/supabase'
import type { Insight } from '../../types'

import './adminPostsEditor.css'

type Mode = 'new' | 'edit'
type ToastKind = 'success' | 'error' | 'info'

type CategoryTag = 'Macro Outlook' | 'Allocation Strategy' | 'Private Strategy' | 'Liquidity Insights'
type TierAccess = 'basic' | 'business' | 'institutional'

const TAGS: { id: CategoryTag; tone: 'purple' | 'green' | 'grey' }[] = [
  { id: 'Macro Outlook', tone: 'purple' },
  { id: 'Allocation Strategy', tone: 'green' },
  { id: 'Private Strategy', tone: 'grey' },
  { id: 'Liquidity Insights', tone: 'purple' },
]

const TIERS: { id: TierAccess; label: string; price: string }[] = [
  { id: 'basic', label: 'Basic', price: '₦15k/mo' },
  { id: 'business', label: 'Business', price: '₦45k/mo' },
  { id: 'institutional', label: 'Institutional', price: '₦120k/mo' },
]

function formatPreviewDate(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date()
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function clampPreviewText(raw: string, maxChars: number): string {
  const base = raw.trim().replace(/\s+/g, ' ')
  if (base.length <= maxChars) return base
  return `${base.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`
}

export default function AdminNewPost({ mode }: { mode?: Mode }) {
  const navigate = useNavigate()
  const params = useParams()

  const editId = params.id ?? null
  const pageMode: Mode = editId ? 'edit' : (mode ?? 'new')

  const [loading, setLoading] = useState(Boolean(editId))
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tag, setTag] = useState<CategoryTag | ''>('')
  const [tier, setTier] = useState<TierAccess | ''>('')

  const [published, setPublished] = useState(false)
  const [initialPublished, setInitialPublished] = useState(false)

  const [publishMode, setPublishMode] = useState<'now' | 'schedule'>('now')
  const [scheduledAt, setScheduledAt] = useState('')

  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(id)
  }, [toast])

  useEffect(() => {
    if (!editId) return

    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data, error } = await supabase.from('insights').select('*').eq('id', editId).single()
        if (cancelled) return
        if (error || !data) {
          setToast({ kind: 'error', message: 'Could not load post.' })
          navigate('/admin/posts', { replace: true })
          return
        }

        const row = data as Insight
        setTitle(row.title ?? '')
        setContent(row.content ?? '')
        setTag((row.tag as CategoryTag) ?? '')
        setTier((row.tier_access as TierAccess) ?? '')
        setPublished(Boolean(row.is_published))
        setInitialPublished(Boolean(row.is_published))

        if (row.published_at) {
          setPublishMode('schedule')
          setScheduledAt(row.published_at.slice(0, 16))
        } else {
          setPublishMode('now')
          setScheduledAt('')
        }
      } catch {
        if (!cancelled) {
          setToast({ kind: 'error', message: 'Could not load post.' })
          navigate('/admin/posts', { replace: true })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [editId, navigate])

  const selectedTone = useMemo(() => {
    const match = TAGS.find((t) => t.id === tag)
    return match?.tone ?? 'grey'
  }, [tag])

  const previewTitle = useMemo(() => {
    return clampPreviewText(title || 'Untitled post', 58)
  }, [title])

  const previewBody = useMemo(() => {
    return clampPreviewText(content || 'Write something for your audience…', 120)
  }, [content])

  const previewDate = useMemo(() => {
    const chosenIso =
      publishMode === 'schedule' && scheduledAt ? new Date(scheduledAt).toISOString() : null
    return formatPreviewDate(chosenIso)
  }, [publishMode, scheduledAt])

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false
    if (!content.trim()) return false
    if (!tag) return false
    if (!tier) return false
    if (!editId && publishMode === 'schedule' && !scheduledAt) return false
    return true
  }, [content, editId, publishMode, scheduledAt, tag, tier, title])

  function showMissing() {
    if (!title.trim()) return setToast({ kind: 'error', message: 'Title is required.' })
    if (!content.trim()) return setToast({ kind: 'error', message: 'Content is required.' })
    if (!tag) return setToast({ kind: 'error', message: 'Select a category tag.' })
    if (!tier) return setToast({ kind: 'error', message: 'Select an access tier.' })
    if (!editId && publishMode === 'schedule' && !scheduledAt) {
      return setToast({ kind: 'error', message: 'Pick a publish date/time.' })
    }
  }

  function handleDiscard() {
    const ok = window.confirm('Discard changes?')
    if (!ok) return
    navigate('/admin/posts')
  }

  async function handleSaveDraft() {
    if (!canSubmit) return showMissing()
    setSaving(true)
    try {
      if (editId) {
        const { error } = await supabase
          .from('insights')
          .update({
            title: title.trim(),
            content: content.trim(),
            tag,
            tier_access: tier,
            is_published: false,
            published_at: null,
          })
          .eq('id', editId)

        if (error) throw error
        setToast({ kind: 'success', message: 'Draft saved' })
      } else {
        const { error } = await supabase.from('insights').insert({
          title: title.trim(),
          content: content.trim(),
          tag,
          tier_access: tier,
          is_published: false,
        })
        if (error) throw error
        setToast({ kind: 'success', message: 'Draft saved' })
      }

      navigate('/admin/posts')
    } catch {
      setToast({ kind: 'error', message: 'Could not save draft. Try again.' })
    } finally {
      setSaving(false)
    }
  }

  async function handlePublishOrUpdate() {
    if (!canSubmit) return showMissing()

    const nowIso = new Date().toISOString()
    const scheduledIso =
      publishMode === 'schedule' && scheduledAt ? new Date(scheduledAt).toISOString() : null

    setSaving(true)
    try {
      if (editId) {
        const turningOn = !initialPublished && published
        const turningOff = initialPublished && !published

        const nextPublishedAt = turningOn ? nowIso : turningOff ? null : undefined

        const { error } = await supabase
          .from('insights')
          .update({
            title: title.trim(),
            content: content.trim(),
            tag,
            tier_access: tier,
            is_published: published,
            ...(nextPublishedAt === undefined ? {} : { published_at: nextPublishedAt }),
          })
          .eq('id', editId)
        if (error) throw error
        setToast({ kind: 'success', message: 'Post updated ✓' })
      } else {
        const { error } = await supabase.from('insights').insert({
          title: title.trim(),
          content: content.trim(),
          tag,
          tier_access: tier,
          is_published: true,
          published_at: scheduledIso ?? nowIso,
        })
        if (error) throw error
        setToast({ kind: 'success', message: 'Post published ✓' })
      }

      navigate('/admin/posts')
    } catch {
      setToast({ kind: 'error', message: editId ? 'Could not update post. Try again.' : 'Could not publish post. Try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="adminPostEditorRoot" aria-label="Admin new post">
      <header className="adminPostEditorHeader">
        <div className="adminPostEditorTitleRow">
          <h1 className="adminPostEditorTitle">
            {pageMode === 'edit' ? 'Edit Intelligence Post' : 'New Intelligence Post'}
          </h1>
          {editId ? <span className="adminEditModePill">Editing existing post</span> : null}
        </div>

        <div className="adminPostEditorHeaderActions">
          {editId ? (
            <button
              type="button"
              className="adminPostEditorOutlineBtn"
              onClick={handleDiscard}
              disabled={saving || loading}
            >
              Discard Changes
            </button>
          ) : null}
          <button
            type="button"
            className="adminPostEditorLinkBtn"
            onClick={handleSaveDraft}
            disabled={saving || loading}
          >
            Save Draft
          </button>
          <button
            type="button"
            className="adminPostEditorPrimaryBtn"
            onClick={handlePublishOrUpdate}
            disabled={saving || loading}
          >
            {editId ? 'Update Post ✓' : 'Publish Now'}
          </button>
        </div>
      </header>

      {toast ? <div className={`adminPostToast ${toast.kind}`}>{toast.message}</div> : null}

      <div className="adminPostEditorGrid" aria-busy={loading}>
        <section className="adminPostPanel" aria-label="Post content">
          <div className="adminPostPanelHead">Post Content</div>

          <label className="adminPostField">
            <div className="adminPostFieldLabel">Post Title</div>
            <input
              className="adminPostTitleInput"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. BTC liquidity conditions..."
              disabled={loading || saving}
            />
          </label>

          <label className="adminPostField">
            <div className="adminPostFieldLabel">Content</div>
            <textarea
              className="adminPostContentInput"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your intelligence post…"
              disabled={loading || saving}
            />
          </label>
        </section>

        <aside className="adminPostRightCol" aria-label="Post settings and preview">
          <section className="adminPostPanel" aria-label="Post settings">
            <div className="adminPostPanelHead">Post Settings</div>

            {editId ? (
              <div className="adminPostSettingsGroup">
                <div className="adminPostToggleRow">
                  <div>
                    <div className="adminPostToggleLabel">Published</div>
                    <div className="adminPostToggleSub">Visible to users right now</div>
                  </div>
                  <button
                    type="button"
                    className={`adminPostToggle ${published ? 'on' : 'off'}`}
                    onClick={() => setPublished((v) => !v)}
                    aria-pressed={published}
                    disabled={loading || saving}
                  >
                    <span className="thumb" />
                  </button>
                </div>
              </div>
            ) : null}

            <div className="adminPostSettingsGroup">
              <div className="adminPostGroupLabel">Category Tag</div>
              <div className="adminPostPillRow" role="radiogroup" aria-label="Category tag selector">
                {TAGS.map((t) => {
                  const active = tag === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`adminTagPill tone-${t.tone} ${active ? 'active' : ''}`}
                      onClick={() => setTag(t.id)}
                      aria-pressed={active}
                      disabled={loading || saving}
                    >
                      {t.id}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="adminPostSettingsGroup">
              <div className="adminPostGroupLabel">Access Tier</div>
              <div className="adminTierTiles" role="radiogroup" aria-label="Access tier selector">
                {TIERS.map((t) => {
                  const active = tier === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`adminTierTile ${active ? 'active' : ''}`}
                      onClick={() => setTier(t.id)}
                      aria-pressed={active}
                      disabled={loading || saving}
                    >
                      <div className="adminTierTileTop">{t.label}</div>
                      <div className="adminTierTileSub">{t.price}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="adminPostSettingsGroup">
              <div className="adminPostGroupLabel">Publish Time</div>
              <div className="adminPublishSelectRow">
                <select
                  className="adminPublishSelect"
                  value={publishMode}
                  onChange={(e) => {
                    const next = e.target.value === 'schedule' ? 'schedule' : 'now'
                    setPublishMode(next)
                    if (next === 'now') setScheduledAt('')
                  }}
                  disabled={loading || saving}
                >
                  <option value="now">Publish immediately</option>
                  <option value="schedule">Schedule</option>
                </select>

                {!editId && publishMode === 'schedule' ? (
                  <input
                    className="adminPublishDate"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    disabled={loading || saving}
                  />
                ) : null}
              </div>
            </div>

            <div className="adminPostActions">
              <button
                type="button"
                className="adminPostPublishBtn"
                onClick={handlePublishOrUpdate}
                disabled={saving || loading || !canSubmit}
              >
                {editId ? 'Update Post ✓' : 'Publish Post →'}
              </button>
              <button
                type="button"
                className="adminPostDraftBtn"
                onClick={handleSaveDraft}
                disabled={saving || loading || !canSubmit}
              >
                Save Draft
              </button>
            </div>
          </section>

          <section className="adminPreviewWrap" aria-label="Live preview">
            <div className="adminPreviewLabel">Preview · how users see it</div>
            <article className="adminPreviewCard">
              <div className={`adminPreviewTag tone-${selectedTone}`}>{tag || 'Category'}</div>
              <div className="adminPreviewTitle">{previewTitle}</div>
              <div className="adminPreviewBody">{previewBody}</div>
              <div className="adminPreviewBottom">
                <div className="adminPreviewDate">{previewDate}</div>
                <div className="adminPreviewTier">
                  {tier ? (
                    <>
                      {tier === 'institutional' ? <span className="adminPreviewLock">🔒</span> : null}
                      {tier}
                    </>
                  ) : (
                    'tier'
                  )}
                </div>
              </div>
            </article>
          </section>
        </aside>
      </div>
    </div>
  )
}
