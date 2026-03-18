'use client'

import { useState } from 'react'
import { LeafIcon, ClipboardIcon, GlobeIcon } from '@/components/Icons'

const slides = [
  {
    title: 'Welcome to GreenOR',
    body: 'Track the environmental impact of every surgical case you participate in.',
    icon: <LeafIcon className="w-12 h-12" />,
  },
  {
    title: 'Log Your Cases',
    body: 'Our guided wizard records instruments, supplies, and anesthesia — we calculate the carbon footprint automatically.',
    icon: <ClipboardIcon className="w-12 h-12" />,
  },
  {
    title: 'Make a Difference',
    body: 'Compare approaches, build streaks, and see how small changes in the OR add up to big environmental impact.',
    icon: <GlobeIcon className="w-12 h-12" />,
  },
]

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [current, setCurrent] = useState(0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-6">
      <div className="animate-scale-in card p-10 max-w-sm w-full shadow-2xl text-center">
        <div className="flex justify-center mb-6 text-green-600">{slides[current].icon}</div>
        <h2 className="text-xl font-bold text-green-900 mb-3 tracking-tight">
          {slides[current].title}
        </h2>
        <p className="text-sm text-green-700/60 mb-8 leading-relaxed">
          {slides[current].body}
        </p>

        {/* Dots */}
        <div className="flex justify-center gap-2 mb-8">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                i === current ? 'bg-green-900 w-4' : 'bg-beige-300'
              }`}
            />
          ))}
        </div>

        <div className="flex gap-3">
          {current > 0 && (
            <button onClick={() => setCurrent(current - 1)} className="btn-secondary flex-1">
              Back
            </button>
          )}
          {current < slides.length - 1 ? (
            <button onClick={() => setCurrent(current + 1)} className="btn-primary flex-1">
              Next
            </button>
          ) : (
            <button onClick={onComplete} className="btn-primary flex-1">
              Get Started
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
