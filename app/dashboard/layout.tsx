import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if profile is complete — redirect outside dashboard to avoid loop
  const { data: profile } = await supabase
    .from('profiles')
    .select('institution, role')
    .eq('id', user.id)
    .single()

  if (profile && (!profile.institution || !profile.role)) {
    redirect('/complete-profile')
  }

  return (
    <div className="min-h-screen bg-beige">
      {/* ── Top nav ── */}
      <nav className="border-b border-beige-200 bg-white/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 h-14 flex items-center justify-between">
          {/* Left: logo + links */}
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-xl font-bold tracking-tight text-green-900">
              Green<span className="text-green-500">OR</span>
            </Link>
            <div className="hidden sm:flex items-center gap-6 text-sm">
              <Link
                href="/dashboard"
                className="text-green-700/70 hover:text-green-900 transition-colors font-medium"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard/history"
                className="text-green-700/70 hover:text-green-900 transition-colors font-medium"
              >
                History
              </Link>
            </div>
          </div>

          {/* Right: log case + user */}
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/log"
              className="btn-primary !py-2 !px-4 !text-xs !rounded-lg"
            >
              + Log Case
            </Link>
            <span className="text-xs text-green-700/50 hidden sm:block max-w-[160px] truncate">
              {user.email}
            </span>
            <SignOutButton />
          </div>
        </div>

        {/* Mobile bottom links */}
        <div className="sm:hidden flex items-center justify-center gap-8 border-t border-beige-100 py-2.5 text-xs font-medium">
          <Link href="/dashboard" className="text-green-700/70 hover:text-green-900 transition-colors">
            Dashboard
          </Link>
          <Link href="/dashboard/history" className="text-green-700/70 hover:text-green-900 transition-colors">
            History
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 sm:px-10 py-7">
        {children}
      </main>
    </div>
  )
}
