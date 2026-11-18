'use client'

class RealtimeChannel {
  private channelName: string
  private handlers: Array<{ id: number; event: string; filter?: any; callback: (payload: any) => void }> = []
  private eventSource?: EventSource
  private nextHandlerId = 1
  public refCount = 0
  // Stored so we can re-open the connection after the tab becomes visible again
  private subscribeCallback?: (status: string) => void
  private visibilityHandler?: () => void

  constructor(channelName: string) {
    this.channelName = channelName
  }

  on(event: string, filterOrCb: any, callback?: (payload: any) => void) {
    const cb = typeof filterOrCb === 'function' ? filterOrCb : callback!
    const filter = typeof filterOrCb === 'object' ? filterOrCb : undefined
    this.handlers.push({ id: this.nextHandlerId++, event, filter, callback: cb })
    return this
  }

  private openEventSource() {
    // Close any stale connection first
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = undefined
    }

    try {
      const url = `/api/realtime?channel=${encodeURIComponent(this.channelName)}`
      const es = new EventSource(url, { withCredentials: true } as any)
      this.eventSource = es

      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data)
          if (payload.type === 'connected') {
            if (this.subscribeCallback) this.subscribeCallback('SUBSCRIBED')
            return
          }

          for (const handler of this.handlers) {
            if (handler.filter) {
              const filter = handler.filter
              if (filter.event && filter.event !== '*' && filter.event !== payload.eventType) {
                continue
              }
              if (filter.table && filter.table !== payload.table) {
                continue
              }
              if (filter.filter && typeof filter.filter === 'string') {
                const match = filter.filter.match(/^([a-zA-Z0-9_]+)=eq\.(.+)$/)
                if (match) {
                  const col = match[1]
                  const expected = match[2].trim().replace(/^['"]|['"]$/g, '')
                  const row = payload.new || payload.old || {}
                  const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, g) => g.toUpperCase())
                  const toSnake = (s: string) => s.replace(/[A-Z]/g, (l) => '_' + l.toLowerCase())
                  const val = row[col] ?? row[toCamel(col)] ?? row[toSnake(col)]
                  if (val === undefined || val === null || String(val).toLowerCase() !== expected.toLowerCase()) {
                    continue
                  }
                }
              }
            }
            handler.callback(payload)
          }
        } catch {
          // Ignore parse / handler errors
        }
      }

      es.onerror = () => {
        // The browser's built-in EventSource retry handles reconnection
      }
    } catch (err) {
      console.warn('Realtime connection error:', err)
    }
  }

  subscribe(callback?: (status: string) => void) {
    this.refCount++
    if (typeof window === 'undefined') return this

    // Store the callback so the visibility handler can invoke it on reconnect
    if (callback) this.subscribeCallback = callback

    // Already connected — nothing else to do
    if (this.eventSource && this.eventSource.readyState !== EventSource.CLOSED) {
      if (callback) callback('SUBSCRIBED')
      return this
    }

    // Only open a connection when the tab is actually visible.
    // If the tab is hidden right now, defer until it becomes visible.
    if (document.visibilityState === 'hidden') {
      // Will be opened by the visibility handler below
    } else {
      this.openEventSource()
    }

    // Register a single visibility handler per channel (guard against duplicates)
    if (!this.visibilityHandler) {
      this.visibilityHandler = () => {
        if (document.visibilityState === 'visible') {
          // Tab came to the foreground — restore the SSE connection if still subscribed
          if (this.refCount > 0 && (!this.eventSource || this.eventSource.readyState === EventSource.CLOSED)) {
            this.openEventSource()
          }
        } else {
          // Tab went to the background — close the SSE connection to free up the
          // browser's per-origin connection pool so other tabs keep working.
          if (this.eventSource) {
            this.eventSource.close()
            this.eventSource = undefined
          }
        }
      }
      document.addEventListener('visibilitychange', this.visibilityHandler)
    }

    return this
  }

  unsubscribe() {
    this.refCount = Math.max(0, this.refCount - 1)
    if (this.refCount === 0) {
      this._teardown()
    }
  }

  close() {
    this.refCount = 0
    this._teardown()
  }

  private _teardown() {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler)
      this.visibilityHandler = undefined
    }
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = undefined
    }
    this.handlers = []
    this.subscribeCallback = undefined
  }
}

const activeChannels = new Map<string, RealtimeChannel>()
const sharedClientInstance: any = {
  channel(name: string) {
    let ch = activeChannels.get(name)
    if (!ch) {
      ch = new RealtimeChannel(name)
      activeChannels.set(name, ch)
    }
    return ch
  },

  removeChannel(channel: RealtimeChannel) {
    if (channel) {
      channel.unsubscribe()
      if (channel.refCount === 0) {
        for (const [name, ch] of activeChannels.entries()) {
          if (ch === channel) {
            activeChannels.delete(name)
            break
          }
        }
      }
    }
  },

  auth: {
    async getUser() {
      try {
        const res = await fetch('/api/auth/me')
        if (!res.ok) return { data: { user: null }, error: null }
        const data = await res.json()
        return { data: { user: data.user || null }, error: null }
      } catch {
        return { data: { user: null }, error: null }
      }
    },

  },
}

export function createClient() {
  return sharedClientInstance
}

export const supabase = sharedClientInstance
