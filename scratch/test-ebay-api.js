const fetch = require('node-fetch');

async function testEbayFindingApi() {
  console.log('--- Testing eBay Finding API findCompletedItems ---');
  const title = 'The Crow';
  const format = 'VHS';
  
  // eBay Finding API XML call
  const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<findCompletedItemsRequest xmlns="http://www.svcs.ebay.com/Services">
  <keywords>${title} ${format}</keywords>
  <itemFilter>
    <name>SoldItemsOnly</name>
    <value>true</value>
  </itemFilter>
  <paginationInput>
    <entriesPerPage>10</entriesPerPage>
  </paginationInput>
</findCompletedItemsRequest>`;

  try {
    const res = await fetch('https://svcs.ebay.com/services/search/FindingService/v1', {
      method: 'POST',
      headers: {
        'X-EBAY-SOA-OPERATION-NAME': 'findCompletedItems',
        'X-EBAY-SOA-SERVICE-VERSION': '1.0.0',
        'X-EBAY-SOA-REQUEST-DATA-FORMAT': 'XML',
        'X-EBAY-SOA-SECURITY-APPNAME': 'EBAY-PUBLIC-CLIENT', // test public app name or query
        'Content-Type': 'text/xml'
      },
      body: xmlBody
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text.slice(0, 800));
  } catch (e) {
    console.error('Error:', e);
  }
}

testEbayFindingApi();
