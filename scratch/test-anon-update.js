const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) env[parts[0].trim().replace('export ', '')] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function testUpdate() {
  console.log('Testing updating value_estimate to null...');
  const { data, error } = await supabase
    .from('collection_items')
    .update({ value_estimate: null })
    .eq('value_estimate', 5.39)
    .select('id');

  if (error) {
    console.error('Update Error:', error);
  } else {
    console.log(`Successfully updated ${data ? data.length : 0} items!`);
  }
}

testUpdate();
