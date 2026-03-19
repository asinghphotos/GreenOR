import { useEffect, useState } from 'react'
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { fmtEmissions, emColor } from '../../lib/emissions'
import type { Profile, CaseWithDetails } from '../../lib/types'

export default function HomeScreen() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [cases, setCases] = useState<CaseWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/'); return }

    const [profileRes, casesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase
        .from('cases_with_details')
        .select('*')
        .eq('user_id', user.id)
        .order('case_date', { ascending: false })
        .limit(50),
    ])

    if (profileRes.data) setProfile(profileRes.data)
    if (casesRes.data) setCases(casesRes.data)
    setLoading(false)
  }

  const totalEmissions = cases.reduce((sum, c) => sum + c.total_emissions_kg, 0)
  const avgEmissions = cases.length ? totalEmissions / cases.length : 0
  const recentCases = cases.slice(0, 5)

  if (loading) {
    return (
      <View className="flex-1 bg-beige-100 items-center justify-center">
        <ActivityIndicator color="#1B4332" size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-beige-100">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-green-900" style={{ fontFamily: 'Georgia' }}>
            Good morning{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </Text>
          <Text className="text-sm text-green-900/50 mt-1" style={{ fontFamily: 'Georgia' }}>
            {profile?.institution || 'GreenOR'}
          </Text>
        </View>

        {/* Stats row */}
        <View className="flex-row gap-3 mb-4">
          <StatCard label="Total Cases" value={String(cases.length)} />
          <StatCard label="Total CO₂e" value={fmtEmissions(totalEmissions).replace(' kg CO₂e', ' kg')} />
        </View>
        <View className="flex-row gap-3 mb-6">
          <StatCard label="Avg / Case" value={fmtEmissions(avgEmissions).replace(' kg CO₂e', ' kg')} color={emColor(avgEmissions)} />
          <StatCard label="This Month" value={`${cases.filter(c => new Date(c.case_date).getMonth() === new Date().getMonth()).length} cases`} />
        </View>

        {/* Log CTA */}
        <TouchableOpacity
          className="bg-green-900 rounded-2xl py-5 items-center mb-6 active:opacity-80"
          onPress={() => router.push('/(tabs)/log')}
        >
          <Text className="text-white font-bold text-base" style={{ fontFamily: 'Georgia' }}>
            📋  Log a Case
          </Text>
        </TouchableOpacity>

        {/* Recent cases */}
        {recentCases.length > 0 && (
          <View>
            <Text className="text-sm font-bold text-green-900/60 uppercase tracking-wider mb-3" style={{ fontFamily: 'Georgia' }}>
              Recent Cases
            </Text>
            {recentCases.map(c => (
              <CaseRow key={c.id} case={c} />
            ))}
          </View>
        )}

        {cases.length === 0 && (
          <View className="bg-white rounded-2xl p-8 border border-beige-300 items-center">
            <Text className="text-3xl mb-3">🌱</Text>
            <Text className="text-base font-bold text-green-900 text-center" style={{ fontFamily: 'Georgia' }}>
              No cases yet
            </Text>
            <Text className="text-sm text-green-900/50 text-center mt-1" style={{ fontFamily: 'Georgia' }}>
              Log your first case to start tracking your surgical footprint.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View className="flex-1 bg-white rounded-2xl p-4 border border-beige-300">
      <Text className="text-xs text-green-900/50 mb-1" style={{ fontFamily: 'Georgia' }}>
        {label}
      </Text>
      <Text
        className="text-lg font-bold"
        style={{ fontFamily: 'Georgia', color: color ?? '#1B4332' }}
      >
        {value}
      </Text>
    </View>
  )
}

function CaseRow({ case: c }: { case: CaseWithDetails }) {
  return (
    <View className="bg-white rounded-2xl p-4 border border-beige-300 mb-2 flex-row justify-between items-center">
      <View className="flex-1 mr-4">
        <Text className="text-sm font-bold text-green-900" style={{ fontFamily: 'Georgia' }} numberOfLines={1}>
          {c.procedure_name}
        </Text>
        <Text className="text-xs text-green-900/50 mt-0.5 capitalize" style={{ fontFamily: 'Georgia' }}>
          {c.surgical_approach} · {new Date(c.case_date).toLocaleDateString()}
        </Text>
      </View>
      <Text
        className="text-sm font-bold"
        style={{ fontFamily: 'Georgia', color: emColor(c.total_emissions_kg) }}
      >
        {fmtEmissions(c.total_emissions_kg).replace(' kg CO₂e', ' kg')}
      </Text>
    </View>
  )
}
