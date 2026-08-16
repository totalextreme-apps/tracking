const anonKey = "sb_publishable_1HsqHfQV_ewZf4MdYQCTEQ_4VRvWGZV";

async function run() {
  const postsUrl = "https://dbhjqpfoqrdrtibqglra.supabase.co/rest/v1/bulletin_posts?select=id,collection_item_id,movie_id,show_id,user_id,profiles(username)";
  const res = await fetch(postsUrl, {
    headers: {
      "apikey": anonKey,
      "Authorization": `Bearer ${anonKey}`
    }
  });
  const posts = await res.json();
  console.log(`Found ${posts.length} posts. Checking for mismatches...`);

  for (const post of posts) {
    if (post.collection_item_id) {
      const colUrl = `https://dbhjqpfoqrdrtibqglra.supabase.co/rest/v1/collection_items?id=eq.${post.collection_item_id}&select=movie_id,show_id`;
      const resCol = await fetch(colUrl, {
        headers: {
          "apikey": anonKey,
          "Authorization": `Bearer ${anonKey}`
        }
      });
      const colItems = await resCol.json();
      if (colItems && colItems.length > 0) {
        const colItem = colItems[0];
        const isMovieMismatch = colItem.movie_id && post.movie_id !== colItem.movie_id;
        const isShowMismatch = colItem.show_id && post.show_id !== colItem.show_id;
        if (isMovieMismatch || isShowMismatch) {
          console.log(`Mismatch on post ${post.id} by ${post.profiles?.username || post.user_id}:`);
          console.log(`Post movie: ${post.movie_id}, ColItem movie: ${colItem.movie_id}`);
        }
      }
    }
  }
}

run();
