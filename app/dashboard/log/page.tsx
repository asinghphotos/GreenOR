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

const STEP_LABELS = ['Procedure', 'Pre-op', 'Access', 'During', 'Closing', 'Anesthesia', 'Review']

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
    <div className={`flex items-center justify-between p-3.5 rounded-xl border-[1.5px] transition-all ${
      quantity > 0 ? 'border-green-300 bg-green-50/50' : 'border-beige-200 bg-white'
    }`}>
      <div className="flex-1 min-w-0 mr-3">
        <div className="text-sm font-semibold text-green-900 truncate">{name}</div>
        <div className="text-xs text-green-700/50 mt-0.5">{emissionKg.toFixed(2)} kg CO₂e</div>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onRemove}
          disabled={quantity === 0}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-beige-100 text-green-900 font-bold text-sm tap-scale hover:bg-beige-200 disabled:opacity-20 transition-colors"
        >
          −
        </button>
        <span className="w-7 text-center text-sm font-bold text-green-900 tabular-nums">
          {quantity}
        </span>
        <button
          onClick={onAdd}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-900 text-white font-bold text-sm tap-scale hover:bg-green-700 transition-colors"
        >
          +
        </button>
      </div>
    </div>
  )
}

// ── Collapsible ──
function CategorySection({ title, children, defaultOpen = false }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-beige-100/50 transition-colors tap-scale"
      >
        <span className="text-sm font-bold text-green-900">{title}</span>
        <span className={`text-green-700/40 text-xs transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>
          ▶
        </span>
      </button>
      <div className={`collapse-content ${open ? 'open' : ''}`}>
        <div className="px-4 pb-4 space-y-2">{children}</div>
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
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold capitalize tap-scale transition-all ${
            selected === opt
              ? 'bg-green-900 text-white shadow-sm'
              : 'bg-beige-100 text-green-900 hover:bg-beige-200'
          }`}
        >
          {opt === 'tiva' ? 'TIVA' : opt === 'mac' ? 'MAC' : opt}
        </button>
      ))}
    </div>
  )
}

// ── Section heading ──
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-bold text-green-900 uppercase tracking-wide">{children}</h3>
  )
}

// ── Main Wizard ──
export default function LogCasePage() {
  const [step, setStep] = useState(0)
  const [state, setState] = useState<WizardState>(initialWizardState)
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

  const goForward = () => { setDirection('forward'); setStep((s) => Math.min(s + 1, 6)) }
  const goBack = () => { setDirection('back'); setStep((s) => Math.max(s - 1, 0)) }

  const totalEmissions = calcTotalEmissions(state.items, state.sets)
  const getItemQty = (id: string) => state.items.find((i) => i.equipment_id === id)?.quantity || 0
  const getSetQty = (id: string) => state.sets.find((s) => s.instrument_set_id === id)?.quantity || 0
  const addItem = (eq: Equipment) => setState((s) => ({ ...s, items: updateItems(s.items, eq, 1) }))
  const removeItem = (eq: Equipment) => setState((s) => ({ ...s, items: updateItems(s.items, eq, -1) }))
  const addSet = (is: InstrumentSet) => setState((s) => ({ ...s, sets: updateSets(s.sets, is, 1) }))
  const removeSet = (is: InstrumentSet) => setState((s) => ({ ...s, sets: updateSets(s.sets, is, -1) }))

  const getStepEquipment = useCallback(
    (categories: string[]) => equipment.filter((eq) => categories.includes(eq.category)),
    [equipment]
  )

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

  return (
    <div className="max-w-xl mx-auto">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-3">
          {STEP_LABELS.map((label, i) => (
            <button
              key={i}
              onClick={() => { if (i < step) { setDirection('back'); setStep(i) } }}
              className={`text-[10px] sm:text-xs font-semibold transition-colors ${
                i === step ? 'text-green-900' : i < step ? 'text-green-500 cursor-pointer hover:text-green-700' : 'text-beige-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="h-1.5 bg-beige-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-green-300 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${((step + 1) / 7) * 100}%` }}
          />
        </div>
      </div>

      {/* Running total */}
      {step >= 1 && (
        <div className="animate-fade-in mb-6 card p-4 flex items-center justify-between">
          <span className="text-xs font-medium text-green-700/50 uppercase tracking-wide">Running Total</span>
          <span className={`text-lg font-bold ${emColor(totalEmissions)}`}>
            {fmtEmissions(totalEmissions)}
          </span>
        </div>
      )}

      {/* Step content */}
      <div key={step} className={direction === 'forward' ? 'animate-slide-right' : 'animate-slide-left'}>

        {/* ── Step 1: Procedure ── */}
        {step === 0 && (
          <div className="space-y-5">
            <div className="text-center mb-2">
              <h2 className="text-2xl font-bold text-green-900 tracking-tight">What procedure?</h2>
              <p className="text-sm text-green-700/50 mt-1">Search by CPT code or name</p>
            </div>

            <input
              type="text"
              placeholder="Search procedures..."
              value={cptSearch}
              onChange={(e) => setCptSearch(e.target.value)}
              className="input-base text-center"
            />

            <div className="space-y-2">
              {filteredCpts.map((cpt) => (
                <button
                  key={cpt.code}
                  onClick={() => setState((s) => ({ ...s, cpt_code: cpt.code, procedure_name: cpt.description, surgical_approach: null }))}
                  className={`w-full text-left p-4 rounded-xl tap-scale transition-all ${
                    state.cpt_code === cpt.code
                      ? 'bg-green-900 text-white shadow-md'
                      : 'card hover:border-green-300'
                  }`}
                >
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
                <SectionHeading>Approach</SectionHeading>
                <div className="grid grid-cols-2 gap-2.5">
                  {cptCodes
                    .find((c) => c.code === state.cpt_code)
                    ?.common_approaches.map((approach) => (
                      <button
                        key={approach}
                        onClick={() => {
                          setState((s) => ({ ...s, surgical_approach: approach as SurgicalApproach }))
                          setTimeout(goForward, 200)
                        }}
                        className={`py-4 rounded-xl text-sm font-semibold capitalize tap-scale transition-all ${
                          state.surgical_approach === approach
                            ? 'bg-green-900 text-white shadow-sm'
                            : 'bg-beige-100 text-green-900 hover:bg-beige-200'
                        }`}
                      >
                        {approach}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Pre-op ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="text-center mb-2">
              <h2 className="text-2xl font-bold text-green-900 tracking-tight">Pre-op setup</h2>
              <p className="text-sm text-green-700/50 mt-1">Lines, catheters, and trays</p>
            </div>

            {equipment.filter((e) => e.name === 'Foley kit').map((eq) => (
              <div
                key={eq.id}
                onClick={() => getItemQty(eq.id) > 0 ? removeItem(eq) : addItem(eq)}
                className={`hover-lift cursor-pointer p-5 rounded-xl border-[1.5px] tap-scale transition-all text-center ${
                  getItemQty(eq.id) > 0 ? 'border-green-300 bg-green-50/50' : 'border-beige-200 bg-white hover:border-green-300'
                }`}
              >
                <div className="font-semibold text-green-900">Foley Catheter</div>
                <div className="text-xs text-green-700/50 mt-1">{eq.emission_factor_kg.toFixed(2)} kg CO₂e</div>
                {getItemQty(eq.id) > 0 && <div className="text-xs font-bold text-green-700 mt-2">✓ Added</div>}
              </div>
            ))}

            {instrumentSets.length > 0 && (
              <div className="space-y-3">
                <SectionHeading>Instrument Trays</SectionHeading>
                <div className="space-y-2">
                  {instrumentSets.map((is) => (
                    <ItemCard key={is.id} name={is.name} emissionKg={is.per_use_emission_kg} quantity={getSetQty(is.id)} onAdd={() => addSet(is)} onRemove={() => removeSet(is)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Access ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="text-center mb-2">
              <h2 className="text-2xl font-bold text-green-900 tracking-tight">Access</h2>
              <p className="text-sm text-green-700/50 mt-1">Entry, trocars, and scope</p>
            </div>

            {(state.surgical_approach === 'laparoscopic' || state.surgical_approach === 'robotic') && (
              <>
                <div className="space-y-3">
                  <SectionHeading>Insufflation</SectionHeading>
                  <div className="space-y-2">
                    {getStepEquipment(['insufflation']).map((eq) => (
                      <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg} quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <SectionHeading>Trocars</SectionHeading>
                  <div className="space-y-2">
                    {getStepEquipment(['trocars']).map((eq) => (
                      <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg} quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <SectionHeading>Scope</SectionHeading>
                  <div className="space-y-2">
                    {getStepEquipment(['scope']).map((eq) => (
                      <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg} quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                    ))}
                  </div>
                </div>
              </>
            )}

            {state.surgical_approach === 'robotic' && (
              <div className="space-y-3">
                <SectionHeading>Robotic</SectionHeading>
                <div className="space-y-2">
                  {getStepEquipment(['robotic']).map((eq) => (
                    <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg} quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                  ))}
                </div>
              </div>
            )}

            {state.surgical_approach === 'open' && (
              <div className="text-center py-8 text-sm text-green-700/50">
                Select any retractors or access instruments used below.
              </div>
            )}

            <CategorySection title="Other Access Equipment">
              {Object.entries(
                equipment.reduce<Record<string, Equipment[]>>((acc, eq) => {
                  if (!['trocars', 'insufflation', 'scope', 'robotic', 'energy', 'staplers', 'clips', 'sutures', 'specimen', 'drapes', 'closure'].includes(eq.category)) {
                    if (!acc[eq.category]) acc[eq.category] = []
                    acc[eq.category].push(eq)
                  }
                  return acc
                }, {})
              ).map(([cat, items]) => (
                <div key={cat} className="space-y-2">
                  <div className="text-[10px] font-bold text-green-700/40 uppercase tracking-wider pt-2">{cat}</div>
                  {items.map((eq) => (
                    <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg} quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                  ))}
                </div>
              ))}
            </CategorySection>
          </div>
        )}

        {/* ── Step 4: During ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="text-center mb-2">
              <h2 className="text-2xl font-bold text-green-900 tracking-tight">During the case</h2>
              <p className="text-sm text-green-700/50 mt-1">Energy, staplers, clips, sutures</p>
            </div>

            {['energy', 'staplers', 'clips', 'sutures', 'specimen'].map((category) => {
              const items = getStepEquipment([category])
              if (items.length === 0) return null
              const labels: Record<string, string> = {
                energy: 'Energy Devices', staplers: 'Staplers', clips: 'Clips', sutures: 'Sutures', specimen: 'Specimen Bags',
              }
              return (
                <div key={category} className="space-y-3">
                  <SectionHeading>{labels[category]}</SectionHeading>
                  <div className="space-y-2">
                    {items.map((eq) => (
                      <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg} quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                    ))}
                  </div>
                </div>
              )
            })}

            <CategorySection title="Other Supplies">
              {equipment
                .filter((eq) => !['energy', 'staplers', 'clips', 'sutures', 'specimen', 'trocars', 'insufflation', 'scope', 'robotic', 'drapes', 'closure'].includes(eq.category))
                .map((eq) => (
                  <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg} quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                ))}
            </CategorySection>
          </div>
        )}

        {/* ── Step 5: Closing ── */}
        {step === 4 && (
          <div className="space-y-5">
            <div className="text-center mb-2">
              <h2 className="text-2xl font-bold text-green-900 tracking-tight">Closing up</h2>
              <p className="text-sm text-green-700/50 mt-1">Closure, drapes, and gowns</p>
            </div>

            {['closure', 'drapes'].map((category) => {
              const items = getStepEquipment([category])
              if (items.length === 0) return null
              return (
                <div key={category} className="space-y-3">
                  <SectionHeading>{category === 'closure' ? 'Wound Closure' : 'Drapes & Gowns'}</SectionHeading>
                  <div className="space-y-2">
                    {items.map((eq) => (
                      <ItemCard key={eq.id} name={eq.name} emissionKg={eq.emission_factor_kg} quantity={getItemQty(eq.id)} onAdd={() => addItem(eq)} onRemove={() => removeItem(eq)} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Step 6: Anesthesia ── */}
        {step === 5 && (
          <div className="space-y-6">
            <div className="text-center mb-2">
              <h2 className="text-2xl font-bold text-green-900 tracking-tight">Anesthesia</h2>
              <p className="text-sm text-green-700/50 mt-1">Duration, type, and gas</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-green-900 mb-2">
                Duration (minutes) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={state.duration_minutes || ''}
                onChange={(e) => setState((s) => ({ ...s, duration_minutes: e.target.value ? parseInt(e.target.value) : null }))}
                placeholder="e.g. 90"
                className="input-base"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-green-900 mb-3">
                Anesthesia Type <span className="text-red-400">*</span>
              </label>
              <ChipSelect options={ANESTHESIA_TYPES} selected={state.anesthesia_type} onSelect={(v) => setState((s) => ({ ...s, anesthesia_type: v }))} />
            </div>

            <div>
              <label className="block text-sm font-bold text-green-900 mb-3">
                Anesthesia Gas <span className="text-red-400">*</span>
              </label>
              <ChipSelect options={ANESTHESIA_GASES} selected={state.anesthesia_gas} onSelect={(v) => setState((s) => ({ ...s, anesthesia_gas: v }))} />
            </div>

            <div>
              <label className="block text-sm font-bold text-green-900 mb-2">
                Notes <span className="text-green-700/40 font-normal">(optional)</span>
              </label>
              <textarea
                value={state.notes}
                onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
                rows={3}
                placeholder="Any additional notes..."
                className="input-base resize-none"
              />
            </div>
          </div>
        )}

        {/* ── Step 7: Review ── */}
        {step === 6 && (
          <div className="space-y-5">
            <div className="text-center mb-2">
              <h2 className="text-2xl font-bold text-green-900 tracking-tight">Review & Submit</h2>
              <p className="text-sm text-green-700/50 mt-1">Confirm everything looks right</p>
            </div>

            {/* Total emissions — prominent */}
            <div className={`p-6 rounded-2xl text-center ${
              totalEmissions < 4 ? 'bg-green-50 border-green-200' : totalEmissions <= 8 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
            } border-[1.5px]`}>
              <div className="text-xs text-green-700/50 font-medium uppercase tracking-wide mb-2">Total Case Emissions</div>
              <div className={`text-4xl font-bold ${emColor(totalEmissions)}`}>
                {fmtEmissions(totalEmissions)}
              </div>
            </div>

            {/* Procedure */}
            <div className="card p-5">
              <div className="text-xs font-bold text-green-700/40 uppercase tracking-wide mb-2">Procedure</div>
              <div className="font-semibold text-green-900">{state.cpt_code} — {state.procedure_name}</div>
              <div className="text-sm text-green-700/60 capitalize mt-0.5">{state.surgical_approach}</div>
            </div>

            {/* Items */}
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

            {/* Sets */}
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

            {/* Anesthesia */}
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
                  <div className="text-green-700/50 text-xs">Gas</div>
                  <div className="font-semibold text-green-900 capitalize">
                    {state.anesthesia_gas === 'tiva' ? 'TIVA' : state.anesthesia_gas === 'mac' ? 'MAC' : state.anesthesia_gas || '—'}
                  </div>
                </div>
              </div>
            </div>

            {!canSubmit && (
              <p className="text-xs text-red-400 text-center font-medium">
                Complete duration, anesthesia type, and gas before submitting.
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="btn-primary w-full !py-4 !text-base"
            >
              {submitting ? 'Submitting...' : 'Submit Case'}
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-6">
        {step > 0 && (
          <button onClick={goBack} className="btn-secondary flex-1">
            Back
          </button>
        )}
        {step < 6 && step > 0 && (
          <button onClick={goForward} className="btn-primary flex-1">
            Next
          </button>
        )}
      </div>
    </div>
  )
}
