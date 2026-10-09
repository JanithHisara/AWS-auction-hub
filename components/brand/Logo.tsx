'use client'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  showTagline?: boolean
  className?: string
}

export function AuctionHammerIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 48 48" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Hammer head */}
      <rect 
        x="8" 
        y="6" 
        width="24" 
        height="12" 
        rx="2" 
        fill="url(#goldGradient)"
        className="drop-shadow-lg"
      />
      {/* Hammer handle */}
      <rect 
        x="17" 
        y="18" 
        width="6" 
        height="22" 
        rx="2" 
        fill="url(#goldGradient)"
      />
      {/* Highlight on hammer head */}
      <rect 
        x="10" 
        y="8" 
        width="20" 
        height="3" 
        rx="1" 
        fill="rgba(255,255,255,0.3)"
      />
      {/* Sound wave / impact lines */}
      <path 
        d="M36 12 L40 8" 
        stroke="var(--gold)" 
        strokeWidth="2" 
        strokeLinecap="round"
        opacity="0.6"
      />
      <path 
        d="M38 16 L44 14" 
        stroke="var(--gold)" 
        strokeWidth="2" 
        strokeLinecap="round"
        opacity="0.4"
      />
      <path 
        d="M36 20 L42 22" 
        stroke="var(--gold)" 
        strokeWidth="2" 
        strokeLinecap="round"
        opacity="0.3"
      />
      {/* Base/podium */}
      <ellipse 
        cx="20" 
        cy="42" 
        rx="14" 
        ry="4" 
        fill="var(--gold)"
        opacity="0.2"
      />
      
      <defs>
        <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--gold-accent)" />
          <stop offset="50%" stopColor="var(--gold)" />
          <stop offset="100%" stopColor="var(--gold-dark)" />
        </linearGradient>
      </defs>
    </svg>
  )
}

const sizes = {
  sm: { icon: 'w-8 h-8', text: 'text-lg', tagline: 'text-[8px]' },
  md: { icon: 'w-10 h-10', text: 'text-xl', tagline: 'text-[9px]' },
  lg: { icon: 'w-14 h-14', text: 'text-2xl', tagline: 'text-[10px]' },
  xl: { icon: 'w-20 h-20', text: 'text-4xl', tagline: 'text-xs' },
}

export default function Logo({ 
  size = 'md', 
  showText = true, 
  showTagline = false,
  className = ''
}: LogoProps) {
  const s = sizes[size]
  
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-[var(--gold)]/20 blur-xl rounded-full" />
        <div className={`relative ${s.icon} flex items-center justify-center`}>
          <AuctionHammerIcon className={s.icon} />
        </div>
      </div>
      
      {showText && (
        <div className="flex flex-col">
          <span className={`${s.text} font-black tracking-tight text-white leading-none`}>
            Auxtion<span className="text-[var(--gold)]">Hub</span>
          </span>
          {showTagline && (
            <span className={`${s.tagline} tracking-[0.15em] text-[var(--text-muted)] uppercase mt-0.5`}>
              Where Tech Meets Trust
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export function LogoMark({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-[var(--gold)]/20 blur-lg rounded-full" />
      <AuctionHammerIcon className={className} />
    </div>
  )
}

