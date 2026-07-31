async function testFirecrawl() {
  const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent('Pulp Fiction VHS')}&LH_Complete=1&LH_Sold=1`;
  console.log('Querying Firecrawl...');
  try {
    const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: ebayUrl,
        formats: ['html'],
        blockAds: true,
        removeBase64Images: true
      })
    });
    console.log('Status:', res.status);
    const data = await res.text();
    console.log('Response body:', data);
  } catch (err) {
    console.error('Error:', err);
  }
}
testFirecrawl();
