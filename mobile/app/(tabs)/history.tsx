import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { fmtEmissions, emColor } from '../../lib/emissions'
import type { CaseWithDetails, SurgicalApproach } from '../../lib/types'

const APPROACH_FILTERS: Array<SurgicalApproach | 'all'> = ['all', 'laparoscopic', 'robotic', 'open', 'hybrid']

function EmBadge({ kg }: { kg: number }) {
  const color = emColor(kg)
  const bg = kg < 4 ? '#F0F7F2' : kg <= 8 ? '#FFFBEB' : '#FFF5F5'
  const border = kg < 4 ? '#D1E8DA' : kg <= 8 ? '#FDE68A' : '#FECACA'
  return (
    <View
      className="rounded-lg px-2.5 py-1"
      style={{ backgroundColor: bg, borderWidth: 1, borderColor: border }}
    >
      <Text className="text-xs font-bold" style={{ fontFamily: 'Georgia', color }}>
        {fmtEmissions(kg).replace(' kg CO₂e', ' kg')}
      </Text>
    </View>
  )
}

function CaseCard({ item, onPress }: { item: CaseWithDetails; onPress: () => void }) {
  const date = new Date(item.case_date)
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-white rounded-2xl border border-[#E5E0D8] p-4 mb-3"
      activeOpacity={0.7}
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-3">
          <Text
            className="text-sm font-bold text-green-900"
            style={{ fontFamily: 'Georgia' }}
            numberOfLines={2}
          >
            {item.procedure_name}
          </Text>
          <View className="flex-row items-center mt-1.5" style={{ gap: 6 }}>
            <View
              className="px-2 py-0.5 rounded-md"
              style={{ backgroundColor: '#F0EBE3' }}
            >
              <Text
                className="text-xs text-green-900/70 capitalize"
                style={{ fontFamily: 'Georgia' }}
              >
                {item.surgical_approach}
              </Text>
            </View>
            <Text className="text-xs text-green-900/40" style={{ fontFamily: 'Georgia' }}>
              {dateStr}
            </Text>
          </View>
          <Text className="text-xs text-green-900/40 mt-1" style={{ fontFamily: 'Georgia' }}>
            {item.duration_minutes} min · {item.anesthesia_gas?.toUpperCase()}
          </Text>
        </View>
        <EmBadge kg={item.total_emissions_kg} />
      </View>
    </TouchableOpacity>
  )
}

function StatsBar({ cases }: { cases: CaseWithDetails[] }) {
  if (cases.length === 0) return null
  const total = cases.reduce((s, c) => s + c.total_emissions_kg, 0)
  const avg = total / cases.length
  const best = Math.min(...cases.map(c => c.total_emissions_kg))
  return (
    <View className="bg-white border border-[#E5E0D8] rounded-2xl mx-5 mb-4 px-4 py-3">
      <View className="flex-row justify-between">
        <StatCell label="Cases" value={String(cases.length)} />
        <View className="w-px bg-[#E5E0D8]" />
        <StatCell label="Avg CO₂e" value={`${avg.toFixed(1)} kg`} color={emColor(avg)} />
        <View className="w-px bg-[#E5E0D8]" />
        <StatCell label="Best" value={`${best.toFixed(1)} kg`} color={emColor(best)} />
      </View>
    </View>
  )
}

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View className="flex-1 items-center">
      <Text className="text-xs text-green-900/50" style={{ fontFamily: 'Georgia' }}>{label}</Text>
      <Text
        className="text-sm font-bold mt-0.5"
        style={{ fontFamily: 'Georgia', color: color ?? '#1B4332' }}
      >
        {value}
      </Text>
    </View>
  )
}

export default function HistoryScreen() {
  const router = useRouter()
  const [cases, setCases] = useState<CaseWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [approachFilter, setApproachFilter] = useState<SurgicalApproach | 'all'>('all')
  const [sortBy, setSortBy] = useState<'date' | 'emissions'>('date')

  useEffect(() => {
    loadCases()
  }, [])

  async function loadCases() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('cases_with_details')
      .select('*')
      .eq('user_id', user.id)
      .order('case_date', { ascending: false })
    if (data) setCases(data)
    setLoading(false)
  }

  const filtered = cases
    .filter(c => {
      if (approachFilter !== 'all' && c.surgical_approach !== approachFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          c.procedure_name?.toLowerCase().includes(q) ||
          c.cpt_code?.includes(q) ||
          c.procedure_category?.toLowerCase().includes(q)
        )
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'emissions') return b.total_emissions_kg - a.total_emissions_kg
      return new Date(b.case_date).getTime() - new Date(a.case_date).getTime()
    })

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#F9F5EE] items-center justify-center">
        <ActivityIndicator color="#1B4332" size="large" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F9F5EE]">
      {/* Header */}
      <View className="px-5 pt-4 pb-2">
        <Text className="text-2xl font-bold text-green-900" style={{ fontFamily: 'Georgia' }}>
          Case History
        </Text>
        <Text className="text-sm text-green-900/50 mt-0.5" style={{ fontFamily: 'Georgia' }}>
          {cases.length} {cases.length === 1 ? 'case' : 'cases'} logged
        </Text>
      </View>

      {/* Search */}
      <View className="px-5 mb-3">
        <TextInput
          className="bg-white border border-[#E5E0D8] rounded-xl px-4 py-2.5 text-green-900 text-sm"
          style={{ fontFamily: 'Georgia' }}
          placeholder="Search procedures…"
          placeholderTextColor="#1B433260"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCapitalize="none"
        />
      </View>

      {/* Approach filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-3"
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
      >
        {APPROACH_FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setApproachFilter(f)}
            className="px-3.5 py-2 rounded-xl"
            style={{
              backgroundColor: approachFilter === f ? '#1B4332' : '#FFFFFF',
              borderWidth: 1,
              borderColor: approachFilter === f ? '#1B4332' : '#E5E0D8',
            }}
          >
            <Text
              className="text-xs font-bold capitalize"
              style={{
                fontFamily: 'Georgia',
                color: approachFilter === f ? '#FFFFFF' : '#1B4332',
              }}
            >
              {f === 'all' ? 'All' : f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sort toggle */}
      <View className="flex-row px-5 mb-3" style={{ gap: 8 }}>
        <TouchableOpacity
          onPress={() => setSortBy('date')}
          className="flex-1 py-2 rounded-xl items-center"
          style={{
            backgroundColor: sortBy === 'date' ? '#1B4332' : '#FFFFFF',
            borderWidth: 1,
            borderColor: sortBy === 'date' ? '#1B4332' : '#E5E0D8',
          }}
        >
          <Text
            className="text-xs font-bold"
            style={{ fontFamily: 'Georgia', color: sortBy === 'date' ? '#FFFFFF' : '#1B4332' }}
          >
            By Date
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSortBy('emissions')}
          className="flex-1 py-2 rounded-xl items-center"
          style={{
            backgroundColor: sortBy === 'emissions' ? '#1B4332' : '#FFFFFF',
            borderWidth: 1,
            borderColor: sortBy === 'emissions' ? '#1B4332' : '#E5E0D8',
          }}
        >
          <Text
            className="text-xs font-bold"
            style={{ fontFamily: 'Georgia', color: sortBy === 'emissions' ? '#FFFFFF' : '#1B4332' }}
          >
            By Emissions ↓
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats bar for filtered set */}
      <StatsBar cases={filtered} />

      {/* Case list */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View className="items-center py-16">
            {cases.length === 0 ? (
              <>
                <Text className="text-4xl mb-3">🌱</Text>
                <Text className="text-base font-bold text-green-900 text-center" style={{ fontFamily: 'Georgia' }}>
                  No cases yet
                </Text>
                <Text className="text-sm text-green-900/50 text-center mt-1" style={{ fontFamily: 'Georgia' }}>
                  Log your first case to start tracking your surgical footprint.
                </Text>
              </>
            ) : (
              <>
                <Text className="text-3xl mb-3">🔍</Text>
                <Text className="text-sm text-green-900/50 text-center" style={{ fontFamily: 'Georgia' }}>
                  No cases match your filters.
                </Text>
                <TouchableOpacity
                  onPress={() => { setSearch(''); setApproachFilter('all') }}
                  className="mt-3"
                >
                  <Text className="text-sm text-green-700 underline" style={{ fontFamily: 'Georgia' }}>
                    Clear filters
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          filtered.map(c => (
            <CaseCard
              key={c.id}
              item={c}
              onPress={() => {
                // Navigate to case detail when built
                // router.push(`/case/${c.id}`)
              }}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
