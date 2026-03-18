'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { fmtEmissions, emColor } from '@/lib/emissions'
import Onboarding from '@/components/Onboarding'
import Link from 'next/link'
import { ClipboardIcon, LeafIcon, ChartBarIcon, FlameIcon, SproutIcon } from '@/components/Icons'

interface DashboardStats {
  totalCases: number
  totalEmissions: number
  avgEmissions: number
  streak: number
  recentCases: {
    id: string
    procedure_name: string
    surgical_approach: string
    total_emissions_kg: number
    case_date: string
  }[]
  approachData: {
    surgical_approach: string
    avg_emissions: number
    case_count: number
  }[]
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadDashboard() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const onboardingSeen = localStorage.getItem('greenor-onboarding-seen')
      if (!onboardingSeen) setShowOnboarding(true)

      const { data: cases } = await supabase
        .from('cases_with_details')
        .select('*')
        .eq('user_id', user.id)
        .order('case_date', { ascending: false })

      const userCases = cases || []
      const totalEmissions = userCases.reduce((sum, c) => sum + (c.total_emissions_kg || 0), 0)

      // Calculate streak
      let streak = 0
      if (userCases.length > 0) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const dates = Array.from(new Set(userCases.map(c => c.case_date))).sort().reverse()
        for (let i = 0; i < dates.length; i++) {
          const caseDate = new Date(dates[i])
          caseDate.setHours(0, 0, 0, 0)
          const diffDays = Math.floor((today.getTime() - caseDate.getTime()) / (1000 * 60 * 60 * 24))
          if (diffDays <= i + 1) {
            streak++
          } else {
            break
          }
        }
      }

      // Approach comparison
      const approachMap = new Map<string, { total: number; count: number }>()
      userCases.forEach(c => {
        const key = c.surgical_approach
        const existing = approachMap.get(key) || { total: 0, count: 0 }
        existing.total += c.total_emissions_kg || 0
        existing.count++
        approachMap.set(key, existing)
      })

      setStats({
        totalCases: userCases.length,
        totalEmissions,
        avgEmissions: userCases.length > 0 ? totalEmissions / userCases.length : 0,
        streak,
        recentCases: userCases.slice(0, 5).map(c => ({
          id: c.id,
          procedure_name: c.procedure_name || c.cpt_code,
          surgical_approach: c.surgical_approach,
          total_emissions_kg: c.total_emissions_kg,
          case_date: c.case_date,
        })),
        approachData: Array.from(approachMap.entries()).map(([approach, data]) => ({
          surgical_approach: approach,
          avg_emissions: data.count > 0 ? data.total / data.count : 0,
          case_count: data.count,
        })),
      })
      setLoading(false)
    }
    loadDashboard()
  }, [supabase])

  const handleOnboardingComplete = () => {
    localStorage.setItem('greenor-onboarding-seen', 'true')
    setShowOnboarding(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-green-700/50 animate-pulse-soft text-sm">Loading your dashboard...</div>
      </div>
    )
  }

  return (
    <>
      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}

      <div className="space-y-8">
        {/* Header */}
        <div className="animate-fade-up">
          <h1 className="text-3xl font-bold text-green-900 tracking-tight">Dashboard</h1>
          <p className="text-green-700/60 mt-1 text-sm">Your surgical sustainability overview</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Cases', value: String(stats?.totalCases || 0), icon: <ClipboardIcon className="w-6 h-6" /> },
            { label: 'Total CO₂e', value: fmtEmissions(stats?.totalEmissions || 0), icon: <LeafIcon className="w-6 h-6" /> },
            { label: 'Avg / Case', value: fmtEmissions(stats?.avgEmissions || 0), icon: <ChartBarIcon className="w-6 h-6" /> },
            { label: 'Day Streak', value: String(stats?.streak || 0), icon: <FlameIcon className="w-6 h-6" /> },
          ].map((stat, i) => (
            <div
              key={i}
              className={`animate-fade-up delay-${i + 1} hover-lift card p-5 text-center`}
            >
              <div className="flex justify-center mb-2 text-green-600">{stat.icon}</div>
              <div className="text-xl font-bold text-green-900">{stat.value}</div>
              <div className="text-xs text-green-700/50 font-medium mt-1 uppercase tracking-wide">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Approach comparison */}
        {stats && stats.approachData.length > 0 && (
          <div className="animate-fade-up delay-3 card p-6 sm:p-8">
            <h2 className="text-lg font-bold text-green-900 mb-5">Emissions by Approach</h2>
            <div className="space-y-4">
              {stats.approachData.map((item) => {
                const maxAvg = Math.max(...stats.approachData.map(d => d.avg_emissions), 1)
                const widthPct = Math.max((item.avg_emissions / maxAvg) * 100, 4)
                return (
                  <div key={item.surgical_approach}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="capitalize text-green-900 font-semibold">
                        {item.surgical_approach}
                      </span>
                      <span className={`${emColor(item.avg_emissions)} font-medium`}>
                        {fmtEmissions(item.avg_emissions)} avg
                        <span className="text-green-700/40 ml-1">({item.case_count})</span>
                      </span>
                    </div>
                    <div className="h-2.5 bg-beige-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-300 to-green-500 rounded-full transition-all duration-700"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Recent cases */}
        <div className="animate-fade-up delay-4 card p-6 sm:p-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-green-900">Recent Cases</h2>
            {stats && stats.recentCases.length > 0 && (
              <Link
                href="/dashboard/history"
                className="text-xs font-medium text-green-700/50 hover:text-green-700 transition-colors"
              >
                View all →
              </Link>
            )}
          </div>

          {stats && stats.recentCases.length > 0 ? (
            <div className="space-y-2">
              {stats.recentCases.map((c, i) => (
                <Link
                  key={c.id}
                  href={`/dashboard/case?id=${c.id}`}
                  className={`hover-lift block p-4 rounded-xl bg-beige-100/50 hover:bg-beige-100 transition-colors delay-${Math.min(i + 5, 7)}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-semibold text-green-900 text-sm truncate">
                        {c.procedure_name}
                      </div>
                      <div className="text-xs text-green-700/50 capitalize mt-0.5">
                        {c.surgical_approach} · {c.case_date}
                      </div>
                    </div>
                    <div className={`font-bold text-sm whitespace-nowrap ${emColor(c.total_emissions_kg)}`}>
                      {fmtEmissions(c.total_emissions_kg)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="flex justify-center mb-4 text-green-500"><SproutIcon className="w-10 h-10" /></div>
              <p className="text-green-700/60 text-sm mb-6">No cases logged yet — let&apos;s change that.</p>
              <Link href="/dashboard/log" className="btn-primary">
                Log Your First Case
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
