import { useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  // Redirect if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/(tabs)')
      } else {
        setCheckingSession(false)
      }
    })
  }, [])

  async function sendMagicLink() {
    if (!email.trim()) return
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: 'greenor://auth/callback',
      },
    })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  if (checkingSession) {
    return (
      <View className="flex-1 bg-beige-100 items-center justify-center">
        <ActivityIndicator color="#1B4332" />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-beige-100"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 px-6 justify-center">
        {/* Logo */}
        <View className="mb-10 items-center">
          <Text
            className="text-4xl font-bold text-green-900"
            style={{ fontFamily: 'Georgia' }}
          >
            GreenOR
          </Text>
          <Text
            className="text-base text-green-900/60 mt-2 text-center"
            style={{ fontFamily: 'Georgia' }}
          >
            Surgical sustainability tracking
          </Text>
        </View>

        {sent ? (
          <View className="bg-white rounded-2xl p-6 border border-beige-300 items-center">
            <Text className="text-2xl mb-3">📬</Text>
            <Text
              className="text-lg font-bold text-green-900 text-center mb-2"
              style={{ fontFamily: 'Georgia' }}
            >
              Check your email
            </Text>
            <Text
              className="text-sm text-green-900/60 text-center"
              style={{ fontFamily: 'Georgia' }}
            >
              We sent a magic link to{'\n'}
              <Text className="font-bold text-green-900">{email}</Text>
            </Text>
            <TouchableOpacity
              className="mt-4"
              onPress={() => { setSent(false); setEmail('') }}
            >
              <Text className="text-sm text-green-700 underline" style={{ fontFamily: 'Georgia' }}>
                Use a different email
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="bg-white rounded-2xl p-6 border border-beige-300">
            <Text
              className="text-sm font-bold text-green-900/70 mb-2 uppercase tracking-wider"
              style={{ fontFamily: 'Georgia' }}
            >
              Email
            </Text>
            <TextInput
              className="bg-beige-100 border border-beige-300 rounded-xl px-4 py-3 text-green-900 text-base mb-4"
              style={{ fontFamily: 'Georgia' }}
              placeholder="surgeon@hospital.org"
              placeholderTextColor="#1B433260"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="send"
              onSubmitEditing={sendMagicLink}
            />

            {error && (
              <Text className="text-red-600 text-sm mb-3" style={{ fontFamily: 'Georgia' }}>
                {error}
              </Text>
            )}

            <TouchableOpacity
              className="bg-green-900 rounded-xl py-4 items-center active:opacity-80"
              onPress={sendMagicLink}
              disabled={loading || !email.trim()}
              style={{ opacity: loading || !email.trim() ? 0.5 : 1 }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  className="text-white font-bold text-base"
                  style={{ fontFamily: 'Georgia' }}
                >
                  Send Magic Link
                </Text>
              )}
            </TouchableOpacity>

            <Text
              className="text-xs text-green-900/40 text-center mt-4"
              style={{ fontFamily: 'Georgia' }}
            >
              No password needed — we'll email you a sign-in link.
            </Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}
