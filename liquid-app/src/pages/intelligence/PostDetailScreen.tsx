import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import type { Insight } from '../../types'

import './intelligenceScreens.css'

const canView = (tier: string, userPlan: string): boolean => {
  if (tier === 'all') return true
  if (tier === 'basic') return ['basic', 'business', 'institutional'].includes(userPlan)
  if (tier === 'business') return ['business', 'institutional'].includes(userPlan)
  if (tier === 'institutional') return userPlan === 'institutional'
  return false
}

function tierLabel(tier: string): string {
  if (tier === 'institutional') return 'Institutional'
  if (tier === 'business') return 'Business'
  if (tier === 'basic') return 'Basic'
  return 'All'
}

function titleCase(value: string): string {
  if (!value) return ''
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

function formatDate(dateIso: string | null): string {
  if (!dateIso) return ''
  const d = new Date(dateIso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function lockedPreview(content: string): string[] {
  const base = content.trim().replace(/\s+/g, ' ')
  const snippet = (base.slice(0, 100) || 'Premium intelligence content available for subscribers.') + '...'
  return [snippet, snippet]
}

export default function PostDetailScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { postId } = useParams()
  const { user } = useAuth()

  const [post, setPost] = useState<Insight | null>(null)
  const [userPlan, setUserPlan] = useState('none')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!user?.id || !postId) return
      setLoading(true)
      setNotFound(false)

      const [userRes, postRes] = await Promise.all([
        supabase.from('users').select('subscription_plan').eq('id', user.id).single(),
        supabase
          .from('insights')
          .select('*')
          .eq('id', postId)
          .eq('is_published', true)
          .maybeSingle(),
      ])

      if (cancelled) return

      setUserPlan((userRes.data?.subscription_plan as string | null) ?? 'none')

      const postData = (postRes.data as Insight | null) ?? null
      if (!postData) {
        setNotFound(true)
        setPost(null)
      } else {
        setPost(postData)
      }

      setLoading(false)
    }

    run().catch(() => {
      if (!cancelled) {
        setLoading(false)
        setNotFound(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [postId, user?.id])

  useEffect(() => {
    const notificationIdFromQuery = searchParams.get('notificationId')
    const stateObj = location.state as { notificationId?: string } | null
    const notificationId = notificationIdFromQuery ?? stateObj?.notificationId ?? null
    if (!notificationId) return

    void (async () => {
      try {
        await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId)
      } catch {
        // Non-blocking mark-as-read write.
      }
    })()
  }, [location.state, searchParams])

  const unlocked = useMemo(() => {
    if (!post) return false
    return canView(post.tier_access, userPlan)
  }, [post, userPlan])

  const tagTone = useMemo(() => {
    if (!post?.tag) return 'grey'
    const t = post.tag.toLowerCase()
    if (t.includes('stable') || t.includes('bull')) return 'green'
    if (t.includes('btc') || t.includes('macro') || t.includes('signal')) return 'purple'
    return 'grey'
  }, [post?.tag])

  if (loading) {
    return (
      <div className="intel-screen">
        <div className="intel-main">
          <div className="intel-loading">Loading post...</div>
        </div>
      </div>
    )
  }

  if (notFound || !post) {
    return (
      <div className="intel-screen">
        <div className="intel-main">
          <div className="intel-detail-nav">
            <button type="button" className="intel-back-btn" onClick={() => navigate('/intelligence')}>
              ←
            </button>
            <div className="intel-detail-nav-title">Intelligence</div>
          </div>
          <div className="intel-loading">Post not found.</div>
          <button type="button" className="intel-open-btn" onClick={() => navigate('/intelligence')}>
            Back to Intelligence
          </button>
        </div>
      </div>
    )
  }

  const previewParagraphs = lockedPreview(post.content)
  const tierText = tierLabel(post.tier_access)

  return (
    <div className="intel-screen">
      <div className="intel-main">
        <div className="intel-detail-nav">
          <button type="button" className="intel-back-btn" onClick={() => navigate('/intelligence')}>
            ←
          </button>
          <div className="intel-detail-nav-title">Intelligence</div>
        </div>

        <div className="intel-detail-meta">
          <span className={`intel-cat-pill ${tagTone}`}>{post.tag}</span>
          <span className="intel-detail-date">{formatDate(post.published_at)}</span>
        </div>

        <h1 className="intel-detail-title">{post.title}</h1>
        <div className={`intel-tier-pill ${unlocked ? 'unlocked' : 'locked'}`}>
          {unlocked ? `◈ ${tierText} & above` : `🔒 ${tierText} only`}
        </div>
        <div className="intel-divider" />

        {unlocked ? (
          <div className="intel-article">
            {post.content.split(/\n{2,}/).map((chunk, idx) => {
              const trimmed = chunk.trim()
              if (!trimmed) return null
              if (/^>\s*/.test(trimmed)) {
                return (
                  <blockquote key={`${idx}-${trimmed.slice(0, 10)}`} className="intel-pull-quote">
                    {trimmed.replace(/^>\s*/, '')}
                  </blockquote>
                )
              }
              if (/^[A-Z][A-Za-z0-9\s&-]{2,40}:?$/.test(trimmed)) {
                return (
                  <h3 key={`${idx}-${trimmed.slice(0, 10)}`} className="intel-section-head">
                    {trimmed}
                  </h3>
                )
              }
              return (
                <p key={`${idx}-${trimmed.slice(0, 10)}`} className="intel-paragraph">
                  {trimmed}
                </p>
              )
            })}
          </div>
        ) : (
          <div className="intel-locked-wrap">
            <div className="intel-blur-content" aria-hidden="true">
              <p className="intel-paragraph">{previewParagraphs[0]}</p>
              <p className="intel-paragraph">{previewParagraphs[1]}</p>
            </div>

            <div className="intel-lock-overlay">
              <div className="intel-lock-icon-box">🔒</div>
              <div className="intel-lock-head">{titleCase(tierText)} access only</div>
              <div className="intel-lock-copy">Upgrade your plan to unlock this premium intelligence post.</div>
              <button type="button" className="intel-upgrade-btn" onClick={() => navigate('/plans')}>
                Upgrade to {titleCase(tierText)} →
              </button>
              <button type="button" className="intel-view-plans-link" onClick={() => navigate('/plans')}>
                View all plans
              </button>
            </div>
          </div>
        )}
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
        <button type="button" className="intel-nav-item active" onClick={() => navigate('/intelligence')}>
          <span className="intel-nav-ico">◈</span>
          <span className="intel-nav-lbl">Insights</span>
        </button>
        <button type="button" className="intel-nav-item" onClick={() => navigate('/portfolio')}>
          <span className="intel-nav-ico">⬚</span>
          <span className="intel-nav-lbl">Portfolio</span>
        </button>
      </div>
    </div>
  )
}
