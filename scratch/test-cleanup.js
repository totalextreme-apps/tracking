const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://dbhjqpfoqrdrtibqglra.supabase.co';
const supabaseAnonKey = 'sb_publishable_1HsqHfQV_ewZf4MdYQCTEQ_4VRvWGZV';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function cleanAllErrant() {
    console.log('Querying items with value_estimate between 5.20 and 5.50...');
    const { data, error } = await supabase
        .from('collection_items')
        .select('id, movie_id, value_estimate, user_id, movies(title)')
        .gte('value_estimate', 5.20)
        .lte('value_estimate', 5.50);

    if (error) {
        console.error('Select error:', error);
        return;
    }

    console.log(`Found ${data.length} items with value between 5.20 and 5.50:`);
    data.forEach(item => {
        console.log(`- ${item.movies?.title}: $${item.value_estimate} (id: ${item.id})`);
    });

    const idsToClean = data.map(i => i.id);
    const { data: updated, error: updateErr } = await supabase
        .from('collection_items')
        .update({ value_estimate: null })
        .in('id', idsToClean)
        .select();

    if (updateErr) console.error('Update error:', updateErr);
    else console.log('Successfully updated count:', updated ? updated.length : 0);
}

cleanAllErrant().catch(console.error);
