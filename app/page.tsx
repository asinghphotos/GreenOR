'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (target === 0) return
    const duration = 1200
    const steps = 36
    const increment = target / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, duration / steps)
    return () => clearInterval(timer)
  }, [target])

  return <span>{count.toLocaleString()}{suffix}</span>
}

export default function LandingPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [globalStats, setGlobalStats] = useState({ cases: 0, emissions: 0, institutions: 0, surgeons: 0 })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) router.push('/dashboard')
    }, 2000)
    return () => clearInterval(interval)
  }, [router, supabase])

  useEffect(() => {
    async function fetchGlobalStats() {
      const [casesRes, profilesRes] = await Promise.all([
        supabase.from('cases').select('total_emissions_kg'),
        supabase.from('profiles').select('institution'),
      ])
      const cases = casesRes.data?.length ?? 0
      const emissions = Math.round(
        casesRes.data?.reduce((sum, c) => sum + (c.total_emissions_kg ?? 0), 0) ?? 0
      )
      const institutions = new Set(
        profilesRes.data?.map((p) => p.institution).filter(Boolean)
      ).size
      const surgeons = profilesRes.data?.length ?? 0
      setGlobalStats({ cases, emissions, institutions, surgeons })
    }
    fetchGlobalStats()
  }, [supabase])

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
    <div className="min-h-screen flex flex-col relative overflow-hidden">

      {/* ── Ambient background glow ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="glow-orb w-[700px] h-[500px] bg-green-100"
          style={{ top: '-120px', left: '50%', transform: 'translateX(-50%)' }}
        />
        <div
          className="glow-orb w-[400px] h-[300px] bg-green-50"
          style={{ bottom: '10%', right: '-100px', animationDelay: '0.6s' }}
        />
      </div>

      {/* ── Nav ── */}
      <nav className="relative flex items-center px-6 sm:px-10 py-3 max-w-5xl mx-auto w-full">
        <div className="flex-1" />
        <div className="text-2xl font-bold tracking-tight text-green-900">
          Green<span className="text-green-500">OR</span>
        </div>
        <div className="flex-1 flex justify-end">
          <a
            href="/login"
            className="nav-link-animated text-sm font-medium text-green-700 hover:text-green-900 transition-colors"
          >
            Sign in
          </a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative flex-1 flex items-center px-6 sm:px-10 py-3 max-w-2xl mx-auto w-full text-center">
        <div className="w-full">
          <div className="animate-fade-up mb-3">
            <span className="badge-pill">
              Measure · Compare · Reduce
            </span>
          </div>
          <h1 className="animate-fade-up delay-1 text-3xl sm:text-[2.75rem] font-bold text-green-900 mb-3 leading-[1.15] tracking-tight">
            Sustainable surgery starts with knowing your footprint
          </h1>
          <p className="animate-fade-up delay-2 text-lg sm:text-xl text-green-700/80 mb-5 leading-relaxed max-w-lg mx-auto">
            Track instruments, measure carbon emissions per case, and make data-driven choices to reduce OR waste.
          </p>

          <form onSubmit={handleSubmit} className="animate-fade-up delay-3 max-w-md mx-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="input-base flex-1 text-center sm:text-left"
                disabled={status === 'loading' || status === 'sent'}
              />
              <button
                type="submit"
                disabled={status === 'loading' || status === 'sent'}
                className="btn-primary whitespace-nowrap"
              >
                {status === 'loading' ? 'Sending...' : status === 'sent' ? 'Check email ✓' : 'Get Started'}
              </button>
            </div>
            {message && (
              <p className={`mt-3 text-sm font-medium ${status === 'error' ? 'text-red-600' : 'text-green-700'}`}>
                {message}
              </p>
            )}
            <p className="mt-3 text-xs text-green-700/50">
              No password needed — we&apos;ll send you a magic link.
            </p>
          </form>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="animate-fade-up delay-4 px-6 sm:px-10 py-2 max-w-4xl mx-auto w-full">
        <div className="text-center mb-3">
          <h2 className="text-xl sm:text-2xl font-bold text-green-900 tracking-tight">
            How it works
          </h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              num: '01',
              title: 'Log Your Case',
              desc: 'Our guided wizard walks you through every instrument and supply used — from trocars to sutures.',
            },
            {
              num: '02',
              title: 'See Your Impact',
              desc: 'Instantly calculate per-case carbon emissions. Compare lap vs. robotic vs. open approaches.',
            },
            {
              num: '03',
              title: 'Drive Change',
              desc: 'Build streaks, beat personal bests, and see how small choices add up to real environmental impact.',
            },
          ].map((feature, i) => (
            <div key={i} className="hover-lift card card-accent-top p-5 text-center">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-green-50 to-green-100 text-green-700 text-xs font-bold mb-3 shadow-sm">
                {feature.num}
              </div>
              <h3 className="text-sm font-bold text-green-900 mb-1.5">{feature.title}</h3>
              <p className="text-xs text-green-700/70 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Global Impact ── */}
      <section className="animate-fade-up delay-5 px-6 sm:px-10 py-2 max-w-4xl mx-auto w-full">
        <div className="text-center mb-3">
          <h2 className="text-xl sm:text-2xl font-bold text-green-900 tracking-tight">
            Global Impact
          </h2>
          <p className="mt-1 text-green-700/60 text-sm">Growing every day.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Cases Logged', value: globalStats.cases },
            { label: 'kg CO₂e Tracked', value: globalStats.emissions },
            { label: 'Institutions', value: globalStats.institutions },
            { label: 'Surgeons', value: globalStats.surgeons },
          ].map((stat, i) => (
            <div key={i} className="hover-lift card p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-green-900 mb-0.5">
                <CountUp target={stat.value} />
              </div>
              <div className="text-xs text-green-700/60 font-medium uppercase tracking-wide">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative px-6 py-2 text-center">
        <div className="text-sm font-bold text-green-900/30 tracking-tight">
          Green<span className="text-green-500/40">OR</span>
        </div>
      </footer>

    </div>
  )
}
