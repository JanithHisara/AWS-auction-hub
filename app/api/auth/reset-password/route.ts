import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPasswordResetEmail } from '@/lib/email/resend'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()
    
    // Generate the recovery link
    const requestUrl = new URL(request.url)
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${requestUrl.origin}/auth/callback?next=/reset-password`
      }
    })
    
    if (error) {
      console.error('Error generating reset link:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    const actionLink = data.properties.action_link
    
    // Send via Resend
    await sendPasswordResetEmail({
      to: email,
      resetLink: actionLink
    })
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' }, 
      { status: 500 }
    )
  }
}
