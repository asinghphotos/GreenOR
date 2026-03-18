import { createClient } from '@/lib/supabase-server'
import { fmtEmissions, emColor } from '@/lib/emissions'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MagnifyingGlassIcon } from '@/components/Icons'

export default async function CaseDetailPage({
  searchParams,
}: {
  searchParams: { id?: string }
}) {
  if (!searchParams.id) redirect('/dashboard/history')

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: caseData } = await supabase
    .from('cases_with_details')
    .select('*')
    .eq('id', searchParams.id)
    .single()

  if (!caseData) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <div className="flex justify-center mb-4 text-green-400"><MagnifyingGlassIcon className="w-10 h-10" /></div>
        <p className="text-green-700/50 text-sm mb-6">Case not found.</p>
        <Link href="/dashboard/history" className="text-sm font-medium text-green-700 hover:text-green-900 transition-colors">
          ← Back to History
        </Link>
      </div>
    )
  }

  const { data: items } = await supabase
    .from('case_items')
    .select('*, equipment(name, category, emission_factor_kg)')
    .eq('case_id', caseData.id)
    .order('created_at')

  const { data: sets } = await supabase
    .from('case_sets')
    .select('*, instrument_sets(name, per_use_emission_kg)')
    .eq('case_id', caseData.id)
    .order('created_at')

  const caseItems = items || []
  const caseSets = sets || []

  const itemsByCategory = caseItems.reduce<Record<string, typeof caseItems>>((acc, item) => {
    const cat = (item.equipment as any)?.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Link
        href="/dashboard/history"
        className="inline-block text-xs font-medium text-green-700/50 hover:text-green-700 transition-colors"
      >
        ← Back to History
      </Link>

      {/* Header */}
      <div className="animate-fade-up text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-green-900 tracking-tight">
          {caseData.procedure_name || caseData.cpt_code}
        </h1>
        <p className="text-sm text-green-700/50 capitalize mt-1">
          {caseData.surgical_approach} · {caseData.case_date}
        </p>
      </div>

      {/* Total emissions */}
      <div className={`animate-fade-up delay-1 p-6 rounded-2xl text-center border-[1.5px] ${
        caseData.total_emissions_kg < 4 ? 'bg-green-50 border-green-200'
          : caseData.total_emissions_kg <= 8 ? 'bg-amber-50 border-amber-200'
          : 'bg-red-50 border-red-200'
      }`}>
        <div className="text-xs text-green-700/50 font-medium uppercase tracking-wide mb-2">Total Case Emissions</div>
        <div className={`text-4xl font-bold ${emColor(caseData.total_emissions_kg)}`}>
          {fmtEmissions(caseData.total_emissions_kg)}
        </div>
      </div>

      {/* Case details */}
      <div className="animate-fade-up delay-2 card p-6">
        <div className="text-xs font-bold text-green-700/40 uppercase tracking-wide mb-4">Case Details</div>
        <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
          {[
            ['CPT Code', caseData.cpt_code],
            ['Approach', caseData.surgical_approach],
            ['Duration', `${caseData.duration_minutes} min`],
            ['Anesthesia', caseData.anesthesia_type],
            ['Gas', caseData.anesthesia_gas === 'tiva' ? 'TIVA' : caseData.anesthesia_gas],
            ['Institution', caseData.institution],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-green-700/50 text-xs">{label}</div>
              <div className="font-semibold text-green-900 capitalize">{value}</div>
            </div>
          ))}
        </div>
        {caseData.notes && (
          <div className="mt-5 pt-4 border-t border-beige-200">
            <div className="text-green-700/50 text-xs mb-1">Notes</div>
            <p className="text-sm text-green-900">{caseData.notes}</p>
          </div>
        )}
      </div>

      {/* Equipment */}
      {Object.keys(itemsByCategory).length > 0 && (
        <div className="animate-fade-up delay-3 card p-6">
          <div className="text-xs font-bold text-green-700/40 uppercase tracking-wide mb-4">Equipment & Supplies</div>
          <div className="space-y-5">
            {Object.entries(itemsByCategory).map(([category, catItems]) => (
              <div key={category}>
                <div className="text-[10px] font-bold text-green-700/30 uppercase tracking-wider mb-2">{category}</div>
                <div className="space-y-1.5">
                  {catItems.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm py-0.5">
                      <span className="text-green-700/70">{(item.equipment as any)?.name} × {item.quantity}</span>
                      <span className={`font-semibold ${emColor(item.subtotal_emissions_kg)}`}>
                        {fmtEmissions(item.subtotal_emissions_kg)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instrument sets */}
      {caseSets.length > 0 && (
        <div className="animate-fade-up delay-4 card p-6">
          <div className="text-xs font-bold text-green-700/40 uppercase tracking-wide mb-4">Instrument Trays</div>
          <div className="space-y-1.5">
            {caseSets.map((set) => (
              <div key={set.id} className="flex justify-between text-sm py-0.5">
                <span className="text-green-700/70">{(set.instrument_sets as any)?.name} × {set.quantity}</span>
                <span className={`font-semibold ${emColor(set.subtotal_emissions_kg)}`}>
                  {fmtEmissions(set.subtotal_emissions_kg)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
