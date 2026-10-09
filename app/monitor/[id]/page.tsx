import MonitorClient from '@/components/monitor/MonitorClient'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function MonitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  
  // Verify gem exists
  const { data: gem } = await supabase
    .from('gems')
    .select('id')
    .eq('id', id)
    .single()

  if (!gem) {
    notFound()
  }

  return <MonitorClient gemId={id} />
}

