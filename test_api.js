const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function check() {
  const { data: item } = await supabase
    .from('gems')
    .select(`
      id,
      current_price,
      auction:auctions (name, auction_type)
    `)
    .limit(1)
    .single();

  console.log(JSON.stringify(item, null, 2));
}
check();
