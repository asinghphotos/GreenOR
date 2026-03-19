import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../lib/types'

export default function ProfileScreen() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) setProfile(data)
      setLoading(false)
    })
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  if (loading) {
    return (
      <View className="flex-1 bg-beige-100 items-center justify-center">
        <ActivityIndicator color="#1B4332" />
      </View>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-beige-100 px-5">
      <View className="mt-6 mb-6">
        <Text className="text-2xl font-bold text-green-900" style={{ fontFamily: 'Georgia' }}>
          Profile
        </Text>
      </View>

      <View className="bg-white rounded-2xl p-5 border border-beige-300 mb-4">
        <ProfileRow label="Name" value={profile?.full_name ?? '—'} />
        <ProfileRow label="Email" value={profile?.email ?? '—'} />
        <ProfileRow label="Role" value={profile?.role ?? '—'} capitalize />
        <ProfileRow label="Institution" value={profile?.institution ?? '—'} last />
      </View>

      <TouchableOpacity
        className="bg-white rounded-2xl py-4 px-5 border border-beige-300 items-center active:opacity-70"
        onPress={signOut}
      >
        <Text className="text-red-600 font-bold text-base" style={{ fontFamily: 'Georgia' }}>
          Sign Out
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

function ProfileRow({ label, value, capitalize, last }: { label: string; value: string; capitalize?: boolean; last?: boolean }) {
  return (
    <View className={`flex-row justify-between py-3 ${!last ? 'border-b border-beige-300' : ''}`}>
      <Text className="text-sm text-green-900/50" style={{ fontFamily: 'Georgia' }}>{label}</Text>
      <Text
        className={`text-sm font-bold text-green-900 ${capitalize ? 'capitalize' : ''}`}
        style={{ fontFamily: 'Georgia' }}
      >
        {value}
      </Text>
    </View>
  )
}
