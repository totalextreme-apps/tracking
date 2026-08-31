const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://dbhjqpfoqrdrtibqglra.supabase.co';
const supabaseAnonKey = 'sb_publishable_1HsqHfQV_ewZf4MdYQCTEQ_4VRvWGZV';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: profiles } = await supabase.from('profiles').select('id, username').limit(5);
  console.log('Profiles:', profiles);
  if (!profiles || profiles.length === 0) return;
  
  const testUserId = profiles[0].id;
  
  const { data: follows } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', testUserId);
    
  const followingIds = follows?.map((f) => f.following_id) || [];
  const interestingIds = [...followingIds, testUserId];
  console.log('Interesting IDs:', interestingIds);

  const [postsRes, updatesRes, watchesRes, listingsRes] = await Promise.all([
    supabase
      .from('bulletin_posts')
      .select(`
        *,
        profiles(*),
        movies(id, title, poster_path, tmdb_id),
        shows(id, name, poster_path, tmdb_id),
        collection_items(
          *,
          movies(id, title, poster_path, tmdb_id),
          shows(id, name, poster_path, tmdb_id)
        ),
        post_comments(
          id,
          content,
          created_at,
          profiles(id, username, avatar_url)
        )
      `)
      .in('user_id', interestingIds)
      .order('created_at', { ascending: false })
      .limit(25),
    supabase
      .from('collection_items')
      .select(`
        *,
        movies(id, title, poster_path, tmdb_id),
        shows(id, name, poster_path, tmdb_id),
        item_comments(
          id,
          content,
          created_at,
          profiles(id, username, avatar_url)
        )
      `)
      .in('user_id', interestingIds)
      .eq('status', 'owned')
      .order('created_at', { ascending: false })
      .limit(25),
    supabase
      .from('collection_items')
      .select(`
        *,
        movies(id, title, poster_path, tmdb_id),
        shows(id, name, poster_path, tmdb_id),
        item_comments(
          id,
          content,
          created_at,
          profiles(id, username, avatar_url)
        )
      `)
      .in('user_id', interestingIds)
      .not('last_watched_at', 'is', null)
      .order('last_watched_at', { ascending: false })
      .limit(25),
    supabase
      .from('collection_items')
      .select(`
        *,
        movies(id, title, poster_path, tmdb_id),
        shows(id, name, poster_path, tmdb_id),
        item_comments(
          id,
          content,
          created_at,
          profiles(id, username, avatar_url)
        )
      `)
      .in('user_id', interestingIds)
      .or('for_sale.eq.true,for_trade.eq.true')
      .order('updated_at', { ascending: false })
      .limit(25)
  ]);

  console.log('Posts Count:', postsRes.data?.length, 'Error:', postsRes.error);
  console.log('Updates Count:', updatesRes.data?.length, 'Error:', updatesRes.error);
  console.log('Watches Count:', watchesRes.data?.length, 'Error:', watchesRes.error);
  console.log('Listings Count:', listingsRes.data?.length, 'Error:', listingsRes.error);

  const posts = postsRes.data || [];
  const updates = updatesRes.data || [];
  const watches = watchesRes.data || [];
  const listings = listingsRes.data || [];

  // Simulate profilesMap
  const profilesMap = {};
  profiles.forEach(p => {
    profilesMap[p.id] = p;
  });

  const processedUpdates = updates.map((u) => ({
    ...u,
    profiles: profilesMap[u.user_id] || null,
    activity_type: 'update'
  }));

  const processedPosts = posts.map((p) => {
    let finalMovie = p.movies;
    let finalShow = p.shows;
    if (p.collection_items) {
      if (p.collection_items.movies) {
        finalMovie = p.collection_items.movies;
      }
      if (p.collection_items.shows) {
        finalShow = p.collection_items.shows;
      }
    }
    return {
      ...p,
      movies: finalMovie,
      shows: finalShow,
      activity_type: 'post'
    };
  });

  const processedWatches = watches.map((w) => ({
    ...w,
    profiles: profilesMap[w.user_id] || null,
    activity_type: 'watch',
    created_at: w.last_watched_at
  }));

  const processedListings = listings.map((l) => ({
    ...l,
    profiles: profilesMap[l.user_id] || null,
    activity_type: 'listing',
    created_at: l.updated_at
  }));

  const communityFeed = [
    ...processedPosts,
    ...processedUpdates,
    ...processedWatches,
    ...processedListings
  ].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Grouping logic
  const sorted = [...communityFeed].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const grouped = [];
  for (let item of sorted) {
    if (item.activity_type === 'post' || item.activity_type === 'comment') {
      grouped.push(item);
    } else {
      const itemDate = new Date(item.created_at).toDateString();
      const lastGroup = grouped[grouped.length - 1];
      if (lastGroup && lastGroup.type === 'story_group' && lastGroup.user_id === item.user_id && lastGroup.date === itemDate) {
         lastGroup.items.push(item);
      } else {
         grouped.push({
            type: 'story_group',
            id: `group-${item.id}`,
            user_id: item.user_id,
            profiles: item.profiles,
            date: itemDate,
            items: [item]
         });
      }
    }
  }

  console.log('Grouped Count:', grouped.length);
  const storyGroup = grouped.find(g => g.type === 'story_group');
  if (storyGroup) {
    console.log('Story Group ID:', storyGroup.id);
    console.log('Story Group Username:', storyGroup.profiles?.username);
    console.log('Story Group items length:', storyGroup.items.length);
    console.log('First sub item format:', storyGroup.items[0].format);
    console.log('First sub item movies:', JSON.stringify(storyGroup.items[0].movies));
    console.log('First sub item shows:', JSON.stringify(storyGroup.items[0].shows));
  } else {
    console.log('No story groups found');
  }
}

run();
