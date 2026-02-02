require('dotenv').config();
const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Add process error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit, just log the error
});

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from client/dist in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/dist')));
}

const JANE_API_URL = 'https://api.iheartjane.com/partner/v1/stores/1635/menu_products';
const JANE_TOKEN = process.env.JANE_TOKEN || '7fhFHHYnEYX7ZTu4tXBdkRFS';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Cache for products (refresh every hour)
let productsCache = null;
let lastFetchTime = null;
let loadingPromise = null; // Store the loading promise to prevent concurrent API calls
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Track conversation and shown products
const conversationMemory = new Map(); // sessionId -> { shownProducts: Set, lastCategory: string }
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Function to get all menu products in one call
function getAllMenuProducts() {
  return new Promise((resolve, reject) => {
    const apiUrl = `${JANE_API_URL}?visible=true&count=1500`;
    
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${JANE_TOKEN}`,
        'User-Agent': 'Beyond-Hello-Server/1.0'
      },
      timeout: 30000 // 30 second timeout
    };

    console.log(`Making API request to: ${apiUrl}`);
    
    const req = https.get(apiUrl, options, (res) => {
      let data = '';
      
      console.log(`API Response Status: ${res.statusCode}`);
      
      res.on('data', (chunk) => { 
        data += chunk; 
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const jsonData = JSON.parse(data);
            console.log(`API Response: Found ${jsonData.products?.length || 0} products`);
            resolve(jsonData);
          } else {
            console.error(`API Error: Status ${res.statusCode}, Body: ${data.substring(0, 500)}`);
            reject(new Error(`API returned status ${res.statusCode}: ${data.substring(0, 200)}`));
          }
        } catch (err) {
          console.error('JSON Parse Error:', err.message);
          console.error('Response data:', data.substring(0, 500));
          reject(new Error(`Failed to parse API response: ${err.message}`));
        }
      });
      
      res.on('error', (err) => {
        console.error('Response error:', err.message);
        reject(err);
      });
    });

    req.on('error', (err) => {
      console.error('Request error:', err.message);
      reject(new Error(`Network error: ${err.message}`));
    });

    req.on('timeout', () => {
      console.error('Request timeout');
      req.destroy();
      reject(new Error('API request timed out after 30 seconds'));
    });

    req.setTimeout(30000);
  });
}

// Function to get ALL menu products
async function getAllProducts() {
  // Check cache
  if (productsCache && lastFetchTime && (Date.now() - lastFetchTime < CACHE_DURATION)) {
    console.log('Returning cached products');
    return productsCache;
  }

  // If already loading, return the existing promise
  if (loadingPromise) {
    console.log('API call already in progress, waiting for completion...');
    return loadingPromise;
  }

  console.log('Fetching fresh products from API...');
  
  // Create and store the loading promise
  loadingPromise = (async () => {
    try {
      const data = await getAllMenuProducts();
      const allProducts = data.products || data.menu_products || [];
      
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
    } catch (err) {
      console.error('Error fetching products:', err.message);
      throw err;
    } finally {
      // Clear the loading promise when done
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

// Utility function for true randomization
function fisherYatesShuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Function to generate correct Beyond Hello product URL
function generateProductUrl(product) {
  // Use product_id (not id) and the existing path as base
  const productId = product.product_id;
  
  if (!productId) {
    return null;
  }
  
  // If there's an existing path, extract the slug from it and use product_id
  if (product.path && product.path.includes('/')) {
    const pathParts = product.path.split('/');
    if (pathParts.length >= 3) {
      // path format is usually "products/12345/slug-here"
      const existingSlug = pathParts.slice(2).join('/'); // Get everything after "products/12345/"
      return `https://beyond-hello.com/pennsylvania-dispensaries/bristol/medical-menu/menu/products/${productId}/${existingSlug}`;
    }
  }
  
  // Fallback: generate slug from brand and name if no existing path
  let slug = '';
  
  if (product.brand) {
    slug = product.brand.toLowerCase()
      .replace(/[™®]/g, '') // Remove trademark symbols
      .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }
  
  if (product.name) {
    const namePart = product.name.toLowerCase()
      .replace(/[™®]/g, '') // Remove trademark symbols
      .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
    
    if (slug && namePart) {
      slug += '-' + namePart;
    } else {
      slug = namePart || `product-${productId}`;
    }
  }
  
  return `https://beyond-hello.com/pennsylvania-dispensaries/bristol/medical-menu/menu/products/${productId}/${slug}`;
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
  console.log(`Starting with ${products.length} total products`);

  // Filter by approved brands
  const approvedBrands = ['hijinks', 'lab', 'nira+', 'nira', 'flower foundry', 'seche', 'tasteology'];
  let filteredProducts = products.filter(p => {
    const brand = (p.brand || '').toLowerCase().trim();
    return approvedBrands.some(approved => brand.includes(approved));
  });

  console.log(`After brand filtering: ${filteredProducts.length} products`);
  
  // Debug: Log some sample product data
  if (filteredProducts.length > 0) {
    const sampleProduct = filteredProducts[0];
    console.log(`Sample product structure:`, {
      name: sampleProduct.name,
      brand: sampleProduct.brand,
      kind: sampleProduct.kind,
      available_kinds: Object.keys(sampleProduct).filter(k => k.includes('kind') || k.includes('type'))
    });
  }

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

  console.log(`After category filtering: ${filteredProducts.length} products (category: ${categoryFilter || 'none'})`);

  // Handle session memory for product variety with enhanced randomization
  let sessionMemory = null;
  if (sessionId) {
    sessionMemory = getSessionMemory(sessionId);
    
    // Check if user is asking for different products
    const isDifferentRequest = userQuery.toLowerCase().match(/\b(different|other|another|new|alternative|else|show me something else|something different)\b/);
    
    if (isDifferentRequest && sessionMemory.lastCategory === categoryFilter) {
      const beforeMemoryFilter = filteredProducts.length;
      const recentlyShown = Array.from(sessionMemory.shownProducts);
      console.log(`Previously shown products: ${recentlyShown.join(', ')}`);
      
      filteredProducts = filteredProducts.filter(p => 
        !sessionMemory.shownProducts.has(p.name)
      );
      
      console.log(`After memory filtering: ${filteredProducts.length} products (removed ${beforeMemoryFilter - filteredProducts.length})`);
      
      // If we've filtered out too many, reset some older products (keep variety flowing)
      if (filteredProducts.length < 3 && recentlyShown.length > 6) {
        console.log('Too few products remaining, resetting memory...');
        sessionMemory.shownProducts.clear();
        // Re-add only the most recent 2 products to avoid immediate repeats
        recentlyShown.slice(-2).forEach(name => sessionMemory.shownProducts.add(name));
        
        // Re-filter with new memory
        filteredProducts = products.filter(p => {
          const brand = (p.brand || '').toLowerCase().trim();
          const matchesBrand = approvedBrands.some(approved => brand.includes(approved));
          const matchesCategory = categoryFilter ? (p.kind || '').toLowerCase() === categoryFilter : true;
          const notRecentlyShown = !sessionMemory.shownProducts.has(p.name);
          return matchesBrand && matchesCategory && notRecentlyShown;
        });
        
        console.log(`After memory reset: ${filteredProducts.length} products available`);
      }
    }
    
    // Update category tracking
    if (categoryFilter !== sessionMemory.lastCategory) {
      // New category, reset shown products but keep some cross-category memory
      sessionMemory.shownProducts.clear();
      sessionMemory.lastCategory = categoryFilter;
      console.log(`New category detected, cleared memory for: ${categoryFilter}`);
    }
  }

  // Multiple rounds of shuffling for maximum randomness
  let shuffled = fisherYatesShuffle(filteredProducts);
  
  // Add time-based seed for additional variance
  const timeSeed = Date.now() % 1000;
  shuffled = shuffled.sort(() => (Math.random() + timeSeed / 1000) - 0.5);
  
  // Final Fisher-Yates shuffle
  shuffled = fisherYatesShuffle(shuffled);
  
  // Take a larger, random slice from different parts of the array
  const totalProducts = shuffled.length;
  const sliceSize = Math.min(25, Math.max(15, Math.floor(totalProducts * 0.4))); // Take 40% but at least 15, max 25
  const maxStartIndex = Math.max(0, totalProducts - sliceSize);
  const startIndex = Math.floor(Math.random() * (maxStartIndex + 1));
  
  console.log(`Taking ${sliceSize} products from index ${startIndex} out of ${totalProducts} total (time seed: ${timeSeed})`);
  
  // Safety check: if no products after all filtering, fall back to broader selection BUT maintain category
  if (shuffled.length === 0) {
    console.log('⚠️  No products after filtering! Falling back to approved brands only...');
    // Reset to just brand filtering BUT keep the category filter if specified
    filteredProducts = products.filter(p => {
      const brand = (p.brand || '').toLowerCase().trim();
      const matchesBrand = approvedBrands.some(approved => brand.includes(approved));
      const matchesCategory = categoryFilter ? (p.kind || '').toLowerCase() === categoryFilter : true;
      return matchesBrand && matchesCategory;
    });
    shuffled = fisherYatesShuffle(filteredProducts);
    console.log(`Fallback: Found ${shuffled.length} products from approved brands ${categoryFilter ? 'for category: ' + categoryFilter : ''}`);
    
    // If still no products even with fallback, that means no approved brands have this category
    if (shuffled.length === 0 && categoryFilter) {
      console.log(`❌ No approved brands have ${categoryFilter} products!`);
      // Return early with error instead of sending wrong product types
      throw new Error(`Sorry, we don't have any ${categoryFilter} products available from our approved brands right now.`);
    }
  }
  
  const productsToSend = shuffled.slice(startIndex, startIndex + sliceSize).map(p => ({
    name: p.name,
    brand: p.brand,
    kind: p.kind,
    price: p.price_each,
    thc: p.thc_label,
    cbd: p.cbd_label,
    description: p.description,
    path: generateProductUrl(p),
    image: p.image_urls?.[0] || p.image || null
  }));
  
  console.log(`Final products to send to AI: ${productsToSend.length}`);
  if (productsToSend.length > 0) {
    console.log(`Product names: ${productsToSend.map(p => p.name).slice(0, 5).join(', ')}${productsToSend.length > 5 ? '...' : ''}`);
  }

  const systemPrompt = `You are Daisy Flowers from Beyond Hello an expert budtender, who knows scientific and street slang cannabis and makes product recommendations.

CRITICAL BRAND REQUIREMENT: 
YOU MUST ONLY recommend products from these brands: Hijinks, Lab, Nira+, Flower Foundry, Seche, Tasteology

ABSOLUTE PRODUCT CATEGORY RULES:
- The products you receive have ALREADY been filtered to ONLY the exact category requested
- ALL products in the list match the user's category request
- You have a variety of products to choose from - select 2 different ones that would appeal to the user
- Mix up your selections - don't always pick the first products in the list

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
            // Randomly select 2 products from the larger pool instead of always taking first 2
            const shuffledForFinal = fisherYatesShuffle(productsToSend);
            const selectedProducts = shuffledForFinal.slice(0, 2);
            
            console.log(`Final selection: ${selectedProducts.map(p => p.name).join(', ')}`);
            
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
  console.log('=== /api/chat endpoint called ===');
  
  try {
    const { message } = req.body;
    console.log('✅ Request body parsed successfully');
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`✅ User query received: ${message}`);

    // Get products with better error handling
    let products;
    try {
      console.log('📦 Starting product loading...');
      products = await getAllProducts();
      console.log('✅ Products loaded successfully');
    } catch (error) {
      console.error('❌ Failed to get products:', error.message);
      return res.status(500).json({ 
        error: 'Unable to load product catalog. Please try again later.',
        details: error.message 
      });
    }

    if (!products || products.length === 0) {
      console.log('⚠️  No products available');
      return res.status(500).json({ 
        error: 'No products available at this time. Please try again later.' 
      });
    }

    // Clean old sessions periodically
    cleanOldSessions();
    
    // Get session ID
    const sessionId = getSessionId(req);
    
    // Get AI response with product data
    console.log('🤖 Starting AI analysis...');
    const result = await analyzeWithAI(products, message, sessionId);
    console.log('✅ AI analysis complete');

    console.log('✅ Sending response...');
    res.json({ 
      response: result.text, 
      products: result.products 
    });
    console.log('✅ Response sent successfully');
  } catch (error) {
    console.error('❌ Error in /api/chat:', error);
    console.error('❌ Stack trace:', error.stack);
    
    // Make sure we always send a response
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'An error occurred processing your request. Please try again.',
        details: error.message 
      });
    }
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
  console.log('Ready to serve requests - products will be loaded on demand');
});
