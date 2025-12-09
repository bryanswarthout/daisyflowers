const https = require('https');

async function getAllProducts() {
  let allProducts = [];
  for (let page = 0; page < 10; page++) {
    const url = `https://api.iheartjane.com/partner/v1/stores/1636/menu_products?visible=true&count=100&pagination_id=${page}`;
    const token = '7fhFHHYnEYX7ZTu4tXBdkRFS';
    
    await new Promise((resolve, reject) => {
      const options = {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      };

      https.get(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          const jsonData = JSON.parse(data);
          const products = jsonData.products || jsonData.menu_products || [];
          allProducts = allProducts.concat(products);
          console.log(`Page ${page}: ${products.length} products`);
          resolve();
        });
      }).on('error', reject);
    });
  }
  return allProducts;
}

getAllProducts().then(products => {
  console.log(`\n=== TOTAL: ${products.length} products ===\n`);
  
  const approvedBrands = ['hijinks', 'lab', 'nira+', 'nira', 'flower foundry', 'seche', 'tasteology'];
  
  const edibles = products.filter(p => p.kind && p.kind.toLowerCase() === 'edible');
  console.log(`Total edibles: ${edibles.length}\n`);
  
  const approvedEdibles = edibles.filter(p => {
    const brand = (p.brand || '').toLowerCase().trim();
    return approvedBrands.some(approved => brand.includes(approved));
  });
  
  console.log(`Approved brand edibles: ${approvedEdibles.length}\n`);
  approvedEdibles.forEach((p, i) => {
    console.log(`${i+1}. ${p.name} - ${p.brand}`);
  });
});
