'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export default function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 px-4 py-2 text-sm font-mono text-[var(--text-secondary)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 rounded border border-transparent hover:border-[var(--error)]/20 transition-all w-full md:w-auto"
    >
      <LogOut className="w-4 h-4" />
      LOGOUT
    </button>
  )
}
