'use client'

// This page is only for local development — it bypasses magic-link auth
// and signs in with a seeded test account so we can preview UI changes.
// It refuses to render in production.

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

export default function DevLoginPage() {
  const router = useRouter()
  const supabase = createClient()

  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600 font-medium">
        Not available in production.
      </div>
    )
  }

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email: 'dev@greenor.dev',
      password: 'devtest123!',
    })
    if (error) {
      alert('Dev login failed: ' + error.message)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-beige px-6">
      <div className="w-full max-w-sm text-center">
        <div className="card p-8 space-y-4">
          <div className="text-2xl font-bold text-green-900">
            Green<span className="text-green-500">OR</span>
          </div>
          <div className="text-xs font-mono bg-yellow-50 border border-yellow-200 text-yellow-800 rounded px-3 py-2">
            DEV PREVIEW — not visible in production
          </div>
          <p className="text-sm text-green-700/60">
            Signs in as <span className="font-mono font-medium">dev@greenor.dev</span>
          </p>
          <button
            onClick={handleLogin}
            className="btn-primary w-full"
          >
            Sign in as Dev User
          </button>
        </div>
      </div>
    </div>
  )
}
