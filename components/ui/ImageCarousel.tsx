'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import MediaRenderer from '@/components/gems/MediaRenderer'

interface ImageCarouselProps {
  media: { url: string; type?: string }[]
  alt?: string
  className?: string
}

export default function ImageCarousel({ media, alt = '', className = '' }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  if (!media || media.length === 0) {
    return (
      <div className={`w-full h-full bg-gradient-to-br from-[var(--surface-elevated)] to-[var(--background)] flex items-center justify-center ${className}`}>
        <span className="text-4xl opacity-30"></span>
      </div>
    )
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentIndex((prev) => (prev + 1) % media.length)
  }

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentIndex((prev) => (prev - 1 + media.length) % media.length)
  }

  return (
    <div className={`relative group ${className}`}>
      <MediaRenderer
        src={media[currentIndex].url}
        alt={`${alt} - ${currentIndex + 1}`}
        mediaType={media[currentIndex].type}
        className="w-full h-full object-cover transition-opacity duration-300"
      />

      {media.length > 1 && (
        <>
          {/* Left Arrow */}
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all z-10"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          {/* Right Arrow */}
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all z-10"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Dots Indicator */}
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
            {media.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentIndex(idx)
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentIndex ? 'bg-[var(--gold)] w-4' : 'bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
