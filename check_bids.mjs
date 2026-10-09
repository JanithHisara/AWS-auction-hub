import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkBids() {
    const { data, error } = await supabase.from("bids").select("*").order("created_at", { ascending: false }).limit(10)
    console.log(data)
}
checkBids()
