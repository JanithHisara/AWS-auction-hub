'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface Props {
  userId?: string
}

export default function AutoRefresh({ userId }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const lastFingerprint = useRef<string | null>(null)
  const isSyncing = useRef(false)
  const pendingRefresh = useRef(false)

  const isAuctionRoom = pathname?.includes('/auction-room/')

  const doRefresh = useCallback(() => {
    // Avoid refreshing if inside auction-room to protect real-time bidding inputs
    if (isAuctionRoom) return

    // If user is currently typing in an input field, delay refresh so cursor/typing isn't lost
    const activeEl = document.activeElement
    const isTyping =
      activeEl &&
      (activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        (activeEl as HTMLElement).isContentEditable)

    if (isTyping) {
      pendingRefresh.current = true
      return
    }

    pendingRefresh.current = false
    router.refresh()
  }, [isAuctionRoom, router])

  const checkSync = useCallback(async () => {
    if (isSyncing.current || isAuctionRoom) return
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return

    isSyncing.current = true
    try {
      const url = `/api/sync${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      })

      if (!res.ok) return
      const data = await res.json()

      if (!data.ok || !data.fingerprint) return

      if (lastFingerprint.current === null) {
        lastFingerprint.current = data.fingerprint
        return
      }

      if (data.fingerprint !== lastFingerprint.current) {
        lastFingerprint.current = data.fingerprint
        doRefresh()
      }
    } catch {
      // Silently ignore transient network errors
    } finally {
      isSyncing.current = false
    }
  }, [userId, isAuctionRoom, doRefresh])

  // Periodic polling every 3.5 seconds
  useEffect(() => {
    if (isAuctionRoom) return

    // Run initial sync check
    checkSync()

    const interval = setInterval(checkSync, 3500)
    return () => clearInterval(interval)
  }, [checkSync, isAuctionRoom])

  // Sync immediately when user switches tabs or window regains focus
  useEffect(() => {
    if (isAuctionRoom) return

    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        checkSync()
      }
    }

    const handleBlurInput = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null
      if (
        pendingRefresh.current &&
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        setTimeout(doRefresh, 200)
      }
    }

    window.addEventListener('focus', handleFocusOrVisible)
    document.addEventListener('visibilitychange', handleFocusOrVisible)
    document.addEventListener('focusout', handleBlurInput)

    return () => {
      window.removeEventListener('focus', handleFocusOrVisible)
      document.removeEventListener('visibilitychange', handleFocusOrVisible)
      document.removeEventListener('focusout', handleBlurInput)
    }
  }, [checkSync, doRefresh, isAuctionRoom])

  return null
}
