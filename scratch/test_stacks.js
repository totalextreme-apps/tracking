const anonKey = "sb_publishable_1HsqHfQV_ewZf4MdYQCTEQ_4VRvWGZV";

async function run() {
  const url = "https://dbhjqpfoqrdrtibqglra.supabase.co/rest/v1/collection_items?user_id=eq.f2c57c49-02a4-4b82-8f91-f3e5e0039db2&select=*,shows(*)";
  const res = await fetch(url, {
    headers: {
      "apikey": anonKey,
      "Authorization": `Bearer ${anonKey}`
    }
  });
  const data = await res.json();
  const tbbt = data.filter(i => i.shows && i.shows.name.includes("Big Bang"));
  console.log("TBBT ITEMS COUNT:", tbbt.length);
  if (tbbt.length > 0) {
    console.log("FIRST TBBT ITEM:");
    console.log(JSON.stringify(tbbt[0], null, 2));
  }
}

run();
