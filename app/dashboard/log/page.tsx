'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import {
  type CptCode,
  type Equipment,
  type InstrumentSet,
  type WizardState,
  type WizardItem,
  type WizardSet,
  type SurgicalApproach,
  initialWizardState,
  ANESTHESIA_TYPES,
  ANESTHESIA_GASES,
} from '@/lib/types'
import { calcTotalEmissions, fmtEmissions, emColor } from '@/lib/emissions'

const STEP_LABELS = ['Procedure', 'Pre-op', 'Draping', 'Access', 'Intraop', 'Closure', 'Anesthesia', 'Review']
const TOTAL_STEPS = STEP_LABELS.length

// ── Helpers ──
function updateItems(items: WizardItem[], equipment: Equipment, delta: number): WizardItem[] {
  const existing = items.find((i) => i.equipment_id === equipment.id)
  if (existing) {
    const newQty = existing.quantity + delta
    if (newQty <= 0) return items.filter((i) => i.equipment_id !== equipment.id)
    return items.map((i) => i.equipment_id === equipment.id ? { ...i, quantity: newQty } : i)
  }
  if (delta > 0) {
    return [...items, { equipment_id: equipment.id, name: equipment.name, quantity: delta, emission_factor_kg: equipment.emission_factor_kg }]
  }
  return items
}

function updateSets(sets: WizardSet[], instrumentSet: InstrumentSet, delta: number): WizardSet[] {
  const existing = sets.find((s) => s.instrument_set_id === instrumentSet.id)
  if (existing) {
    const newQty = existing.quantity + delta
    if (newQty <= 0) return sets.filter((s) => s.instrument_set_id !== instrumentSet.id)
    return sets.map((s) => s.instrument_set_id === instrumentSet.id ? { ...s, quantity: newQty } : s)
  }
  if (delta > 0) {
    return [...sets, { instrument_set_id: instrumentSet.id, name: instrumentSet.name, quantity: delta, per_use_emission_kg: instrumentSet.per_use_emission_kg }]
  }
  return sets
}

// ── Item Card ──
function ItemCard({ name, emissionKg, quantity, onAdd, onRemove }: {
  name: string; emissionKg: number; quantity: number; onAdd: () => void; onRemove: () => void
}) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-xl border-[1.5px] transition-all ${
      quantity > 0 ? 'border-green-300 bg-green-50/50' : 'border-beige-200 bg-white'
    }`}>
      <div className="flex-1 min-w-0 mr-3">
        <div className="text-sm font-semibold text-green-900 truncate">{name}</div>
        <div className="text-xs text-green-700/50 mt-0.5">{emissionKg.toFixed(2)} kg CO₂e</div>
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={onRemove} disabled={quantity === 0}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-beige-100 text-green-900 font-bold text-sm tap-scale hover:bg-beige-200 disabled:opacity-20 transition-colors">
          −
        </button>
        <span className="w-7 text-center text-sm font-bold text-green-900 tabular-nums">{quantity}</span>
        <button onClick={onAdd}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-900 text-white font-bold text-sm tap-scale hover:bg-green-700 transition-colors">
          +
        </button>
      </div>
    </div>
  )
}

// ── Chip selector ──
function ChipSelect({ options, selected, onSelect }: {
  options: readonly string[]; selected: string | null; onSelect: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button key={opt} onClick={() => onSelect(opt)}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold capitalize tap-scale transition-all ${
            selected === opt ? 'bg-green-900 text-white shadow-sm' : 'bg-beige-100 text-green-900 hover:bg-beige-200'
          }`}>
          {opt === 'tiva' ? 'TIVA' : opt === 'mac' ? 'MAC' : opt}
        </button>
      ))}
    </div>
  )
}

// ── Question Card ──
// The core UX: a clinical prompt with No / Yes / optional expanded picker
function QuestionCard({
  question,
  hint,
  answered,
  onNo,
  onYes,
  yesLabel = 'Yes',
  children,
}: {
  question: string
  hint?: string
  answered: 'yes' | 'no' | null
  onNo: () => void
  onYes: () => void
  yesLabel?: string
  children?: React.ReactNode
}) {
  return (
    <div className={`rounded-xl border-[1.5px] overflow-hidden transition-all ${
      answered === 'yes' ? 'border-green-300' :
      answered === 'no' ? 'border-beige-200 opacity-70' :
      'border-beige-200 bg-white'
    }`}>
      <div className={`p-4 ${answered === 'yes' ? 'bg-green-50/40' : answered === 'no' ? 'bg-beige-50/60' : 'bg-white'}`}>
        <div className="text-sm font-semibold text-green-900 leading-snug">{question}</div>
        {hint && <div className="text-xs text-green-700/40 mt-0.5">{hint}</div>}
        <div className="flex gap-2 mt-3">
          <button onClick={onNo}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold tap-scale transition-all ${
              answered === 'no'
                ? 'bg-green-900/8 text-green-900 ring-1 ring-green-900/15'
                : 'bg-beige-100 text-green-800/70 hover:bg-beige-200'
            }`}>
            No
          </button>
          <button onClick={onYes}
            className={`flex-[2] py-2.5 rounded-lg text-sm font-semibold tap-scale transition-all ${
              answered === 'yes'
                ? 'bg-green-900 text-white shadow-sm'
                : 'bg-beige-100 text-green-800/70 hover:bg-beige-200'
            }`}>
            {yesLabel}
          </button>
        </div>
      </div>
      {answered === 'yes' && children && (
        <div className="border-t border-green-200/60 px-4 pb-4 pt-3 space-y-2 bg-green-50/20">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Section heading ──
function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-bold text-green-900/50 uppercase tracking-wider pt-1">{children}</h3>
}

// ── Main Wizard ──
export default function LogCasePage() {
  const [step, setStep] = useState(0)
  const [state, setState] = useState<WizardState>(initialWizardState)
  const [answers, setAnswers] = useState<Record<string, 'yes' | 'no'>>({})
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [submitting, setSubmitting] = useState(false)

  const [cptCodes, setCptCodes] = useState<CptCode[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [instrumentSets, setInstrumentSets] = useState<InstrumentSet[]>([])
  const [cptSearch, setCptSearch] = useState('')

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const [cptRes, eqRes, setRes] = await Promise.all([
        supabase.from('cpt_codes').select('*').order('code'),
        supabase.from('equipment').select('*').order('category').order('name'),
        supabase.from('instrument_sets').select('*').order('name'),
      ])
      setCptCodes(cptRes.data || [])
      setEquipment(eqRes.data || [])
      setInstrumentSets(setRes.data || [])
    }
    load()
  }, [supabase])

  const goForward = () => { setDirection('forward'); setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1)) }
  const goBack = () => { setDirection('back'); setStep((s) => Math.max(s - 1, 0)) }

  const totalEmissions = calcTotalEmissions(state.items, state.sets)
  const getItemQty = (id: string) => state.items.find((i) => i.equipment_id === id)?.quantity || 0
  const getSetQty = (id: string) => state.sets.find((s) => s.instrument_set_id === id)?.quantity || 0

  const addItem = useCallback((eq: Equipment) => setState((s) => ({ ...s, items: updateItems(s.items, eq, 1) })), [])
  const removeItem = useCallback((eq: Equipment) => setState((s) => ({ ...s, items: updateItems(s.items, eq, -1) })), [])
  const addSet = useCallback((is: InstrumentSet) => setState((s) => ({ ...s, sets: updateSets(s.sets, is, 1) })), [])
  const removeSet = useCallback((is: InstrumentSet) => setState((s) => ({ ...s, sets: updateSets(s.sets, is, -1) })), [])

  // Equipment lookup helpers
  const byCategory = useCallback((cats: string[]) =>
    equipment.filter((e) => cats.includes(e.category)), [equipment])

  const findByName = useCallback((keyword: string) =>
    equipment.find((e) => e.name.toLowerCase().includes(keyword.toLowerCase())), [equipment])

  // Answer helpers — "yes" auto-adds the default item; "no" clears items from given categories
  const answerYes = useCallback((id: string, defaultItem?: Equipment) => {
    setAnswers((a) => ({ ...a, [id]: 'yes' }))
    if (defaultItem) {
      setState((s) => ({
        ...s,
        items: s.items.find((i) => i.equipment_id === defaultItem.id)
          ? s.items
          : [...s.items, { equipment_id: defaultItem.id, name: defaultItem.name, quantity: 1, emission_factor_kg: defaultItem.emission_factor_kg }],
      }))
    }
  }, [])

  const answerNo = useCallback((id: string, clearCategories?: string[]) => {
    setAnswers((a) => ({ ...a, [id]: 'no' }))
    if (clearCategories && clearCategories.length > 0) {
      const toRemoveIds = new Set(equipment.filter((e) => clearCategories.includes(e.category)).map((e) => e.id))
      setState((s) => ({ ...s, items: s.items.filter((i) => !toRemoveIds.has(i.equipment_id)) }))
    }
  }, [equipment])

  const handleSubmit = async () => {
    if (!state.cpt_code || !state.surgical_approach || !state.duration_minutes || !state.anesthesia_type || !state.anesthesia_gas) return
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('institution').eq('id', user.id).single()
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .insert({
        user_id: user.id, cpt_code: state.cpt_code, surgical_approach: state.surgical_approach,
        duration_minutes: state.duration_minutes, anesthesia_type: state.anesthesia_type,
        anesthesia_gas: state.anesthesia_gas, institution: profile?.institution || '',
        total_emissions_kg: totalEmissions, notes: state.notes || null,
      })
      .select('id').single()
    if (caseError || !caseData) { setSubmitting(false); return }
    if (state.items.length > 0) {
      await supabase.from('case_items').insert(
        state.items.map((item) => ({
          case_id: caseData.id, equipment_id: item.equipment_id,
          quantity: item.quantity, subtotal_emissions_kg: item.quantity * item.emission_factor_kg,
        }))
      )
    }
    if (state.sets.length > 0) {
      await supabase.from('case_sets').insert(
        state.sets.map((set) => ({
          case_id: caseData.id, instrument_set_id: set.instrument_set_id,
          quantity: set.quantity, subtotal_emissions_kg: set.quantity * set.per_use_emission_kg,
        }))
      )
    }
    router.push(`/dashboard/case?id=${caseData.id}`)
  }

  const filteredCpts = cptCodes.filter(
    (c) => c.code.includes(cptSearch) || c.description.toLowerCase().includes(cptSearch.toLowerCase()) || c.category.toLowerCase().includes(cptSearch.toLowerCase())
  )

  const canSubmit = state.cpt_code && state.surgical_approach && state.duration_minutes && state.anesthesia_type && state.anesthesia_gas
  const isLapOrRobotic = state.surgical_approach === 'laparoscopic' || state.surgical_approach === 'robotic'
  const isRobotic = state.surgical_approach === 'robotic'

  return (
    <div className="max-w-xl mx-auto">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-3">
          {STEP_LABELS.map((label, i) => (
            <button key={i}
              onClick={() => { if (i < step) { setDirection('back'); setStep(i) } }}
              className={`text-[9px] sm:text-[11px] font-semibold transition-colors ${
                i === step ? 'text-green-900' : i < step ? 'text-green-500 cursor-pointer hover:text-green-700' : 'text-beige-300'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <div className="h-1.5 bg-beige-200 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-green-500 to-green-300 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} />
        </div>
      </div>

      {/* Running total */}
      {step >= 1 && (
        <div className="animate-fade-in mb-5 card p-3.5 flex items-center justify-between">
          <span className="text-xs font-medium text-green-700/50 uppercase tracking-wide">Running Total</span>
          <span className={`text-lg font-bold ${emColor(totalEmissions)}`}>{fmtEmissions(totalEmissions)}</span>
        </div>
      )}

      {/* Step content */}
      <div key={step} className={direction === 'forward' ? 'animate-slide-right' : 'animate-slide-left'}>

        {/* ── Step 0: Procedure ── */}
        {step === 0 && (
          <div className="space-y-5">
            <div className="text-center mb-2">
              <h2 className="text-2xl font-bold text-green-900 tracking-tight">What procedure?</h2>
              <p className="text-sm text-green-700/50 mt-1">Search by CPT code or name</p>
            </div>
            <input type="text" placeholder="Search procedures..." value={cptSearch}
              onChange={(e) => setCptSearch(e.target.value)} className="input-base text-center" />
            <div className="space-y-2">
              {filteredCpts.map((cpt) => (
                <button key={cpt.code}
                  onClick={() => setState((s) => ({ ...s, cpt_code: cpt.code, procedure_name: cpt.description, surgical_approach: null }))}
                  className={`w-full text-left p-4 rounded-xl tap-scale transition-all ${
                    state.cpt_code === cpt.code ? 'bg-green-900 text-white shadow-md' : 'card hover:border-green-300'
                  }`}>
                  <div className={`font-semibold text-sm ${state.cpt_code === cpt.code ? 'text-white' : 'text-green-900'}`}>
                    {cpt.code} — {cpt.description}
                  </div>
                  <div className={`text-xs mt-0.5 ${state.cpt_code === cpt.code ? 'text-green-100' : 'text-green-700/50'}`}>
                    {cpt.category}
                  </div>
                </button>
              ))}
            </div>
            {state.cpt_code && (
              <div className="space-y-3 pt-2">
                <SectionHeading>Surgical Approach</SectionHeading>
                <div className="grid grid-cols-2 gap-2.5">
                  {cptCodes.find((c) => c.code === state.cpt_code)?.common_approaches.map((approach) => (
                    <button key={approach}
                      onClick={() => {
                        setState((s) => ({ ...s, surgical_approach: approach as SurgicalApproach }))
                        setTimeout(goForward, 200)
                      }}
                      className={`py-4 rounded-xl text-sm font-semibold capitalize tap-scale transition-all ${
                        state.surgical_approach === approach ? 'bg-green-900 text-white shadow-sm' : 'bg-beige-100 text-green-900 hover:bg-beige-200'
                      }`}>
                      {approach}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 1: Pre-op ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-green-900 tracking-tight">Pre-op</h2>
              <p className="text-sm text-green-700/50 mt-1">Lines, catheters, and patient setup</p>
            </div>

            {/* Foley */}
            {(() => {
              const item = findByName('foley')
              return (
                <QuestionCard
                  question="Was a Foley catheter placed?"
                  hint="Includes collection bag and drainage kit"
                  answered={answers['foley'] ?? null}
                  onNo={() => answerNo('foley', ['urinary', 'foley', 'catheter'])}
                  onYes={() => answerYes('foley', item)}
                  yesLabel={item ? `Yes — ${item.name} · ${item.emission_factor_kg.toFixed(2)} kg` : 'Yes'}>
                  {item && (
                    <ItemCard name={item.name} emissionKg={item.emission_factor_kg}
                      quantity={getItemQty(item.id)} onAdd={() => addItem(item)} onRemove={() => removeItem(item)} />
                  )}
                  {byCategory(['urinary', 'catheter']).filter(e => e.id !== item?.id).map(eq => (
                    <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg}
                      quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                  ))}
                </QuestionCard>
              )
            })()}

            {/* Arterial line */}
            {(() => {
              const item = findByName('arterial')
              return (
                <QuestionCard
                  question="Was an arterial line placed?"
                  hint="A-line for continuous hemodynamic monitoring"
                  answered={answers['aline'] ?? null}
                  onNo={() => answerNo('aline')}
                  onYes={() => answerYes('aline', item)}
                  yesLabel={item ? `Yes — ${item.name} · ${item.emission_factor_kg.toFixed(2)} kg` : 'Yes'}>
                  {item && (
                    <ItemCard name={item.name} emissionKg={item.emission_factor_kg}
                      quantity={getItemQty(item.id)} onAdd={() => addItem(item)} onRemove={() => removeItem(item)} />
                  )}
                </QuestionCard>
              )
            })()}

            {/* Central line */}
            {(() => {
              const item = findByName('central')
              return (
                <QuestionCard
                  question="Was a central venous catheter placed?"
                  hint="CVL, introducer sheath, or PICC"
                  answered={answers['cvl'] ?? null}
                  onNo={() => answerNo('cvl')}
                  onYes={() => answerYes('cvl', item)}
                  yesLabel={item ? `Yes — ${item.name} · ${item.emission_factor_kg.toFixed(2)} kg` : 'Yes'}>
                  {item && (
                    <ItemCard name={item.name} emissionKg={item.emission_factor_kg}
                      quantity={getItemQty(item.id)} onAdd={() => addItem(item)} onRemove={() => removeItem(item)} />
                  )}
                  {byCategory(['lines', 'vascular_access']).filter(e => e.id !== item?.id).map(eq => (
                    <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg}
                      quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                  ))}
                </QuestionCard>
              )
            })()}

            {/* Patient warming */}
            {(() => {
              const item = findByName('warm') ?? findByName('blanket')
              return (
                <QuestionCard
                  question="Was a patient warming device used?"
                  hint="Forced-air warming blanket or heated mattress"
                  answered={answers['warming'] ?? null}
                  onNo={() => answerNo('warming', ['warming'])}
                  onYes={() => answerYes('warming', item)}
                  yesLabel={item ? `Yes — ${item.name} · ${item.emission_factor_kg.toFixed(2)} kg` : 'Yes'}>
                  {item && (
                    <ItemCard name={item.name} emissionKg={item.emission_factor_kg}
                      quantity={getItemQty(item.id)} onAdd={() => addItem(item)} onRemove={() => removeItem(item)} />
                  )}
                  {byCategory(['warming']).filter(e => e.id !== item?.id).map(eq => (
                    <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg}
                      quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                  ))}
                </QuestionCard>
              )
            })()}

            {/* SCDs */}
            <QuestionCard
              question="Were sequential compression devices (SCDs) applied?"
              hint="DVT prophylaxis leg compression sleeves"
              answered={answers['scd'] ?? null}
              onNo={() => answerNo('scd')}
              onYes={() => answerYes('scd')}
            />

            {/* Instrument trays */}
            {instrumentSets.length > 0 && (
              <div className="space-y-3 pt-2">
                <SectionHeading>Instrument Trays Opened</SectionHeading>
                <div className="space-y-2">
                  {instrumentSets.map((is) => (
                    <ItemCard key={is.id} name={is.name} emissionKg={is.per_use_emission_kg}
                      quantity={getSetQty(is.id)} onAdd={() => addSet(is)} onRemove={() => removeSet(is)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Draping ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-green-900 tracking-tight">Draping & prep</h2>
              <p className="text-sm text-green-700/50 mt-1">Drapes, gowns, and surgical prep</p>
            </div>

            {/* Surgical drapes */}
            {(() => {
              const drapeItems = byCategory(['drapes', 'draping'])
              const defaultDrape = drapeItems.find(e => e.name.toLowerCase().includes('drape')) ?? drapeItems[0]
              return (
                <QuestionCard
                  question="Were surgical drapes used?"
                  hint="Sterile field draping for the surgical site"
                  answered={answers['drapes'] ?? null}
                  onNo={() => answerNo('drapes', ['drapes', 'draping'])}
                  onYes={() => answerYes('drapes', defaultDrape)}
                  yesLabel={defaultDrape ? `Yes — ${defaultDrape.name} · ${defaultDrape.emission_factor_kg.toFixed(2)} kg` : 'Yes'}>
                  {drapeItems.map(eq => (
                    <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg}
                      quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                  ))}
                </QuestionCard>
              )
            })()}

            {/* Surgical gowns */}
            {(() => {
              const item = findByName('gown')
              return (
                <QuestionCard
                  question="Were sterile surgical gowns used?"
                  hint="One per scrubbed team member"
                  answered={answers['gowns'] ?? null}
                  onNo={() => answerNo('gowns')}
                  onYes={() => answerYes('gowns', item)}
                  yesLabel={item ? `Yes — ${item.name} · ${item.emission_factor_kg.toFixed(2)} kg` : 'Yes'}>
                  {item && (
                    <ItemCard name={item.name} emissionKg={item.emission_factor_kg}
                      quantity={getItemQty(item.id)} onAdd={() => addItem(item)} onRemove={() => removeItem(item)} />
                  )}
                </QuestionCard>
              )
            })()}

            {/* Prep kit */}
            {(() => {
              const item = findByName('prep') ?? findByName('chlorhexidine') ?? findByName('betadine')
              return (
                <QuestionCard
                  question="Was a surgical site prep kit used?"
                  hint="Chlorhexidine, betadine, or alcohol scrub kit"
                  answered={answers['prep'] ?? null}
                  onNo={() => answerNo('prep', ['prep', 'antiseptic'])}
                  onYes={() => answerYes('prep', item)}
                  yesLabel={item ? `Yes — ${item.name} · ${item.emission_factor_kg.toFixed(2)} kg` : 'Yes'}>
                  {item && (
                    <ItemCard name={item.name} emissionKg={item.emission_factor_kg}
                      quantity={getItemQty(item.id)} onAdd={() => addItem(item)} onRemove={() => removeItem(item)} />
                  )}
                  {byCategory(['prep', 'antiseptic']).filter(e => e.id !== item?.id).map(eq => (
                    <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg}
                      quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                  ))}
                </QuestionCard>
              )
            })()}

            {/* Positioning aids */}
            {(() => {
              const item = findByName('posit') ?? findByName('bean') ?? findByName('pad')
              return (
                <QuestionCard
                  question="Were patient positioning aids used?"
                  hint="Gel pads, bean bag, lithotomy stirrups, etc."
                  answered={answers['positioning'] ?? null}
                  onNo={() => answerNo('positioning', ['positioning'])}
                  onYes={() => answerYes('positioning', item)}
                  yesLabel={item ? `Yes — ${item.name} · ${item.emission_factor_kg.toFixed(2)} kg` : 'Yes'}>
                  {item && (
                    <ItemCard name={item.name} emissionKg={item.emission_factor_kg}
                      quantity={getItemQty(item.id)} onAdd={() => addItem(item)} onRemove={() => removeItem(item)} />
                  )}
                  {byCategory(['positioning']).filter(e => e.id !== item?.id).map(eq => (
                    <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg}
                      quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                  ))}
                </QuestionCard>
              )
            })()}

            {/* Bovie grounding pad */}
            {(() => {
              const item = findByName('grounding') ?? findByName('cautery pad') ?? findByName('dispersive')
              return (
                <QuestionCard
                  question="Was a electrosurgical grounding pad placed?"
                  hint="Bovie/ESU return electrode pad"
                  answered={answers['grounding_pad'] ?? null}
                  onNo={() => answerNo('grounding_pad')}
                  onYes={() => answerYes('grounding_pad', item)}
                  yesLabel={item ? `Yes — ${item.name} · ${item.emission_factor_kg.toFixed(2)} kg` : 'Yes'}>
                  {item && (
                    <ItemCard name={item.name} emissionKg={item.emission_factor_kg}
                      quantity={getItemQty(item.id)} onAdd={() => addItem(item)} onRemove={() => removeItem(item)} />
                  )}
                </QuestionCard>
              )
            })()}
          </div>
        )}

        {/* ── Step 3: Access ── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-green-900 tracking-tight">Access</h2>
              <p className="text-sm text-green-700/50 mt-1">Entry, trocars, scope, and setup</p>
            </div>

            {/* CO2 insufflation — lap/robotic only */}
            {isLapOrRobotic && (() => {
              const insuffItems = byCategory(['insufflation'])
              const item = insuffItems[0]
              return (
                <QuestionCard
                  question="Was CO2 insufflation used?"
                  hint="Pneumoperitoneum for laparoscopic access"
                  answered={answers['insufflation'] ?? null}
                  onNo={() => answerNo('insufflation', ['insufflation'])}
                  onYes={() => answerYes('insufflation', item)}
                  yesLabel={item ? `Yes — ${item.name} · ${item.emission_factor_kg.toFixed(2)} kg` : 'Yes'}>
                  {insuffItems.map(eq => (
                    <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg}
                      quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                  ))}
                </QuestionCard>
              )
            })()}

            {/* Veress needle / optical trocar for entry */}
            {isLapOrRobotic && (() => {
              const item = findByName('veress') ?? findByName('optical')
              return (
                <QuestionCard
                  question="What initial entry technique was used?"
                  hint="Veress needle, optical trocar, or Hasson open technique"
                  answered={answers['entry'] ?? null}
                  onNo={() => answerNo('entry')}
                  onYes={() => answerYes('entry', item)}
                  yesLabel={item ? `Yes — ${item.name} · ${item.emission_factor_kg.toFixed(2)} kg` : 'Veress / Optical entry'}>
                  {item && (
                    <ItemCard name={item.name} emissionKg={item.emission_factor_kg}
                      quantity={getItemQty(item.id)} onAdd={() => addItem(item)} onRemove={() => removeItem(item)} />
                  )}
                </QuestionCard>
              )
            })()}

            {/* Trocars */}
            {(isLapOrRobotic || state.surgical_approach === 'hybrid') && (() => {
              const trocarItems = byCategory(['trocars'])
              const defaultTrocar = trocarItems.find(e => e.name.toLowerCase().includes('5mm')) ?? trocarItems[0]
              return (
                <QuestionCard
                  question="Were trocars placed?"
                  hint="Select all trocar sizes used"
                  answered={answers['trocars'] ?? null}
                  onNo={() => answerNo('trocars', ['trocars'])}
                  onYes={() => answerYes('trocars', defaultTrocar)}
                  yesLabel="Yes — select sizes below">
                  {trocarItems.map(eq => (
                    <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg}
                      quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                  ))}
                </QuestionCard>
              )
            })()}

            {/* Scope */}
            {isLapOrRobotic && (() => {
              const scopeItems = byCategory(['scope'])
              const item = scopeItems[0]
              return (
                <QuestionCard
                  question="What scope was used?"
                  hint="Laparoscope or robotic camera"
                  answered={answers['scope'] ?? null}
                  onNo={() => answerNo('scope', ['scope'])}
                  onYes={() => answerYes('scope', item)}
                  yesLabel={item ? `Yes — ${item.name} · ${item.emission_factor_kg.toFixed(2)} kg` : 'Yes'}>
                  {scopeItems.map(eq => (
                    <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg}
                      quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                  ))}
                </QuestionCard>
              )
            })()}

            {/* Robotic docking */}
            {isRobotic && (() => {
              const roboticItems = byCategory(['robotic'])
              const item = roboticItems[0]
              return (
                <QuestionCard
                  question="Was the robot docked?"
                  hint="DaVinci system — select instruments used"
                  answered={answers['robotic'] ?? null}
                  onNo={() => answerNo('robotic', ['robotic'])}
                  onYes={() => answerYes('robotic', item)}
                  yesLabel="Yes — select robotic instruments">
                  {roboticItems.map(eq => (
                    <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg}
                      quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                  ))}
                </QuestionCard>
              )
            })()}

            {/* Open approach — wound protector / retractors */}
            {(state.surgical_approach === 'open' || state.surgical_approach === 'hybrid') && (() => {
              const item = findByName('wound protector') ?? findByName('alexis') ?? findByName('retractor')
              return (
                <QuestionCard
                  question="Were wound retractors or protectors used?"
                  hint="Hand-held retractors, self-retaining systems, or wound protector sleeves"
                  answered={answers['retractors'] ?? null}
                  onNo={() => answerNo('retractors', ['retractors'])}
                  onYes={() => answerYes('retractors', item)}
                  yesLabel={item ? `Yes — ${item.name} · ${item.emission_factor_kg.toFixed(2)} kg` : 'Yes'}>
                  {item && (
                    <ItemCard name={item.name} emissionKg={item.emission_factor_kg}
                      quantity={getItemQty(item.id)} onAdd={() => addItem(item)} onRemove={() => removeItem(item)} />
                  )}
                  {byCategory(['retractors']).filter(e => e.id !== item?.id).map(eq => (
                    <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg}
                      quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                  ))}
                </QuestionCard>
              )
            })()}

            {/* Irrigation */}
            {(() => {
              const item = findByName('irrigat') ?? findByName('suction') ?? findByName('yankauer')
              return (
                <QuestionCard
                  question="Was a suction/irrigation device used?"
                  hint="Suction-irrigation wand, Yankauer, or laparoscopic sucker"
                  answered={answers['suction_irrig'] ?? null}
                  onNo={() => answerNo('suction_irrig')}
                  onYes={() => answerYes('suction_irrig', item)}
                  yesLabel={item ? `Yes — ${item.name} · ${item.emission_factor_kg.toFixed(2)} kg` : 'Yes'}>
                  {item && (
                    <ItemCard name={item.name} emissionKg={item.emission_factor_kg}
                      quantity={getItemQty(item.id)} onAdd={() => addItem(item)} onRemove={() => removeItem(item)} />
                  )}
                </QuestionCard>
              )
            })()}
          </div>
        )}

        {/* ── Step 4: Intraop ── */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-green-900 tracking-tight">Intraoperative</h2>
              <p className="text-sm text-green-700/50 mt-1">Energy, staplers, clips, and supplies</p>
            </div>

            {/* Energy */}
            {(() => {
              const energyItems = byCategory(['energy'])
              const item = energyItems.find(e => e.name.toLowerCase().includes('bovie') || e.name.toLowerCase().includes('electrosurgical')) ?? energyItems[0]
              return (
                <QuestionCard
                  question="Was energy used?"
                  hint="Electrosurgical (bovie), ultrasonic (harmonic), laser, or bipolar"
                  answered={answers['energy'] ?? null}
                  onNo={() => answerNo('energy', ['energy'])}
                  onYes={() => answerYes('energy', item)}
                  yesLabel="Yes — select devices used">
                  {energyItems.map(eq => (
                    <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg}
                      quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                  ))}
                </QuestionCard>
              )
            })()}

            {/* Staplers */}
            {(() => {
              const staplerItems = byCategory(['staplers'])
              const item = staplerItems[0]
              return (
                <QuestionCard
                  question="Were staplers used?"
                  hint="Endo-GIA, linear, or circular staplers"
                  answered={answers['staplers'] ?? null}
                  onNo={() => answerNo('staplers', ['staplers'])}
                  onYes={() => answerYes('staplers', item)}
                  yesLabel="Yes — select stapler type and count">
                  {staplerItems.map(eq => (
                    <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg}
                      quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                  ))}
                </QuestionCard>
              )
            })()}

            {/* Clips */}
            {(() => {
              const clipItems = byCategory(['clips'])
              const item = clipItems[0]
              return (
                <QuestionCard
                  question="Were clips applied?"
                  hint="Hemoclips, Ligaclips, or locking clips (e.g. Hem-o-lok)"
                  answered={answers['clips'] ?? null}
                  onNo={() => answerNo('clips', ['clips'])}
                  onYes={() => answerYes('clips', item)}
                  yesLabel="Yes — select clip type">
                  {clipItems.map(eq => (
                    <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg}
                      quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                  ))}
                </QuestionCard>
              )
            })()}

            {/* Sutures */}
            {(() => {
              const sutureItems = byCategory(['sutures'])
              const item = sutureItems[0]
              return (
                <QuestionCard
                  question="Were sutures used intraoperatively?"
                  hint="Absorbable or permanent sutures for hemostasis or anastomosis"
                  answered={answers['sutures_intraop'] ?? null}
                  onNo={() => answerNo('sutures_intraop', ['sutures'])}
                  onYes={() => answerYes('sutures_intraop', item)}
                  yesLabel="Yes — select suture type">
                  {sutureItems.map(eq => (
                    <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg}
                      quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                  ))}
                </QuestionCard>
              )
            })()}

            {/* Mesh */}
            {(() => {
              const item = findByName('mesh')
              return (
                <QuestionCard
                  question="Was mesh implanted?"
                  hint="Synthetic or biologic mesh for hernia repair, prolapse, etc."
                  answered={answers['mesh'] ?? null}
                  onNo={() => answerNo('mesh', ['mesh'])}
                  onYes={() => answerYes('mesh', item)}
                  yesLabel={item ? `Yes — ${item.name} · ${item.emission_factor_kg.toFixed(2)} kg` : 'Yes'}>
                  {item && (
                    <ItemCard name={item.name} emissionKg={item.emission_factor_kg}
                      quantity={getItemQty(item.id)} onAdd={() => addItem(item)} onRemove={() => removeItem(item)} />
                  )}
                  {byCategory(['mesh', 'implant']).filter(e => e.id !== item?.id).map(eq => (
                    <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg}
                      quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                  ))}
                </QuestionCard>
              )
            })()}

            {/* Specimen retrieval */}
            {(() => {
              const specimenItems = byCategory(['specimen'])
              const item = specimenItems[0]
              return (
                <QuestionCard
                  question="Was a specimen retrieved?"
                  hint="Specimen bag for safe extraction"
                  answered={answers['specimen'] ?? null}
                  onNo={() => answerNo('specimen', ['specimen'])}
                  onYes={() => answerYes('specimen', item)}
                  yesLabel={item ? `Yes — ${item.name} · ${item.emission_factor_kg.toFixed(2)} kg` : 'Yes'}>
                  {specimenItems.map(eq => (
                    <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg}
                      quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                  ))}
                </QuestionCard>
              )
            })()}

            {/* Vessel loops / silastic */}
            {(() => {
              const item = findByName('vessel loop') ?? findByName('silastic') ?? findByName('penrose')
              return (
                <QuestionCard
                  question="Were vessel loops or silastic drains used?"
                  hint="Vessel loops, Penrose drains, or silastic tubing for retraction"
                  answered={answers['vessel_loops'] ?? null}
                  onNo={() => answerNo('vessel_loops')}
                  onYes={() => answerYes('vessel_loops', item)}
                  yesLabel={item ? `Yes — ${item.name} · ${item.emission_factor_kg.toFixed(2)} kg` : 'Yes'}>
                  {item && (
                    <ItemCard name={item.name} emissionKg={item.emission_factor_kg}
                      quantity={getItemQty(item.id)} onAdd={() => addItem(item)} onRemove={() => removeItem(item)} />
                  )}
                </QuestionCard>
              )
            })()}

            {/* Irrigation intraop */}
            <QuestionCard
              question="Was the field irrigated?"
              hint="Warm saline, antibiotic irrigation, or betadine wash"
              answered={answers['irrigation'] ?? null}
              onNo={() => answerNo('irrigation')}
              onYes={() => answerYes('irrigation')}
            />
          </div>
        )}

        {/* ── Step 5: Closure ── */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-green-900 tracking-tight">Closure</h2>
              <p className="text-sm text-green-700/50 mt-1">Wound closure, drains, and dressings</p>
            </div>

            {/* Drains placed */}
            {(() => {
              const item = findByName('drain') ?? findByName('jackson') ?? findByName('blake')
              return (
                <QuestionCard
                  question="Were closed-suction drains placed?"
                  hint="Jackson-Pratt, Blake drain, or similar"
                  answered={answers['drains'] ?? null}
                  onNo={() => answerNo('drains', ['drains'])}
                  onYes={() => answerYes('drains', item)}
                  yesLabel={item ? `Yes — ${item.name} · ${item.emission_factor_kg.toFixed(2)} kg` : 'Yes'}>
                  {item && (
                    <ItemCard name={item.name} emissionKg={item.emission_factor_kg}
                      quantity={getItemQty(item.id)} onAdd={() => addItem(item)} onRemove={() => removeItem(item)} />
                  )}
                  {byCategory(['drains']).filter(e => e.id !== item?.id).map(eq => (
                    <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg}
                      quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                  ))}
                </QuestionCard>
              )
            })()}

            {/* Fascial closure */}
            {(() => {
              const closureItems = byCategory(['closure'])
              const fascia = closureItems.find(e => e.name.toLowerCase().includes('fascial') || e.name.toLowerCase().includes('loop')) ?? closureItems[0]
              return (
                <QuestionCard
                  question="Was the fascia closed?"
                  hint="Running or interrupted fascial sutures"
                  answered={answers['fascia'] ?? null}
                  onNo={() => answerNo('fascia')}
                  onYes={() => answerYes('fascia', fascia)}
                  yesLabel={fascia ? `Yes — ${fascia.name} · ${fascia.emission_factor_kg.toFixed(2)} kg` : 'Yes'}>
                  {closureItems.map(eq => (
                    <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg}
                      quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                  ))}
                </QuestionCard>
              )
            })()}

            {/* Skin closure */}
            {(() => {
              const item = findByName('staple') ?? findByName('skin closure') ?? findByName('prolene') ?? findByName('monocryl')
              return (
                <QuestionCard
                  question="How was the skin closed?"
                  hint="Subcuticular suture, staples, or interrupted sutures"
                  answered={answers['skin_closure'] ?? null}
                  onNo={() => answerNo('skin_closure')}
                  onYes={() => answerYes('skin_closure', item)}
                  yesLabel="Yes — select closure method">
                  {item && (
                    <ItemCard name={item.name} emissionKg={item.emission_factor_kg}
                      quantity={getItemQty(item.id)} onAdd={() => addItem(item)} onRemove={() => removeItem(item)} />
                  )}
                  {byCategory(['skin_closure', 'staples']).filter(e => e.id !== item?.id).map(eq => (
                    <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg}
                      quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                  ))}
                </QuestionCard>
              )
            })()}

            {/* Closure strips */}
            {(() => {
              const item = findByName('steri') ?? findByName('closure strip') ?? findByName('steristrip')
              return (
                <QuestionCard
                  question="Were wound closure strips applied?"
                  hint="Steri-strips or adhesive closure strips over incision"
                  answered={answers['closure_strips'] ?? null}
                  onNo={() => answerNo('closure_strips')}
                  onYes={() => answerYes('closure_strips', item)}
                  yesLabel={item ? `Yes — ${item.name} · ${item.emission_factor_kg.toFixed(2)} kg` : 'Yes'}>
                  {item && (
                    <ItemCard name={item.name} emissionKg={item.emission_factor_kg}
                      quantity={getItemQty(item.id)} onAdd={() => addItem(item)} onRemove={() => removeItem(item)} />
                  )}
                </QuestionCard>
              )
            })()}

            {/* Wound dressing */}
            {(() => {
              const item = findByName('dressing') ?? findByName('tegaderm') ?? findByName('gauze')
              return (
                <QuestionCard
                  question="Was a wound dressing applied?"
                  hint="Gauze, Tegaderm, foam dressing, or wound vac"
                  answered={answers['dressing'] ?? null}
                  onNo={() => answerNo('dressing', ['dressings'])}
                  onYes={() => answerYes('dressing', item)}
                  yesLabel={item ? `Yes — ${item.name} · ${item.emission_factor_kg.toFixed(2)} kg` : 'Yes'}>
                  {item && (
                    <ItemCard name={item.name} emissionKg={item.emission_factor_kg}
                      quantity={getItemQty(item.id)} onAdd={() => addItem(item)} onRemove={() => removeItem(item)} />
                  )}
                  {byCategory(['dressings']).filter(e => e.id !== item?.id).map(eq => (
                    <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg}
                      quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                  ))}
                </QuestionCard>
              )
            })()}

            {/* Wound vac */}
            {(() => {
              const item = findByName('wound vac') ?? findByName('npwt') ?? findByName('vacuum')
              return (
                <QuestionCard
                  question="Was negative pressure wound therapy (wound vac) applied?"
                  hint="NPWT for complex or high-risk wounds"
                  answered={answers['wound_vac'] ?? null}
                  onNo={() => answerNo('wound_vac')}
                  onYes={() => answerYes('wound_vac', item)}
                  yesLabel={item ? `Yes — ${item.name} · ${item.emission_factor_kg.toFixed(2)} kg` : 'Yes'}>
                  {item && (
                    <ItemCard name={item.name} emissionKg={item.emission_factor_kg}
                      quantity={getItemQty(item.id)} onAdd={() => addItem(item)} onRemove={() => removeItem(item)} />
                  )}
                </QuestionCard>
              )
            })()}
          </div>
        )}

        {/* ── Step 6: Anesthesia ── */}
        {step === 6 && (
          <div className="space-y-6">
            <div className="text-center mb-2">
              <h2 className="text-2xl font-bold text-green-900 tracking-tight">Anesthesia</h2>
              <p className="text-sm text-green-700/50 mt-1">Duration, type, and agent</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-green-900 mb-2">
                Case duration (minutes) <span className="text-red-400">*</span>
              </label>
              <input type="number" min="1"
                value={state.duration_minutes || ''}
                onChange={(e) => setState((s) => ({ ...s, duration_minutes: e.target.value ? parseInt(e.target.value) : null }))}
                placeholder="e.g. 90" className="input-base" />
            </div>

            {/* Regional nerve block */}
            {(() => {
              const item = findByName('nerve block') ?? findByName('regional')
              return (
                <QuestionCard
                  question="Was a regional nerve block performed?"
                  hint="TAP block, spinal, epidural, or peripheral nerve block"
                  answered={answers['nerve_block'] ?? null}
                  onNo={() => answerNo('nerve_block')}
                  onYes={() => answerYes('nerve_block', item)}
                  yesLabel={item ? `Yes — ${item.name} · ${item.emission_factor_kg.toFixed(2)} kg` : 'Yes'}>
                  {item && (
                    <ItemCard name={item.name} emissionKg={item.emission_factor_kg}
                      quantity={getItemQty(item.id)} onAdd={() => addItem(item)} onRemove={() => removeItem(item)} />
                  )}
                  {byCategory(['regional', 'nerve_block']).filter(e => e.id !== item?.id).map(eq => (
                    <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg}
                      quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                  ))}
                </QuestionCard>
              )
            })()}

            <div>
              <label className="block text-sm font-bold text-green-900 mb-3">
                Anesthesia type <span className="text-red-400">*</span>
              </label>
              <ChipSelect options={ANESTHESIA_TYPES} selected={state.anesthesia_type}
                onSelect={(v) => setState((s) => ({ ...s, anesthesia_type: v }))} />
            </div>

            <div>
              <label className="block text-sm font-bold text-green-900 mb-3">
                Anesthetic agent <span className="text-red-400">*</span>
              </label>
              <ChipSelect options={ANESTHESIA_GASES} selected={state.anesthesia_gas}
                onSelect={(v) => setState((s) => ({ ...s, anesthesia_gas: v }))} />
            </div>

            <div>
              <label className="block text-sm font-bold text-green-900 mb-2">
                Notes <span className="text-green-700/40 font-normal">(optional)</span>
              </label>
              <textarea value={state.notes}
                onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
                rows={3} placeholder="Any additional context..."
                className="input-base resize-none" />
            </div>
          </div>
        )}

        {/* ── Step 7: Review ── */}
        {step === 7 && (
          <div className="space-y-5">
            <div className="text-center mb-2">
              <h2 className="text-2xl font-bold text-green-900 tracking-tight">Review & Submit</h2>
              <p className="text-sm text-green-700/50 mt-1">Confirm everything looks right</p>
            </div>

            <div className={`p-6 rounded-2xl text-center border-[1.5px] ${
              totalEmissions < 4 ? 'bg-green-50 border-green-200' :
              totalEmissions <= 8 ? 'bg-amber-50 border-amber-200' :
              'bg-red-50 border-red-200'
            }`}>
              <div className="text-xs text-green-700/50 font-medium uppercase tracking-wide mb-2">Total Case Emissions</div>
              <div className={`text-4xl font-bold ${emColor(totalEmissions)}`}>{fmtEmissions(totalEmissions)}</div>
            </div>

            <div className="card p-5">
              <div className="text-xs font-bold text-green-700/40 uppercase tracking-wide mb-2">Procedure</div>
              <div className="font-semibold text-green-900">{state.cpt_code} — {state.procedure_name}</div>
              <div className="text-sm text-green-700/60 capitalize mt-0.5">{state.surgical_approach}</div>
            </div>

            {state.items.length > 0 && (
              <div className="card p-5">
                <div className="text-xs font-bold text-green-700/40 uppercase tracking-wide mb-3">Equipment & Supplies</div>
                <div className="space-y-2">
                  {state.items.map((item) => (
                    <div key={item.equipment_id} className="flex justify-between text-sm">
                      <span className="text-green-700/70">{item.name} × {item.quantity}</span>
                      <span className={`font-semibold ${emColor(item.quantity * item.emission_factor_kg)}`}>
                        {fmtEmissions(item.quantity * item.emission_factor_kg)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {state.sets.length > 0 && (
              <div className="card p-5">
                <div className="text-xs font-bold text-green-700/40 uppercase tracking-wide mb-3">Instrument Trays</div>
                <div className="space-y-2">
                  {state.sets.map((set) => (
                    <div key={set.instrument_set_id} className="flex justify-between text-sm">
                      <span className="text-green-700/70">{set.name} × {set.quantity}</span>
                      <span className={`font-semibold ${emColor(set.quantity * set.per_use_emission_kg)}`}>
                        {fmtEmissions(set.quantity * set.per_use_emission_kg)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card p-5">
              <div className="text-xs font-bold text-green-700/40 uppercase tracking-wide mb-2">Anesthesia</div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-green-700/50 text-xs">Duration</div>
                  <div className="font-semibold text-green-900">{state.duration_minutes || '—'} min</div>
                </div>
                <div>
                  <div className="text-green-700/50 text-xs">Type</div>
                  <div className="font-semibold text-green-900 capitalize">{state.anesthesia_type || '—'}</div>
                </div>
                <div>
                  <div className="text-green-700/50 text-xs">Agent</div>
                  <div className="font-semibold text-green-900 capitalize">
                    {state.anesthesia_gas === 'tiva' ? 'TIVA' : state.anesthesia_gas === 'mac' ? 'MAC' : state.anesthesia_gas || '—'}
                  </div>
                </div>
              </div>
            </div>

            {!canSubmit && (
              <p className="text-xs text-red-400 text-center font-medium">
                Complete duration, anesthesia type, and agent before submitting.
              </p>
            )}

            <button onClick={handleSubmit} disabled={!canSubmit || submitting}
              className="btn-primary w-full !py-4 !text-base">
              {submitting ? 'Submitting...' : 'Submit Case'}
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-6">
        {step > 0 && (
          <button onClick={goBack} className="btn-secondary flex-1">Back</button>
        )}
        {step > 0 && step < TOTAL_STEPS - 1 && (
          <button onClick={goForward} className="btn-primary flex-1">Next</button>
        )}
      </div>
    </div>
  )
}
