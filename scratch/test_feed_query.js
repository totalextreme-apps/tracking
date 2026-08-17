const anonKey = "sb_publishable_1HsqHfQV_ewZf4MdYQCTEQ_4VRvWGZV";

async function run() {
  const url = "https://dbhjqpfoqrdrtibqglra.supabase.co/rest/v1/bulletin_posts?id=eq.421dacd5-79d3-4bea-89e4-8015a526e71f&select=*,profiles(*),movies(*),shows(*),collection_items(*,movies(*),shows(*))";
  const res = await fetch(url, {
    headers: {
      "apikey": anonKey,
      "Authorization": `Bearer ${anonKey}`
    }
  });
  const data = await res.json();
  console.log("TEST FEED QUERY RESULT:");
  console.log(JSON.stringify(data, null, 2));
}

run();
