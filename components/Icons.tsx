// Minimal stroke-based SVG icons (Heroicons-inspired, 24×24 viewBox)

type IconProps = { className?: string }

export function ClipboardIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9h6m-6 3h4" />
    </svg>
  )
}

export function LeafIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 3.75S17 4.5 14 8c-3.75 4.5-3.75 9-3.75 9M20.25 3.75C20.25 3.75 21 12 15 16.5c-2.5 1.88-5.25 2.25-5.25 2.25m0 0L7.5 21m2.25-2.25L7.5 16.5" />
    </svg>
  )
}

export function ChartBarIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5V19a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-5.5m0 0V8a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5.5m0 0V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v8.5m0 0V10a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1" />
    </svg>
  )
}

export function FlameIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.387Zm0 0a8.82 8.82 0 0 0 2.273 5.386A8.247 8.247 0 0 1 12 21 8.25 8.25 0 0 1 9 9.601a8.987 8.987 0 0 0 3.139-1.497 9.02 9.02 0 0 0 3.223-2.89Z" />
    </svg>
  )
}

export function GlobeIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253M3.157 7.582A8.959 8.959 0 0 0 3 12c0 .778.099 1.533.284 2.253" />
    </svg>
  )
}

export function SproutIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 22V12m0 0C12 7 8 4 3 4c0 5 3 8 9 8Zm0 0c0-5 4-8 9-8 0 5-3 8-9 8Z" />
    </svg>
  )
}

export function MagnifyingGlassIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  )
}
