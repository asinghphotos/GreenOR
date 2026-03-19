import { View, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

// TODO: Implement case history with filters (date range, approach, CPT category)

export default function HistoryScreen() {
  return (
    <SafeAreaView className="flex-1 bg-beige-100 items-center justify-center px-6">
      <Text className="text-3xl mb-4">📊</Text>
      <Text className="text-xl font-bold text-green-900 text-center" style={{ fontFamily: 'Georgia' }}>
        Case History
      </Text>
      <Text className="text-sm text-green-900/50 text-center mt-2" style={{ fontFamily: 'Georgia' }}>
        Your full case history with filters — coming soon.
      </Text>
    </SafeAreaView>
  )
}
