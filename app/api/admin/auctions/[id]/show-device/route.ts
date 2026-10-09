import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { IoTDataPlaneClient, PublishCommand } from '@aws-sdk/client-iot-data-plane'

// Need to duplicate this to avoid cyclic deps or weird aws-sdk imports failing Vercel unless installed
const iotClient = new IoTDataPlaneClient({ region: process.env.AWS_REGION || 'us-east-1' })

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Update the database
    const { data: auction, error } = await supabase
      .from('auctions')
      .update({ show_on_device: true })
      .eq('id', id)
      .select()
      .single()

    if (error || !auction) {
      return NextResponse.json({ error: 'Failed to update auction' }, { status: 500 })
    }

    // Now, fetch ALL auctions that should be visible to devices to construct the GET_AUCTION payload
    const { data: auctions } = await supabase
      .from('auctions')
      .select('*')
      .in('status', ['upcoming', 'registration_open', 'live'])
      .order('auction_start', { ascending: true })

    if (auctions) {
      const payload = {
        Action: 'GET_AUCTION',
        Status: 'SUCCESS',
        Auctions: auctions.map(a => ({
          Auction_ID: a.id,
          Name: a.name,
          Auction_Mode: a.auction_type,
          Auction_Status: a.status,
          Start_DateTime: a.auction_start,
          End_DateTime: a.auction_end,
          Items_Count: 0,
          Registered_Count: 0,
          Show_On_Device: !!a.show_on_device
        }))
      }

      // Publish broadcast to force all devices to update their auction list immediately
      await iotClient.send(new PublishCommand({
        topic: 'auction/broadcast',
        payload: Buffer.from(JSON.stringify(payload)),
        qos: 1
      }))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Show on device error:", error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
