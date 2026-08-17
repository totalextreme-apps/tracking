const anonKey = "sb_publishable_1HsqHfQV_ewZf4MdYQCTEQ_4VRvWGZV";

async function run() {
  const url = "https://dbhjqpfoqrdrtibqglra.supabase.co/rest/v1/collection_items?id=eq.515f5b19-78fb-458f-a94b-bf89fa4666c7&select=*,shows(*)";
  const res = await fetch(url, {
    headers: {
      "apikey": anonKey,
      "Authorization": `Bearer ${anonKey}`
    }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

run();
