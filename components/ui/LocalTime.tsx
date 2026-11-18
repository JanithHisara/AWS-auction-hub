'use client'

import { useState, useEffect } from 'react'

interface Props {
  date: string | Date | null | undefined
  format?: 'full' | 'short' | 'time' | 'long' | 'weekday-short'
  className?: string
  fallback?: string
}

export default function LocalTime({ date, format = 'full', className, fallback = '—' }: Props) {
  const [formatted, setFormatted] = useState<string>('')

  useEffect(() => {
    if (!date) {
      setFormatted(fallback)
      return
    }

    const d = new Date(date)
    if (isNaN(d.getTime())) {
      setFormatted(fallback)
      return
    }

    let options: Intl.DateTimeFormatOptions = {}

    if (format === 'long') {
      options = {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }
    } else if (format === 'weekday-short') {
      options = {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }
    } else if (format === 'full') {
      options = {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }
    } else if (format === 'short') {
      options = {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }
    } else if (format === 'time') {
      options = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }
    }

    try {
      setFormatted(new Intl.DateTimeFormat('en-US', options).format(d))
    } catch {
      setFormatted(fallback)
    }
  }, [date, format, fallback])

  // Show placeholder during SSR to avoid hydration mismatch
  if (!formatted) {
    return <span className={className}>...</span>
  }

  return <span className={className}>{formatted}</span>
}
