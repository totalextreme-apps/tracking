const fetch = require('node-fetch');
const fs = require('fs');

async function inspectDDGHtml() {
  const query = 'site:ebay.com/itm "The Crow" VHS';
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  fs.writeFileSync('./scratch/ddg_sample.html', html);
  console.log('Saved DDG HTML. Length:', html.length);
}
inspectDDGHtml();
