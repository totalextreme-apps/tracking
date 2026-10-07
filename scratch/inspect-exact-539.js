const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) env[parts[0].trim().replace('export ', '')] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function inspectExactValues() {
  console.log('Querying collection_items for values near 5.39...');
  const { data, error } = await supabase
    .from('collection_items')
    .select('id, value_estimate, format, movies(title), shows(name)')
    .not('value_estimate', 'is', null);

  if (error) {
    console.error('Query Error:', error);
    return;
  }

  const near539 = data.filter(i => {
    const v = Number(i.value_estimate);
    return Math.abs(v - 5.39) < 0.01 || (v.toFixed && v.toFixed(2) === '5.39');
  });

  console.log(`Total valued items: ${data.length}`);
  console.log(`Items matching ~5.39: ${near539.length}`);
  if (near539.length > 0) {
    console.log('Sample near 5.39 items:');
    near539.slice(0, 10).forEach(i => {
      const title = i.movies ? i.movies.title : (i.shows ? i.shows.name : 'Unknown');
      console.log(`- ID: ${i.id} | Title: "${title}" | Raw Value: ${i.value_estimate} (Type: ${typeof i.value_estimate})`);
    });
  }
}

inspectExactValues();
