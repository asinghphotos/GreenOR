'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) router.push('/dashboard')
    }, 2000)
    return () => clearInterval(interval)
  }, [router, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setStatus('loading')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setStatus('error')
      setMessage(error.message)
    } else {
      setStatus('sent')
      setMessage('Check your email for a magic link!')
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="animate-fade-up w-full max-w-sm text-center">
        {/* Logo */}
        <a href="/" className="inline-block mb-10">
          <span className="text-3xl font-bold tracking-tight text-green-900">
            Green<span className="text-green-500">OR</span>
          </span>
        </a>

        <div className="card p-8 sm:p-10">
          <h1 className="text-xl font-bold text-green-900 mb-2">Welcome back</h1>
          <p className="text-sm text-green-700/60 mb-8">
            Sign in with a magic link — no password needed.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="input-base text-center"
              disabled={status === 'loading' || status === 'sent'}
            />
            <button
              type="submit"
              disabled={status === 'loading' || status === 'sent'}
              className="btn-primary w-full"
            >
              {status === 'loading' ? 'Sending...' : status === 'sent' ? 'Check your email ✓' : 'Send Magic Link'}
            </button>
          </form>

          {message && (
            <p className={`mt-5 text-sm font-medium ${status === 'error' ? 'text-red-600' : 'text-green-700'}`}>
              {message}
            </p>
          )}
        </div>

        <a
          href="/"
          className="inline-block mt-8 text-sm text-green-700/50 hover:text-green-700 transition-colors"
        >
          ← Back to home
        </a>
      </div>
    </div>
  )
}
