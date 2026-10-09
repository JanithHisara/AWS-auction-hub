'use client'

import { useState } from 'react'
import { Gem } from '@/types/database'
import { X } from 'lucide-react'
import ImageCarousel from '@/components/ui/ImageCarousel'

interface ItemWithImages extends Gem {
  gem_images: { image_url: string; media_type?: string }[]
}

interface AuctionItemsPreviewProps {
  items: ItemWithImages[]
}

function formatCurrency(amount: number | null | undefined) {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return 'Rs. 0';
  const val = Number(amount);
  if (val >= 1_000_000_000) {
    return 'LKR ' + (val / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  } else if (val >= 1_000_000) {
    return 'LKR ' + (val / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  } else if (val >= 1_000) {
    return 'LKR ' + (val / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  } else {
    return 'LKR ' + val.toString();
  }
}

export default function AuctionItemsPreview({ items }: AuctionItemsPreviewProps) {
  const [selectedItem, setSelectedItem] = useState<ItemWithImages | null>(null)

  if (items.length === 0) return null

  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <div 
            key={item.id} 
            onClick={() => setSelectedItem(item)}
            className="group relative rounded-xl overflow-hidden bg-[var(--surface)] border border-[var(--border)] cursor-pointer"
          >
            <div className="aspect-square overflow-hidden">
              {item.gem_images?.[0]?.image_url ? (
                <img 
                  src={item.gem_images[0].image_url}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[var(--surface-elevated)] to-[var(--background)] flex items-center justify-center">
                  <span className="text-4xl opacity-30"></span>
                </div>
              )}
              
              {item.gem_images?.length > 1 && (
                <div className="absolute top-2 right-2 bg-black/70 text-white text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-sm">
                  1 / {item.gem_images.length}
                </div>
              )}
            </div>
            
            <div className="p-4 bg-gradient-to-t from-[var(--surface-elevated)] to-transparent absolute bottom-0 left-0 right-0">
              <h3 className="font-bold text-white text-lg drop-shadow-md">{item.name}</h3>
              <p className="text-[var(--gold)] font-mono text-sm font-semibold drop-shadow-md">
                Starting: {formatCurrency(item.starting_price)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Item Details Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedItem(null)} />
          
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#12121a] border border-[var(--gold)]/30 rounded-2xl shadow-2xl shadow-[var(--gold)]/10 overflow-hidden flex flex-col md:flex-row">
            
            {/* Close Button */}
            <button 
              onClick={() => setSelectedItem(null)}
              className="absolute top-4 right-4 z-20 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Left: Image Carousel */}
            <div className="w-full md:w-1/2 aspect-square md:aspect-auto bg-black">
              <ImageCarousel 
                media={selectedItem.gem_images.map(img => ({ url: img.image_url, type: img.media_type }))}
                alt={selectedItem.name}
                className="w-full h-full"
              />
            </div>

            {/* Right: Details */}
            <div className="w-full md:w-1/2 p-6 sm:p-8 overflow-y-auto">
              <div className="text-sm text-[var(--gold)]/80 uppercase tracking-widest font-bold mb-2">Item Preview</div>
              <h2 className="text-2xl sm:text-3xl font-black text-white mb-6">{selectedItem.name}</h2>
              
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-[var(--text-muted)] mb-1 uppercase tracking-wider">Starting Price</p>
                  <p className="text-3xl font-mono font-bold text-[var(--gold)]">
                    {formatCurrency(selectedItem.starting_price)}
                  </p>
                </div>

                {selectedItem.description && (
                  <div>
                    <p className="text-sm text-[var(--text-muted)] mb-1 uppercase tracking-wider">Description</p>
                    <p className="text-sm sm:text-base text-white/90 leading-relaxed">{selectedItem.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {selectedItem.carat_weight && (
                    <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Carat Weight</p>
                      <p className="font-bold text-white">{selectedItem.carat_weight} ct</p>
                    </div>
                  )}
                  {selectedItem.cut && (
                    <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Cut</p>
                      <p className="font-bold text-white">{selectedItem.cut}</p>
                    </div>
                  )}
                  {selectedItem.color && (
                    <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Color</p>
                      <p className="font-bold text-white">{selectedItem.color}</p>
                    </div>
                  )}
                  {selectedItem.provenance && (
                    <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Provenance</p>
                      <p className="font-bold text-white">{selectedItem.provenance}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
