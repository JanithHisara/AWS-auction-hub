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
  const resolvedType = mediaType || inferType(src)

  if (resolvedType === 'video') {
    return (
      <video
        src={src}
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
      src={src}
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
