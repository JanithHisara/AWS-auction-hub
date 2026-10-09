import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase
    .from("gems")
    .select("id, round_end_time, auctions(auction_end, auction_type)")
    .limit(1)
    .single();
    
  console.log(JSON.stringify(data, null, 2));
}

test();
