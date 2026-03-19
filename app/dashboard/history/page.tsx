import { createClient } from '@/lib/supabase-server'
import { fmtEmissions, emColor } from '@/lib/emissions'
import HistoryFilters from '@/components/HistoryFilters'
import Link from 'next/link'
import { Suspense } from 'react'
import { ClipboardIcon } from '@/components/Icons'

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: { search?: string; approach?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  let query = supabase
    .from('cases_with_details')
    .select('*')
    .eq('user_id', user.id)
    .order('case_date', { ascending: false })

  if (searchParams.approach) {
    query = query.eq('surgical_approach', searchParams.approach)
  }
  if (searchParams.search) {
    query = query.or(
      `procedure_name.ilike.%${searchParams.search}%,cpt_code.ilike.%${searchParams.search}%`
    )
  }

  const { data: cases } = await query
  const allCases = cases || []

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-green-900 tracking-tight">Case History</h1>
        <p className="text-sm text-green-700/50 mt-1">
          {allCases.length} {allCases.length === 1 ? 'case' : 'cases'} logged
        </p>
      </div>

      <Suspense fallback={null}>
        <HistoryFilters />
      </Suspense>

      <div className="space-y-2.5">
        {allCases.length > 0 ? (
          allCases.map((c, i) => (
            <Link
              key={c.id}
              href={`/dashboard/case?id=${c.id}`}
              className={`hover-lift block p-5 card transition-all animate-fade-up delay-${Math.min(i, 7)}`}
              style={{
                borderLeft: `3px solid ${
                  c.total_emissions_kg < 4 ? '#40916C'
                  : c.total_emissions_kg <= 8 ? '#D97706'
                  : '#DC2626'
                }`,
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold text-green-900 text-sm truncate">
                    {c.procedure_name || c.cpt_code}
                  </div>
                  <div className="text-xs text-green-700/50 capitalize mt-0.5">
                    {c.surgical_approach} · {c.case_date}
                    {c.duration_minutes && ` · ${c.duration_minutes} min`}
                  </div>
                </div>
                <div className={`text-sm font-bold whitespace-nowrap ${emColor(c.total_emissions_kg)}`}>
                  {fmtEmissions(c.total_emissions_kg)}
                </div>
              </div>
            </Link>
          ))
        ) : searchParams.search || searchParams.approach ? (
          <div className="text-center py-16">
            <div className="flex justify-center mb-4 text-green-400">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
            </div>
            <p className="text-green-900 font-semibold text-sm mb-1">No cases match your filters</p>
            <p className="text-green-700/50 text-xs mb-6">Try a different approach or clear your search.</p>
            <Link href="/dashboard/history" className="text-sm text-green-700/60 hover:text-green-900 underline underline-offset-2 transition-colors">
              Clear filters
            </Link>
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="flex justify-center mb-4 text-green-400"><ClipboardIcon className="w-10 h-10" /></div>
            <p className="text-green-700/50 text-sm mb-6">No cases logged yet.</p>
            <Link href="/dashboard/log" className="btn-primary">
              Log a Case
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
