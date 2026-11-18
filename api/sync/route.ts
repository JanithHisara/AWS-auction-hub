import { type Request, type Response } from 'express'
import { unavailable } from '../admin/_auth'

export async function GET(_request: Request, response: Response) {
  unavailable(response, 'Offline synchronization state')
}
