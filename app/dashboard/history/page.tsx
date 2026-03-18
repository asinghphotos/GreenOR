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
              className={`hover-lift block p-5 card transition-all hover:border-green-300 animate-fade-up delay-${Math.min(i, 7)}`}
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
        ) : (
          <div className="text-center py-16">
            <div className="flex justify-center mb-4 text-green-400"><ClipboardIcon className="w-10 h-10" /></div>
            <p className="text-green-700/50 text-sm mb-6">No cases found.</p>
            <Link href="/dashboard/log" className="btn-primary">
              Log a Case
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
