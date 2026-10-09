'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Mail, ArrowRight, Loader2, ArrowLeft } from 'lucide-react'
import Logo from '@/components/brand/Logo'

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const supabase = createClient()
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (status === 'loading') return
    setStatus('loading')
    setMessage(null)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to send reset email')
      }
      
      setStatus('success')
      setMessage('Password reset instructions have been sent to your email.')
    } catch (err: unknown) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Failed to send reset email')
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed inset-0 bg-grid-pattern opacity-30" />
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-[var(--gold-accent)]/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-[var(--amethyst)]/10 rounded-full blur-3xl" />
      
      <div className="w-full max-w-md relative z-10">
        <div className="card-glass rounded-2xl p-8 border-glow">
          <div className="flex flex-col items-center mb-8">
            <Logo size="lg" showTagline />
            <h1 className="text-xl font-bold text-white mt-6 mb-2">Reset Password</h1>
            <p className="text-[var(--text-secondary)] text-sm text-center">
              Enter your email address and we'll send you instructions to reset your password.
            </p>
          </div>

          {status === 'success' ? (
            <div className="text-center space-y-6">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm">
                {message}
              </div>
              <Link href="/login" className="btn-outline w-full flex items-center justify-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <fieldset disabled={status === 'loading'} className="border-0 p-0 m-0 min-w-0 space-y-5">
              {status === 'error' && message && (
                <div className="error-message flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  {message}
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

              <button
                type="submit"
                disabled={status === 'loading' || !email}
                className="btn-gold w-full flex items-center justify-center gap-2 group"
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <span>Send Reset Link</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
              </fieldset>
            </form>
          )}
          
          {status !== 'success' && (
            <div className="mt-8 pt-6 border-t border-[var(--border)] text-center">
              <Link href="/login" className="text-[var(--text-muted)] hover:text-white text-sm flex items-center justify-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

