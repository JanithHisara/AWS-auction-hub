import { fromTable, RpcBuilder } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function createClient() {
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
  }
}
