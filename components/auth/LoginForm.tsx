'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Lock, Mail, ArrowRight, Loader2 } from 'lucide-react'
import Logo from '@/components/brand/Logo'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const redirectUrl = searchParams.get('redirect')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      if (data.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', data.user.id)
          .single()

        // Redirect to original destination or role-based default
        if (redirectUrl) {
          router.push(redirectUrl)
        } else if (userData?.role === 'admin' || userData?.role === 'super_admin' || userData?.role === 'moderator') {
          router.push('/admin')
        } else {
          router.push('/')
        }
        router.refresh()
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to login'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 bg-grid-pattern opacity-30" />
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-[var(--gold-accent)]/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-[var(--amethyst)]/10 rounded-full blur-3xl" />
      
      <div className="w-full max-w-md relative z-10">
        <div className="card-glass rounded-2xl p-8 border-glow">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <Logo size="lg" showTagline />
            <h1 className="text-xl font-bold text-white mt-6 mb-2">
              Welcome Back
            </h1>
            <p className="text-[var(--text-secondary)] text-sm">Sign in to access exclusive auctions</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <fieldset disabled={loading} className="border-0 p-0 m-0 min-w-0 space-y-5">
            {error && (
              <div className="error-message flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-[var(--text-muted)]" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-[var(--text-muted)]" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5"
                  placeholder=""
                />
              </div>
              <div className="flex justify-end mt-2">
                <Link href="/forgot-password" className="text-sm text-[var(--gold)] hover:text-[var(--gold-light)]">
                  Forgot Password?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-gold w-full flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
            </fieldset>
          </form>

          <div className="mt-8 pt-6 border-t border-[var(--border)] text-center">
            <p className="text-[var(--text-muted)] text-sm">
              Don't have an account?{' '}
              <Link href="/register" className="text-[var(--gold)] hover:text-[var(--gold-light)] font-medium">
                Create one
              </Link>
            </p>
          </div>
        </div>

        {/* Trust badges */}
        <div className="flex justify-center gap-6 mt-8 text-[var(--text-muted)] text-xs">
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Secure
          </span>
          <span className="flex items-center gap-1">
            <span></span>
            Encrypted
          </span>
          <span className="flex items-center gap-1">
            <span></span>
            Verified
          </span>
        </div>
      </div>
    </div>
  )
}

