const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://dbhjqpfoqrdrtibqglra.supabase.co';
const supabaseAnonKey = 'sb_publishable_1HsqHfQV_ewZf4MdYQCTEQ_4VRvWGZV';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Testing insert on reactions for mock user...');
  const userId = '00000000-0000-0000-0000-000000000000';
  
  const { data: items, error: itemsError } = await supabase.from('collection_items').select('id').limit(1);
  if (itemsError || !items || items.length === 0) {
    console.error('No items found or query failed:', itemsError);
    return;
  }
  const itemId = items[0].id;
  console.log('Using item ID:', itemId);

  const { data, error } = await supabase.from('reactions').insert({
    user_id: userId,
    collection_item_id: itemId,
    reaction_type: '🔥'
  }).select();

  if (error) {
    console.error('Error inserting reaction:', error);
  } else {
    console.log('Successfully inserted reaction:', data);
    
    // Now delete it
    const { error: delError } = await supabase.from('reactions').delete().eq('id', data[0].id);
    if (delError) {
      console.error('Error deleting reaction:', delError);
    } else {
      console.log('Successfully deleted reaction.');
    }
  }
}

run();
