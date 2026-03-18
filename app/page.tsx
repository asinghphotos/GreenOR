'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

function useScrollFade() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) el.classList.add('visible')
      },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return ref
}

function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    started.current = false
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const duration = 1500
          const steps = 40
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
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [target])

  return (
    <span ref={ref}>
      {count.toLocaleString()}{suffix}
    </span>
  )
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

  const featuresRef = useScrollFade()
  const impactRef = useScrollFade()

  return (
    <div className="min-h-screen">
      {/* ── Nav ── */}
      <nav className="relative flex items-center px-6 sm:px-10 py-5 max-w-5xl mx-auto">
        <div className="flex-1" />
        <div className="text-2xl font-bold tracking-tight text-green-900">
          Green<span className="text-green-500">OR</span>
        </div>
        <div className="flex-1 flex justify-end">
          <a
            href="/login"
            className="text-sm font-medium text-green-700 hover:text-green-900 transition-colors"
          >
            Sign in
          </a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="px-6 sm:px-10 pt-20 sm:pt-28 pb-28 max-w-2xl mx-auto text-center">
        <div className="animate-fade-up inline-block mb-6 px-4 py-1.5 bg-green-50 text-green-700 text-xs font-bold tracking-wide uppercase rounded-full">
          Measure · Compare · Reduce
        </div>
        <h1 className="animate-fade-up delay-1 text-4xl sm:text-[3.25rem] font-bold text-green-900 mb-6 leading-[1.15] tracking-tight">
          Sustainable surgery starts with knowing your footprint
        </h1>
        <p className="animate-fade-up delay-2 text-lg sm:text-xl text-green-700/80 mb-12 leading-relaxed max-w-lg mx-auto">
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
            <p className={`mt-4 text-sm font-medium ${status === 'error' ? 'text-red-600' : 'text-green-700'}`}>
              {message}
            </p>
          )}
          <p className="mt-4 text-xs text-green-700/50">
            No password needed — we&apos;ll send you a magic link.
          </p>
        </form>
      </section>

      {/* ── Features ── */}
      <section ref={featuresRef} className="scroll-fade px-6 sm:px-10 py-20 max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-green-900 tracking-tight">
            How it works
          </h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-5">
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
            <div
              key={i}
              className="hover-lift card p-7 text-center"
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-50 text-green-700 text-sm font-bold mb-5">
                {feature.num}
              </div>
              <h3 className="text-lg font-bold text-green-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-green-700/70 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Global Impact ── */}
      <section ref={impactRef} className="scroll-fade px-6 sm:px-10 py-20 max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-green-900 tracking-tight">
            Global Impact
          </h2>
          <p className="mt-3 text-green-700/60 text-lg">Growing every day.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Cases Logged', value: globalStats.cases },
            { label: 'kg CO₂e Tracked', value: globalStats.emissions },
            { label: 'Institutions', value: globalStats.institutions },
            { label: 'Surgeons', value: globalStats.surgeons },
          ].map((stat, i) => (
            <div key={i} className="card p-6 text-center">
              <div className="text-3xl sm:text-4xl font-bold text-green-900 mb-1">
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
      <footer className="px-6 py-12 text-center">
        <div className="text-lg font-bold text-green-900/30 tracking-tight mb-1">
          Green<span className="text-green-500/40">OR</span>
        </div>
        <p className="text-xs text-green-700/40">
          Making surgical sustainability visible, measurable, and actionable.
        </p>
      </footer>
    </div>
  )
}
