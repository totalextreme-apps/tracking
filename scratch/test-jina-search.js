const fetch = require('node-fetch');

async function testJinaBing(title, format) {
  console.log(`\n--- Testing Jina + Bing for "${title}" (${format}) ---`);
  const query = `site:ebay.com sold "${title}" ${format}`;
  const targetUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  const jinaUrl = `https://r.jina.ai/${targetUrl}`;

  try {
    const res = await fetch(jinaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    console.log('Jina Status:', res.status);
    const text = await res.text();
    console.log('Text len:', text.length);
    console.log('Preview:', text.slice(0, 600));

    // Look for prices in Bing search snippets
    const prices = [];
    const dollarRegex = /\$([0-9]+\.[0-9]{2})/g;
    let m;
    while ((m = dollarRegex.exec(text)) !== null) {
      const p = parseFloat(m[1]);
      if (p > 0.50 && p < 2500 && p !== 5.39) prices.push(p);
    }
    console.log('Dollar matches:', Array.from(new Set(prices)).slice(0, 10));
  } catch (e) {
    console.error('Jina Error:', e);
  }
}

async function main() {
  await testJinaBing('The Crow', 'VHS');
  await testJinaBing('Pulp Fiction', 'VHS');
}

main();
