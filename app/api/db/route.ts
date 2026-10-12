import { NextResponse } from 'next/server'
import { PostgresQueryBuilder, executeRpc } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Handle RPC calls
    if (body.rpc) {
      const result = await executeRpc(body.rpc, body.args || {})
      return NextResponse.json(result)
    }

    const {
      table,
      action = 'SELECT',
      selectClause = '*',
      selectOptions,
      filters = [],
      orClauses = [],
      orders = [],
      limitCount,
      offsetCount,
      payload,
      isSingle = false,
      isMaybeSingle = false,
    } = body

    if (!table || typeof table !== 'string') {
      return NextResponse.json({ data: null, error: { message: 'Table is required' } }, { status: 400 })
    }

    const builder = new PostgresQueryBuilder(table)
    ;(builder as any).action = action
    ;(builder as any).selectClause = selectClause
    ;(builder as any).selectOptions = selectOptions
    ;(builder as any).filters = filters
    ;(builder as any).orClauses = orClauses
    ;(builder as any).orders = orders
    ;(builder as any).limitCount = limitCount
    ;(builder as any).offsetCount = offsetCount
    ;(builder as any).payload = payload
    ;(builder as any).isSingle = isSingle
    ;(builder as any).isMaybeSingle = isMaybeSingle

    const result = await builder.execute()
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('API /api/db error:', error)
    return NextResponse.json(
      { data: null, error: { message: error.message || 'Internal database error' } },
      { status: 500 }
    )
  }
}
