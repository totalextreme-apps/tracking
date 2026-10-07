const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) env[parts[0].trim().replace('export ', '')] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function checkUsers() {
  const { data } = await supabase
    .from('collection_items')
    .select('id, user_id, value_estimate')
    .not('value_estimate', 'is', null);

  const countsByUser = {};
  data.forEach(i => {
    const v = Number(i.value_estimate);
    if (Math.abs(v - 5.39) < 0.01) {
      countsByUser[i.user_id] = (countsByUser[i.user_id] || 0) + 1;
    }
  });

  console.log('5.39 items by user_id:', countsByUser);
}

checkUsers();
