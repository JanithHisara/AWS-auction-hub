'use client'

import { useState, useRef } from 'react'
import { Upload, X, Loader2, Image as ImageIcon, Film } from 'lucide-react'
import { MediaType } from '@/types/database'

interface MediaItem {
  url: string
  media_type: MediaType
}

interface Props {
  images: string[]
  mediaTypes?: MediaType[]
  maxImages?: number
  onChange: (images: string[], mediaTypes: MediaType[]) => void
}

function inferMediaType(url: string): MediaType {
  const lower = url.toLowerCase()
  if (lower.match(/\.(mp4|webm|mov)(\?|$)/)) return 'video'
  if (lower.match(/\.gif(\?|$)/)) return 'gif'
  return 'image'
}

export default function ImageUploader({ images, mediaTypes = [], maxImages, onChange }: Props) {
  const [uploading, setUploading] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([])

  const getMediaType = (index: number): MediaType => mediaTypes[index] || 'image'

  const handleFileSelect = async (index: number, file: File) => {
    setError(null)
    setUploading(index)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        let errorMsg = 'Upload failed with status ' + res.status;
        try {
          const text = await res.text();
          try {
            const data = JSON.parse(text);
            if (data.message) errorMsg = data.message;
          } catch (e) {
            errorMsg = errorMsg + ': ' + text.substring(0, 100);
          }
        } catch (e) {}
        throw new Error(errorMsg)
      }

      const { url, media_type } = await res.json()
      const newImages = [...images]
      const newMediaTypes = [...mediaTypes]
      newImages[index] = url
      newMediaTypes[index] = media_type || inferMediaType(url)
      onChange(newImages, newMediaTypes)
    } catch (err) {
      setError(err instanceof Error ? err.message + ' (caught)' : 'Upload failed (not error)')
    } finally {
      setUploading(null)
    }
  }

  const handleDrop = (index: number, e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      handleFileSelect(index, file)
    }
  }

  const addImage = () => {
    onChange([...images, ''], [...mediaTypes, 'image'])
  }

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index)
    const newMediaTypes = mediaTypes.filter((_, i) => i !== index)
    onChange(
      newImages.length > 0 ? newImages : [''],
      newMediaTypes.length > 0 ? newMediaTypes : ['image']
    )
  }

  const updateImageUrl = (index: number, url: string) => {
    const newImages = [...images]
    const newMediaTypes = [...mediaTypes]
    newImages[index] = url
    newMediaTypes[index] = inferMediaType(url)
    onChange(newImages, newMediaTypes)
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {images.map((url, index) => {
        const mt = getMediaType(index)
        const isVideo = mt === 'video'
        const isGif = mt === 'gif'

        return (
          <div key={index} className="space-y-2">
            <div
              onDrop={(e) => handleDrop(index, e)}
              onDragOver={(e) => e.preventDefault()}
              className={`relative border-2 border-dashed rounded-xl transition-all ${
                url 
                  ? 'border-emerald-500/30 bg-emerald-500/5' 
                  : 'border-[var(--border)] hover:border-[var(--gold)]/50 bg-[var(--surface)]'
              }`}
            >
              {url ? (
                <div className="relative aspect-video">
                  {isVideo ? (
                    <video
                      src={url}
                      controls
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <img
                      src={url}
                      alt={`Media ${index + 1}`}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  )}
                  <div className="absolute top-2 left-2 flex gap-1">
                    {(isVideo || isGif) && (
                      <span className="px-2 py-0.5 rounded bg-black/60 text-xs font-bold text-white uppercase">
                        {mt}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => updateImageUrl(index, '')}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-500 text-white rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : uploading === index ? (
                <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <p className="text-sm">Uploading...</p>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center py-12 cursor-pointer">
                  <input
                    ref={(el) => { fileInputRefs.current[index] = el }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileSelect(index, file)
                    }}
                  />
                  <Upload className="w-8 h-8 text-[var(--text-muted)] mb-2" />
                  <p className="text-sm text-[var(--text-secondary)]">
                    Drop file or <span className="text-[var(--gold)]">browse</span>
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Images: max 5MB (JPG, PNG, WebP, GIF) &middot; Videos: max 50MB (MP4, WebM, MOV)
                  </p>
                </label>
              )}
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                {getMediaType(index) === 'video' ? (
                  <Film className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                ) : (
                  <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                )}
                <input
                  type="url"
                  value={url}
                  onChange={(e) => updateImageUrl(index, e.target.value)}
                  placeholder="Or paste image/video URL..."
                  className="w-full pl-10 text-sm"
                />
              </div>
              {images.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="p-2.5 bg-red-500/20 border border-red-500/40 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )
      })}

      {(!maxImages || images.length < maxImages) && (
        <button
          type="button"
          onClick={addImage}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] rounded-lg hover:border-[var(--gold)]/50 transition-colors w-full justify-center"
        >
          <Upload className="w-4 h-4" /> Add Another Image/Video
        </button>
      )}
    </div>
  )
}
