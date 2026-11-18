import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  
  // Supabase may pass 'next' or 'redirect_to'
  let next = requestUrl.searchParams.get('next') || requestUrl.searchParams.get('redirect_to') || '/'
  const origin = requestUrl.origin

  // If next contains the full origin URL, strip it to just the path
  if (next.startsWith(origin)) {
    next = next.replace(origin, '')
  }

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Ensure we don't accidentally redirect to an absolute URL from query params unless it's our origin
  const redirectUrl = next.startsWith('/') ? next : '/'

  return NextResponse.redirect(`${origin}${redirectUrl}`)
}
