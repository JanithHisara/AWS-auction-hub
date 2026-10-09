'use client'

import Link from 'next/link'
import { Target, Gavel, FileText, ArrowLeft } from 'lucide-react'

export default function SelectAuctionType() {
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/auctions" className="p-2 hover:bg-[var(--surface)] rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Select Auction Type</h1>
          <p className="text-[var(--text-muted)] mt-1">Choose the type of auction you want to create</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-1 md:grid-cols-3 gap-6">
        
        <Link href="/admin/auctions/new/progressive" className="group">
          <div className="h-full p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--gold)]/50 hover:bg-[var(--gold)]/5 transition-all">
            <div className="w-12 h-12 rounded-xl bg-[var(--surface-light)] group-hover:bg-[var(--gold)] flex items-center justify-center mb-4 transition-colors">
              <Gavel className="w-6 h-6 text-[var(--text-muted)] group-hover:text-black transition-colors" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[var(--gold)] transition-colors">English Auction</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Admin raises the price each round and only one bidder wins per round. If no one accepts, the last round winner wins.
            </p>
          </div>
        </Link>

        <Link href="/admin/auctions/new/tender" className="group">
          <div className="h-full p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--gold)]/50 hover:bg-[var(--gold)]/5 transition-all">
            <div className="w-12 h-12 rounded-xl bg-[var(--surface-light)] group-hover:bg-[var(--gold)] flex items-center justify-center mb-4 transition-colors">
              <FileText className="w-6 h-6 text-[var(--text-muted)] group-hover:text-black transition-colors" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[var(--gold)] transition-colors">Sealed Bid (Tender)</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              All items active at once. Bidders submit hidden bids. Bidding is open from the start until the end time. Admin selects winners manually.
            </p>
          </div>
        </Link>

        <Link href="/admin/auctions/new/incremental" className="group">
          <div className="h-full p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--gold)]/50 hover:bg-[var(--gold)]/5 transition-all">
            <div className="w-12 h-12 rounded-xl bg-[var(--surface-light)] group-hover:bg-[var(--gold)] flex items-center justify-center mb-4 transition-colors">
              <Target className="w-6 h-6 text-[var(--text-muted)] group-hover:text-black transition-colors" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[var(--gold)] transition-colors">Progressive Elimination</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Admin raises the price each round. Bidders who don't accept are eliminated. Last remaining bidder wins.
            </p>
          </div>
        </Link>

      </div>
    </div>
  )
}
