'use client'

import { useState, useEffect } from 'react'

interface CountdownTimerProps {
  endTime: string
}

export default function CountdownTimer({ endTime }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number
    hours: number
    minutes: number
    seconds: number
  } | null>(null)

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime()
      const end = new Date(endTime).getTime()
      const difference = end - now

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24))
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((difference % (1000 * 60)) / 1000)

      setTimeLeft({ days, hours, minutes, seconds })
    }

    calculateTimeLeft()
    const interval = setInterval(calculateTimeLeft, 1000)

    return () => clearInterval(interval)
  }, [endTime])

  if (!timeLeft) {
    return <span className="text-[var(--gold-dark)] text-xs font-semibold">Loading...</span>
  }

  if (timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0) {
    return (
      <span className="text-[var(--error)] text-xs font-bold uppercase tracking-wide">
        Ended
      </span>
    )
  }

  const isUrgent = timeLeft.days === 0 && timeLeft.hours < 2

  return (
    <div className={`flex items-center gap-1.5 ${isUrgent ? 'text-[var(--error)]' : 'text-[var(--gold-dark)]'}`}>
      {timeLeft.days > 0 && (
        <span className="text-xs font-bold">
          {timeLeft.days}d
        </span>
      )}
      <div className="flex items-center gap-0.5">
        <span className="text-xs font-bold tabular-nums">
          {String(timeLeft.hours).padStart(2, '0')}
        </span>
        <span className="text-[var(--text-muted)]">:</span>
        <span className="text-xs font-bold tabular-nums">
          {String(timeLeft.minutes).padStart(2, '0')}
        </span>
        <span className="text-[var(--text-muted)]">:</span>
        <span className={`text-xs font-bold tabular-nums ${isUrgent ? 'animate-pulse' : ''}`}>
          {String(timeLeft.seconds).padStart(2, '0')}
        </span>
      </div>
    </div>
  )
}

