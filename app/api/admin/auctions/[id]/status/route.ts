import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuctionManager } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { sendAuctionLiveEmail, sendAuctionSummaryEmail } from '@/lib/email/resend'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireAuctionManager(id, undefined, PERMISSIONS.MANAGE_AUCTIONS)
    const supabase = await createClient()

    let status: string
    const contentType = request.headers.get('content-type')
    
    if (contentType?.includes('application/json')) {
      const body = await request.json()
      status = body.status
    } else {
      const formData = await request.formData()
      status = formData.get('status') as string
    }

    const validStatuses = ['draft', 'upcoming', 'registration_open', 'registration_closed', 'live', 'ended', 'completed']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const adminDb = createAdminClient()

    if (status === 'registration_open') {
      const { count: unpublishedCount } = await adminDb
        .from('gems')
        .select('*', { count: 'exact', head: true })
        .eq('auction_id', id)
        .eq('status', 'draft')

      if (unpublishedCount && unpublishedCount > 0) {
        return NextResponse.json({ error: 'All items must be published before opening registration.' }, { status: 400 })
      }

      const { count: totalCount } = await adminDb
        .from('gems')
        .select('*', { count: 'exact', head: true })
        .eq('auction_id', id)

      if (totalCount === 0) {
        return NextResponse.json({ error: 'Auction must have at least one item before opening registration.' }, { status: 400 })
      }
    }

    const { error } = await adminDb
      .from('auctions')
      .update({ 
        status,
        published_at: status !== 'draft' ? new Date().toISOString() : null,
      })
      .eq('id', id)

    if (error) {
      console.error('Update error:', error)
      return NextResponse.json({ error: 'Failed to update: ' + error.message }, { status: 500 })
    }

    // When auction goes live, notify all approved registered users via email
    if (status === 'live') {
      try {
        const adminDb = createAdminClient()
        const { data: auction } = await adminDb
          .from('auctions')
          .select('name')
          .eq('id', id)
          .single()

        const { data: registrations } = await adminDb
          .from('auction_registrations')
          .select('access_token, user:users!auction_registrations_user_id_fkey(email, anonymous_name, display_name)')
          .eq('auction_id', id)
          .eq('approval_status', 'approved')

        if (registrations?.length && auction) {
          type UserInfo = { email: string; anonymous_name?: string | null; display_name?: string | null }
          const emailPromises = registrations
            .map(r => {
              const userRaw = r.user as unknown
              const user: UserInfo | null = Array.isArray(userRaw) ? (userRaw[0] as UserInfo | undefined) ?? null : userRaw as UserInfo | null
              return { ...r, userInfo: user }
            })
            .filter(r => r.userInfo?.email)
            .map(r => 
              sendAuctionLiveEmail({
                to: r.userInfo!.email,
                auctionName: auction.name,
                accessToken: r.access_token,
                userName: r.userInfo!.display_name || r.userInfo!.anonymous_name || undefined,
              }).catch(err => console.error(`Failed to send live email to ${r.userInfo!.email}:`, err))
            )
          await Promise.allSettled(emailPromises)
          console.log(`Sent auction-live emails to ${emailPromises.length} registrants`)
        }
      } catch (emailError) {
        console.error('Failed to send auction-live notification emails:', emailError)
      }
    }

    // When auction is completed, notify all registered users with summary of gems and winning prices
    if (status === 'completed') {
      try {
        const adminDb = createAdminClient()
        
        // 1. Fetch auction name
        const { data: auction } = await adminDb
          .from('auctions')
          .select('name')
          .eq('id', id)
          .single()

        if (auction) {
          // 2. Fetch all gems in this auction
          const { data: gems } = await adminDb
            .from('gems')
            .select('id, name, description, status')
            .eq('auction_id', id)

          if (gems && gems.length > 0) {
            // 3. Fetch winning bids for these gems
            const { data: winners } = await adminDb
              .from('auction_winners')
              .select('gem_id, winning_bid_id')
              .in('gem_id', gems.map(g => g.id))

            const winningBidIds = winners?.map(w => w.winning_bid_id).filter(Boolean) || []
            let winningBidsMap: Record<string, number> = {}
            
            if (winningBidIds.length > 0) {
              const { data: winningBids } = await adminDb
                .from('bids')
                .select('id, bid_amount')
                .in('id', winningBidIds)
              
              if (winningBids) {
                winningBidsMap = winningBids.reduce((acc, b) => {
                  acc[b.id] = b.bid_amount
                  return acc
                }, {} as Record<string, number>)
              }
            }

            const gemWinnersMap = winners?.reduce((acc, w) => {
              acc[w.gem_id] = w.winning_bid_id
              return acc
            }, {} as Record<string, string>) || {}

            const itemsSummary = gems.map(g => {
              const winningBidId = gemWinnersMap[g.id]
              const winningPrice = winningBidId ? winningBidsMap[winningBidId] || null : null
              return {
                name: g.name,
                description: g.description,
                winningPrice,
              }
            })

            // 4. Fetch all approved registered users
            const { data: registrations } = await adminDb
              .from('auction_registrations')
              .select('user:users!auction_registrations_user_id_fkey(email, anonymous_name, display_name)')
              .eq('auction_id', id)
              .eq('approval_status', 'approved')

            if (registrations?.length) {
              type UserInfo = { email: string; anonymous_name?: string | null; display_name?: string | null }
              const emailPromises = registrations
                .map(r => {
                  const userRaw = r.user as unknown
                  const user: UserInfo | null = Array.isArray(userRaw) ? (userRaw[0] as UserInfo | undefined) ?? null : userRaw as UserInfo | null
                  return user
                })
                .filter((u): u is UserInfo => !!u?.email)
                .map(u => 
                  sendAuctionSummaryEmail({
                    to: u.email,
                    userName: u.display_name || u.anonymous_name || undefined,
                    auctionName: auction.name,
                    items: itemsSummary,
                  }).catch(err => console.error(`Failed to send summary email to ${u.email}:`, err))
                )
              
              await Promise.allSettled(emailPromises)
              console.log(`Sent auction summary emails to ${emailPromises.length} registrants`)
            }
          }
        }
      } catch (emailError) {
        console.error('Failed to send auction summary emails:', emailError)
      }
    }

    if (contentType?.includes('application/json')) {
      return NextResponse.json({ success: true, status })
    }
    
    return NextResponse.redirect(new URL(`/admin/auctions/${id}`, request.url))

  } catch (error: any) {
    console.error('Status update error:', error)
    if (error?.message === 'NEXT_REDIRECT') {
      return NextResponse.json({ error: 'Unauthorized: You are not the assigned moderator for this auction.' }, { status: 403 })
    }
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

