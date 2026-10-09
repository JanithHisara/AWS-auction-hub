'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import CountdownTimer from '@/components/auctions/CountdownTimer'
import BidForm from '@/components/auctions/BidForm'
import BidHistory from '@/components/auctions/BidHistory'
import RealtimeBidUpdates from '@/components/auctions/RealtimeBidUpdates'
import WinnerPaymentLink from '@/components/payment/WinnerPaymentLink'

import type { Gem, Bid, GemImage, GemCertificate } from '@/types/database'

interface GemDetailClientProps {
  initialGem: Gem & {
    images: GemImage[]
    certificates: GemCertificate[]
    bids: Bid[]
    winner?: Record<string, unknown>
    isActive: boolean
      isSealed?: boolean
    currentUserId?: string | null
    isRegisteredForAuction?: boolean
  }
}

export default function GemDetailClient({ initialGem }: GemDetailClientProps) {
  const router = useRouter()
  const [gem, setGem] = useState(initialGem)
  const [bids, setBids] = useState(initialGem.bids)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`gem_updates:${gem.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'gems',
          filter: `id=eq.${gem.id}`,
        },
        (payload) => {
          const newGem = payload.new as Gem
          setGem(prev => ({ ...prev, ...newGem }))

          if (newGem.status === 'ended' || newGem.status === 'completed') {
            router.refresh()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gem.id, router])

  const handleBidUpdate = (newBids: Bid[]) => {
    setBids(newBids)
  }

  const highestBid = bids?.[0]?.bid_amount || gem.starting_price
  const imageOnly = gem.images?.filter(img => img.media_type !== 'video') || []
  const videoOnly = gem.images?.filter(img => img.media_type === 'video') || []
  const mainImage = imageOnly[selectedImageIndex]?.image_url || imageOnly[0]?.image_url
  const nextPrice = (gem.current_price || gem.starting_price) + gem.min_bid_increment

  return (
    <>
      <RealtimeBidUpdates gemId={gem.id} onBidUpdate={handleBidUpdate} />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-6">
        <a href="/" className="hover:text-white transition-colors">Home</a>
        <span>/</span>
        <span className="text-white">{gem.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">{gem.name}</h1>
          {gem.isActive && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/40 rounded-full">
              <div className="relative">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <div className="absolute inset-0 w-2 h-2 bg-emerald-400 rounded-full animate-ping opacity-75" />
              </div>
              <span className="text-sm font-semibold text-emerald-400">LIVE AUCTION</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 lg:gap-8 mb-8">
        {/* Image Gallery */}
        <div className="lg:col-span-2 space-y-6">
          {imageOnly.length > 0 ? (
            <div className="card-glass rounded-2xl p-4 sm:p-6">
              <div className="relative aspect-square mb-4 rounded-xl overflow-hidden bg-[var(--surface)] group">
                <img
                  src={mainImage!}
                  alt={gem.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {gem.isActive && (
                  <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md px-4 py-3 rounded-xl border border-[var(--border)]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">Ends In</span>
                    </div>
                    <CountdownTimer endTime={gem.end_time} />
                  </div>
                )}
              </div>
              
              {imageOnly.length > 1 && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {imageOnly.map((img, index) => (
                    <button
                      key={img.id}
                      onClick={() => setSelectedImageIndex(index)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${selectedImageIndex === index
                          ? 'border-[var(--gold)] shadow-gold'
                          : 'border-[var(--border)] hover:border-[var(--gold)]/50'
                        }`}
                    >
                      <img
                        src={img.image_url}
                        alt={`${gem.name} - ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : !videoOnly.length ? (
            <div className="card-glass rounded-2xl p-12">
              <div className="flex items-center justify-center aspect-square bg-[var(--surface)] rounded-xl">
                <span className="text-6xl opacity-30"></span>
              </div>
            </div>
          ) : null}

          {/* Videos */}
          {videoOnly.length > 0 && (
            <div className="card-glass rounded-2xl p-4 sm:p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span></span> Videos
              </h2>
              <div className="space-y-4">
                {videoOnly.map((vid) => (
                  <div key={vid.id} className="rounded-xl overflow-hidden border border-[var(--border)] bg-black">
                    <video
                      src={vid.image_url}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full aspect-video object-contain"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Auction Info */}
        <div className="space-y-6">
          {/* Price Card */}
          <div className="card-glass rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-6">Auction Details</h2>

            <div className="mb-6 p-5 bg-gradient-to-br from-[var(--gold)]/20 to-[var(--gold)]/5 rounded-xl border border-[var(--gold)]/30">
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-2">Current Price</p>
              <p className="text-4xl font-bold text-[var(--gold)] mb-2">
                {formatCurrency(gem.current_price || gem.starting_price)}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                {bids?.length || 0} {bids?.length === 1 ? 'bid' : 'bids'} total
              </p>

              {gem.isActive && gem.round_end_time && (
                <div className="mt-4 pt-4 border-t border-[var(--gold)]/20">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-[var(--text-muted)]">Next Round</span>
                    <CountdownTimer endTime={gem.round_end_time} />
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Price increases to <span className="font-bold text-[var(--gold)]">{formatCurrency(nextPrice)}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-[var(--border)]">
              <div className="p-3 bg-[var(--surface)] rounded-xl">
                <p className="text-xs text-[var(--text-muted)] mb-1">Starting</p>
                <p className="text-lg font-bold text-white">{formatCurrency(gem.starting_price)}</p>
              </div>
              <div className="p-3 bg-[var(--surface)] rounded-xl">
                <p className="text-xs text-[var(--text-muted)] mb-1">Increment</p>
                <p className="text-lg font-bold text-white">{formatCurrency(gem.min_bid_increment)}</p>
              </div>
            </div>

            {gem.isActive ? (
              <BidForm gem={gem} currentBid={highestBid} />
            ) : gem.winner ? (
              gem.isRegisteredForAuction && gem.winner.user_id !== gem.currentUserId ? (
                <div className="p-5 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-4">
                  <div className="flex items-center gap-2 text-amber-500 font-semibold">
                    <span></span>
                    <span>Auction Ended</span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    We are sorry, you did not win this gem. Better luck in the next auction!
                  </p>
                  <div className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg">
                    <p className="text-xs text-[var(--text-muted)] uppercase mb-1 font-semibold">Winning Price</p>
                    <p className="text-2xl font-bold text-[var(--gold)]">
                      {formatCurrency(highestBid)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-5 bg-emerald-500/20 border border-emerald-500/30 rounded-xl">
                  <p className="text-sm font-semibold text-emerald-400 uppercase mb-2">Auction Ended</p>
                  <p className="text-xs text-[var(--text-muted)] mb-1">Winner</p>
                  <p className="text-lg font-bold text-white mb-4">
                    {((gem.winner.user as { anonymous_name?: string, display_name?: string })?.display_name || (gem.winner.user as { anonymous_name?: string })?.anonymous_name) || 'Anonymous'}
                    {gem.currentUserId && gem.winner.user_id === gem.currentUserId && ' (You)'}
                  </p>
                  <WinnerPaymentLink gemId={gem.id} />
                </div>
              )
            ) : (
              <div className="p-5 bg-[var(--surface)] border border-[var(--border)] rounded-xl">
                <p className="text-[var(--text-secondary)]">Auction has ended</p>
              </div>
            )}
          </div>

          {/* Specs */}
          {(gem.carat_weight || gem.color) && (
            <div className="card-glass rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">Specifications</h2>
              <div className="space-y-2">
                {gem.carat_weight && <SpecRow label="Carat" value={`${gem.carat_weight} ct`} />}
                {gem.color && <SpecRow label="Color" value={gem.color} />}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="grid lg:grid-cols-3 gap-6 lg:gap-8 mb-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="card-glass rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Description</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
              {gem.description}
            </p>
          </div>

          {gem.provenance && (
            <div className="card-glass rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span></span> Provenance
              </h2>
              <p className="text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
                {gem.provenance}
              </p>
            </div>
          )}

          {gem.certificates && gem.certificates.length > 0 && (
            <div className="card-glass rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span></span> Certificates
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {gem.certificates.map((cert) => (
                  <a
                    key={cert.id}
                    href={cert.certificate_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl hover:border-[var(--gold)]/50 transition-colors group"
                  >
                    <div className="w-10 h-10 bg-[var(--gold)]/20 rounded-lg flex items-center justify-center">
                      
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-white group-hover:text-[var(--gold)] transition-colors">
                        {cert.certificate_type || 'Certificate'}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">View document</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <BidHistory bids={bids || []} isSealed={initialGem.isSealed && initialGem.isActive} revealNames={gem.status === 'completed' || gem.status === 'ended' || !!gem.winner} />
    </>
  )
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center p-3 bg-[var(--surface)] rounded-lg">
      <span className="text-sm text-[var(--text-muted)]">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  )
}





