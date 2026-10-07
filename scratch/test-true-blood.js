const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://dbhjqpfoqrdrtibqglra.supabase.co';
const supabaseAnonKey = 'sb_publishable_1HsqHfQV_ewZf4MdYQCTEQ_4VRvWGZV';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTrueBlood() {
    console.log('Searching for True Blood in database...');
    const { data, error } = await supabase
        .from('collection_items')
        .select('*, shows(name)')
        .not('show_id', 'is', null);

    if (error) console.error('Error:', error);
    else {
        const matches = data.filter(i => i.shows?.name?.toLowerCase().includes('true blood'));
        console.log('True Blood items count:', matches.length);
        console.log(matches);
    }
}

checkTrueBlood();
