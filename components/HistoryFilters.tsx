'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { APPROACHES } from '@/lib/types'

export default function HistoryFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentSearch = searchParams.get('search') || ''
  const currentApproach = searchParams.get('approach') || ''

  const updateParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`/dashboard/history?${params.toString()}`)
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto">
      <input
        type="text"
        placeholder="Search procedures..."
        defaultValue={currentSearch}
        onChange={(e) => updateParams('search', e.target.value)}
        className="input-base flex-1 text-center sm:text-left"
      />
      <select
        value={currentApproach}
        onChange={(e) => updateParams('approach', e.target.value)}
        className="input-base sm:w-44 text-center sm:text-left"
      >
        <option value="">All approaches</option>
        {APPROACHES.map((a) => (
          <option key={a} value={a}>
            {a.charAt(0).toUpperCase() + a.slice(1)}
          </option>
        ))}
      </select>
    </div>
  )
}
