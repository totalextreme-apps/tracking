const anonKey = "sb_publishable_1HsqHfQV_ewZf4MdYQCTEQ_4VRvWGZV";

async function run() {
  const url = "https://dbhjqpfoqrdrtibqglra.supabase.co/rest/v1/collection_items?media_type=eq.tv&limit=5";
  const res = await fetch(url, {
    headers: {
      "apikey": anonKey,
      "Authorization": `Bearer ${anonKey}`
    }
  });
  const data = await res.json();
  console.log("TV ITEMS:");
  console.log(JSON.stringify(data, null, 2));
}

run();
