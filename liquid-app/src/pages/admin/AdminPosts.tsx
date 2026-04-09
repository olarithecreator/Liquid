import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { adminSupabase as supabase } from '../../lib/supabase'
import type { Insight } from '../../types'

import './adminPostsList.css'

type ToastKind = 'success' | 'error' | 'info'

type InsightRow = Insight & {
  created_at?: string | null
  views?: number | null
  view_count?: number | null
  updated_at?: string | null
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function tagTone(tag: string): 'purple' | 'green' | 'grey' {
  const t = (tag || '').toLowerCase()
  if (t.includes('allocation')) return 'green'
  if (t.includes('macro') || t.includes('liquidity')) return 'purple'
  if (t.includes('private')) return 'grey'
  return 'grey'
}

function tierLabel(tier: string): string {
  if (tier === 'institutional') return 'Institutional'
  if (tier === 'business') return 'Business'
  if (tier === 'basic') return 'Basic'
  return tier || '—'
}

export default function AdminPosts() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<InsightRow[]>([])
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(id)
  }, [toast])

  async function fetchAll() {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('insights').select('*').order('created_at', {
        ascending: false,
      })
      if (error) throw error
      setPosts(((data as InsightRow[]) ?? []).filter(Boolean))
    } catch {
      setPosts([])
      setToast({ kind: 'error', message: 'Could not load posts.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    fetchAll()
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        if (cancelled) return
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const published = useMemo(() => posts.filter((p) => p.is_published), [posts])
  const drafts = useMemo(() => posts.filter((p) => !p.is_published), [posts])

  async function handleDelete(postId: string) {
    const ok = window.confirm('Delete this post? This cannot be undone.')
    if (!ok) return

    const prev = posts
    setPosts((cur) => cur.filter((p) => p.id !== postId))
    try {
      const { error } = await supabase.from('insights').delete().eq('id', postId)
      if (error) throw error
      setToast({ kind: 'success', message: 'Post deleted' })
    } catch {
      setPosts(prev)
      setToast({ kind: 'error', message: 'Could not delete post.' })
    }
  }

  async function handlePublishDraft(postId: string) {
    const nowIso = new Date().toISOString()
    setPosts((cur) =>
      cur.map((p) => (p.id === postId ? { ...p, is_published: true, published_at: nowIso } : p)),
    )
    try {
      const { error } = await supabase
        .from('insights')
        .update({ is_published: true, published_at: nowIso })
        .eq('id', postId)
      if (error) throw error
      setToast({ kind: 'success', message: 'Post published ✓' })
    } catch {
      await fetchAll()
      setToast({ kind: 'error', message: 'Could not publish draft.' })
    }
  }

  return (
    <div className="adminPostsRoot" aria-label="Admin posts">
      <header className="adminPostsHeader">
        <h1 className="adminPostsTitle">Intelligence Posts</h1>
        <button type="button" className="adminPostsNewBtn" onClick={() => navigate('/admin/post/new')}>
          + New Post
        </button>
      </header>

      {toast ? <div className={`adminPostsToast ${toast.kind}`}>{toast.message}</div> : null}

      {loading ? (
        <div className="adminPostsLoading">Loading posts…</div>
      ) : (
        <div className="adminPostsStack">
          <section className="adminPostsSection" aria-label="Published posts">
            <div className="adminPostsSectionHead">Published</div>
            <div className="adminPostsCard">
              {published.length === 0 ? (
                <div className="adminPostsEmpty">No published posts yet.</div>
              ) : (
                <ul className="adminPostsList">
                  {published.map((p) => {
                    const tone = tagTone(p.tag)
                    const views = Number(p.view_count ?? p.views ?? 0)
                    return (
                      <li key={p.id} className="adminPostRow">
                        <div className="adminPostRowLeft">
                          <span className={`adminRowTag tone-${tone}`}>{p.tag}</span>
                          <div className="adminRowText">
                            <div className="adminRowTitle">{p.title}</div>
                            <div className="adminRowMeta">
                              <span className="adminRowTier">{tierLabel(p.tier_access)}</span>
                              <span className="adminRowDot">•</span>
                              <span className="adminRowDate">{formatDate(p.published_at || p.created_at)}</span>
                              <span className="adminRowDot">•</span>
                              <span className="adminRowViews">{views.toLocaleString('en-US')} views</span>
                            </div>
                          </div>
                        </div>

                        <div className="adminPostRowActions">
                          <button
                            type="button"
                            className="adminRowBtn"
                            onClick={() => navigate(`/admin/post/${p.id}/edit`)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="adminRowBtn danger"
                            onClick={() => void handleDelete(p.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className="adminPostsSection" aria-label="Draft posts">
            <div className="adminPostsSectionHead">Drafts</div>
            <div className="adminPostsCard">
              {drafts.length === 0 ? (
                <div className="adminPostsEmpty">No drafts.</div>
              ) : (
                <ul className="adminPostsList">
                  {drafts.map((p) => {
                    const tone = tagTone(p.tag || 'draft')
                    const views = Number(p.view_count ?? p.views ?? 0)
                    return (
                      <li key={p.id} className="adminPostRow">
                        <div className="adminPostRowLeft">
                          <span className={`adminRowTag tone-${tone}`}>{p.tag || 'Draft'}</span>
                          <div className="adminRowText">
                            <div className="adminRowTitle">{p.title}</div>
                            <div className="adminRowMeta">
                              <span className="adminRowTier">{tierLabel(p.tier_access)}</span>
                              <span className="adminRowDot">•</span>
                              <span className="adminRowDate">
                                Not published · Last edit {formatDate(p.updated_at || p.created_at)}
                              </span>
                              {views > 0 ? (
                                <>
                                  <span className="adminRowDot">•</span>
                                  <span className="adminRowViews">{views.toLocaleString('en-US')} views</span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="adminPostRowActions">
                          <button
                            type="button"
                            className="adminRowBtn"
                            onClick={() => navigate(`/admin/post/${p.id}/edit`)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="adminRowBtn success"
                            onClick={() => void handlePublishDraft(p.id)}
                          >
                            Publish
                          </button>
                          <button
                            type="button"
                            className="adminRowBtn danger"
                            onClick={() => void handleDelete(p.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
