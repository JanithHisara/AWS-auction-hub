import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PERMISSIONS } from '@/lib/permissions'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_DEVICES)

    const body = await request.json()
    const { display_name, email, phone, password } = body

    if (!display_name) {
      return NextResponse.json({ error: 'Display name is required' }, { status: 400 })
    }
    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Check for duplicate email if provided
    if (email) {
      const { data: existingUser } = await adminClient
        .from('users')
        .select('id')
        .eq('email', email)
        .single()

      if (existingUser) {
        return NextResponse.json(
          { error: 'A user with this email already exists' },
          { status: 409 },
        )
      }
    }

    const generatedEmail = email || `nfc-${Date.now()}@placeholder.local`
    
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: generatedEmail,
      email_confirm: true,
      password: password,
      user_metadata: {
        display_name: display_name,
        phone: phone || null
      }
    })

    if (authError) {
      if (authError.message.toLowerCase().includes('already exists')) {
        return NextResponse.json(
          { error: 'A user with this email already exists' },
          { status: 409 },
        )
      }
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    if (!authData || !authData.user) {
      return NextResponse.json({ error: 'Failed to retrieve created user data' }, { status: 500 })
    }

    const userId = authData.user.id

    // The database trigger will have created the public.users record.
    // Now we just update it with the additional fields.
    const { data: user, error } = await adminClient
      .from('users')
      .update({
        display_name,
        phone: phone || null,
        // Trigger generates anonymous_name if not provided, but we can set it if we want, 
        // however the trigger already gave it a unique one. We'll just leave what the trigger did.
      })
      .eq('id', userId)
      .select('id, email, display_name, phone, role, anonymous_name')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ user }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
}
