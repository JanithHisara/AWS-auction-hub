'use client'

class ClientRpcBuilder {
  private fnName: string
  private args: any

  constructor(fnName: string, args: any) {
    this.fnName = fnName
    this.args = args
  }

  single() {
    return this
  }

  async execute(): Promise<{ data: any; error: any }> {
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rpc: this.fnName, args: this.args }),
      })
      return await res.json()
    } catch (err: any) {
      return { data: null, error: { message: err.message || 'RPC failed' } }
    }
  }

  then(resolve: (value: { data: any; error: any }) => void, reject?: (reason: any) => void) {
    return this.execute().then(resolve, reject)
  }
}

class ClientQueryBuilder<T = any> {
  private table: string
  private action: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT' = 'SELECT'
  private selectClause: string = '*'
  private selectOptions?: any
  private filters: any[] = []
  private orClauses: string[] = []
  private orders: any[] = []
  private limitCount?: number
  private offsetCount?: number
  private payload?: any
  private isSingle: boolean = false
  private isMaybeSingle: boolean = false

  constructor(table: string) {
    this.table = table
  }

  select(columns: string = '*', options?: any) {
    if (this.action !== 'INSERT' && this.action !== 'UPDATE' && this.action !== 'DELETE' && this.action !== 'UPSERT') {
      this.action = 'SELECT'
    }
    this.selectClause = columns
    this.selectOptions = options
    return this
  }

  insert(data: any) {
    this.action = 'INSERT'
    this.payload = data
    return this
  }

  update(data: any) {
    this.action = 'UPDATE'
    this.payload = data
    return this
  }

  delete() {
    this.action = 'DELETE'
    return this
  }

  upsert(data: any) {
    this.action = 'UPSERT'
    this.payload = data
    return this
  }

  eq(column: string, value: any) {
    this.filters.push({ column, operator: value === null ? 'IS' : '=', value })
    return this
  }

  neq(column: string, value: any) {
    this.filters.push({ column, operator: '!=', value })
    return this
  }

  gt(column: string, value: any) {
    this.filters.push({ column, operator: '>', value })
    return this
  }

  gte(column: string, value: any) {
    this.filters.push({ column, operator: '>=', value })
    return this
  }

  lt(column: string, value: any) {
    this.filters.push({ column, operator: '<', value })
    return this
  }

  lte(column: string, value: any) {
    this.filters.push({ column, operator: '<=', value })
    return this
  }

  in(column: string, values: any[]) {
    this.filters.push({ column, operator: 'IN', value: values })
    return this
  }

  is(column: string, value: any) {
    this.filters.push({ column, operator: 'IS', value })
    return this
  }

  not(column: string, operator: string, value: any) {
    const op = operator.toLowerCase()
    if (op === 'in') {
      let vals: any[] = []
      if (typeof value === 'string') {
        vals = value.replace(/[\(\)"]/g, '').split(',').map(s => s.trim())
      } else if (Array.isArray(value)) {
        vals = value
      }
      this.filters.push({ column, operator: 'NOT IN', value: vals })
    } else if (op === 'is') {
      this.filters.push({ column, operator: 'IS NOT', value })
    } else {
      this.filters.push({ column, operator: '!=', value })
    }
    return this
  }

  ilike(column: string, pattern: string) {
    this.filters.push({ column, operator: 'ILIKE', value: pattern })
    return this
  }

  or(clause: string) {
    this.orClauses.push(clause)
    return this
  }

  order(column: string, optionsOrAsc?: any, _extra?: any) {
    let ascending = true
    if (typeof optionsOrAsc === 'boolean') {
      ascending = optionsOrAsc
    } else if (optionsOrAsc && typeof optionsOrAsc === 'object') {
      ascending = optionsOrAsc.ascending ?? true
    }
    this.orders.push({ column, ascending })
    return this
  }

  limit(count: number) {
    this.limitCount = count
    return this
  }

  range(from: number, to: number) {
    this.offsetCount = from
    this.limitCount = to - from + 1
    return this
  }

  single() {
    this.isSingle = true
    this.limitCount = 1
    return this
  }

  maybeSingle() {
    this.isMaybeSingle = true
    this.limitCount = 1
    return this
  }

  async execute(): Promise<{ data: any; error: any; count?: number }> {
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: this.table,
          action: this.action,
          selectClause: this.selectClause,
          selectOptions: this.selectOptions,
          filters: this.filters,
          orClauses: this.orClauses,
          orders: this.orders,
          limitCount: this.limitCount,
          offsetCount: this.offsetCount,
          payload: this.payload,
          isSingle: this.isSingle,
          isMaybeSingle: this.isMaybeSingle,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        return { data: null, error: errJson.error || { message: 'Database request failed' } }
      }

      return await res.json()
    } catch (err: any) {
      return { data: null, error: { message: err.message || 'Network error' } }
    }
  }

  then(resolve: (value: { data: T; error: any; count?: number }) => void, reject?: (reason: any) => void) {
    return this.execute().then(resolve as any, reject)
  }
}

class RealtimeChannel {
  private channelName: string
  private handlers: Array<{ event: string; filter?: any; callback: (payload: any) => void }> = []
  private eventSource?: EventSource

  constructor(channelName: string) {
    this.channelName = channelName
  }

  on(event: string, filterOrCb: any, callback?: (payload: any) => void) {
    const cb = typeof filterOrCb === 'function' ? filterOrCb : callback!
    const filter = typeof filterOrCb === 'object' ? filterOrCb : undefined
    this.handlers.push({ event, filter, callback: cb })
    return this
  }

  subscribe(callback?: (status: string) => void) {
    if (typeof window === 'undefined') return this

    try {
      const url = `/api/realtime?channel=${encodeURIComponent(this.channelName)}`
      this.eventSource = new EventSource(url)

      this.eventSource.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data)
          if (payload.type === 'connected') {
            if (callback) callback('SUBSCRIBED')
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
                  const expected = match[2]
                  const row = payload.new || payload.old || {}
                  if (String(row[col]) !== expected) {
                    continue
                  }
                }
              }
            }
            handler.callback(payload)
          }
        } catch {
          // Ignore
        }
      }

      this.eventSource.onerror = () => {
        // Handled automatically by browser EventSource
      }
    } catch (err) {
      console.warn('Realtime connection error:', err)
    }

    return this
  }

  unsubscribe() {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = undefined
    }
  }
}

const activeChannels = new Map<string, RealtimeChannel>()

export function createClient() {
  return {
    from<T = any>(table: string) {
      return new ClientQueryBuilder<T>(table)
    },

    rpc(fnName: string, args: any = {}) {
      return new ClientRpcBuilder(fnName, args)
    },

    channel(name: string) {
      let ch = activeChannels.get(name)
      if (!ch) {
        ch = new RealtimeChannel(name)
        activeChannels.set(name, ch)
      }
      return ch
    },

    removeChannel(channel: RealtimeChannel) {
      channel.unsubscribe()
      for (const [key, val] of activeChannels.entries()) {
        if (val === channel) {
          activeChannels.delete(key)
        }
      }
    },

    auth: {
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          })
          const data = await res.json()
          if (!res.ok) {
            return { data: { user: null, session: null }, error: new Error(data.error || 'Login failed') }
          }
          return { data: { user: data.user, session: { user: data.user } }, error: null }
        } catch (err: any) {
          return { data: { user: null, session: null }, error: err }
        }
      },

      async signUp({
        email,
        password,
        options,
      }: {
        email: string
        password: string
        options?: { data?: Record<string, any>; emailRedirectTo?: string }
      }) {
        try {
          const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, options }),
          })
          const data = await res.json()
          if (!res.ok) {
            return { data: { user: null, session: null }, error: new Error(data.error || 'Registration failed') }
          }
          return { data: { user: data.user, session: { user: data.user } }, error: null }
        } catch (err: any) {
          return { data: { user: null, session: null }, error: err }
        }
      },

      async signOut() {
        try {
          await fetch('/api/auth/logout', { method: 'POST' })
          return { error: null }
        } catch (err: any) {
          return { error: err }
        }
      },

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

      async getSession() {
        try {
          const res = await fetch('/api/auth/me')
          if (!res.ok) return { data: { session: null }, error: null }
          const data = await res.json()
          const user = data.user || null
          return { data: { session: user ? { user } : null }, error: null }
        } catch {
          return { data: { session: null }, error: null }
        }
      },

      async setSession(_session: any): Promise<{ data: any; error: { message: string } | null }> {
        return { data: {}, error: null }
      },

      async resetPasswordForEmail(_email: string): Promise<{ data: any; error: { message: string } | null }> {
        return { data: {}, error: null }
      },

      async updateUser(_attributes: Record<string, any>): Promise<{ data: any; error: { message: string } | null }> {
        return { data: {}, error: null }
      },

      onAuthStateChange(_callback: (event: string, session: any) => void) {
        return {
          data: {
            subscription: {
              unsubscribe: () => {},
            },
          },
        }
      },
    },
  }
}
