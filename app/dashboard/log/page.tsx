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

type AnswerVal = 'yes' | 'no' | 'custom' | null

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
// Three-button pattern: No / Yes — [default item] / Yes + other equipment
function QuestionCard({
  question,
  hint,
  answered,
  onNo,
  onYes,
  onOther,
  yesLabel,        // label for the quick-Yes button (e.g. "Yes — Foley Kit · 0.45 kg")
  otherLabel,      // label for the picker button (default: "Yes + other equipment")
  noOther = false, // hide the "other" button entirely (for simple yes/no questions)
  children,        // shown when answered === 'custom'
}: {
  question: string
  hint?: string
  answered: AnswerVal
  onNo: () => void
  onYes?: () => void
  onOther: () => void
  yesLabel?: string
  otherLabel?: string
  noOther?: boolean
  children?: React.ReactNode
}) {
  const isYes = answered === 'yes'
  const isNo = answered === 'no'
  const isOther = answered === 'custom'
  const isActive = isYes || isOther

  return (
    <div className={`rounded-xl border-[1.5px] overflow-hidden transition-all ${
      isActive ? 'border-green-300' : isNo ? 'border-beige-200 opacity-60' : 'border-beige-200'
    }`}>
      <div className={`p-4 ${isActive ? 'bg-green-50/40' : isNo ? 'bg-beige-50/50' : 'bg-white'}`}>
        <div className="text-sm font-semibold text-green-900 leading-snug">{question}</div>
        {hint && <div className="text-xs text-green-700/40 mt-0.5">{hint}</div>}
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {/* No */}
          <button onClick={onNo}
            className={`px-4 py-2 rounded-lg text-sm font-semibold tap-scale transition-all ${
              isNo ? 'bg-green-900/10 text-green-900 ring-1 ring-green-900/15' : 'bg-beige-100 text-green-800/60 hover:bg-beige-200'
            }`}>
            No
          </button>
          {/* Yes (quick, adds default item) */}
          {yesLabel && onYes && (
            <button onClick={onYes}
              className={`flex-1 min-w-0 px-3 py-2 rounded-lg text-sm font-semibold tap-scale transition-all truncate ${
                isYes ? 'bg-green-900 text-white shadow-sm' : 'bg-beige-100 text-green-800/60 hover:bg-beige-200'
              }`}>
              {yesLabel}
            </button>
          )}
          {/* Yes + other equipment (opens full category picker) */}
          {!noOther && (
            <button onClick={onOther}
              className={`px-4 py-2 rounded-lg text-sm font-semibold tap-scale transition-all whitespace-nowrap ${
                isOther ? 'bg-green-700 text-white shadow-sm' : 'bg-beige-100 text-green-800/60 hover:bg-beige-200'
              }`}>
              {otherLabel ?? (yesLabel ? 'Yes + other' : 'Yes — select')}
            </button>
          )}
        </div>
      </div>
      {/* Equipment picker — shown when custom/other selected */}
      {isOther && children && (
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
  const [answers, setAnswers] = useState<Record<string, AnswerVal>>({})
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

  const addItem = useCallback((eq: Equipment) =>
    setState((s) => ({ ...s, items: updateItems(s.items, eq, 1) })), [])
  const removeItem = useCallback((eq: Equipment) =>
    setState((s) => ({ ...s, items: updateItems(s.items, eq, -1) })), [])
  const addSet = useCallback((is: InstrumentSet) =>
    setState((s) => ({ ...s, sets: updateSets(s.sets, is, 1) })), [])
  const removeSet = useCallback((is: InstrumentSet) =>
    setState((s) => ({ ...s, sets: updateSets(s.sets, is, -1) })), [])

  // Equipment lookup helpers — match exact DB category names (case-sensitive)
  const byCategory = useCallback((cats: string[]) =>
    equipment.filter((e) => cats.includes(e.category)), [equipment])

  const findByName = useCallback((keyword: string) =>
    equipment.find((e) => e.name.toLowerCase().includes(keyword.toLowerCase())), [equipment])

  // ── Answer handlers ──
  // "Yes" — quick-adds one default item, sets answered='yes'
  const answerYes = useCallback((id: string, defaultItem?: Equipment, clearCats?: string[]) => {
    setAnswers((a) => ({ ...a, [id]: 'yes' }))
    if (clearCats && clearCats.length > 0) {
      const removeIds = new Set(equipment.filter((e) => clearCats.includes(e.category) && e.id !== defaultItem?.id).map((e) => e.id))
      setState((s) => ({
        ...s,
        items: [
          ...s.items.filter((i) => !removeIds.has(i.equipment_id)),
          ...(defaultItem && !s.items.find((i) => i.equipment_id === defaultItem.id)
            ? [{ equipment_id: defaultItem.id, name: defaultItem.name, quantity: 1, emission_factor_kg: defaultItem.emission_factor_kg }]
            : []),
        ],
      }))
    } else if (defaultItem) {
      setState((s) => ({
        ...s,
        items: s.items.find((i) => i.equipment_id === defaultItem.id)
          ? s.items
          : [...s.items, { equipment_id: defaultItem.id, name: defaultItem.name, quantity: 1, emission_factor_kg: defaultItem.emission_factor_kg }],
      }))
    }
  }, [equipment])

  // "No" — clears all items from the given categories
  const answerNo = useCallback((id: string, clearCats?: string[]) => {
    setAnswers((a) => ({ ...a, [id]: 'no' }))
    if (clearCats && clearCats.length > 0) {
      const removeIds = new Set(equipment.filter((e) => clearCats.includes(e.category)).map((e) => e.id))
      setState((s) => ({ ...s, items: s.items.filter((i) => !removeIds.has(i.equipment_id)) }))
    }
  }, [equipment])

  // "Yes + other equipment" — opens picker without auto-adding anything
  const answerOther = useCallback((id: string) => {
    setAnswers((a) => ({ ...a, [id]: 'custom' }))
  }, [])

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
  const isOpen = state.surgical_approach === 'open' || state.surgical_approach === 'hybrid'

  // Shorthand for rendering all ItemCards for a list of equipment
  const renderItems = (items: Equipment[]) => items.map((eq) => (
    <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg}
      quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
  ))

  return (
    <div className="max-w-xl mx-auto">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-3">
          {STEP_LABELS.map((label, i) => (
            <button key={i}
              onClick={() => { if (i < step) { setDirection('back'); setStep(i) } }}
              className={`text-[9px] sm:text-[11px] font-semibold transition-all ${
                i === step ? 'text-green-900' : i < step ? 'text-green-500 cursor-pointer hover:text-green-700' : 'text-beige-300'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <div className="h-1.5 bg-beige-200 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${((step + 1) / TOTAL_STEPS) * 100}%`,
              background: 'linear-gradient(90deg, #74C69D 0%, #40916C 60%, #2D6A4F 100%)',
              boxShadow: '0 0 6px rgba(64, 145, 108, 0.4)',
            }} />
        </div>
      </div>

      {/* Running total */}
      {step >= 1 && (
        <div className="animate-fade-in mb-5 card card-accent-top p-3.5 flex items-center justify-between">
          <span className="text-xs font-medium text-green-700/50 uppercase tracking-wide">Running Total</span>
          <span className={`text-lg font-bold ${emColor(totalEmissions)}`}>{fmtEmissions(totalEmissions)}</span>
        </div>
      )}

      {/* Step content */}
      <div key={step} className={direction === 'forward' ? 'animate-slide-right' : 'animate-slide-left'}>

        {/* ══ Step 0: Procedure ══ */}
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

        {/* ══ Step 1: Pre-op ══ */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-green-900 tracking-tight">Pre-op</h2>
              <p className="text-sm text-green-700/50 mt-1">Lines, catheters, and patient setup</p>
            </div>

            {/* Foley */}
            {(() => {
              const def = byCategory(['Catheter'])[0]
              return (
                <QuestionCard
                  question="Was a Foley catheter placed?"
                  hint="Includes drainage bag and catheter kit"
                  answered={answers['foley'] ?? null}
                  onNo={() => answerNo('foley', ['Catheter'])}
                  onYes={def ? () => answerYes('foley', def, ['Catheter']) : undefined}
                  yesLabel={def ? `Yes — ${def.name} · ${def.emission_factor_kg.toFixed(2)} kg` : undefined}
                  onOther={() => answerOther('foley')}>
                  {renderItems(byCategory(['Catheter']))}
                </QuestionCard>
              )
            })()}

            {/* Arterial line */}
            {(() => {
              const aLine = findByName('Arterial line kit')
              return (
                <QuestionCard
                  question="Was an arterial line placed?"
                  hint="A-line for continuous hemodynamic monitoring — includes catheter, pressure tubing, and transducer"
                  answered={answers['aline'] ?? null}
                  onNo={() => answerNo('aline')}
                  onYes={aLine ? () => answerYes('aline', aLine) : undefined}
                  yesLabel={aLine ? `Yes — ${aLine.name} · ${aLine.emission_factor_kg.toFixed(2)} kg` : undefined}
                  onOther={() => answerOther('aline')}>
                  {renderItems(byCategory(['Vascular Access']).filter(e => e.name.toLowerCase().includes('arterial')))}
                </QuestionCard>
              )
            })()}

            {/* Central line */}
            {(() => {
              const def = findByName('triple lumen')
              return (
                <QuestionCard
                  question="Was a central venous catheter placed?"
                  hint="Triple lumen CVL, single lumen, introducer sheath, or PICC"
                  answered={answers['cvl'] ?? null}
                  onNo={() => answerNo('cvl')}
                  onYes={def ? () => answerYes('cvl', def) : undefined}
                  yesLabel={def ? `Yes — ${def.name} · ${def.emission_factor_kg.toFixed(2)} kg` : undefined}
                  onOther={() => answerOther('cvl')}>
                  {renderItems(byCategory(['Vascular Access']).filter(e =>
                    !e.name.toLowerCase().includes('arterial') && !e.name.toLowerCase().includes('peripheral iv')
                  ))}
                </QuestionCard>
              )
            })()}

            {/* Peripheral IV */}
            {(() => {
              const def = findByName('Peripheral IV')
              return (
                <QuestionCard
                  question="Were peripheral IVs placed?"
                  hint="Angiocath IV catheters — count all that were placed"
                  answered={answers['piv'] ?? null}
                  onNo={() => answerNo('piv')}
                  onYes={def ? () => answerYes('piv', def) : undefined}
                  yesLabel={def ? `Yes — ${def.name} · ${def.emission_factor_kg.toFixed(2)} kg` : undefined}
                  onOther={() => answerOther('piv')}>
                  {renderItems(byCategory(['Vascular Access']).filter(e => e.name.toLowerCase().includes('peripheral')))}
                </QuestionCard>
              )
            })()}

            {/* Patient warming */}
            {(() => {
              const def = findByName('Forced air warming blanket')
              return (
                <QuestionCard
                  question="Was a patient warming device used?"
                  hint="Forced-air warming blanket (Bair Hugger), warming gown, or fluid warmer"
                  answered={answers['warming'] ?? null}
                  onNo={() => answerNo('warming', ['Warming'])}
                  onYes={def ? () => answerYes('warming', def, ['Warming']) : undefined}
                  yesLabel={def ? `Yes — Bair Hugger · ${def.emission_factor_kg.toFixed(2)} kg` : undefined}
                  onOther={() => answerOther('warming')}>
                  {renderItems(byCategory(['Warming']))}
                </QuestionCard>
              )
            })()}

            {/* SCDs */}
            {(() => {
              const def = findByName('SCD compression sleeves')
              return (
                <QuestionCard
                  question="Were SCDs applied?"
                  hint="Sequential compression devices for DVT prophylaxis"
                  answered={answers['scd'] ?? null}
                  onNo={() => answerNo('scd')}
                  onYes={def ? () => answerYes('scd', def) : undefined}
                  yesLabel={def ? `Yes — ${def.name} · ${def.emission_factor_kg.toFixed(2)} kg` : 'Yes'}
                  onOther={() => answerOther('scd')}
                  noOther={!def}>
                  {def && renderItems([def])}
                </QuestionCard>
              )
            })()}

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

        {/* ══ Step 2: Draping & Prep ══ */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-green-900 tracking-tight">Draping & prep</h2>
              <p className="text-sm text-green-700/50 mt-1">Drapes, gowns, grounding, and surgical prep</p>
            </div>

            {/* Drape pack — which type */}
            {(() => {
              const drapeItems = byCategory(['Drapes']).filter(e => !e.name.toLowerCase().includes('gown'))
              // suggest the most common drape based on approach
              const def = isRobotic
                ? drapeItems.find(e => e.name.toLowerCase().includes('robotic'))
                : isLapOrRobotic
                  ? drapeItems.find(e => e.name.toLowerCase().includes('lap'))
                  : drapeItems.find(e => e.name.toLowerCase().includes('laparotomy'))
                ?? drapeItems[0]
              return (
                <QuestionCard
                  question="Which drape pack was used?"
                  hint="Select the drape pack(s) opened — use + for multiple"
                  answered={answers['drapes'] ?? null}
                  onNo={() => answerNo('drapes', ['Drapes'])}
                  onYes={def ? () => answerYes('drapes', def, ['Drapes']) : undefined}
                  yesLabel={def ? `Yes — ${def.name} · ${def.emission_factor_kg.toFixed(2)} kg` : undefined}
                  onOther={() => answerOther('drapes')}>
                  {renderItems(drapeItems)}
                </QuestionCard>
              )
            })()}

            {/* Gowns — disposable vs reusable, how many */}
            {(() => {
              const gownItems = byCategory(['Drapes']).filter(e => e.name.toLowerCase().includes('gown'))
              const disposableGown = gownItems.find(e => e.name.toLowerCase().includes('disposable'))
              return (
                <QuestionCard
                  question="Were disposable or reusable sterile gowns used?"
                  hint="Add one per scrubbed team member — disposable vs. reusable has a big emissions difference"
                  answered={answers['gowns'] ?? null}
                  onNo={() => answerNo('gowns')}
                  onYes={disposableGown ? () => answerYes('gowns', disposableGown) : undefined}
                  yesLabel={disposableGown ? `Yes — Disposable gown · ${disposableGown.emission_factor_kg.toFixed(2)} kg each` : undefined}
                  onOther={() => answerOther('gowns')}>
                  {renderItems(gownItems)}
                </QuestionCard>
              )
            })()}

            {/* Grounding pad */}
            {(() => {
              const def = byCategory(['Grounding'])[0]
              return (
                <QuestionCard
                  question="Was an electrosurgical grounding pad placed?"
                  hint="Bovie return electrode / ESU dispersive pad"
                  answered={answers['grounding'] ?? null}
                  onNo={() => answerNo('grounding', ['Grounding'])}
                  onYes={def ? () => answerYes('grounding', def, ['Grounding']) : undefined}
                  yesLabel={def ? `Yes — ${def.name} · ${def.emission_factor_kg.toFixed(2)} kg` : 'Yes'}
                  onOther={() => answerOther('grounding')}
                  noOther={!def || byCategory(['Grounding']).length <= 1}>
                  {renderItems(byCategory(['Grounding']))}
                </QuestionCard>
              )
            })()}

            {/* Surgical prep */}
            {(() => {
              const prepItems = byCategory(['Prep'])
              const def = prepItems.find(e => e.name.toLowerCase().includes('chloraprep')) ?? prepItems[0]
              return (
                <QuestionCard
                  question="Which surgical prep was used?"
                  hint="Antiseptic for surgical site preparation"
                  answered={answers['prep'] ?? null}
                  onNo={() => answerNo('prep', ['Prep'])}
                  onYes={def ? () => answerYes('prep', def, ['Prep']) : undefined}
                  yesLabel={def ? `Yes — ${def.name} · ${def.emission_factor_kg.toFixed(2)} kg` : undefined}
                  onOther={() => answerOther('prep')}>
                  {renderItems(prepItems)}
                </QuestionCard>
              )
            })()}

            {/* Patient positioning */}
            {(() => {
              const posItems = byCategory(['Positioning']).filter(e => !e.name.toLowerCase().includes('scd'))
              const def = posItems.find(e => e.name.toLowerCase().includes('gel')) ?? posItems[0]
              return (
                <QuestionCard
                  question="Were special positioning aids used?"
                  hint="Gel pads, bean bag, lithotomy stirrups, shoulder roll, etc."
                  answered={answers['positioning'] ?? null}
                  onNo={() => answerNo('positioning')}
                  onYes={def ? () => answerYes('positioning', def) : undefined}
                  yesLabel={def ? `Yes — ${def.name} · ${def.emission_factor_kg.toFixed(2)} kg` : undefined}
                  onOther={() => answerOther('positioning')}>
                  {renderItems(posItems)}
                </QuestionCard>
              )
            })()}
          </div>
        )}

        {/* ══ Step 3: Access ══ */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-green-900 tracking-tight">Access</h2>
              <p className="text-sm text-green-700/50 mt-1">Entry technique, trocars, and scope</p>
            </div>

            {/* CO2 insufflation — lap/robotic */}
            {isLapOrRobotic && (() => {
              const co2Items = byCategory(['Insufflation'])
              const def = co2Items.find(e => e.name.toLowerCase().includes('co2')) ?? co2Items[0]
              return (
                <QuestionCard
                  question="Was CO2 insufflation used?"
                  hint="Pneumoperitoneum for laparoscopic access — includes insufflation tubing"
                  answered={answers['co2'] ?? null}
                  onNo={() => answerNo('co2', ['Insufflation'])}
                  onYes={def ? () => answerYes('co2', def) : undefined}
                  yesLabel={def ? `Yes — ${def.name} · ${def.emission_factor_kg.toFixed(2)} kg` : undefined}
                  onOther={() => answerOther('co2')}>
                  {renderItems(co2Items)}
                </QuestionCard>
              )
            })()}

            {/* Entry technique + working trocars */}
            {(() => {
              const trocarItems = byCategory(['Trocar'])
              // Group entry devices vs working trocars for the label
              const entryDef = trocarItems.find(e =>
                e.name.toLowerCase().includes('hasson') || e.name.toLowerCase().includes('optical')
              ) ?? trocarItems.find(e => e.name.toLowerCase().includes('12mm'))
              const question = isLapOrRobotic
                ? 'What trocars were placed? (including entry)'
                : isOpen
                  ? 'Were trocars or access devices used?'
                  : 'Were trocars placed?'
              const hint = isLapOrRobotic
                ? 'Include entry trocar (Veress, Hasson, optical) and all working trocars — use + for each'
                : 'Select any trocars or access devices used'
              return (
                <QuestionCard
                  question={question}
                  hint={hint}
                  answered={answers['trocars'] ?? null}
                  onNo={() => answerNo('trocars', ['Trocar'])}
                  onYes={undefined}
                  yesLabel={undefined}
                  onOther={() => answerOther('trocars')}
                  otherLabel="Yes — select sizes">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-green-700/40 uppercase tracking-wider pb-1">Entry Technique</div>
                    {renderItems(trocarItems.filter(e =>
                      e.name.toLowerCase().includes('hasson') ||
                      e.name.toLowerCase().includes('optical') ||
                      e.name.toLowerCase().includes('sils') ||
                      e.name.toLowerCase().includes('hand port')
                    ))}
                    <div className="text-[10px] font-bold text-green-700/40 uppercase tracking-wider pb-1 pt-2">Working Trocars</div>
                    {renderItems(trocarItems.filter(e =>
                      !e.name.toLowerCase().includes('hasson') &&
                      !e.name.toLowerCase().includes('optical') &&
                      !e.name.toLowerCase().includes('sils') &&
                      !e.name.toLowerCase().includes('hand port')
                    ))}
                  </div>
                </QuestionCard>
              )
            })()}

            {/* Scope */}
            {(isLapOrRobotic || state.surgical_approach === 'endoscopic') && (() => {
              const scopeItems = byCategory(['Scope'])
              const def = scopeItems.find(e => e.name.toLowerCase().includes('laparoscope')) ?? scopeItems[0]
              return (
                <QuestionCard
                  question="What scope was used?"
                  hint="Laparoscope, robotic camera, or endoscope"
                  answered={answers['scope'] ?? null}
                  onNo={() => answerNo('scope', ['Scope'])}
                  onYes={def ? () => answerYes('scope', def, ['Scope']) : undefined}
                  yesLabel={def ? `Yes — ${def.name} · ${def.emission_factor_kg.toFixed(2)} kg` : undefined}
                  onOther={() => answerOther('scope')}>
                  {renderItems(scopeItems)}
                </QuestionCard>
              )
            })()}

            {/* Robot docking */}
            {isRobotic && (() => {
              const robotItems = byCategory(['Robotic'])
              const def = robotItems.find(e => e.name.toLowerCase().includes('drape')) ?? robotItems[0]
              return (
                <QuestionCard
                  question="Was the robot docked?"
                  hint="da Vinci system — includes robot drape kit and instruments"
                  answered={answers['robot'] ?? null}
                  onNo={() => answerNo('robot', ['Robotic'])}
                  onYes={def ? () => answerYes('robot', def) : undefined}
                  yesLabel={def ? `Yes — ${def.name} · ${def.emission_factor_kg.toFixed(2)} kg` : undefined}
                  onOther={() => answerOther('robot')}>
                  {renderItems(robotItems)}
                </QuestionCard>
              )
            })()}

            {/* Suction / irrigation */}
            {(() => {
              const siItems = byCategory(['Suction/Irrigation'])
              const def = isLapOrRobotic
                ? siItems.find(e => e.name.toLowerCase().includes('laparoscopic')) ?? siItems[0]
                : siItems.find(e => e.name.toLowerCase().includes('yankauer')) ?? siItems[0]
              return (
                <QuestionCard
                  question="Was a suction or irrigation device used?"
                  hint="Laparoscopic suction-irrigation wand, Yankauer suction tip, or suction tubing"
                  answered={answers['suction'] ?? null}
                  onNo={() => answerNo('suction', ['Suction/Irrigation'])}
                  onYes={def ? () => answerYes('suction', def, ['Suction/Irrigation']) : undefined}
                  yesLabel={def ? `Yes — ${def.name} · ${def.emission_factor_kg.toFixed(2)} kg` : undefined}
                  onOther={() => answerOther('suction')}>
                  {renderItems(siItems)}
                </QuestionCard>
              )
            })()}

            {/* AirSeal */}
            {isLapOrRobotic && (() => {
              const def = findByName('AirSeal')
              return (
                <QuestionCard
                  question="Was an AirSeal system used?"
                  hint="AirSeal intelligent flow system for stable pneumoperitoneum"
                  answered={answers['airseal'] ?? null}
                  onNo={() => answerNo('airseal')}
                  onYes={def ? () => answerYes('airseal', def) : undefined}
                  yesLabel={def ? `Yes — ${def.name} · ${def.emission_factor_kg.toFixed(2)} kg` : 'Yes'}
                  onOther={() => answerOther('airseal')}
                  noOther>
                  {def && renderItems([def])}
                </QuestionCard>
              )
            })()}
          </div>
        )}

        {/* ══ Step 4: Intraop ══ */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-green-900 tracking-tight">Intraoperative</h2>
              <p className="text-sm text-green-700/50 mt-1">Energy, staplers, clips, sutures, and supplies</p>
            </div>

            {/* Energy */}
            {(() => {
              const energyItems = byCategory(['Energy Device'])
              return (
                <QuestionCard
                  question="Was energy used?"
                  hint="Electrosurgical (monopolar/bipolar/Bovie), ultrasonic (Harmonic, Thunderbeat), or vessel sealer (LigaSure, Enseal)"
                  answered={answers['energy'] ?? null}
                  onNo={() => answerNo('energy', ['Energy Device'])}
                  onYes={undefined}
                  yesLabel={undefined}
                  onOther={() => answerOther('energy')}
                  otherLabel="Yes — select devices">
                  {renderItems(energyItems)}
                </QuestionCard>
              )
            })()}

            {/* Staplers */}
            {(() => {
              const staplerItems = byCategory(['Stapler']).filter(e => !e.name.toLowerCase().includes('skin'))
              return (
                <QuestionCard
                  question="Were staplers fired?"
                  hint="Endo-GIA, Echelon Flex, EEA circular — add one per stapler used, plus reloads separately"
                  answered={answers['staplers'] ?? null}
                  onNo={() => answerNo('staplers', ['Stapler'])}
                  onYes={undefined}
                  yesLabel={undefined}
                  onOther={() => answerOther('staplers')}
                  otherLabel="Yes — select staplers">
                  {renderItems(staplerItems)}
                  {byCategory(['Stapler']).filter(e => e.name.toLowerCase().includes('reload')).length > 0 && (
                    <>
                      <div className="text-[10px] font-bold text-green-700/40 uppercase tracking-wider pt-1">Reloads</div>
                      {renderItems(byCategory(['Stapler']).filter(e => e.name.toLowerCase().includes('reload')))}
                    </>
                  )}
                </QuestionCard>
              )
            })()}

            {/* Clips */}
            {(() => {
              const clipItems = byCategory(['Clips'])
              const def = clipItems.find(e => e.name.toLowerCase().includes('hem-o-lok')) ?? clipItems[0]
              return (
                <QuestionCard
                  question="Were clips applied?"
                  hint="Hem-o-lok, titanium Ligaclips — add per applier used"
                  answered={answers['clips'] ?? null}
                  onNo={() => answerNo('clips', ['Clips'])}
                  onYes={def ? () => answerYes('clips', def) : undefined}
                  yesLabel={def ? `Yes — ${def.name} · ${def.emission_factor_kg.toFixed(2)} kg` : undefined}
                  onOther={() => answerOther('clips')}>
                  {renderItems(clipItems)}
                </QuestionCard>
              )
            })()}

            {/* Intraop sutures */}
            {(() => {
              const sutureItems = byCategory(['Suture'])
              return (
                <QuestionCard
                  question="Were sutures placed intraoperatively?"
                  hint="Hemostatic, anastomotic, or retraction sutures placed during the case (not closure)"
                  answered={answers['sutures_intraop'] ?? null}
                  onNo={() => answerNo('sutures_intraop')}
                  onYes={undefined}
                  yesLabel={undefined}
                  onOther={() => answerOther('sutures_intraop')}
                  otherLabel="Yes — select sutures">
                  {renderItems(sutureItems)}
                </QuestionCard>
              )
            })()}

            {/* Mesh */}
            {(() => {
              const meshItems = byCategory(['Mesh'])
              const def = meshItems.find(e => e.name.toLowerCase().includes('lightweight')) ?? meshItems[0]
              return (
                <QuestionCard
                  question="Was mesh implanted?"
                  hint="Synthetic or biologic mesh for hernia repair, prolapse, or other reconstruction"
                  answered={answers['mesh'] ?? null}
                  onNo={() => answerNo('mesh', ['Mesh'])}
                  onYes={def ? () => answerYes('mesh', def) : undefined}
                  yesLabel={def ? `Yes — ${def.name} · ${def.emission_factor_kg.toFixed(2)} kg` : undefined}
                  onOther={() => answerOther('mesh')}>
                  {renderItems(meshItems)}
                </QuestionCard>
              )
            })()}

            {/* Specimen retrieval */}
            {(() => {
              const specItems = byCategory(['Specimen Bag'])
              const def = specItems.find(e => e.name.toLowerCase().includes('10mm')) ?? specItems[0]
              return (
                <QuestionCard
                  question="Was a specimen retrieved?"
                  hint="Endo Catch bag for safe laparoscopic extraction"
                  answered={answers['specimen'] ?? null}
                  onNo={() => answerNo('specimen', ['Specimen Bag'])}
                  onYes={def ? () => answerYes('specimen', def, ['Specimen Bag']) : undefined}
                  yesLabel={def ? `Yes — ${def.name} · ${def.emission_factor_kg.toFixed(2)} kg` : undefined}
                  onOther={() => answerOther('specimen')}>
                  {renderItems(specItems)}
                </QuestionCard>
              )
            })()}

            {/* Irrigation */}
            <QuestionCard
              question="Was the operative field irrigated?"
              hint="Warm saline, antibiotic, or betadine irrigation"
              answered={answers['irrigation'] ?? null}
              onNo={() => answerNo('irrigation')}
              onYes={() => answerYes('irrigation')}
              yesLabel="Yes"
              onOther={() => answerOther('irrigation')}
              noOther>
              {null}
            </QuestionCard>
          </div>
        )}

        {/* ══ Step 5: Closure ══ */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-green-900 tracking-tight">Closure</h2>
              <p className="text-sm text-green-700/50 mt-1">Drains, fascial closure, skin, and dressings</p>
            </div>

            {/* Drains */}
            {(() => {
              const drainItems = byCategory(['Drain'])
              const def = drainItems.find(e => e.name.toLowerCase().includes('jp')) ?? drainItems[0]
              return (
                <QuestionCard
                  question="Were closed-suction drains placed?"
                  hint="Jackson-Pratt, Blake, or Hemovac drains — add one per drain placed"
                  answered={answers['drains'] ?? null}
                  onNo={() => answerNo('drains', ['Drain'])}
                  onYes={def ? () => answerYes('drains', def) : undefined}
                  yesLabel={def ? `Yes — ${def.name} · ${def.emission_factor_kg.toFixed(2)} kg` : undefined}
                  onOther={() => answerOther('drains')}>
                  {renderItems(drainItems)}
                </QuestionCard>
              )
            })()}

            {/* Fascial closure */}
            {(() => {
              const fascialItems = byCategory(['Closure']).filter(e =>
                e.name.toLowerCase().includes('fascial') ||
                e.name.toLowerCase().includes('pds') ||
                e.name.toLowerCase().includes('loop') ||
                e.name.toLowerCase().includes('vicryl')
              )
              const def = fascialItems.find(e => e.name.toLowerCase().includes('pds')) ?? fascialItems[0]
              return (
                <QuestionCard
                  question="Was the fascia closed?"
                  hint="Running or figure-of-eight fascial closure sutures"
                  answered={answers['fascia'] ?? null}
                  onNo={() => answerNo('fascia')}
                  onYes={def ? () => answerYes('fascia', def) : undefined}
                  yesLabel={def ? `Yes — ${def.name} · ${def.emission_factor_kg.toFixed(2)} kg` : undefined}
                  onOther={() => answerOther('fascia')}>
                  {renderItems(fascialItems.length > 0 ? fascialItems : byCategory(['Closure']))}
                </QuestionCard>
              )
            })()}

            {/* Skin closure */}
            {(() => {
              const skinItems = [
                ...byCategory(['Closure']).filter(e =>
                  e.name.toLowerCase().includes('monocryl') ||
                  e.name.toLowerCase().includes('dermabond') ||
                  e.name.toLowerCase().includes('steri')
                ),
                ...byCategory(['Stapler']).filter(e => e.name.toLowerCase().includes('skin')),
              ]
              const def = skinItems.find(e => e.name.toLowerCase().includes('monocryl')) ?? skinItems[0]
              return (
                <QuestionCard
                  question="How was the skin closed?"
                  hint="Subcuticular suture (Monocryl), skin staples, Dermabond, or Steri-strips"
                  answered={answers['skin'] ?? null}
                  onNo={() => answerNo('skin')}
                  onYes={def ? () => answerYes('skin', def) : undefined}
                  yesLabel={def ? `Yes — ${def.name} · ${def.emission_factor_kg.toFixed(2)} kg` : undefined}
                  onOther={() => answerOther('skin')}
                  otherLabel="Yes — select method">
                  {renderItems(skinItems.length > 0 ? skinItems : byCategory(['Closure']))}
                </QuestionCard>
              )
            })()}

            {/* Closure strips */}
            {(() => {
              const def = findByName('Steri-strips')
              return (
                <QuestionCard
                  question="Were wound closure strips applied?"
                  hint="Steri-strips over the incision for reinforcement"
                  answered={answers['steristrips'] ?? null}
                  onNo={() => answerNo('steristrips')}
                  onYes={def ? () => answerYes('steristrips', def) : undefined}
                  yesLabel={def ? `Yes — ${def.name} · ${def.emission_factor_kg.toFixed(2)} kg` : 'Yes'}
                  onOther={() => answerOther('steristrips')}
                  noOther={!def}>
                  {def && renderItems([def])}
                </QuestionCard>
              )
            })()}

            {/* Wound dressing */}
            {(() => {
              const dressingItems = byCategory(['Dressing']).filter(e => !e.name.toLowerCase().includes('npwt'))
              const def = dressingItems.find(e => e.name.toLowerCase().includes('tegaderm')) ?? dressingItems[0]
              return (
                <QuestionCard
                  question="What wound dressing was applied?"
                  hint="Tegaderm, gauze, foam dressing, or ABD pad"
                  answered={answers['dressing'] ?? null}
                  onNo={() => answerNo('dressing', ['Dressing'])}
                  onYes={def ? () => answerYes('dressing', def) : undefined}
                  yesLabel={def ? `Yes — ${def.name} · ${def.emission_factor_kg.toFixed(2)} kg` : undefined}
                  onOther={() => answerOther('dressing')}>
                  {renderItems(dressingItems)}
                </QuestionCard>
              )
            })()}

            {/* Wound VAC */}
            {(() => {
              const def = findByName('NPWT kit')
              return (
                <QuestionCard
                  question="Was negative-pressure wound therapy (wound vac) applied?"
                  hint="NPWT for open abdomen, complex wounds, or high-risk closures"
                  answered={answers['npwt'] ?? null}
                  onNo={() => answerNo('npwt')}
                  onYes={def ? () => answerYes('npwt', def) : undefined}
                  yesLabel={def ? `Yes — ${def.name} · ${def.emission_factor_kg.toFixed(2)} kg` : 'Yes'}
                  onOther={() => answerOther('npwt')}
                  noOther>
                  {def && renderItems([def])}
                </QuestionCard>
              )
            })()}
          </div>
        )}

        {/* ══ Step 6: Anesthesia ══ */}
        {step === 6 && (
          <div className="space-y-6">
            <div className="text-center mb-2">
              <h2 className="text-2xl font-bold text-green-900 tracking-tight">Anesthesia</h2>
              <p className="text-sm text-green-700/50 mt-1">Duration, agent, and regional blocks</p>
            </div>

            {/* Regional block */}
            {(() => {
              const regionalItems = byCategory(['Regional'])
              const def = regionalItems.find(e => e.name.toLowerCase().includes('peripheral')) ?? regionalItems[0]
              return (
                <QuestionCard
                  question="Was a regional nerve block performed?"
                  hint="Spinal, epidural, TAP block, or peripheral nerve block"
                  answered={answers['regional'] ?? null}
                  onNo={() => answerNo('regional', ['Regional'])}
                  onYes={def ? () => answerYes('regional', def) : undefined}
                  yesLabel={def ? `Yes — ${def.name} · ${def.emission_factor_kg.toFixed(2)} kg` : undefined}
                  onOther={() => answerOther('regional')}>
                  {renderItems(regionalItems)}
                </QuestionCard>
              )
            })()}

            <div>
              <label className="block text-sm font-bold text-green-900 mb-2">
                Case duration (minutes) <span className="text-red-400">*</span>
              </label>
              <input type="number" min="1"
                value={state.duration_minutes || ''}
                onChange={(e) => setState((s) => ({ ...s, duration_minutes: e.target.value ? parseInt(e.target.value) : null }))}
                placeholder="e.g. 90" className="input-base" />
            </div>

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

        {/* ══ Step 7: Review ══ */}
        {step === 7 && (
          <div className="space-y-5">
            <div className="text-center mb-2">
              <h2 className="text-2xl font-bold text-green-900 tracking-tight">Review & Submit</h2>
              <p className="text-sm text-green-700/50 mt-1">Confirm everything looks right</p>
            </div>

            <div className={`p-7 rounded-2xl text-center border-[1.5px] ${
              totalEmissions < 4 ? 'bg-green-50 border-green-200' :
              totalEmissions <= 8 ? 'bg-amber-50 border-amber-200' :
              'bg-red-50 border-red-200'
            }`} style={{
              boxShadow: totalEmissions < 4
                ? '0 4px 24px rgba(64, 145, 108, 0.12), inset 0 1px 0 rgba(255,255,255,0.7)'
                : totalEmissions <= 8
                ? '0 4px 24px rgba(217, 119, 6, 0.1), inset 0 1px 0 rgba(255,255,255,0.7)'
                : '0 4px 24px rgba(220, 38, 38, 0.1), inset 0 1px 0 rgba(255,255,255,0.7)'
            }}>
              <div className="text-xs text-green-700/50 font-medium uppercase tracking-widest mb-3">Total Case Emissions</div>
              <div className={`text-5xl font-bold tracking-tight ${emColor(totalEmissions)}`}>{fmtEmissions(totalEmissions)}</div>
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
                  <div className="font-semibold text-green-900 uppercase">
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
