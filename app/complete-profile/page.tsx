'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { ROLES, type Role } from '@/lib/types'

export default function CompleteProfilePage() {
  const [institution, setInstitution] = useState('')
  const [role, setRole] = useState<Role | ''>('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!institution || !role) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('profiles')
      .update({ institution, role })
      .eq('id', user.id)

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        {/* Logo */}
        <div className="mb-10">
          <span className="text-3xl font-bold tracking-tight text-green-900">
            Green<span className="text-green-500">OR</span>
          </span>
        </div>

        <div className="animate-scale-in card p-8 sm:p-10 text-left">
          <div className="text-center mb-8">
            <h1 className="text-xl font-bold text-green-900 mb-2">Complete Your Profile</h1>
            <p className="text-sm text-green-700/60">
              Two quick fields to get you started.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Institution */}
            <div>
              <label className="block text-sm font-bold text-green-900 mb-2">
                Institution
              </label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="e.g. GWU Hospital"
                required
                className="input-base"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-bold text-green-900 mb-3">
                Role
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`py-3 px-4 rounded-xl text-sm font-semibold capitalize tap-scale transition-all ${
                      role === r
                        ? 'bg-green-900 text-white shadow-sm'
                        : 'bg-beige-100 text-green-900 hover:bg-beige-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={!institution || !role || saving}
              className="btn-primary w-full"
            >
              {saving ? 'Saving...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
