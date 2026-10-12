'use client'

import Link from 'next/link'
import { CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react'
import Logo from '@/components/brand/Logo'

export default function ConfirmedPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 bg-grid-pattern opacity-30" />
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-[var(--gold-accent)]/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-[var(--amethyst)]/10 rounded-full blur-3xl" />

      <div className="w-full max-w-md relative z-10">
        <div className="card-glass rounded-2xl p-8 border-glow text-center">
          {/* Brand Logo */}
          <div className="flex flex-col items-center mb-6">
            <Logo size="lg" showTagline />
          </div>

          {/* Success Badge */}
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-3">
            Email Confirmed!
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mb-8 leading-relaxed">
            Your Auctionhub account has been verified successfully. You can now sign in and explore exclusive gem auctions.
          </p>

          <Link
            href="/login"
            className="btn-gold w-full flex items-center justify-center gap-2 group py-3.5 rounded-xl font-semibold shadow-lg shadow-[var(--gold)]/20"
          >
            <span>Proceed to Sign In</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>

          <div className="flex justify-center items-center gap-2 mt-8 text-[var(--text-muted)] text-xs">
            <ShieldCheck className="w-4 h-4 text-[var(--gold)]" />
            <span>Verified Secure Account</span>
          </div>
        </div>
      </div>
    </div>
  )
}
