import { type Request, type Response } from 'express'
import { getApiUser } from '../../admin/_auth'

export async function GET(request: Request, response: Response) {
  try {
    const user = await getApiUser(request)
    if (!user) {
      response.json({ user: null })
      return
    }

    response.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        display_name: user.displayName || null,
        anonymous_name: user.anonymousName || null,
        phone: user.phone || null,
      },
    })
  } catch (error) {
    console.error('Error fetching current user:', error)
    response.status(500).json({ error: 'Failed to fetch user.' })
  }
}
