import { supabase } from '../lib/supabase';

async function debugCollection() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('No user found');
    return;
  }

  console.log('Fetching raw collection items for user:', user.id);
  
  const { data, error } = await supabase
    .from('collection_items')
    .select('*')
    .eq('user_id', user.id);

  if (error) {
    console.error('Error fetching collection:', error);
    return;
  }

  console.log('Total items in DB:', data.length);
  
  // Look specifically for anything that might be Ice Age
  // Ice Age TMDB ID: 425
  // Ice Age: The Meltdown: 950
  // Ice Age: Dawn of the Dinosaurs: 8321
  const iceAgeIds = [425, 950, 8321, 103332, 278927];
  
  const potentialIceAge = data.filter(item => {
    return iceAgeIds.includes(Number(item.movie_id)) || 
           iceAgeIds.includes(Number(item.tmdb_id)) ||
           String(item.movie_id).includes('425') ||
           String(item.notes || '').toLowerCase().includes('ice age');
  });

  console.log('Potential Ice Age items found in raw DB:', JSON.stringify(potentialIceAge, null, 2));

  // Check for ANY items that have no movie_id or show_id
  const invalidItems = data.filter(i => !i.movie_id && !i.show_id);
  console.log('Items with NO IDs:', invalidItems.length);
}

debugCollection();
