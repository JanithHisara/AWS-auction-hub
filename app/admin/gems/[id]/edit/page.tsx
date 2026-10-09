import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'
import GemForm from '@/components/gems/GemForm'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function EditGemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requirePermission(PERMISSIONS.MANAGE_ITEMS)
  const supabase = await createClient()

  const { data: gem } = await supabase
    .from('gems')
    .select('*')
    .eq('id', id)
    .eq('admin_id', user.id)
    .single()

  if (!gem) notFound()

  const { data: images } = await supabase
    .from('gem_images')
    .select('*')
    .eq('gem_id', id)
    .order('display_order')

  const { data: certificates } = await supabase
    .from('gem_certificates')
    .select('*')
    .eq('gem_id', id)

  const { data: auctions } = await supabase
    .from('auctions')
    .select('id, name, status, auction_start, auction_end, auction_type')
    .eq('admin_id', user.id)
    .in('status', ['draft', 'upcoming', 'registration_open'])
    .order('auction_start', { ascending: true })

  return (
    <div className="max-w-3xl mx-auto">
      <Link 
        href={`/admin/gems/${id}`}
        className="inline-flex items-center gap-2 text-[var(--text-secondary)] hover:text-white mb-6 transition-colors"
      >
         Back to Item
      </Link>

      <div className="card-glass rounded-2xl p-8">
        <h1 className="text-3xl font-bold text-white mb-2">Edit Item</h1>
        <p className="text-[var(--text-secondary)] mb-8">Update item details</p>
        
        <GemForm 
          gem={{ ...gem, images: images || [], certificates: certificates || [] }} 
          auctions={(auctions || []) as any}
        />
      </div>
    </div>
  )
}

