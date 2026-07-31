const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = '/Users/mac1/Desktop/tracking-app/.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim().replace('export ', '');
        const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        env[key] = val;
    }
});

const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkValuedItems() {
    console.log('Querying valued collection items...');
    try {
        const { data, error } = await supabase
            .from('collection_items')
            .select(`
                id,
                format,
                value_estimate,
                movies ( title ),
                shows ( name )
            `)
            .not('value_estimate', 'is', null);
            
        if (error) {
            console.error('Error fetching data:', error);
            return;
        }
        
        console.log(`Found ${data.length} valued items:`);
        data.slice(0, 10).forEach((item, idx) => {
            const title = item.movies ? item.movies.title : (item.shows ? item.shows.name : 'Unknown');
            console.log(`- ${idx+1}: "${title}" (${item.format}) => $${item.value_estimate}`);
        });
    } catch (e) {
        console.error('Exception:', e);
    }
}

checkValuedItems();
