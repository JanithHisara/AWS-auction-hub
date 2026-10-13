import prisma from '@/lib/prisma'
import { broadcastEvent } from '@/lib/events'
import crypto from 'crypto'

export interface QueryFilter {
  column: string
  operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'IN' | 'NOT IN' | 'IS' | 'IS NOT' | 'ILIKE'
  value: any
}

export interface QueryOrder {
  column: string
  ascending: boolean
}

export function sanitizeRow(row: any): any {
  if (!row || typeof row !== 'object') return row
  if (Array.isArray(row)) return row.map(sanitizeRow)

  const sanitized: Record<string, any> = {}
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      sanitized[key] = value
    } else if (typeof value === 'bigint') {
      sanitized[key] = Number(value)
    } else if (value instanceof Date) {
      sanitized[key] = value.toISOString()
    } else if (typeof value === 'object' && 'toNumber' in value && typeof (value as any).toNumber === 'function') {
      sanitized[key] = (value as any).toNumber()
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeRow(value)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

export function isUuid(val: any): boolean {
  return typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
}

export function isTimestamp(val: any): boolean {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}(:\d{2})?)?$/i.test(val)
}

export function isUuidColumn(colName?: string, tableName?: string): boolean {
  if (!colName) return false
  const lowerCol = colName.toLowerCase()
  if (
    lowerCol === 'access_token' ||
    lowerCol === 'token' ||
    lowerCol === 'session_token' ||
    lowerCol === 'auction_code' ||
    lowerCol === 'code' ||
    lowerCol === 'device_id' ||
    lowerCol === 'nfc_uid' ||
    lowerCol === 'content' ||
    lowerCol === 'password' ||
    lowerCol === 'password_hash' ||
    lowerCol === 'email' ||
    lowerCol === 'name' ||
    lowerCol === 'title' ||
    lowerCol === 'status' ||
    lowerCol === 'role' ||
    lowerCol === 'phone' ||
    lowerCol === 'anonymous_name' ||
    lowerCol === 'display_name' ||
    lowerCol === 'description' ||
    lowerCol === 'banner_image_url' ||
    lowerCol === 'image_url' ||
    lowerCol === 'certificate_url' ||
    lowerCol === 'certificate_type' ||
    lowerCol === 'payment_method' ||
    lowerCol === 'transaction_id' ||
    lowerCol === 'group_name' ||
    lowerCol === 'label'
  ) {
    return false
  }
  if (tableName === 'sessions' && lowerCol === 'id') {
    return false
  }
  if (lowerCol === 'id' || lowerCol.endsWith('_id') || lowerCol === 'approved_by') {
    return true
  }
  return false
}

export function formatSqlPlaceholder(val: any, idx: number, colName?: string, tableName?: string): string {
  if (colName) {
    if (isUuidColumn(colName, tableName) && isUuid(val)) {
      return `$${idx}::uuid`
    }
    if (isTimestamp(val)) {
      return `$${idx}::timestamp`
    }
    return `$${idx}`
  }
  if (isUuid(val)) {
    return `$${idx}::uuid`
  }
  if (isTimestamp(val)) {
    return `$${idx}::timestamp`
  }
  return `$${idx}`
}

export async function executeRpc(fnName: string, args: any = {}): Promise<{ data: any; error: any }> {
  try {
    if (fnName === 'get_auction_registration_count') {
      const auctionId = args.auction_uuid || args.p_auction_id || args.auction_id
      if (!auctionId) return { data: 0, error: null }
      const count = await prisma.auctionRegistration.count({
        where: { auctionId, isActive: true },
      })
      return { data: count, error: null }
    }

    if (fnName === 'process_auction_schedule') {
      const now = new Date()
      await prisma.auction.updateMany({
        where: {
          status: 'upcoming',
          registrationStart: { lte: now },
          registrationEnd: { gt: now },
        },
        data: { status: 'registration_open' },
      })

      await prisma.auction.updateMany({
        where: {
          status: 'registration_open',
          registrationEnd: { lte: now },
        },
        data: { status: 'registration_closed' },
      })

      await prisma.auction.updateMany({
        where: {
          status: { in: ['registration_open', 'upcoming'] },
          auctionStart: { lte: now },
          auctionEnd: { gt: now },
        },
        data: { status: 'live' },
      })

      await prisma.auction.updateMany({
        where: {
          status: 'live',
          auctionEnd: { lte: now },
        },
        data: { status: 'ended' },
      })

      try {
        await prisma.chatConversation.deleteMany({
          where: {
            auction: {
              status: { in: ['ended', 'completed'] }
            }
          }
        })
      } catch (err) {
        console.error('Failed to cleanup ended auction chat in db.ts:', err)
      }

      return { data: { success: true }, error: null }
    }

    if (fnName === 'get_monitor_stats') {
      const gemId = args.p_gem_id || args.gem_id
      if (!gemId) return { data: null, error: null }
      const bids = await prisma.bid.findMany({
        where: { gemId },
        orderBy: { bidAmount: 'desc' },
        include: { user: true },
      })
      const gem = await prisma.gem.findUnique({ where: { id: gemId } })
      const highestBid = bids[0]?.bidAmount || gem?.startingPrice || 0
      return {
        data: {
          gem: sanitizeRow(gem),
          highest_bid: Number(highestBid),
          total_bids: bids.length,
          bids: sanitizeRow(bids),
        },
        error: null,
      }
    }

    if (fnName === 'eliminate_non_approvers') {
      const gemId = args.p_gem_id
      const currentPrice = args.p_price ?? args.p_current_price
      if (!gemId) return { data: null, error: null }

      const gem = await prisma.gem.findUnique({ where: { id: gemId } })
      if (!gem || !gem.auctionId) return { data: { eliminated_count: 0 }, error: null }

      const registrations = await prisma.auctionRegistration.findMany({
        where: { auctionId: gem.auctionId, isActive: true },
        select: { userId: true },
      })

      const bidders = await prisma.bid.findMany({
        where: { gemId, bidAmount: currentPrice },
        select: { userId: true },
      })
      const bidderIds = new Set(bidders.map(b => b.userId))

      const eliminationsToCreate = registrations
        .filter(r => !bidderIds.has(r.userId))
        .map(r => ({
          gemId,
          userId: r.userId,
          eliminatedAtPrice: currentPrice,
        }))

      if (eliminationsToCreate.length > 0) {
        await prisma.gemElimination.createMany({
          data: eliminationsToCreate,
        })
      }

      return { data: { eliminated_count: eliminationsToCreate.length }, error: null }
    }

    return { data: null, error: null }
  } catch (err: any) {
    console.error(`Error executing RPC ${fnName}:`, err)
    return { data: null, error: { message: err.message || 'RPC execution failed' } }
  }
}

export class RpcBuilder {
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
    return await executeRpc(this.fnName, this.args)
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    resolve?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(resolve, reject)
  }

  catch<TResult = never>(reject?: ((reason: any) => TResult | PromiseLike<TResult>) | null) {
    return this.execute().catch(reject)
  }

  finally(callback?: (() => void) | null) {
    return this.execute().finally(callback)
  }
}

export class PostgresQueryBuilder<T = any> {
  private table: string
  private action: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT' = 'SELECT'
  private selectClause: string = '*'
  private selectOptions?: any
  private filters: QueryFilter[] = []
  private orClauses: string[] = []
  private orders: QueryOrder[] = []
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
    if (value === null || value === undefined) {
      this.filters.push({ column, operator: 'IS', value: null })
    } else {
      this.filters.push({ column, operator: '=', value })
    }
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

  private buildWhereClause(paramOffset = 1): { whereSql: string; params: any[] } {
    const conditions: string[] = []
    const params: any[] = []
    let currentIdx = paramOffset

    for (const f of this.filters) {
      if (f.operator === 'IS') {
        conditions.push(`"${f.column}" IS NULL`)
      } else if (f.operator === 'IS NOT') {
        conditions.push(`"${f.column}" IS NOT NULL`)
      } else if (f.operator === 'IN') {
        const inVals = Array.isArray(f.value) ? f.value : [f.value]
        if (inVals.length === 0) {
          conditions.push('FALSE')
        } else {
          const placeholders = inVals.map((v, i) => formatSqlPlaceholder(v, currentIdx + i, f.column, this.table)).join(', ')
          conditions.push(`"${f.column}" IN (${placeholders})`)
          params.push(...inVals)
          currentIdx += inVals.length
        }
      } else if (f.operator === 'NOT IN') {
        const inVals = Array.isArray(f.value) ? f.value : [f.value]
        if (inVals.length === 0) {
          // NOT IN empty list is always true
        } else {
          const placeholders = inVals.map((v, i) => formatSqlPlaceholder(v, currentIdx + i, f.column, this.table)).join(', ')
          conditions.push(`"${f.column}" NOT IN (${placeholders})`)
          params.push(...inVals)
          currentIdx += inVals.length
        }
      } else {
        const ph = formatSqlPlaceholder(f.value, currentIdx, f.column, this.table)
        conditions.push(`"${f.column}" ${f.operator} ${ph}`)
        params.push(f.value)
        currentIdx++
      }
    }

    for (const orStr of this.orClauses) {
      const parts = orStr.split(',')
      const subConditions: string[] = []
      for (const part of parts) {
        const m = part.trim().match(/^([a-zA-Z0-9_]+)\.(eq|neq|ilike|like)\.(.+)$/i)
        if (m) {
          const col = m[1]
          const op = m[2].toUpperCase()
          const val = m[3]
          const ph = formatSqlPlaceholder(val, currentIdx, col, this.table)
          subConditions.push(`"${col}" ${op} ${ph}`)
          params.push(val)
          currentIdx++
        }
      }
      if (subConditions.length > 0) {
        conditions.push(`(${subConditions.join(' OR ')})`)
      }
    }

    if (conditions.length === 0) return { whereSql: '', params: [] }

    return {
      whereSql: ` WHERE ${conditions.join(' AND ')}`,
      params,
    }
  }

  async execute(): Promise<{ data: any; error: any; count?: number }> {
    try {
      if (this.action === 'INSERT') {
        return await this.executeInsert()
      } else if (this.action === 'UPDATE') {
        return await this.executeUpdate()
      } else if (this.action === 'DELETE') {
        return await this.executeDelete()
      } else if (this.action === 'UPSERT') {
        return await this.executeUpsert()
      } else {
        return await this.executeSelect()
      }
    } catch (err: any) {
      console.error(`PostgresQueryBuilder Error on "${this.table}":`, err)
      return { data: null, error: { message: err.message || 'Database query error' } }
    }
  }

  private async executeInsert() {
    const records = Array.isArray(this.payload) ? this.payload : [this.payload]
    if (records.length === 0) return { data: [], error: null }

    const results: any[] = []
    for (const record of records) {
      if (!record.id && record.id !== null) {
        record.id = crypto.randomUUID()
      }
      const keys = Object.keys(record).filter(k => record[k] !== undefined)
      const values = keys.map(k => record[k])
      const colNames = keys.map(k => `"${k}"`).join(', ')
      const placeholders = values.map((val, i) => formatSqlPlaceholder(val, i + 1, keys[i], this.table)).join(', ')

      const sql = `INSERT INTO "${this.table}" (${colNames}) VALUES (${placeholders}) RETURNING *`
      const res = await prisma.$queryRawUnsafe<any[]>(sql, ...values)
      const inserted = sanitizeRow(res[0])
      results.push(inserted)

      broadcastEvent({
        channel: this.table,
        table: this.table,
        eventType: 'INSERT',
        new: inserted,
      })
    }

    const data = this.isSingle ? (results[0] || null) : (Array.isArray(this.payload) ? results : (results[0] || null))
    return { data, error: null }
  }

  private async executeUpdate() {
    const keys = Object.keys(this.payload).filter(k => this.payload[k] !== undefined)
    if (keys.length === 0) return { data: null, error: null }

    const setClauses: string[] = []
    const params: any[] = []
    let pIdx = 1

    for (const k of keys) {
      const val = this.payload[k]
      const ph = formatSqlPlaceholder(val, pIdx, k, this.table)
      setClauses.push(`"${k}" = ${ph}`)
      params.push(val)
      pIdx++
    }

    const { whereSql, params: whereParams } = this.buildWhereClause(pIdx)
    params.push(...whereParams)

    const sql = `UPDATE "${this.table}" SET ${setClauses.join(', ')}${whereSql} RETURNING *`
    const res = await prisma.$queryRawUnsafe<any[]>(sql, ...params)
    const sanitized = sanitizeRow(res)

    for (const row of sanitized) {
      broadcastEvent({
        channel: this.table,
        table: this.table,
        eventType: 'UPDATE',
        new: row,
      })
    }

    const data = this.isSingle || this.isMaybeSingle ? (sanitized[0] || null) : sanitized
    return { data, error: null }
  }

  private async executeDelete() {
    const { whereSql, params } = this.buildWhereClause(1)
    const sql = `DELETE FROM "${this.table}"${whereSql} RETURNING *`
    const res = await prisma.$queryRawUnsafe<any[]>(sql, ...params)
    const sanitized = sanitizeRow(res)

    for (const row of sanitized) {
      broadcastEvent({
        channel: this.table,
        table: this.table,
        eventType: 'DELETE',
        old: row,
      })
    }

    return { data: sanitized, error: null }
  }

  private async executeUpsert() {
    const record = this.payload
    const keys = Object.keys(record).filter(k => record[k] !== undefined)
    const values = keys.map(k => record[k])
    const colNames = keys.map(k => `"${k}"`).join(', ')
    const placeholders = values.map((val, i) => formatSqlPlaceholder(val, i + 1, keys[i], this.table)).join(', ')

    const conflictCol = keys.includes('user_id') && this.table === 'user_rewards' ? '"user_id"' : '"id"'
    const updateSets = keys.map(k => `"${k}" = EXCLUDED."${k}"`).join(', ')

    const sql = `INSERT INTO "${this.table}" (${colNames}) VALUES (${placeholders}) ON CONFLICT (${conflictCol}) DO UPDATE SET ${updateSets} RETURNING *`
    const res = await prisma.$queryRawUnsafe<any[]>(sql, ...values)
    const saved = sanitizeRow(res[0])

    broadcastEvent({
      channel: this.table,
      table: this.table,
      eventType: 'UPDATE',
      new: saved,
    })

    return { data: saved, error: null }
  }

  private async executeSelect() {
    const { whereSql, params } = this.buildWhereClause(1)
    let sql = `SELECT * FROM "${this.table}"${whereSql}`

    if (this.orders.length > 0) {
      const orderSql = this.orders
        .map(o => `"${o.column}" ${o.ascending ? 'ASC' : 'DESC'}`)
        .join(', ')
      sql += ` ORDER BY ${orderSql}`
    }

    if (this.limitCount !== undefined) {
      sql += ` LIMIT ${this.limitCount}`
    }

    if (this.offsetCount !== undefined) {
      sql += ` OFFSET ${this.offsetCount}`
    }

    const rows = await prisma.$queryRawUnsafe<any[]>(sql, ...params)
    let sanitized = sanitizeRow(rows)

    sanitized = await this.expandRelations(sanitized)

    if (this.isSingle) {
      if (sanitized.length === 0) {
        return { data: null, error: { message: 'Row not found' }, count: 0 }
      }
      return { data: sanitized[0], error: null, count: 1 }
    }

    if (this.isMaybeSingle) {
      return { data: sanitized[0] || null, error: null, count: sanitized.length }
    }

    return { data: sanitized, error: null, count: sanitized.length }
  }

  private async expandRelations(rows: any[]): Promise<any[]> {
    if (!rows || rows.length === 0) return rows
    const clause = this.selectClause

    // Expand user join
    if (clause.includes('user:users') || clause.includes('user:users!')) {
      const userIds = Array.from(new Set(rows.map(r => r.user_id || r.admin_id).filter(Boolean)))
      if (userIds.length > 0) {
        const users = await prisma.$queryRawUnsafe<any[]>(
          `SELECT id, email, role, anonymous_name, display_name, phone FROM "users" WHERE id IN (${userIds.map((v, i) => formatSqlPlaceholder(v, i + 1)).join(', ')})`,
          ...userIds
        )
        const userMap = new Map(sanitizeRow(users).map((u: any) => [u.id, u]))
        for (const r of rows) {
          const uid = r.user_id || r.admin_id
          r.user = userMap.get(uid) || null
        }
      }
    }

    // Expand auction join
    if (clause.includes('auction:auctions')) {
      const auctionIds = Array.from(new Set(rows.map(r => r.auction_id).filter(Boolean)))
      if (auctionIds.length > 0) {
        const auctions = await prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM "auctions" WHERE id IN (${auctionIds.map((v, i) => formatSqlPlaceholder(v, i + 1)).join(', ')})`,
          ...auctionIds
        )
        const auctionMap = new Map(sanitizeRow(auctions).map((a: any) => [a.id, a]))
        for (const r of rows) {
          r.auction = auctionMap.get(r.auction_id) || null
        }
      }
    }

    // Expand gem join
    if (clause.includes('gem:gems') || clause.includes('gems(*)')) {
      const gemIds = Array.from(new Set(rows.map(r => r.gem_id).filter(Boolean)))
      if (gemIds.length > 0) {
        const gems = await prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM "gems" WHERE id IN (${gemIds.map((v, i) => formatSqlPlaceholder(v, i + 1)).join(', ')})`,
          ...gemIds
        )
        const gemMap = new Map(sanitizeRow(gems).map((g: any) => [g.id, g]))
        for (const r of rows) {
          r.gem = gemMap.get(r.gem_id) || null
        }
      }
    }

    // Expand gem_images
    if (clause.includes('gem_images') && this.table === 'gems') {
      const gemIds = rows.map(r => r.id).filter(Boolean)
      if (gemIds.length > 0) {
        const images = await prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM "gem_images" WHERE gem_id IN (${gemIds.map((v, i) => formatSqlPlaceholder(v, i + 1)).join(', ')}) ORDER BY display_order ASC`,
          ...gemIds
        )
        const sanitizedImages = sanitizeRow(images)
        for (const r of rows) {
          r.gem_images = sanitizedImages.filter((img: any) => img.gem_id === r.id)
          r.images = r.gem_images
        }
      }
    }

    // Expand gem_certificates
    if (clause.includes('gem_certificates') && this.table === 'gems') {
      const gemIds = rows.map(r => r.id).filter(Boolean)
      if (gemIds.length > 0) {
        const certs = await prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM "gem_certificates" WHERE gem_id IN (${gemIds.map((v, i) => formatSqlPlaceholder(v, i + 1)).join(', ')})`,
          ...gemIds
        )
        const sanitizedCerts = sanitizeRow(certs)
        for (const r of rows) {
          r.gem_certificates = sanitizedCerts.filter((c: any) => c.gem_id === r.id)
        }
      }
    }

    // Expand bids for gems
    if (clause.includes('bids') && this.table === 'gems') {
      const gemIds = rows.map(r => r.id).filter(Boolean)
      if (gemIds.length > 0) {
        const bids = await prisma.$queryRawUnsafe<any[]>(
          `SELECT b.*, u.anonymous_name, u.display_name 
           FROM "bids" b 
           LEFT JOIN "users" u ON b.user_id = u.id 
           WHERE b.gem_id IN (${gemIds.map((v, i) => formatSqlPlaceholder(v, i + 1, 'gem_id', 'bids')).join(', ')}) 
           ORDER BY b.created_at ASC`,
          ...gemIds
        )
        const sanitizedBids = sanitizeRow(bids)
        for (const b of sanitizedBids) {
          b.bid_amount = Number(b.bid_amount)
          b.user = {
            anonymous_name: b.anonymous_name || null,
            display_name: b.display_name || null,
          }
        }
        for (const r of rows) {
          r.bids = sanitizedBids.filter((bid: any) => bid.gem_id === r.id)
        }
      } else {
        for (const r of rows) {
          r.bids = []
        }
      }
    }

    // Expand single bid join (e.g. bid:bids on payments or winning_bid:bids on auction_winners)
    if (clause.includes('bid:bids') || clause.includes('winning_bid:bids')) {
      const bidIds = Array.from(new Set(rows.map(r => r.bid_id || r.winning_bid_id).filter(Boolean)))
      if (bidIds.length > 0) {
        const bids = await prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM "bids" WHERE id IN (${bidIds.map((v, i) => formatSqlPlaceholder(v, i + 1, 'id', 'bids')).join(', ')})`,
          ...bidIds
        )
        const bidMap = new Map(sanitizeRow(bids).map((b: any) => {
          b.bid_amount = Number(b.bid_amount)
          return [b.id, b]
        }))
        for (const r of rows) {
          if (r.bid_id) r.bid = bidMap.get(r.bid_id) || null
          if (r.winning_bid_id) r.winning_bid = bidMap.get(r.winning_bid_id) || null
        }
      }
    }

    return rows
  }

  then<TResult1 = { data: T; error: any; count?: number }, TResult2 = never>(
    resolve?: ((value: { data: T; error: any; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(resolve as any, reject)
  }

  catch<TResult = never>(reject?: ((reason: any) => TResult | PromiseLike<TResult>) | null) {
    return this.execute().catch(reject)
  }

  finally(callback?: (() => void) | null) {
    return this.execute().finally(callback)
  }
}

export function fromTable<T = any>(tableName: string) {
  return new PostgresQueryBuilder<T>(tableName)
}
