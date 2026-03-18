import { WizardItem, WizardSet } from './types'

export function calcItemEmissions(items: WizardItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.emission_factor_kg, 0)
}

export function calcSetEmissions(sets: WizardSet[]): number {
  return sets.reduce((sum, set) => sum + set.quantity * set.per_use_emission_kg, 0)
}

export function calcTotalEmissions(items: WizardItem[], sets: WizardSet[]): number {
  return calcItemEmissions(items) + calcSetEmissions(sets)
}

export function fmtEmissions(kg: number): string {
  if (kg < 0.01) return '0.00 kg CO₂e'
  return `${kg.toFixed(2)} kg CO₂e`
}

export function emColor(kg: number): string {
  if (kg < 4) return 'text-green-700'
  if (kg <= 8) return 'text-amber-700'
  return 'text-red-700'
}

export function emBgColor(kg: number): string {
  if (kg < 4) return 'bg-green-50'
  if (kg <= 8) return 'bg-amber-50'
  return 'bg-red-50'
}
