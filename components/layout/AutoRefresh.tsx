'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  userId?: string
}

export default function AutoRefresh({ userId }: Props) {
  const router = useRouter()
  const lastFingerprint = useRef<string | null>(null)
  const isSyncing = useRef(false)
  const pendingRefresh = useRef(false)

  const doRefresh = useCallback(() => {
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
  }, [router])

  const checkSync = useCallback(async () => {
    if (isSyncing.current) return
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
  }, [userId, doRefresh])

  // Periodic polling every 3 seconds across all pages
  useEffect(() => {
    checkSync()

    const interval = setInterval(checkSync, 3000)
    return () => clearInterval(interval)
  }, [checkSync])

  // Sync immediately when user switches tabs or window regains focus
  useEffect(() => {
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
  }, [checkSync, doRefresh])

  return null
}
