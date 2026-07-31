fetch('http://localhost:8081/api/market-value?s=Transformers%20Blu-ray').then(async res => {
    console.log(res.status);
    console.log(await res.text());
}).catch(console.error);
