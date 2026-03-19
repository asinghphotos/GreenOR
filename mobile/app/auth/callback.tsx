import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const params = useLocalSearchParams()

  useEffect(() => {
    const { access_token, refresh_token } = params

    if (access_token && refresh_token) {
      supabase.auth
        .setSession({
          access_token: access_token as string,
          refresh_token: refresh_token as string,
        })
        .then(({ error }) => {
          if (error) {
            router.replace('/')
          } else {
            router.replace('/(tabs)')
          }
        })
    } else {
      router.replace('/')
    }
  }, [])

  return (
    <View className="flex-1 bg-beige-100 items-center justify-center">
      <ActivityIndicator color="#1B4332" size="large" />
    </View>
  )
}
