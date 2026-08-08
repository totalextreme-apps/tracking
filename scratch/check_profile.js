const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://dbhjqpfoqrdrtibqglra.supabase.co';
const supabaseAnonKey = 'sb_publishable_1HsqHfQV_ewZf4MdYQCTEQ_4VRvWGZV';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', '00000000-0000-0000-0000-000000000000').maybeSingle();
  if (error) {
    console.error('Error fetching mock profile:', error);
  } else {
    console.log('Mock profile data:', data);
  }
}

run();
