// ── Database row types ──

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: Role
  institution: string
  created_at: string
}

export interface CptCode {
  code: string
  description: string
  category: string
  common_approaches: string[]
  created_at: string
}

export interface Equipment {
  id: string
  name: string
  category: string
  manufacturer: string | null
  emission_factor_kg: number
  is_reusable: boolean
  emission_source: string | null
  confidence: string
  created_at: string
}

export interface InstrumentSet {
  id: string
  name: string
  institution: string
  per_use_emission_kg: number
  description: string | null
  created_at: string
}

export interface Case {
  id: string
  user_id: string
  cpt_code: string
  surgical_approach: SurgicalApproach
  case_date: string
  duration_minutes: number
  anesthesia_type: string
  anesthesia_gas: string
  institution: string
  total_emissions_kg: number
  notes: string | null
  created_at: string
}

export interface CaseItem {
  id: string
  case_id: string
  equipment_id: string
  quantity: number
  subtotal_emissions_kg: number
  created_at: string
}

export interface CaseSet {
  id: string
  case_id: string
  instrument_set_id: string
  quantity: number
  subtotal_emissions_kg: number
  created_at: string
}

// ── View types ──

export interface CaseWithDetails extends Case {
  procedure_name: string
  procedure_category: string
  logged_by: string
}

export interface EmissionsByApproach {
  procedure_name: string
  procedure_category: string
  surgical_approach: SurgicalApproach
  case_count: number
  avg_emissions: number
  min_emissions: number
  max_emissions: number
}

// ── Constants ──

export type SurgicalApproach = 'laparoscopic' | 'robotic' | 'open' | 'hybrid' | 'endoscopic'
export type Role = 'attending' | 'fellow' | 'resident' | 'student' | 'other'

export const APPROACHES: SurgicalApproach[] = ['laparoscopic', 'robotic', 'open', 'hybrid']
export const ANESTHESIA_TYPES = ['general', 'regional', 'mac', 'local'] as const
export const ANESTHESIA_GASES = ['sevoflurane', 'desflurane', 'isoflurane', 'nitrous', 'tiva'] as const
export const ROLES: Role[] = ['attending', 'fellow', 'resident', 'student', 'other']

// ── Wizard state ──

export interface WizardItem {
  equipment_id: string
  name: string
  quantity: number
  emission_factor_kg: number
}

export interface WizardSet {
  instrument_set_id: string
  name: string
  quantity: number
  per_use_emission_kg: number
}

export interface WizardState {
  cpt_code: string | null
  procedure_name: string | null
  surgical_approach: SurgicalApproach | null
  items: WizardItem[]
  sets: WizardSet[]
  duration_minutes: number | null
  anesthesia_type: string | null
  anesthesia_gas: string | null
  notes: string
}

export const initialWizardState: WizardState = {
  cpt_code: null,
  procedure_name: null,
  surgical_approach: null,
  items: [],
  sets: [],
  duration_minutes: null,
  anesthesia_type: null,
  anesthesia_gas: null,
  notes: '',
}
