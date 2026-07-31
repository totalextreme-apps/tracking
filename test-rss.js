const title = 'Transformers';
const format = 'Blu-ray';
const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(title + ' ' + format)}&LH_Complete=1&LH_Sold=1&_rss=1`;
fetch(url).then(async res => {
    console.log("Status:", res.status);
    const text = await res.text();
    console.log(text.slice(0, 1000));
    // Check if price is anywhere in it
    console.log("Prices in text:", text.match(/\$[0-9]+\.[0-9]{2}/g)?.slice(0, 5));
}).catch(console.error);
