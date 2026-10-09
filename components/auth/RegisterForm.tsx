'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lock, Mail, ArrowRight, Loader2, ShieldCheck, User, Phone } from 'lucide-react'
import Logo from '@/components/brand/Logo'

export default function RegisterForm() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return 'Minimum 8 characters required'
    if (!/[A-Z]/.test(pwd)) return 'Uppercase character required'
    if (!/[a-z]/.test(pwd)) return 'Lowercase character required'
    if (!/[0-9]/.test(pwd)) return 'Numeric character required'
    return null
  }

  const validatePhone = (value: string): string | null => {
    const digits = value.replace(/[\s\-\(\)\.]/g, '')
    if (!digits) return 'Phone number is required'
    if (!/^\+?\d{7,15}$/.test(digits)) return 'Enter a valid phone number (e.g. +94771234567)'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError(null)

    const phoneError = validatePhone(phone)
    if (phoneError) {
      setError(phoneError)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }

    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            display_name: name,
            phone: phone,
          },
        },
      })

      if (error) throw error

      if (data.user) {
        router.push('/login?registered=true')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 bg-grid-pattern opacity-30" />
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[var(--gold-accent)]/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-[var(--amethyst)]/10 rounded-full blur-3xl" />

      <div className="w-full max-w-md relative z-10">
        <div className="card-glass rounded-2xl p-8 border-glow">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <Logo size="lg" showTagline />
            <h1 className="text-xl font-bold text-white mt-6 mb-2">
              Create Account
            </h1>
            <p className="text-[var(--text-secondary)]">Join exclusive gem auctions</p>
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
                <label htmlFor="name" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-[var(--text-muted)]" />
                  </div>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-[var(--text-muted)]" />
                  </div>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5"
                    placeholder="+94 77 123 4567"
                  />
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  Include country code (e.g. +94 for Sri Lanka, +1 for US)
                </p>
              </div>

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
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  Min 8 chars  Uppercase  Lowercase  Number
                </p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <ShieldCheck className="h-5 w-5 text-[var(--text-muted)]" />
                  </div>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5"
                    placeholder=""
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-gold w-full flex items-center justify-center gap-2 group mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </fieldset>
          </form>

          <div className="mt-8 pt-6 border-t border-[var(--border)] text-center">
            <p className="text-[var(--text-muted)] text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-[var(--gold)] hover:text-[var(--gold-light)] font-medium">
                Sign in
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

