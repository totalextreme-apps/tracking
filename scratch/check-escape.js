const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://dbhjqpfoqrdrtibqglra.supabase.co';
const supabaseAnonKey = 'sb_publishable_1HsqHfQV_ewZf4MdYQCTEQ_4VRvWGZV';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkEscape() {
    const { data, error } = await supabase
        .from('collection_items')
        .select('*, movies(title, id)')
        .not('movie_id', 'is', null);

    if (error) console.error('Error:', error);
    else {
        const matches = data.filter(i => i.movies?.title?.toLowerCase().includes('escape from new york'));
        console.log('Total Escape from New York items across all users:', matches.length);
        matches.forEach(m => {
            console.log('User:', m.user_id, '| Format:', m.format, '| Value:', m.value_estimate, '| ItemID:', m.id);
        });
    }
}

checkEscape();
