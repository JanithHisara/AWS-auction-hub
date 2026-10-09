import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PERMISSIONS } from '@/lib/permissions'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_DEVICES)
    
    const { id } = await params
    const adminDb = createAdminClient()

    // Update all non-completed/non-ended gems in this auction to 'active'
    const { error } = await adminDb
      .from('gems')
      .update({ status: 'active' })
      .eq('auction_id', id)
      .not('status', 'in', '("ended","completed")')

    if (error) {
      console.error('Failed to activate all items:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}
