import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const user = await requirePermission(PERMISSIONS.MANAGE_ITEMS)
    const supabase = await createClient()
    const body = await request.json()

    const { data: gem, error } = await supabase
      .from('gems')
      .insert({
        admin_id: user.id,
        auction_id: body.auction_id || null,
        name: body.name,
        description: body.description,
        starting_price: body.starting_price,
        min_bid_increment: body.min_bid_increment,
        start_time: body.start_time,
        end_time: body.end_time,
        status: 'draft',
        carat_weight: body.carat_weight,
        cut: body.cut,
        color: body.color,
        clarity: body.clarity,
        provenance: body.provenance,
      })
      .select()
      .single()

    if (error) throw error

    if (body.images && body.images.length > 0) {
      const mediaTypes: string[] = body.media_types || []
      const images = body.images.map((url: string, index: number) => ({
        gem_id: gem.id,
        image_url: url,
        display_order: index,
        media_type: mediaTypes[index] || 'image',
      }))

      await supabase.from('gem_images').insert(images)
    }

    // Handle certificates if provided
    if (body.certificates && body.certificates.length > 0) {
      const certificates = body.certificates.map((cert: { url: string; type?: string }) => ({
        gem_id: gem.id,
        certificate_url: cert.url,
        certificate_type: cert.type || null,
      }))

      await supabase.from('gem_certificates').insert(certificates)
    }

    return NextResponse.json(gem)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let query = supabase
      .from('gems')
      .select('*')
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

