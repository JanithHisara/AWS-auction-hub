'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export interface RealtimeAutoRefreshProps {
  channel: string
  tables?: string[]
  onRefresh?: () => void | Promise<void>
  debounceMs?: number
}

export default function RealtimeAutoRefresh({
  channel: channelName,
  tables,
  onRefresh,
  debounceMs = 300,
}: RealtimeAutoRefreshProps) {
  const router = useRouter()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    if (!channelName) return

    const supabase = createClient()
    if (!supabase?.channel) return

    const triggerRefresh = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        if (onRefreshRef.current) {
          try {
            onRefreshRef.current()
          } catch (err) {
            console.error('RealtimeAutoRefresh: onRefresh callback error:', err)
          }
        } else {
          router.refresh()
        }
      }, debounceMs)
    }

    const channel = supabase.channel(channelName)

    if (tables && tables.length > 0) {
      for (const table of tables) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          triggerRefresh()
        })
      }
    } else {
      channel.on('postgres_changes', { event: '*', schema: 'public' }, () => {
        triggerRefresh()
      })
    }

    // Direct fallback for custom events on this channel
    channel.on('broadcast', { event: '*' }, () => {
      triggerRefresh()
    })

    channel.subscribe()

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      supabase.removeChannel?.(channel)
    }
  }, [channelName, tables, router, debounceMs])

  return null
}
