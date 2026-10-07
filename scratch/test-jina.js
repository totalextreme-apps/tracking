const fetch = require('node-fetch');

async function testJinaReader() {
  console.log('--- Testing Jina AI Reader for eBay Sold items ---');
  const title = 'The Crow';
  const format = 'VHS';
  const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(title + ' ' + format)}&LH_Complete=1&LH_Sold=1`;
  const jinaUrl = `https://r.jina.ai/${ebayUrl}`;

  try {
    const res = await fetch(jinaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    console.log('Jina Status:', res.status);
    const text = await res.text();
    console.log('Jina Text length:', text.length);
    console.log('Sample text:', text.slice(0, 1000));

    // Look for prices in markdown
    const dollarMatches = text.match(/\$([0-9]+\.[0-9]{2})/g);
    console.log('\nFound dollar amounts:', dollarMatches ? dollarMatches.slice(0, 20) : []);
  } catch (e) {
    console.error('Jina Error:', e);
  }
}

testJinaReader();
