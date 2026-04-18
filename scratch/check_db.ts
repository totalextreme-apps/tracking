import { supabase } from '../lib/supabase';

async function check() {
  const { data: profile } = await supabase.from('profiles').select('id').eq('username', 'HorrorShow86').single();
  if (!profile) {
    console.log('Profile not found');
    return;
  }
  const userId = profile.id;
  console.log('User ID:', userId);

  const { data: items } = await supabase
    .from('collection_items')
    .select('*, movies(*), shows(*)')
    .eq('user_id', userId);
  
  console.log('Total items:', items?.length);
  const iceAge = items?.filter(i => (i.movies?.title || i.shows?.name || '').toLowerCase().includes('ice age'));
  console.log('Ice Age items found:', iceAge?.length);
  if (iceAge) {
    iceAge.forEach(i => {
       console.log('- Title:', i.movies?.title || i.shows?.name, 'Format:', i.format, 'Status:', i.status, 'MovieID:', i.movie_id, 'ShowID:', i.show_id);
    });
  }
}

check();
