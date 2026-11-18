'use client'

interface MediaRendererProps {
  src: string
  alt?: string
  mediaType?: string
  className?: string
  autoPlay?: boolean
  loop?: boolean
  muted?: boolean
  controls?: boolean
}

export function normalizeMediaUrl(url: string | null | undefined): string {
  if (!url) return ''
  return url.replace(/^https?:\/\/(backend|127\.0\.0\.1|localhost):4000\/uploads\//, '/uploads/')
}

export default function MediaRenderer({
  src,
  alt = '',
  mediaType,
  className = '',
  autoPlay = true,
  loop = true,
  muted = true,
  controls = true,
}: MediaRendererProps) {
  const normalizedSrc = normalizeMediaUrl(src)
  const resolvedType = mediaType || inferType(normalizedSrc)

  if (resolvedType === 'video') {
    return (
      <video
        src={normalizedSrc}
        className={className}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        controls={controls}
        playsInline
      />
    )
  }

  return (
    <img
      src={normalizedSrc}
      alt={alt}
      className={className}
    />
  )
}

function inferType(url: string): 'image' | 'gif' | 'video' {
  const lower = url.toLowerCase()
  if (lower.match(/\.(mp4|webm|mov)(\?|$)/)) return 'video'
  if (lower.match(/\.gif(\?|$)/)) return 'gif'
  return 'image'
}
