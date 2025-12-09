// Test script to demonstrate enhanced product randomization
const http = require('http');

const testChat = (message, testName) => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ message });

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log(`\n=== ${testName} ===`);
          console.log('Products recommended:');
          if (response.products) {
            response.products.forEach((p, i) => {
              console.log(`${i + 1}. ${p.name} (${p.brand})`);
            });
          }
          resolve(response);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
};

async function runRandomizationTest() {
  console.log('🎲 Testing Enhanced Product Randomization');
  console.log('==========================================');
  
  try {
    // Wait a bit for server to load products
    console.log('Waiting for products to load...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test same query multiple times to see randomization
    await testChat('I want some flower', 'Test 1 - Flower Request');
    await testChat('I want some flower', 'Test 2 - Same Flower Request');
    await testChat('I want some flower', 'Test 3 - Same Flower Request Again');
    
    // Test "different" request
    await testChat('show me different flower', 'Test 4 - Different Flower Request');
    await testChat('something else for flower', 'Test 5 - Another Different Request');
    
    console.log('\n✅ Randomization test complete!');
    console.log('You should see different products in each response.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runRandomizationTest();