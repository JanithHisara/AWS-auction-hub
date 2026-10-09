'use client'

import { useState, useEffect } from 'react'

interface Props {
  date: string | Date
  format?: 'full' | 'short' | 'time' | 'long' | 'weekday-short'
  className?: string
}

export default function LocalTime({ date, format = 'full', className }: Props) {
  const [formatted, setFormatted] = useState<string>('')

  useEffect(() => {
    const d = new Date(date)
    
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

    setFormatted(new Intl.DateTimeFormat('en-US', options).format(d))
  }, [date, format])

  // Show placeholder during SSR to avoid hydration mismatch
  if (!formatted) {
    return <span className={className}>...</span>
  }

  return <span className={className}>{formatted}</span>
}
