const fetch = require('node-fetch');

async function testIphoneRss() {
  console.log('--- Testing eBay Mobile RSS with eBayiPhone User-Agent ---');
  const title = 'Pulp Fiction';
  const format = 'VHS';
  const query = `${title} ${format}`;
  const rssUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Complete=1&LH_Sold=1&_rss=1`;

  try {
    const res = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'eBayiPhone/6.115.0 Mobile/15E148',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    console.log('Status:', res.status);
    const xml = await res.text();
    console.log('XML Length:', xml.length);
    console.log('XML Sample:\n', xml.slice(0, 1500));

    // Extract item titles and prices from RSS XML
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const itemStr = match[1];
      const itemTitleMatch = itemStr.match(/<title>([\s\S]*?)<\/title>/i);
      const priceMatch = itemStr.match(/\$([0-9]+\.[0-9]{2})/);
      
      const itemTitle = itemTitleMatch ? itemTitleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
      const price = priceMatch ? parseFloat(priceMatch[1]) : null;
      if (price && price > 0.50 && price < 2500) {
        items.push({ title: itemTitle, price });
      }
    }

    console.log('\nExtracted RSS Items:', items.length);
    if (items.length) {
      console.log('Sample RSS items:', items.slice(0, 5));
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

testIphoneRss();
