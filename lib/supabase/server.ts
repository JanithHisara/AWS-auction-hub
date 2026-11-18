import { fromTable, RpcBuilder } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

function createServerInstance() {
  return {
    from<T = any>(table: string) {
      return fromTable<T>(table)
    },

    rpc(fnName: string, args: any = {}) {
      return new RpcBuilder(fnName, args)
    },

    auth: {
      async getUser() {
        const user = await getCurrentUser()
        return { data: { user }, error: null }
      },

      async getSession() {
        const user = await getCurrentUser()
        return { data: { session: user ? { user } : null }, error: null }
      },

      async exchangeCodeForSession(_code: string) {
        return { data: {}, error: null }
      },
    },

    channel(_name: string) {
      return {
        on: () => ({ subscribe: () => {} }),
        subscribe: () => {},
      }
    },

    removeChannel(_channel: any) {
      // No-op on server
    },
  }
}

export function createClient(): any {
  const instance = createServerInstance()
  const promise = Promise.resolve(instance)
  return Object.assign(promise, instance)
}

export const supabase = createServerInstance()
export default createClient
