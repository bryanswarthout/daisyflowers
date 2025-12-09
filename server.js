require('dotenv').config();
const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from client/dist in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/dist')));
}

const JANE_API_URL = 'https://api.iheartjane.com/partner/v1/stores/1636/menu_products';
const JANE_TOKEN = process.env.JANE_TOKEN || '7fhFHHYnEYX7ZTu4tXBdkRFS';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Cache for products (refresh every hour)
let productsCache = null;
let lastFetchTime = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Track conversation and shown products
const conversationMemory = new Map(); // sessionId -> { shownProducts: Set, lastCategory: string }
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Function to get menu products from a single page
function getMenuProductsPage(paginationId) {
  return new Promise((resolve, reject) => {
    const pageUrl = `${JANE_API_URL}?visible=true&count=100&pagination_id=${paginationId}`;
    
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${JANE_TOKEN}`
      }
    };

    https.get(pageUrl, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } else {
            reject(new Error(`API returned status ${res.statusCode}`));
          }
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

// Function to get ALL menu products
async function getAllProducts() {
  // Check cache
  if (productsCache && lastFetchTime && (Date.now() - lastFetchTime < CACHE_DURATION)) {
    console.log('Returning cached products');
    return productsCache;
  }

  console.log('Fetching fresh products from API...');
  let allProducts = [];
  let paginationId = 0;
  let hasMorePages = true;

  while (hasMorePages && paginationId < 100) {
    try {
      const pageData = await getMenuProductsPage(paginationId);
      const products = pageData.products || pageData.menu_products || [];
      
      if (products.length > 0) {
        allProducts = allProducts.concat(products);
        paginationId++;
      } else {
        hasMorePages = false;
      }
    } catch (err) {
      console.error(`Error fetching page ${paginationId}:`, err.message);
      hasMorePages = false;
    }
  }

  productsCache = allProducts;
  lastFetchTime = Date.now();
  console.log(`Loaded ${allProducts.length} products`);
  
  // Save all products to JSON file
  try {
    fs.writeFileSync('products.json', JSON.stringify(allProducts, null, 2));
    console.log('✅ Products saved to products.json');
  } catch (err) {
    console.error('Error saving products to file:', err.message);
  }
  
  return allProducts;
}

// Session management
function getSessionId(req) {
  // Simple session ID based on IP and user agent (for demo purposes)
  return req.ip + '|' + (req.headers['user-agent'] || '').substring(0, 50);
}

function getSessionMemory(sessionId) {
  if (!conversationMemory.has(sessionId)) {
    conversationMemory.set(sessionId, {
      shownProducts: new Set(),
      lastCategory: null,
      timestamp: Date.now()
    });
  }
  return conversationMemory.get(sessionId);
}

function cleanOldSessions() {
  const now = Date.now();
  for (const [sessionId, memory] of conversationMemory.entries()) {
    if (now - memory.timestamp > SESSION_TIMEOUT) {
      conversationMemory.delete(sessionId);
    }
  }
}

// Function to analyze with AI
async function analyzeWithAI(products, userQuery, sessionId = null) {
  // Filter by approved brands
  const approvedBrands = ['hijinks', 'lab', 'nira+', 'nira', 'flower foundry', 'seche', 'tasteology'];
  let filteredProducts = products.filter(p => {
    const brand = (p.brand || '').toLowerCase().trim();
    return approvedBrands.some(approved => brand.includes(approved));
  });

  // Filter by category
  const queryLower = userQuery.toLowerCase();
  let categoryFilter = null;
  
  if (queryLower.match(/\b(flower|flowers|bud|buds|strain|strains)\b/)) {
    categoryFilter = 'flower';
    filteredProducts = filteredProducts.filter(p => {
      const kind = (p.kind || '').toLowerCase();
      return kind === 'flower';
    });
  } else if (queryLower.match(/\b(edible|edibles|gummy|gummies|chew|chews|troche|troches|ingestible|ingestibles)\b/)) {
    categoryFilter = 'edible';
    filteredProducts = filteredProducts.filter(p => {
      const kind = (p.kind || '').toLowerCase();
      return kind === 'edible';
    });
  } else if (queryLower.match(/\b(vape|vapes|cartridge|cartridges|cart|carts|pen|pens|vape pen)\b/)) {
    categoryFilter = 'vape';
    filteredProducts = filteredProducts.filter(p => {
      const kind = (p.kind || '').toLowerCase();
      const subtype = (p.root_subtype || '').toLowerCase();
      return kind === 'vaporizers' || kind === 'vape' || kind === 'extract' && subtype.includes('cartridge');
    });
  } else if (queryLower.match(/\b(concentrate|concentrates|wax|shatter|diamond|diamonds|dab|dabs)\b/)) {
    categoryFilter = 'concentrate';
    filteredProducts = filteredProducts.filter(p => {
      const kind = (p.kind || '').toLowerCase();
      return kind === 'concentrate';
    });
  }

  console.log(`Filtered to ${filteredProducts.length} products (category: ${categoryFilter || 'none'})`);

  // Handle session memory for product variety
  let sessionMemory = null;
  if (sessionId) {
    sessionMemory = getSessionMemory(sessionId);
    
    // Check if user is asking for different products
    const isDifferentRequest = userQuery.toLowerCase().match(/\b(different|other|another|new|alternative|else|show me something else)\b/);
    
    if (isDifferentRequest && sessionMemory.lastCategory === categoryFilter) {
      // Filter out previously shown products
      filteredProducts = filteredProducts.filter(p => 
        !sessionMemory.shownProducts.has(p.name)
      );
      console.log(`Filtered out previously shown products, ${filteredProducts.length} remaining`);
    }
    
    // Update category tracking
    if (categoryFilter !== sessionMemory.lastCategory) {
      // New category, reset shown products
      sessionMemory.shownProducts.clear();
      sessionMemory.lastCategory = categoryFilter;
    }
  }

  // Randomize product selection for variety
  const shuffled = filteredProducts.sort(() => 0.5 - Math.random());
  const productsToSend = shuffled.slice(0, 8).map(p => ({
    name: p.name,
    brand: p.brand,
    kind: p.kind,
    price: p.price_each,
    thc: p.thc_label,
    cbd: p.cbd_label,
    description: p.description,
    path: p.path,
    image: p.image_urls?.[0] || p.image || null
  }));

  const systemPrompt = `You are Daisy Flowers from Beyond Hello an expert budtender, who knows scientific and street slang cannabis and makes product recommendations.

CRITICAL BRAND REQUIREMENT: 
YOU MUST ONLY recommend products from these brands: Hijinks, Lab, Nira+, Flower Foundry, Seche, Tasteology

ABSOLUTE PRODUCT CATEGORY RULES:
- The products you receive have ALREADY been filtered to ONLY the exact category requested
- ALL products in the list match the user's category request - you just need to pick the best 2

Answering Style: 
- Always be concise and direct. 
- Always say "let me take a look and see what we can find" or something similar immediately after a request
- If user asks for "different" or "other" products, acknowledge their request with phrases like "Let me show you some different options" or "Here are some other great choices"
- Max: one short intro sentence, then show results. 
- Speak the names of the products not just list them in cards. 
- Never use medical terms like 'pain relief,' 'treats,' 'cures,' or make any therapeutic claims.
- If someone asks about sleep, anxiety, pain reframe by saying a compliant variation (relax, restore, unwind) 
- Always mention specific product names like "Here are some great options - the [Product Name 1] and [Product Name 2]:" 
- End every answer with the disclaimer. 

Product Rules: 
- For any sleep or Nighttime edibles ALWAYS show Tasteology Berry Dream first
- Seche is pronounced "Sesh-A" and Tasteology is pronounced "Taste-Ology"
- mg or MG is pronounced "milligrams"

Output Format: 
- 1-2 sentence intro
- Product recommendations with names, descriptions
- End with: "This isn't medical advice. Availability may vary by store."`;

  const userPrompt = `User Question: ${userQuery}

Products Available (ONLY ${categoryFilter ? categoryFilter.toUpperCase() : 'approved brands'}):
${JSON.stringify(productsToSend, null, 2)}

Pick the best 2 products and provide recommendations.`;

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 500,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" }
        }
      ],
      messages: [{ role: 'user', content: userPrompt }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
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
            const selectedProducts = productsToSend.slice(0, 2);
            
            // Track shown products in session
            if (sessionMemory) {
              selectedProducts.forEach(p => {
                sessionMemory.shownProducts.add(p.name);
              });
              sessionMemory.timestamp = Date.now();
            }
            
            resolve({
              text: response.content[0].text,
              products: selectedProducts
            });
          } else {
            console.error('Anthropic API response:', JSON.stringify(response, null, 2));
            reject(new Error(`Invalid AI response: ${JSON.stringify(response)}`));
          }
        } catch (err) {
          console.error('Failed to parse AI response:', data);
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// API Endpoints
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    products: productsCache ? productsCache.length : 0,
    environment: process.env.NODE_ENV || 'development',
    version: require('./package.json').version
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`User query: ${message}`);

    // Get products
    const products = await getAllProducts();

    // Clean old sessions periodically
    cleanOldSessions();
    
    // Get session ID
    const sessionId = getSessionId(req);
    
    // Get AI response with product data
    const result = await analyzeWithAI(products, message, sessionId);

    res.json({ 
      response: result.text, 
      products: result.products 
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve React app for all non-API routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/dist/index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`🌼 Daisy Flowers API Server running on http://localhost:${PORT}`);
  console.log('Preloading products...');
  getAllProducts().then(() => {
    console.log('✅ Products preloaded');
  });
});
