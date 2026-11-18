import { type Request, type Response } from 'express'
import prisma from '../../lib/prisma'
import { jsonError } from '../admin/_auth'
import { PostgresQueryBuilder, RpcBuilder } from '../../lib/db'

export async function GET(request: Request, response: Response) {
  try {
    await prisma.$queryRaw`SELECT 1`
    response.json({ status: 'connected' })
  } catch {
    jsonError(response, 503, 'Could not connect to the configured PostgreSQL database.', 'DATABASE_CONNECTION_FAILED')
  }
}

export async function POST(request: Request, response: Response) {
  try {
    const body = request.body || {}
    if (body.rpc) {
      const rpc = new RpcBuilder(body.rpc, body.args || {})
      const result = await rpc.execute()
      response.json(result)
      return
    }

    if (body.table) {
      const q = new PostgresQueryBuilder(body.table)
      Object.assign(q, {
        action: body.action || 'SELECT',
        selectClause: body.selectClause || '*',
        selectOptions: body.selectOptions,
        filters: body.filters || [],
        orClauses: body.orClauses || [],
        orders: body.orders || [],
        limitCount: body.limitCount,
        offsetCount: body.offsetCount,
        payload: body.payload,
        isSingle: Boolean(body.isSingle),
        isMaybeSingle: Boolean(body.isMaybeSingle),
      })
      const result = await q.execute()
      response.json(result)
      return
    }

    jsonError(response, 400, 'Invalid database request: table or rpc is required.')
  } catch (err: any) {
    response.status(500).json({ data: null, error: { message: err?.message || 'Database execution error' } })
  }
}
