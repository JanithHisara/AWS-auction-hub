import { fromTable, RpcBuilder } from '@/lib/db'
import prisma from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

export function createAdminClient() {
  return {
    from<T = any>(table: string) {
      return fromTable<T>(table)
    },

    rpc(fnName: string, args: any = {}) {
      return new RpcBuilder(fnName, args)
    },

    auth: {
      admin: {
        async getUserById(id: string) {
          const user = await prisma.user.findUnique({ where: { id } })
          return { data: { user }, error: user ? null : { message: 'User not found' } }
        },

        async updateUserById(id: string, data: any) {
          const user = await prisma.user.update({ where: { id }, data })
          return { data: { user }, error: null }
        },

        async deleteUser(id: string) {
          await prisma.user.delete({ where: { id } })
          return { data: { user: null }, error: null }
        },

        async createUser({ email, password, user_metadata }: any) {
          try {
            const normalizedEmail = email.trim().toLowerCase()
            const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
            if (existing) {
              return { data: { user: null }, error: { message: 'User already exists' } }
            }

            const hashedPassword = password ? await hashPassword(password) : null
            let anonName = `Bidder-${Math.floor(100000 + Math.random() * 900000)}`
            const user = await prisma.user.create({
              data: {
                email: normalizedEmail,
                passwordHash: hashedPassword,
                role: 'user',
                anonymousName: anonName,
                displayName: user_metadata?.display_name || null,
                phone: user_metadata?.phone || null,
              },
            })

            return { data: { user }, error: null }
          } catch (err: any) {
            return { data: { user: null }, error: { message: err.message || 'Create user failed' } }
          }
        },

        async generateLink({ type, email, options }: any): Promise<{ data: any; error: { message: string } | null }> {
          const token = crypto.randomUUID()
          const redirect = options?.redirectTo || '/reset-password'
          const action_link = `${redirect}${redirect.includes('?') ? '&' : '?'}token=${token}`
          return {
            data: {
              properties: { action_link, hashed_token: token },
              user: { email },
            },
            error: null,
          }
        },
      },
    },
  }
}
