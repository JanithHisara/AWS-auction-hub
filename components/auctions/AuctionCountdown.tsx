'use client'

import { useState, useEffect } from 'react'

interface Props {
  targetDate: string
  label: string
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
  total: number
}

export default function AuctionCountdown({ targetDate, label }: Props) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 })
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    
    const calculateTimeLeft = () => {
      const difference = new Date(targetDate).getTime() - new Date().getTime()
      
      if (difference <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 }
      }
      
      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        total: difference,
      }
    }

    setTimeLeft(calculateTimeLeft())

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000)

    return () => clearInterval(timer)
  }, [targetDate])

  if (!isClient) {
    return (
      <div className="text-center">
        <p className="text-sm text-[var(--text-muted)] uppercase tracking-wider mb-4">{label}</p>
        <div className="flex justify-center gap-3">
          {['Days', 'Hours', 'Mins', 'Secs'].map((unit) => (
            <div key={unit} className="countdown-unit">
              <span className="countdown-value">--</span>
              <span className="countdown-label">{unit}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (timeLeft.total <= 0) {
    return (
      <div className="text-center">
        <div className="live-badge mx-auto mb-4">
          <span className="live-dot" />
          LIVE NOW
        </div>
        <p className="text-lg font-bold text-white">Auction is active!</p>
      </div>
    )
  }

  const units = [
    { value: timeLeft.days, label: 'Days' },
    { value: timeLeft.hours, label: 'Hours' },
    { value: timeLeft.minutes, label: 'Mins' },
    { value: timeLeft.seconds, label: 'Secs' },
  ]

  return (
    <div className="text-center">
      <p className="text-sm text-[var(--text-muted)] uppercase tracking-wider mb-4">{label}</p>
      <div className="flex justify-center gap-3">
        {units.map((unit) => (
          <div key={unit.label} className="countdown-unit">
            <span className={`countdown-value ${unit.label === 'Secs' ? 'animate-countdown' : ''}`}>
              {unit.value.toString().padStart(2, '0')}
            </span>
            <span className="countdown-label">{unit.label}</span>
          </div>
        ))}
      </div>
      
      {/* Urgency indicator */}
      {timeLeft.days === 0 && timeLeft.hours < 1 && (
        <div className="mt-4 px-4 py-2 bg-red-500/20 border border-red-500/40 rounded-lg">
          <p className="text-sm font-bold text-red-400 flex items-center justify-center gap-2">
            <span className="animate-pulse"></span>
            Starting soon!
          </p>
        </div>
      )}
    </div>
  )
}


