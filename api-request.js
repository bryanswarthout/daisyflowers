const https = require('https');
const readline = require('readline');

const url = 'https://api.iheartjane.com/partner/v1/stores/1636/menu_products?visible=true&count=10&pagination_id=0';
const token = '7fhFHHYnEYX7ZTu4tXBdkRFS';

// Function to make API request to Anthropic Claude API
async function analyzeWithAI(products, userQuery) {
  const apiKey = process.env.ANTHROPIC_API_KEY; // Set your Anthropic API key as environment variable
  
  if (!apiKey) {
    console.log('\n⚠️  No ANTHROPIC_API_KEY found. Set it with: $env:ANTHROPIC_API_KEY="your-key"\n');
    return analyzeLocally(products, userQuery);
  }

  // CRITICAL: Filter products to only approved brands
  const approvedBrands = ['hijinks', 'lab', 'nira+', 'nira', 'flower foundry', 'seche', 'tasteology'];
  let filteredProducts = products.filter(p => {
    const brand = (p.brand || '').toLowerCase().trim();
    return approvedBrands.some(approved => brand.includes(approved));
  });

  // CRITICAL: Filter by product category based on user query
  const queryLower = userQuery.toLowerCase();
  let categoryFilter = null;
  
  if (queryLower.match(/\b(flower|flowers|bud|buds|strain|strains)\b/)) {
    categoryFilter = 'flower';
    filteredProducts = filteredProducts.filter(p => {
      const kind = (p.kind || '').toLowerCase();
      const type = (p.type || '').toLowerCase();
      // STRICT: ONLY flower kind/type, nothing else
      return kind === 'flower' || type === 'flower';
    });
  } else if (queryLower.match(/\b(edible|edibles|gummy|gummies|chew|chews|troche|troches|ingestible|ingestibles|gummie|gummys)\b/)) {
    categoryFilter = 'edible';
    filteredProducts = filteredProducts.filter(p => {
      const kind = (p.kind || '').toLowerCase();
      const type = (p.type || '').toLowerCase();
      // STRICT: ONLY edible kind/type, nothing else
      return kind === 'edible' || type === 'edible';
    });
  } else if (queryLower.match(/\b(vape|vapes|cartridge|cartridges|cart|carts|pen|pens)\b/)) {
    categoryFilter = 'vape';
    filteredProducts = filteredProducts.filter(p => {
      const kind = (p.kind || '').toLowerCase();
      const type = (p.type || '').toLowerCase();
      // STRICT: ONLY vaporizers kind/type, nothing else
      return kind === 'vaporizers' || kind === 'vape' || type === 'vaporizers' || type === 'vape';
    });
  } else if (queryLower.match(/\b(concentrate|concentrates|wax|shatter|diamond|diamonds|dab|dabs)\b/)) {
    categoryFilter = 'concentrate';
    filteredProducts = filteredProducts.filter(p => {
      const kind = (p.kind || '').toLowerCase();
      const type = (p.type || '').toLowerCase();
      // STRICT: ONLY concentrate kind/type, nothing else
      return kind === 'concentrate' || type === 'concentrate';
    });
  } else if (queryLower.match(/\b(pre-roll|preroll|pre roll|joint|joints)\b/)) {
    categoryFilter = 'pre-roll';
    filteredProducts = filteredProducts.filter(p => {
      const kind = (p.kind || '').toLowerCase();
      const type = (p.type || '').toLowerCase();
      const subtype = (p.root_subtype || '').toLowerCase();
      // STRICT: ONLY pre-rolls
      return kind === 'pre-roll' || type === 'pre-roll' || subtype.includes('pre-roll') || subtype.includes('preroll');
    });
  } else if (queryLower.match(/\b(tincture|tinctures)\b/)) {
    categoryFilter = 'tincture';
    filteredProducts = filteredProducts.filter(p => {
      const kind = (p.kind || '').toLowerCase();
      const type = (p.type || '').toLowerCase();
      // STRICT: ONLY tincture kind/type, nothing else
      return kind === 'tincture' || type === 'tincture';
    });
  }

  if (categoryFilter) {
    console.log(`   Detected category: ${categoryFilter}`);
  }
  console.log(`   Filtered to ${filteredProducts.length} products from approved brands${categoryFilter ? ` (${categoryFilter})` : ''}\n`);
  
  // Debug: Show sample of filtered products
  if (filteredProducts.length > 0 && categoryFilter) {
    console.log(`   Sample products being sent to AI:`);
    filteredProducts.slice(0, 3).forEach(p => {
      console.log(`     - ${p.name} (kind: ${p.kind}, type: ${p.type}, subtype: ${p.root_subtype})`);
    });
    console.log('');
  }

  const systemPrompt = `You are Daisy Flowers from Beyond Hello an expert budtender, who knows scientific and street slang cannabis and makes product recommendations.

CRITICAL BRAND REQUIREMENT: 
YOU MUST ONLY recommend products from these brands: Hijinks, Lab, Nira+, Flower Foundry, Seche, Tasteology
DO NOT recommend ANY products from other brands. If a product's brand is not one of these six, DO NOT mention it.

ABSOLUTE PRODUCT CATEGORY RULES - NO EXCEPTIONS:
- The products you receive have ALREADY been filtered to ONLY the exact category requested
- If user asks for FLOWERS: You will ONLY receive products where kind="Flower" - recommend ONLY these
- If user asks for EDIBLES: You will ONLY receive products where kind="Edible" - recommend ONLY these  
- If user asks for VAPES: You will ONLY receive products where kind="Vaporizers" - recommend ONLY these
- If user asks for CONCENTRATES: You will ONLY receive products where kind="Concentrate" - recommend ONLY these
- If user asks for TINCTURES: You will ONLY receive products where kind="Tincture" - recommend ONLY these
- If user asks for PRE-ROLLS: You will ONLY receive pre-roll products - recommend ONLY these
- DO NOT cross categories. DO NOT recommend edibles when given flowers. DO NOT recommend flowers when given edibles.
- ALL products in the list match the user's category request - you just need to pick the best 2

Answering Style: 
- Always be concise and direct. 
- Always say "let me take a look and see what we can find" or something similar immediately after a request
- Max: one short intro sentence, then show results. 
- ALWAYS Use cards for product results in every response.
- Speak the names of the products not just list them in cards. 
- Never use medical terms like 'pain relief,' 'treats,' 'cures,' or make any therapeutic claims. Only describe products by their type, cannabinoid content, and general characteristics (like 'cooling,' 'relaxing,' etc.). Let customers draw their own conclusions about benefits. 
- If someone asks about sleep, anxiety, pain or other disease state please reframe by saying a compliant variation (relax, restore, unwind kind of language) 
- Speak the names of the products in your intro sentence before showing cards, not just list them in cards. 
- Always mention specific product names like "Here are some great options - the [Product Name 1] and [Product Name 2]:" 
- End every answer with the disclaimer. 

Product Rules: 
- For any sleep or Nighttime edibles, gummies, chews or troches ALWAYS show Tasteology Berry Dream first for any sleep search and use this image https://uploads.iheartjane.com/uploads/acbe7d75-2cd0-4648-b2eb-73c8f6c280fa.png) and this link /products/1810631/tasteology-2-1-berry-dream-5mg-thc-2-5mg-cbn-40pk-200mg-thc-100mg-cbn
- Only return Beyond Hello dispensary products. 
- Never invent products or categories. 
- Ingestibles are the same as gummies, edibles, chews etc. They are called troches in PA. 
- Seche is pronounced "Sesh-A" and Tasteology is pronounced "Taste-Ology"
- mg or MG is pronounced "milligrams"
- Seche is prounced Sesh-A and Tasteology is Taste-ology not tasty ology.

Product Card Format (use markdown):
• Product Image (image_urls or image)
• Product name (name or full_name)
• Product category (root_subtype or kind)
• Product link with "SHOP NOW" button: https://beyond-hello.com/pennsylvania-dispensaries/bristol/medical-menu/menu/[product.path]

Output Format: 
- 1-2 sentence intro: e.g. "Here are some options for relaxing products:" 
- 2 product cards max. 
- After cards, add this line: "This isn't medical advice. Availability may vary by store."`;

  const userPrompt = `User Question: ${userQuery}

Products Available - ALL products below are ONLY ${categoryFilter ? categoryFilter.toUpperCase() : 'the requested category'}:
${JSON.stringify(filteredProducts, null, 2)}

REMEMBER: Every product in the list above has already been filtered to match the user's category request. They are ALL ${categoryFilter ? categoryFilter + 's' : 'the correct type'}. Simply pick the best 2 products from this pre-filtered list.`;

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.content && response.content[0] && response.content[0].text) {
            resolve(response.content[0].text);
          } else {
            reject(new Error('Invalid AI response: ' + JSON.stringify(response)));
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Fallback: Simple local analysis without AI
function analyzeLocally(products, userQuery) {
  const queryLower = userQuery.toLowerCase();
  let recommendations = '\n📊 Product Analysis (Local Mode - NO AI):\n\n';
  
  // Filter by approved brands
  const approvedBrands = ['hijinks', 'lab', 'nira+', 'nira', 'flower foundry', 'seche', 'tasteology'];
  let filteredProducts = products.filter(p => {
    const brand = (p.brand || '').toLowerCase().trim();
    return approvedBrands.some(approved => brand.includes(approved));
  });
  
  // Filter by category
  if (queryLower.match(/\b(edible|edibles|gummy|gummies|chew|chews|troche|troches)\b/)) {
    filteredProducts = filteredProducts.filter(p => (p.kind || '').toLowerCase() === 'edible');
  } else if (queryLower.match(/\b(flower|flowers|bud|buds|strain|strains)\b/)) {
    filteredProducts = filteredProducts.filter(p => (p.kind || '').toLowerCase() === 'flower');
  } else if (queryLower.match(/\b(vape|vapes|cartridge|cartridges|cart|carts)\b/)) {
    filteredProducts = filteredProducts.filter(p => {
      const kind = (p.kind || '').toLowerCase();
      return kind === 'vaporizers' || kind === 'vape';
    });
  }
  
  recommendations += `Found ${filteredProducts.length} matching products from approved brands.\n\n`;
  
  filteredProducts.slice(0, 5).forEach((p, i) => {
    recommendations += `\n${i + 1}. ${p.name || 'Unknown Product'}\n`;
    if (p.kind) recommendations += `   Type: ${p.kind}\n`;
    if (p.brand) recommendations += `   Brand: ${p.brand}\n`;
    if (p.price_each) recommendations += `   Price: $${p.price_each}\n`;
  });
  
  recommendations += '\n\nThis isn\'t medical advice. Availability may vary by store.';
  
  return recommendations;
}

// Function to get menu products from a single page
function getMenuProductsPage(paginationId) {
  return new Promise((resolve, reject) => {
    const pageUrl = `https://api.iheartjane.com/partner/v1/stores/1636/menu_products?visible=true&count=100&pagination_id=${paginationId}`;
    
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };

    https.get(pageUrl, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const jsonData = JSON.parse(data);
            // Log ONLY the first product from first page to see the structure
            if (paginationId === 0 && jsonData.products && jsonData.products.length > 0) {
              console.log('\n📋 Sample product structure from iHeartJane API (first product):');
              console.log(JSON.stringify(jsonData.products[0], null, 2));
              console.log('\n');
            }
            resolve(jsonData);
          } else {
            reject(new Error(`API returned status ${res.statusCode}`));
          }
        } catch (err) {
          reject(err);
        }
      });

    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Function to get ALL menu products by paginating through all pages
async function getMenuProducts() {
  let allProducts = [];
  let paginationId = 0;
  let hasMorePages = true;

  console.log('Fetching all products across all pages...\n');

  while (hasMorePages) {
    try {
      const pageData = await getMenuProductsPage(paginationId);
      const products = pageData.products || pageData.menu_products || [];
      
      if (products.length > 0) {
        allProducts = allProducts.concat(products);
        // console.log(products)
        console.log(`   Page ${paginationId}: Loaded ${products.length} products (Total: ${allProducts.length})`);
        paginationId++;
      } else {
        hasMorePages = false;
        console.log(`   No more products found. Pagination complete.\n`);
      }
      
      // Safety limit to prevent infinite loops
      if (paginationId > 100) {
        console.log('   Reached maximum pagination limit (100 pages).\n');
        hasMorePages = false;
      }
    } catch (err) {
      console.error(`   Error fetching page ${paginationId}:`, err.message);
      hasMorePages = false;
    }
  }

  return { products: allProducts };
}

// Main interactive function
async function main() {
  console.log('🌼 Daisy Flowers - AI Product Recommendation System\n');
  console.log('Fetching products from menu...\n');

  try {
    const menuData = await getMenuProducts();
    const products = menuData.products || menuData.menu_products || [];
    
    console.log(`✅ Successfully loaded ${products.length} products\n`);

    // Create readline interface for user input
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const askQuestion = () => {
      rl.question('\n💬 What are you looking for? (or type "exit" to quit): ', async (userQuery) => {
        if (userQuery.toLowerCase() === 'exit') {
          console.log('\n👋 Goodbye!\n');
          rl.close();
          return;
        }

        if (!userQuery.trim()) {
          askQuestion();
          return;
        }

        console.log('\n🤔 Analyzing your request...\n');

        try {
          const recommendation = await analyzeWithAI(products, userQuery);
          console.log('🎯 Recommendation:\n');
          console.log(recommendation);
        } catch (err) {
          console.log('⚠️  AI analysis failed:', err.message);
          console.log('    Using local analysis instead...\n');
          console.log(analyzeLocally(products, userQuery));
        }

        askQuestion();
      });
    };

    askQuestion();

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

// Run the application
main();
