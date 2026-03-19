// Mirrors web app lib/types.ts — keep in sync

export type SurgicalApproach = 'laparoscopic' | 'robotic' | 'open' | 'hybrid' | 'endoscopic'
export type Role = 'attending' | 'fellow' | 'resident' | 'student' | 'other'

export const APPROACHES: SurgicalApproach[] = ['laparoscopic', 'robotic', 'open', 'hybrid']
export const ANESTHESIA_TYPES = ['general', 'regional', 'mac', 'local'] as const
export const ANESTHESIA_GASES = ['sevoflurane', 'desflurane', 'isoflurane', 'nitrous', 'tiva'] as const
export const ROLES: Role[] = ['attending', 'fellow', 'resident', 'student', 'other']

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: Role
  institution: string
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

export interface CaseWithDetails extends Case {
  procedure_name: string
  procedure_category: string
  logged_by: string
}
