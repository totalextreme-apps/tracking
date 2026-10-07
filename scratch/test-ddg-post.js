const fetch = require('node-fetch');

async function testDDGPost(queryStr) {
  console.log(`\n--- Testing DDG POST query: "${queryStr}" ---`);
  try {
    const res = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Origin': 'https://html.duckduckgo.com',
        'Referer': 'https://html.duckduckgo.com/'
      },
      body: `q=${encodeURIComponent(queryStr)}`
    });

    console.log('Status:', res.status);
    const html = await res.text();
    console.log('HTML len:', html.length);

    // Parse prices
    const dollarMatches = html.match(/\$([0-9]+\.[0-9]{2})/g);
    console.log('Dollar matches found:', dollarMatches ? dollarMatches.slice(0, 15) : []);

    // Look for search result text
    const snippets = [];
    const regex = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = regex.exec(html)) !== null) {
      snippets.push(m[1].replace(/<[^>]*>/g, '').trim());
    }
    console.log('Found snippets:', snippets.length);
    if (snippets.length) console.log('Sample snippet:', snippets[0]);
  } catch (e) {
    console.error('Error:', e);
  }
}

async function main() {
  await testDDGPost('site:ebay.com "The Crow" VHS sold');
  await testDDGPost('ebay "Pulp Fiction" VHS sold price');
}

main();
