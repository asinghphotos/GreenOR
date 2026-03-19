import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { fmtEmissions, emColor } from '../../lib/emissions'
import {
  type CptCode, type Equipment, type InstrumentSet,
  type WizardState, type WizardItem, type WizardSet,
  initialWizardState, APPROACHES, ANESTHESIA_TYPES, ANESTHESIA_GASES,
  type SurgicalApproach,
} from '../../lib/types'

// ─── Emission calc ───────────────────────────────────────────────────────────

function calcTotal(items: WizardItem[], sets: WizardSet[]): number {
  const itemTotal = items.reduce((sum, i) => sum + i.quantity * i.emission_factor_kg, 0)
  const setTotal = sets.reduce((sum, s) => sum + s.quantity * s.per_use_emission_kg, 0)
  return itemTotal + setTotal
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function updateItems(items: WizardItem[], eq: Equipment, delta: number): WizardItem[] {
  const existing = items.find(i => i.equipment_id === eq.id)
  if (existing) {
    const newQty = existing.quantity + delta
    if (newQty <= 0) return items.filter(i => i.equipment_id !== eq.id)
    return items.map(i => i.equipment_id === eq.id ? { ...i, quantity: newQty } : i)
  }
  if (delta > 0) {
    return [...items, { equipment_id: eq.id, name: eq.name, quantity: delta, emission_factor_kg: eq.emission_factor_kg }]
  }
  return items
}

function updateSets(sets: WizardSet[], is: InstrumentSet, delta: number): WizardSet[] {
  const existing = sets.find(s => s.instrument_set_id === is.id)
  if (existing) {
    const newQty = existing.quantity + delta
    if (newQty <= 0) return sets.filter(s => s.instrument_set_id !== is.id)
    return sets.map(s => s.instrument_set_id === is.id ? { ...s, quantity: newQty } : s)
  }
  if (delta > 0) {
    return [...sets, { instrument_set_id: is.id, name: is.name, quantity: delta, per_use_emission_kg: is.per_use_emission_kg }]
  }
  return sets
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = ((step + 1) / total) * 100
  const labels = ['Procedure', 'Equipment', 'Trays', 'Details', 'Review']
  return (
    <View className="px-5 pt-4 pb-2">
      <View className="flex-row justify-between mb-2">
        {labels.map((label, i) => (
          <Text
            key={i}
            className="text-[10px] font-bold"
            style={{
              fontFamily: 'Georgia',
              color: i === step ? '#1B4332' : i < step ? '#40916C' : '#D4CAB8',
            }}
          >
            {label}
          </Text>
        ))}
      </View>
      <View className="h-1.5 bg-[#E5E0D8] rounded-full overflow-hidden">
        <View
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            backgroundColor: '#40916C',
          }}
        />
      </View>
    </View>
  )
}

function RunningTotal({ kg }: { kg: number }) {
  if (kg === 0) return null
  return (
    <View className="mx-5 mb-3 bg-white border border-[#E5E0D8] rounded-xl px-4 py-2.5 flex-row justify-between items-center">
      <Text className="text-xs text-green-900/50 uppercase tracking-wider" style={{ fontFamily: 'Georgia' }}>
        Running Total
      </Text>
      <Text className="text-base font-bold" style={{ fontFamily: 'Georgia', color: emColor(kg) }}>
        {fmtEmissions(kg)}
      </Text>
    </View>
  )
}

function StepHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="mb-5">
      <Text className="text-2xl font-bold text-green-900 text-center" style={{ fontFamily: 'Georgia' }}>
        {title}
      </Text>
      {subtitle && (
        <Text className="text-sm text-green-900/50 text-center mt-1" style={{ fontFamily: 'Georgia' }}>
          {subtitle}
        </Text>
      )}
    </View>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-xs font-bold text-green-900/50 uppercase tracking-wider mb-2 mt-4" style={{ fontFamily: 'Georgia' }}>
      {children}
    </Text>
  )
}

function ItemRow({
  name, emKg, qty, onAdd, onRemove, reusable,
}: {
  name: string; emKg: number; qty: number; onAdd: () => void; onRemove: () => void; reusable?: boolean
}) {
  return (
    <View
      className="flex-row items-center justify-between py-3 border-b border-[#E5E0D8]"
    >
      <View className="flex-1 mr-3">
        <Text
          className="text-sm font-bold text-green-900"
          style={{ fontFamily: 'Georgia' }}
          numberOfLines={2}
        >
          {name}
          {reusable ? ' ♻' : ''}
        </Text>
        <Text className="text-xs text-green-900/40 mt-0.5" style={{ fontFamily: 'Georgia' }}>
          {emKg.toFixed(2)} kg CO₂e each
        </Text>
      </View>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <TouchableOpacity
          onPress={onRemove}
          disabled={qty === 0}
          className="w-8 h-8 rounded-lg bg-[#F0EBE3] items-center justify-center"
          style={{ opacity: qty === 0 ? 0.3 : 1 }}
        >
          <Text className="text-green-900 font-bold text-base" style={{ lineHeight: 20 }}>−</Text>
        </TouchableOpacity>
        <Text
          className="text-sm font-bold text-green-900 text-center"
          style={{ fontFamily: 'Georgia', width: 24 }}
        >
          {qty}
        </Text>
        <TouchableOpacity
          onPress={onAdd}
          className="w-8 h-8 rounded-lg bg-green-900 items-center justify-center"
        >
          <Text className="text-white font-bold text-base" style={{ lineHeight: 20 }}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function ChipRow({
  options, selected, onSelect, capitalize = true,
}: {
  options: readonly string[]; selected: string | null; onSelect: (v: string) => void; capitalize?: boolean
}) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt}
          onPress={() => onSelect(opt)}
          className="px-4 py-2.5 rounded-xl"
          style={{
            backgroundColor: selected === opt ? '#1B4332' : '#F0EBE3',
          }}
        >
          <Text
            className="text-sm font-bold"
            style={{
              fontFamily: 'Georgia',
              color: selected === opt ? '#FFFFFF' : '#1B4332',
              textTransform: capitalize ? 'capitalize' : 'none',
            }}
          >
            {opt === 'tiva' ? 'TIVA' : opt === 'mac' ? 'MAC' : opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5

export default function LogScreen() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [state, setState] = useState<WizardState>(initialWizardState)
  const [cptSearch, setCptSearch] = useState('')
  const [cptCodes, setCptCodes] = useState<CptCode[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [instrumentSets, setInstrumentSets] = useState<InstrumentSet[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

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
      setLoading(false)
    }
    load()
  }, [])

  const totalEmissions = calcTotal(state.items, state.sets)

  const addItem = useCallback((eq: Equipment) =>
    setState(s => ({ ...s, items: updateItems(s.items, eq, 1) })), [])
  const removeItem = useCallback((eq: Equipment) =>
    setState(s => ({ ...s, items: updateItems(s.items, eq, -1) })), [])
  const addSet = useCallback((is: InstrumentSet) =>
    setState(s => ({ ...s, sets: updateSets(s.sets, is, 1) })), [])
  const removeSet = useCallback((is: InstrumentSet) =>
    setState(s => ({ ...s, sets: updateSets(s.sets, is, -1) })), [])

  const getItemQty = (id: string) => state.items.find(i => i.equipment_id === id)?.quantity || 0
  const getSetQty = (id: string) => state.sets.find(s => s.instrument_set_id === id)?.quantity || 0

  // Group equipment by category
  const equipmentByCategory = equipment.reduce<Record<string, Equipment[]>>((acc, eq) => {
    if (!acc[eq.category]) acc[eq.category] = []
    acc[eq.category].push(eq)
    return acc
  }, {})
  const categories = Object.keys(equipmentByCategory).sort()

  const filteredCpts = cptSearch.trim()
    ? cptCodes.filter(c =>
        c.code.includes(cptSearch) ||
        c.description.toLowerCase().includes(cptSearch.toLowerCase()) ||
        c.category.toLowerCase().includes(cptSearch.toLowerCase())
      )
    : cptCodes

  const selectedCpt = cptCodes.find(c => c.code === state.cpt_code)
  const approachOptions = selectedCpt?.common_approaches?.length
    ? selectedCpt.common_approaches as SurgicalApproach[]
    : APPROACHES

  const canAdvance = (() => {
    if (step === 0) return !!(state.cpt_code && state.surgical_approach)
    if (step === 3) return !!(state.duration_minutes && state.anesthesia_type && state.anesthesia_gas)
    return true
  })()

  const canSubmit = !!(state.cpt_code && state.surgical_approach && state.duration_minutes && state.anesthesia_type && state.anesthesia_gas)

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSubmitting(false); return }

    const { data: profile } = await supabase
      .from('profiles').select('institution').eq('id', user.id).single()

    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .insert({
        user_id: user.id,
        cpt_code: state.cpt_code,
        surgical_approach: state.surgical_approach,
        duration_minutes: state.duration_minutes,
        anesthesia_type: state.anesthesia_type,
        anesthesia_gas: state.anesthesia_gas,
        institution: profile?.institution || '',
        total_emissions_kg: totalEmissions,
        notes: state.notes || null,
      })
      .select('id')
      .single()

    if (caseError || !caseData) {
      Alert.alert('Error', 'Failed to save case. Please try again.')
      setSubmitting(false)
      return
    }

    if (state.items.length > 0) {
      await supabase.from('case_items').insert(
        state.items.map(item => ({
          case_id: caseData.id,
          equipment_id: item.equipment_id,
          quantity: item.quantity,
          subtotal_emissions_kg: item.quantity * item.emission_factor_kg,
        }))
      )
    }
    if (state.sets.length > 0) {
      await supabase.from('case_sets').insert(
        state.sets.map(s => ({
          case_id: caseData.id,
          instrument_set_id: s.instrument_set_id,
          quantity: s.quantity,
          subtotal_emissions_kg: s.quantity * s.per_use_emission_kg,
        }))
      )
    }

    // Reset wizard and go home
    setState(initialWizardState)
    setCptSearch('')
    setStep(0)
    router.replace('/(tabs)')
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#F9F5EE] items-center justify-center">
        <ActivityIndicator color="#1B4332" size="large" />
        <Text className="text-sm text-green-900/50 mt-3" style={{ fontFamily: 'Georgia' }}>
          Loading equipment…
        </Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F9F5EE]">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
          {step > 0 ? (
            <TouchableOpacity onPress={() => setStep(s => s - 1)} className="py-1 pr-3">
              <Text className="text-green-700 text-base" style={{ fontFamily: 'Georgia' }}>← Back</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 60 }} />}
          <Text className="text-base font-bold text-green-900" style={{ fontFamily: 'Georgia' }}>
            Log a Case
          </Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Progress */}
        <ProgressBar step={step} total={TOTAL_STEPS} />

        {/* Running total (steps 1+) */}
        {step >= 1 && <RunningTotal kg={totalEmissions} />}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >

          {/* ══ Step 0: Procedure ══ */}
          {step === 0 && (
            <View>
              <StepHeader title="What procedure?" subtitle="Search by CPT code or name" />
              <TextInput
                className="bg-white border border-[#E5E0D8] rounded-xl px-4 py-3 text-green-900 text-sm mb-4"
                style={{ fontFamily: 'Georgia' }}
                placeholder="Search procedures…"
                placeholderTextColor="#1B433260"
                value={cptSearch}
                onChangeText={setCptSearch}
                returnKeyType="search"
                autoCapitalize="none"
              />
              <View className="space-y-2">
                {filteredCpts.slice(0, 30).map(cpt => (
                  <TouchableOpacity
                    key={cpt.code}
                    onPress={() => setState(s => ({
                      ...s,
                      cpt_code: cpt.code,
                      procedure_name: cpt.description,
                      surgical_approach: null,
                    }))}
                    className="p-4 rounded-xl border"
                    style={{
                      backgroundColor: state.cpt_code === cpt.code ? '#1B4332' : '#FFFFFF',
                      borderColor: state.cpt_code === cpt.code ? '#1B4332' : '#E5E0D8',
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      className="text-sm font-bold"
                      style={{ fontFamily: 'Georgia', color: state.cpt_code === cpt.code ? '#FFFFFF' : '#1B4332' }}
                    >
                      {cpt.code} — {cpt.description}
                    </Text>
                    <Text
                      className="text-xs mt-0.5"
                      style={{ fontFamily: 'Georgia', color: state.cpt_code === cpt.code ? '#A7F3D0' : '#1B433270' }}
                    >
                      {cpt.category}
                    </Text>
                  </TouchableOpacity>
                ))}
                {filteredCpts.length === 0 && (
                  <View className="items-center py-10">
                    <Text className="text-2xl mb-2">🔍</Text>
                    <Text className="text-sm text-green-900/50 text-center" style={{ fontFamily: 'Georgia' }}>
                      No procedures found for "{cptSearch}"
                    </Text>
                  </View>
                )}
              </View>

              {state.cpt_code && (
                <View className="mt-4">
                  <SectionLabel>Surgical Approach</SectionLabel>
                  <View className="flex-row flex-wrap" style={{ gap: 10 }}>
                    {approachOptions.map(approach => (
                      <TouchableOpacity
                        key={approach}
                        onPress={() => setState(s => ({ ...s, surgical_approach: approach }))}
                        className="rounded-xl py-3 px-5"
                        style={{
                          backgroundColor: state.surgical_approach === approach ? '#1B4332' : '#F0EBE3',
                        }}
                      >
                        <Text
                          className="text-sm font-bold capitalize"
                          style={{
                            fontFamily: 'Georgia',
                            color: state.surgical_approach === approach ? '#FFFFFF' : '#1B4332',
                          }}
                        >
                          {approach}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ══ Step 1: Equipment ══ */}
          {step === 1 && (
            <View>
              <StepHeader title="Equipment" subtitle="Add supplies and disposables used" />
              {categories.map(cat => (
                <View key={cat} className="mb-4 bg-white rounded-2xl border border-[#E5E0D8] px-4 pt-1 pb-2">
                  <SectionLabel>{cat}</SectionLabel>
                  {equipmentByCategory[cat].map(eq => (
                    <ItemRow
                      key={eq.id}
                      name={eq.name}
                      emKg={eq.emission_factor_kg}
                      qty={getItemQty(eq.id)}
                      onAdd={() => addItem(eq)}
                      onRemove={() => removeItem(eq)}
                      reusable={eq.is_reusable}
                    />
                  ))}
                </View>
              ))}
              {categories.length === 0 && (
                <View className="items-center py-10">
                  <Text className="text-sm text-green-900/50 text-center" style={{ fontFamily: 'Georgia' }}>
                    No equipment in database yet.{'\n'}Skip to continue.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ══ Step 2: Instrument Sets ══ */}
          {step === 2 && (
            <View>
              <StepHeader title="Instrument Trays" subtitle="Select reusable trays that were opened" />
              {instrumentSets.length > 0 ? (
                <View className="bg-white rounded-2xl border border-[#E5E0D8] px-4 pt-1 pb-2">
                  {instrumentSets.map(is => (
                    <ItemRow
                      key={is.id}
                      name={is.name}
                      emKg={is.per_use_emission_kg}
                      qty={getSetQty(is.id)}
                      onAdd={() => addSet(is)}
                      onRemove={() => removeSet(is)}
                    />
                  ))}
                </View>
              ) : (
                <View className="items-center py-10">
                  <Text className="text-2xl mb-2">📦</Text>
                  <Text className="text-sm text-green-900/50 text-center" style={{ fontFamily: 'Georgia' }}>
                    No instrument trays configured.{'\n'}Skip to continue.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ══ Step 3: Details ══ */}
          {step === 3 && (
            <View>
              <StepHeader title="Case Details" subtitle="Duration and anesthesia" />

              <SectionLabel>Duration (minutes)</SectionLabel>
              <View className="flex-row flex-wrap" style={{ gap: 8, marginBottom: 8 }}>
                {[30, 60, 90, 120, 150, 180, 240, 300].map(mins => (
                  <TouchableOpacity
                    key={mins}
                    onPress={() => setState(s => ({ ...s, duration_minutes: mins }))}
                    className="rounded-xl py-3 px-4"
                    style={{
                      backgroundColor: state.duration_minutes === mins ? '#1B4332' : '#F0EBE3',
                    }}
                  >
                    <Text
                      className="text-sm font-bold"
                      style={{
                        fontFamily: 'Georgia',
                        color: state.duration_minutes === mins ? '#FFFFFF' : '#1B4332',
                      }}
                    >
                      {mins}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                className="bg-white border border-[#E5E0D8] rounded-xl px-4 py-3 text-green-900 text-sm mb-5"
                style={{ fontFamily: 'Georgia' }}
                placeholder="Or type exact duration…"
                placeholderTextColor="#1B433260"
                keyboardType="number-pad"
                value={state.duration_minutes != null && ![30,60,90,120,150,180,240,300].includes(state.duration_minutes)
                  ? String(state.duration_minutes) : ''}
                onChangeText={t => {
                  const n = parseInt(t, 10)
                  if (!isNaN(n) && n > 0) setState(s => ({ ...s, duration_minutes: n }))
                  else if (t === '') setState(s => ({ ...s, duration_minutes: null }))
                }}
              />

              <SectionLabel>Anesthesia Type</SectionLabel>
              <View className="mb-5">
                <ChipRow
                  options={ANESTHESIA_TYPES}
                  selected={state.anesthesia_type}
                  onSelect={v => setState(s => ({ ...s, anesthesia_type: v }))}
                />
              </View>

              <SectionLabel>Anesthesia Gas / Technique</SectionLabel>
              <View className="mb-5">
                <ChipRow
                  options={ANESTHESIA_GASES}
                  selected={state.anesthesia_gas}
                  onSelect={v => setState(s => ({ ...s, anesthesia_gas: v }))}
                />
              </View>

              <SectionLabel>Notes (optional)</SectionLabel>
              <TextInput
                className="bg-white border border-[#E5E0D8] rounded-xl px-4 py-3 text-green-900 text-sm"
                style={{ fontFamily: 'Georgia', minHeight: 80, textAlignVertical: 'top' }}
                placeholder="Any relevant notes…"
                placeholderTextColor="#1B433260"
                value={state.notes}
                onChangeText={t => setState(s => ({ ...s, notes: t }))}
                multiline
                numberOfLines={3}
              />
            </View>
          )}

          {/* ══ Step 4: Review ══ */}
          {step === 4 && (
            <View>
              <StepHeader title="Review" subtitle="Double-check before submitting" />

              {/* Emissions summary */}
              <View
                className="rounded-2xl p-5 items-center mb-5"
                style={{ backgroundColor: '#F0F7F2', borderWidth: 1, borderColor: '#D1E8DA' }}
              >
                <Text className="text-xs text-green-700/60 uppercase tracking-wider mb-1" style={{ fontFamily: 'Georgia' }}>
                  Total Emissions
                </Text>
                <Text
                  className="text-4xl font-bold"
                  style={{ fontFamily: 'Georgia', color: emColor(totalEmissions) }}
                >
                  {totalEmissions.toFixed(2)}
                </Text>
                <Text className="text-sm text-green-700/60 mt-1" style={{ fontFamily: 'Georgia' }}>
                  kg CO₂e
                </Text>
              </View>

              {/* Procedure details */}
              <View className="bg-white rounded-2xl border border-[#E5E0D8] mb-4 overflow-hidden">
                <ReviewRow label="Procedure" value={`${state.cpt_code} — ${state.procedure_name}`} />
                <ReviewRow label="Approach" value={state.surgical_approach ?? '—'} capitalize />
                <ReviewRow label="Duration" value={state.duration_minutes ? `${state.duration_minutes} min` : '—'} />
                <ReviewRow label="Anesthesia" value={state.anesthesia_type?.toUpperCase() ?? '—'} />
                <ReviewRow label="Gas" value={state.anesthesia_gas?.toUpperCase() ?? '—'} last />
              </View>

              {/* Equipment summary */}
              {(state.items.length > 0 || state.sets.length > 0) && (
                <View className="bg-white rounded-2xl border border-[#E5E0D8] mb-4 overflow-hidden">
                  <View className="px-4 py-3 border-b border-[#E5E0D8]">
                    <Text className="text-xs font-bold text-green-900/50 uppercase tracking-wider" style={{ fontFamily: 'Georgia' }}>
                      Equipment & Trays
                    </Text>
                  </View>
                  {state.items.map((item, i) => (
                    <ReviewRow
                      key={item.equipment_id}
                      label={item.name}
                      value={`×${item.quantity} · ${(item.quantity * item.emission_factor_kg).toFixed(2)} kg`}
                      last={i === state.items.length - 1 && state.sets.length === 0}
                    />
                  ))}
                  {state.sets.map((set, i) => (
                    <ReviewRow
                      key={set.instrument_set_id}
                      label={set.name}
                      value={`×${set.quantity} · ${(set.quantity * set.per_use_emission_kg).toFixed(2)} kg`}
                      last={i === state.sets.length - 1}
                    />
                  ))}
                </View>
              )}

              {state.notes ? (
                <View className="bg-white rounded-2xl border border-[#E5E0D8] mb-4 px-4 py-3">
                  <Text className="text-xs font-bold text-green-900/50 uppercase tracking-wider mb-1" style={{ fontFamily: 'Georgia' }}>
                    Notes
                  </Text>
                  <Text className="text-sm text-green-900" style={{ fontFamily: 'Georgia' }}>
                    {state.notes}
                  </Text>
                </View>
              ) : null}

              {/* Submit */}
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting || !canSubmit}
                className="bg-green-900 rounded-2xl py-5 items-center mt-2"
                style={{ opacity: submitting || !canSubmit ? 0.5 : 1 }}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold text-base" style={{ fontFamily: 'Georgia' }}>
                    Submit Case
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>

        {/* Bottom nav (steps 0–3 only) */}
        {step < 4 && (
          <View className="px-5 pb-4 pt-2 border-t border-[#E5E0D8] bg-white">
            <TouchableOpacity
              onPress={() => setStep(s => s + 1)}
              disabled={!canAdvance}
              className="bg-green-900 rounded-xl py-4 items-center"
              style={{ opacity: canAdvance ? 1 : 0.3 }}
            >
              <Text className="text-white font-bold text-base" style={{ fontFamily: 'Georgia' }}>
                {step === 3 ? 'Review →' : 'Continue →'}
              </Text>
            </TouchableOpacity>
            {step > 0 && (
              <Text className="text-xs text-green-900/30 text-center mt-2" style={{ fontFamily: 'Georgia' }}>
                Tap Continue to skip this step
              </Text>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function ReviewRow({
  label, value, last, capitalize,
}: {
  label: string; value: string; last?: boolean; capitalize?: boolean
}) {
  return (
    <View
      className="flex-row justify-between items-start px-4 py-3"
      style={{ borderBottomWidth: last ? 0 : 1, borderBottomColor: '#E5E0D8' }}
    >
      <Text
        className="text-sm text-green-900/50 flex-shrink-0 mr-4"
        style={{ fontFamily: 'Georgia', maxWidth: '40%' }}
      >
        {label}
      </Text>
      <Text
        className="text-sm font-bold text-green-900 text-right flex-1"
        style={{ fontFamily: 'Georgia', textTransform: capitalize ? 'capitalize' : 'none' }}
        numberOfLines={3}
      >
        {value}
      </Text>
    </View>
  )
}
