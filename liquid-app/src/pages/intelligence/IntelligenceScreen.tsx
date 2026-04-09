import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { useAppSettings } from '../../hooks/useAppSettings'
import { supabase } from '../../lib/supabase'
import type { Insight } from '../../types'
import BottomNav from '../../components/ui/BottomNav'

import './intelligenceScreens.css'

const canView = (tier: string, userPlan: string): boolean => {
  if (tier === 'all') return true
  if (tier === 'basic') return ['basic', 'business', 'institutional'].includes(userPlan)
  if (tier === 'business') return ['business', 'institutional'].includes(userPlan)
  if (tier === 'institutional') return userPlan === 'institutional'
  return false
}

function tierLabel(tier: string): string {
  if (tier === 'basic') return 'Basic'
  if (tier === 'business') return 'Business'
  if (tier === 'institutional') return 'Institutional'
  return 'All'
}

function planLabel(plan: string): string {
  if (plan === 'none') return 'No Plan'
  if (plan === 'basic') return 'Basic'
  if (plan === 'business') return 'Business'
  if (plan === 'institutional') return 'Institutional'
  return 'No Plan'
}

export default function IntelligenceScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { allocStable, allocBtc, allocEth } = useAppSettings()

  const [userPlan, setUserPlan] = useState<string>('none')
  const [insights, setInsights] = useState<Insight[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!user?.id) return

      setLoading(true)
      const [userRes, insightsRes] = await Promise.all([
        supabase.from('users').select('subscription_plan').eq('id', user.id).single(),
        supabase
          .from('insights')
          .select('*')
          .eq('is_published', true)
          .order('published_at', { ascending: false }),
      ])

      if (cancelled) return

      const plan = (userRes.data?.subscription_plan as string | null) ?? 'none'
      setUserPlan(plan)

      const list = (insightsRes.data as Insight[] | null) ?? []
      setInsights(list)
      setLoading(false)
    }

    run().catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [user?.id])

  const allocationTotal = useMemo(() => {
    const sum = allocStable + allocBtc + allocEth
    return sum > 0 ? sum : 100
  }, [allocBtc, allocEth, allocStable])

  function handleCardClick(post: Insight) {
    const unlocked = canView(post.tier_access, userPlan)

    if (!unlocked) {
      navigate('/plans')
      return
    }

    if (expandedId === post.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(post.id)
  }

  function handleOpenPost(postId: string) {
    navigate(`/intelligence/post/${postId}`)
  }

  return (
    <div className="intel-screen">
      <div className="intel-main">
        <div className="intel-header">
          <h1 className="intel-title">Intelligence</h1>
          <button type="button" className="intel-plan-pill" onClick={() => navigate('/plans')}>
            {planLabel(userPlan)}
          </button>
        </div>

        {userPlan === 'none' ? (
          <button type="button" className="intel-sub-banner" onClick={() => navigate('/plans')}>
            Unlock premium insights with a plan →
          </button>
        ) : null}

        <div className="intel-alloc-card">
          <div className="intel-alloc-title">Portfolio Allocation</div>
          <div className="intel-alloc-bar">
            <span
              className="seg stable"
              style={{ width: `${(allocStable / allocationTotal) * 100}%` }}
            />
            <span
              className="seg btc"
              style={{ width: `${(allocBtc / allocationTotal) * 100}%` }}
            />
            <span
              className="seg eth"
              style={{ width: `${(allocEth / allocationTotal) * 100}%` }}
            />
          </div>

          <div className="intel-alloc-row">
            <span className="dot stable" /> Stable <b>{allocStable}%</b>
          </div>
          <div className="intel-alloc-row">
            <span className="dot btc" /> BTC <b>{allocBtc}%</b>
          </div>
          <div className="intel-alloc-row">
            <span className="dot eth" /> ETH <b>{allocEth}%</b>
          </div>
        </div>

        <div className="intel-feed-title">Market Updates</div>

        {loading ? (
          <div className="intel-loading">Loading insights...</div>
        ) : insights.length === 0 ? (
          <div className="intel-loading">No published insights yet.</div>
        ) : (
          <div className="intel-feed">
            {insights.map((post) => {
              const unlocked = canView(post.tier_access, userPlan)
              const expanded = expandedId === post.id
              return (
                <article
                  key={post.id}
                  className={`intel-card ${expanded ? 'expanded' : ''}`}
                  style={{ opacity: unlocked ? 1 : 0.45 }}
                  onClick={() => handleCardClick(post)}
                >
                  <div className="intel-card-tag">{post.tag}</div>
                  <div className="intel-card-title">{post.title}</div>

                  {unlocked ? (
                    expanded ? (
                      <>
                        <div className="intel-card-content">{post.content}</div>
                        <button
                          type="button"
                          className="intel-open-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenPost(post.id)
                          }}
                        >
                          Open Post →
                        </button>
                      </>
                    ) : null
                  ) : (
                    <div className="intel-lock-badge">🔒 {tierLabel(post.tier_access)} only</div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>

      <BottomNav active="insights" />
    </div>
  )
}
