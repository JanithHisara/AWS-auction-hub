'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from '@/components/auth/LogoutButton'
import Logo from '@/components/brand/Logo'
import { LayoutDashboard, User, Ticket, Trophy, Menu, X } from 'lucide-react'

interface NavbarProps {
  user: { id: string; email?: string } | null
  role: string | null
}

export default function Navbar({ user, role }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  // Close mobile menu on navigation
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Hide navbar in auction room and monitor pages
  if (pathname?.startsWith('/monitor') || pathname?.startsWith('/auction-room')) {
    return null
  }

  return (
    <nav className="sticky top-0 z-50 bg-[var(--background)]/90 backdrop-blur-xl border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 sm:h-20">
          {/* Logo */}
          <Link href="/" className="group">
            <Logo size="md" showTagline className="group-hover:opacity-90 transition-opacity" />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            <Link
              href="/"
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                pathname === '/' 
                  ? 'text-[var(--gold)] bg-[var(--gold)]/10' 
                  : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface)]'
              }`}
            >
              Auctions
            </Link>
            
            {user && (
              <>
                <Link
                  href="/my-auctions"
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    pathname === '/my-auctions' 
                      ? 'text-[var(--gold)] bg-[var(--gold)]/10' 
                      : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface)]'
                  }`}
                >
                  <Ticket className="w-4 h-4" />
                  My Auctions
                </Link>
                
                <Link
                  href="/my-bids"
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    pathname === '/my-bids' 
                      ? 'text-[var(--gold)] bg-[var(--gold)]/10' 
                      : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface)]'
                  }`}
                >
                  <Trophy className="w-4 h-4" />
                  My Bids
                </Link>

                {(role === 'admin' || role === 'super_admin' || role === 'moderator') && (
                  <Link
                    href="/admin"
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      pathname?.startsWith('/admin') 
                        ? 'text-[var(--gold)] bg-[var(--gold)]/10' 
                        : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface)]'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    Admin
                  </Link>
                )}
              </>
            )}

            <div className="w-px h-6 bg-[var(--border)] mx-3" />

            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-white transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                </Link>
                <LogoutButton />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-white transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="btn-gold text-sm py-2 px-5"
                >
                  <span>Sign Up</span>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 text-white hover:bg-[var(--surface)] rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden border-t border-[var(--border)] py-4 space-y-1 bg-[var(--background)] absolute left-0 right-0 px-4 border-b shadow-2xl">
            <Link
              href="/"
              className="block px-4 py-3 text-sm font-medium text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface)] rounded-lg transition-all"
              onClick={() => setIsOpen(false)}
            >
              Auctions
            </Link>
            
            {user ? (
              <>
                <Link
                  href="/my-auctions"
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface)] rounded-lg transition-all"
                  onClick={() => setIsOpen(false)}
                >
                  <Ticket className="w-4 h-4" />
                  My Auctions
                </Link>
                
                <Link
                  href="/my-bids"
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface)] rounded-lg transition-all"
                  onClick={() => setIsOpen(false)}
                >
                  <Trophy className="w-4 h-4" />
                  My Bids
                </Link>
                
                <Link
                  href="/profile"
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface)] rounded-lg transition-all"
                  onClick={() => setIsOpen(false)}
                >
                  <User className="w-4 h-4" />
                  Profile
                </Link>

                {(role === 'admin' || role === 'super_admin' || role === 'moderator') && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface)] rounded-lg transition-all"
                    onClick={() => setIsOpen(false)}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    Admin Dashboard
                  </Link>
                )}
                
                <div className="border-t border-[var(--border)] my-3" />
                <div className="px-4 py-2">
                  <LogoutButton />
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="block px-4 py-3 text-sm font-medium text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface)] rounded-lg transition-all"
                  onClick={() => setIsOpen(false)}
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="block mx-4 py-3 text-center btn-gold text-sm"
                  onClick={() => setIsOpen(false)}
                >
                  <span>Sign Up</span>
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
