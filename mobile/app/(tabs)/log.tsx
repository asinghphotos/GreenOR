import { View, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

// TODO: Implement 7-step case logging wizard
// Steps: CPT code → surgical approach → equipment → instrument sets → duration → anesthesia → notes/submit

export default function LogScreen() {
  return (
    <SafeAreaView className="flex-1 bg-beige-100 items-center justify-center px-6">
      <Text className="text-3xl mb-4">📋</Text>
      <Text className="text-xl font-bold text-green-900 text-center" style={{ fontFamily: 'Georgia' }}>
        Case Log
      </Text>
      <Text className="text-sm text-green-900/50 text-center mt-2" style={{ fontFamily: 'Georgia' }}>
        The 7-step case logging wizard is coming soon.
      </Text>
    </SafeAreaView>
  )
}
