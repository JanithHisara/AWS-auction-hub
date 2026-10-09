const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPolicies() {
  const { data, error } = await supabase.rpc('query_pg_policies_custom_not_exist_but_we_can_try');
  // Just fetch from gem_images to see if there is a difference
  const { data: adminImages } = await supabase.from('gem_images').select('*').limit(5);
  console.log('Admin images count:', adminImages?.length);
  
  const publicClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: publicImages } = await publicClient.from('gem_images').select('*').limit(5);
  console.log('Public images count:', publicImages?.length);
}
checkPolicies();
