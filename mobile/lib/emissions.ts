// Mirrors web app lib/emissions.ts

export function fmtEmissions(kg: number): string {
  if (kg < 0.01) return '0.00 kg CO₂e'
  return `${kg.toFixed(2)} kg CO₂e`
}

export function emColorClass(kg: number): string {
  if (kg < 4) return 'text-green-700'
  if (kg <= 8) return 'text-amber-600'
  return 'text-red-700'
}

// Returns hex color for use with React Native style props (not NativeWind)
export function emColor(kg: number): string {
  if (kg < 4) return '#15803D'
  if (kg <= 8) return '#D97706'
  return '#DC2626'
}
