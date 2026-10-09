import { createAdminClient } from './lib/supabase/admin'

async function check() {
  const adminDb = createAdminClient()
  const { data, error } = await adminDb.from('auctions').select('id, name, admin_id, moderator_id, status')
  console.log(data, error)
}
check()