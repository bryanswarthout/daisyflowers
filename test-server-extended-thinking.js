require('dotenv').config();
const http = require('http'); // Changed from https to http

// Test a complex query that should trigger extended thinking
const testComplexQuery = async () => {
  const complexQuery = "I need something that helps me focus during creative work sessions but won't make me anxious or crash later. I'm moderately experienced and prefer something I can use during the day.";
  
  const postData = JSON.stringify({
    message: complexQuery
  });

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

  return new Promise((resolve, reject) => {
    console.log('Testing Extended Thinking with Complex Query:');
    console.log(`Query: ${complexQuery}\n`);

    const req = http.request(options, (res) => { // Changed from https to http
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('=== EXTENDED THINKING RESPONSE ===');
          console.log('Status:', res.statusCode);
          console.log('Response:', response.response);
          console.log('\nProducts recommended:', response.products?.length || 0);
          if (response.products) {
            response.products.forEach((p, i) => {
              console.log(`${i + 1}. ${p.name} by ${p.brand} (${p.kind})`);
            });
          }
          console.log('=== END RESPONSE ===\n');
          resolve(response);
        } catch (e) {
          console.error('Failed to parse response:', data);
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
};

// Test a simple query for comparison
const testSimpleQuery = async () => {
  const simpleQuery = "I want something for sleep";
  
  const postData = JSON.stringify({
    message: simpleQuery
  });

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

  return new Promise((resolve, reject) => {
    console.log('Testing Extended Thinking with Simple Query:');
    console.log(`Query: ${simpleQuery}\n`);

    const req = http.request(options, (res) => { // Changed from https to http
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('=== SIMPLE QUERY RESPONSE ===');
          console.log('Status:', res.statusCode);
          console.log('Response:', response.response);
          console.log('\nProducts recommended:', response.products?.length || 0);
          if (response.products) {
            response.products.forEach((p, i) => {
              console.log(`${i + 1}. ${p.name} by ${p.brand} (${p.kind})`);
            });
          }
          console.log('=== END RESPONSE ===\n');
          resolve(response);
        } catch (e) {
          console.error('Failed to parse response:', data);
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
};

// Run tests
(async () => {
  try {
    console.log('🧠 TESTING EXTENDED THINKING FOR COMPLEX ANALYSIS\n');
    
    await testComplexQuery();
    
    console.log('='.repeat(60));
    
    await testSimpleQuery();
    
    console.log('='.repeat(60));
    console.log('✅ Extended thinking tests completed!');
    console.log('Key features implemented:');
    console.log('- Structured <thinking> analysis process');
    console.log('- Query complexity scoring (0-6 scale)');  
    console.log('- Enhanced terpene profile extraction');
    console.log('- Multi-dimensional product analysis');
    console.log('- Context-aware reasoning');
    console.log('- Increased token limit for detailed responses');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
})();