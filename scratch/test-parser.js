const fs = require('fs');

function parseEbayPrices(html) {
    const prices = [];
    const priceRegex = /class="[^"]*(s-item__price|s-card__price)[^"]*">([\s\S]*?)<\/span>/g;
    let match;

    while ((match = priceRegex.exec(html)) !== null) {
        let priceText = match[2].replace(/<[^>]*>/g, '').trim();
        if (priceText.includes('to')) {
            priceText = priceText.split('to')[0].trim();
        }
        const cleanPrice = parseFloat(priceText.replace(/[^0-9.]/g, ''));
        if (!isNaN(cleanPrice) && cleanPrice > 0) {
            prices.push(cleanPrice);
        }
    }

    return prices;
}

function calculateMedianPrice(prices) {
    const validPrices = prices.filter(p => p >= 1.00 && p <= 200.00);
    if (validPrices.length === 0) return null;

    const sorted = [...validPrices].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 !== 0) {
        return sorted[mid];
    } else {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
}

function testParser() {
  const logPath = '/Users/mac1/.gemini/antigravity/brain/c4dcf298-e914-4ff1-96a0-41cc6f41c4d2/.system_generated/tasks/task-3240.log';
  const logContent = fs.readFileSync(logPath, 'utf8');
  
  const lines = logContent.split('\n');
  const responseLine = lines.find(l => l.startsWith('Response body:'));
  if (!responseLine) {
    console.error('Could not find Response body line');
    return;
  }
  
  const jsonStr = responseLine.replace('Response body: ', '').trim();
  const data = JSON.parse(jsonStr);
  const html = data.data.html;
  
  console.log('HTML Length:', html.length);
  
  const prices = parseEbayPrices(html);
  console.log('Parsed Prices:', prices);
  console.log('Median price:', calculateMedianPrice(prices));
}

testParser();
