"use client"

import { useState, useEffect } from 'react'

interface Props {
  roundEndTime: string | null
  forceStop?: boolean
  onExpire?: () => void
}

export default function AuctionCountdown({ roundEndTime, forceStop = false, onExpire }: Props) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    if (!roundEndTime) {
      setTimeLeft('')
      return
    }

    const updateCountdown = () => {
      const now = new Date().getTime()
      const end = new Date(roundEndTime).getTime()
      const distance = end - now

      if (distance <= 0 || forceStop) {
        setTimeLeft('00:00')
        if (distance <= 0 && onExpire) {
          onExpire()
        }
        return
      }

      const hours = Math.floor(distance / (1000 * 60 * 60))
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((distance % (1000 * 60)) / 1000)

      if (hours > 0) {
        setTimeLeft(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
      } else {
        setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [roundEndTime, forceStop, onExpire])

  return <>{timeLeft || '00:00'}</>
}
