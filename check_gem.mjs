import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
    const { data, error } = await supabase
      .from("gems")
      .select("id, auction:auctions(auction_type, auction_end, status)")
      .limit(1)
    console.log(JSON.stringify(data, null, 2))
}
check()
