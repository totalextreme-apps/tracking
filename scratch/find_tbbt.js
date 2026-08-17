const anonKey = "sb_publishable_1HsqHfQV_ewZf4MdYQCTEQ_4VRvWGZV";

async function run() {
  const url = "https://dbhjqpfoqrdrtibqglra.supabase.co/rest/v1/collection_items?movie_id=is.null&select=*,shows(*)";
  const res = await fetch(url, {
    headers: {
      "apikey": anonKey,
      "Authorization": `Bearer ${anonKey}`
    }
  });
  const data = await res.json();
  console.log("TOTAL TV COLLECTION ITEMS:", data.length);
  for (const item of data) {
    console.log(`- Item ID: ${item.id}, Show ID: ${item.show_id}, Season: ${item.season_number}, User: ${item.user_id}, Show Name: ${item.shows?.name}`);
  }
}

run();
