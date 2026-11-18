'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export default function LogoutButton() {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    setError(null)

    try {
      const response = await fetch(`/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        throw new Error('The logout API returned an invalid response. Make sure the API server is running.')
      }

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Unable to log out. Please try again.')
      }

      router.push('/')
      router.refresh()
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Unable to log out. Please try again.')
      setIsLoggingOut(false)
    }
  }

  return (
    <>
      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="flex items-center gap-2 px-4 py-2 text-sm font-mono text-[var(--text-secondary)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 rounded border border-transparent hover:border-[var(--error)]/20 transition-all w-full md:w-auto disabled:opacity-50"
      >
        <LogOut className="w-4 h-4" />
        {isLoggingOut ? 'LOGGING OUT...' : 'LOGOUT'}
      </button>
      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
    </>
  )
}
