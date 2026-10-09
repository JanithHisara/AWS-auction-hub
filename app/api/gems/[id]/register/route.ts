import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireAuth()
    const supabase = await createClient()

    // Verify gem exists and is active (or upcoming)
    // Allowing registration for active or draft (if published?) - usually active.
    // Actually, users should be able to register before it starts.
    const { data: gem } = await supabase
      .from('gems')
      .select('*')
      .eq('id', id)
      .in('status', ['active', 'draft']) // Allow registration in draft/upcoming if published?
      // Let's stick to 'active' or upcoming check.
      // Schema has start_time.
      .single()

    if (!gem) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 })
    }

    // Check if already registered
    const { data: existing } = await supabase
      .from('auction_registrations')
      .select('id')
      .eq('gem_id', id)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      return NextResponse.json({ message: 'Already registered' }, { status: 200 })
    }

    // Register
    const { error } = await supabase
      .from('auction_registrations')
      .insert({
        gem_id: id,
        user_id: user.id,
      })

    if (error) throw error

    return NextResponse.json({ message: 'Successfully registered' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const user = await requireAuth()
        const supabase = await createClient()
    
        const { data: registration } = await supabase
          .from('auction_registrations')
          .select('id')
          .eq('gem_id', id)
          .eq('user_id', user.id)
          .single()
    
        return NextResponse.json({ isRegistered: !!registration })
      } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
}

