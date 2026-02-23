require('dotenv').config();
const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { scrapeMenu, buildMenuContext, annotateProductsWithDeals } = require('./menu-scraper');
const { buildDocumentContext } = require('./doc-parser');

// Architecture: User query → extractUserIntent → scoreProduct (all products) → enrich with live menu data → send ALL to Claude → Claude selects 2-3 → match back to product cards

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

// Function to extract structured user intent from natural language queries
function extractUserIntent(query) {
  const queryLower = query.toLowerCase();
  
  const intent = {
    category: null,
    subcategory: null,
    effects: [],
    lineagePreference: null,
    intensityPref: null,
    experienceLevel: null,
    priceMax: null,
    specificProduct: null
  };
  
  // Category detection (matching actual 'kind' values in data)
  if (/\b(flower|bud|buds|strain|strains)\b/i.test(query)) {
    intent.category = 'flower';
  } else if (/\b(vape|vapes|cart|carts|cartridge|cartridges|pen|pens)\b/i.test(query)) {
    intent.category = 'extract';
    intent.subcategory = 'cartridge';
  } else if (/\b(concentrate|concentrates|wax|shatter|dab|dabs|diamond|diamonds|live resin|badder|budder|sugar)\b/i.test(query)) {
    intent.category = 'extract';
    intent.subcategory = 'concentrate';
  } else if (/\b(edible|edibles|gummy|gummies|chew|chews|troche|troches)\b/i.test(query)) {
    intent.category = 'edible';
  } else if (/\b(tincture|tinctures|drops|oil|oils)\b/i.test(query)) {
    intent.category = 'tincture';
  }
  
  // Effect keywords mapping
  if (/\b(sleep|insomnia|nighttime|bedtime|rest|wind down)\b/i.test(query)) {
    intent.effects.push('sleep');
  }
  if (/\b(energy|energize|morning|daytime|wake|active|productive)\b/i.test(query)) {
    intent.effects.push('energy');
  }
  if (/\b(relax|relaxing|calm|chill|stress|unwind|anxiety|anxious)\b/i.test(query)) {
    intent.effects.push('relax');
  }
  if (/\b(focus|concentrate|study|work|clarity|clear-headed)\b/i.test(query)) {
    intent.effects.push('focus');
  }
  if (/\b(pain|sore|ache|aching|inflammation|relief)\b/i.test(query)) {
    intent.effects.push('pain');
  }
  if (/\b(creative|creativity|art|music|inspiration)\b/i.test(query)) {
    intent.effects.push('creative');
  }
  if (/\b(appetite|hungry|eat|munchies)\b/i.test(query)) {
    intent.effects.push('appetite');
  }
  if (/\b(happy|euphoria|euphoric|mood|uplifting|uplift)\b/i.test(query)) {
    intent.effects.push('mood');
  }
  
  // Explicit lineage preference
  if (/\bindica\b/i.test(query)) {
    intent.lineagePreference = 'indica';
  } else if (/\bsativa\b/i.test(query)) {
    intent.lineagePreference = 'sativa';
  } else if (/\bhybrid\b/i.test(query)) {
    intent.lineagePreference = 'hybrid';
  } else {
    // Infer lineage from effects (only if not explicitly stated)
    const indicaEffects = intent.effects.filter(e => ['sleep', 'relax', 'pain'].includes(e));
    const sativaEffects = intent.effects.filter(e => ['energy', 'focus', 'creative'].includes(e));
    
    if (indicaEffects.length > sativaEffects.length) {
      intent.lineagePreference = 'indica';
    } else if (sativaEffects.length > indicaEffects.length) {
      intent.lineagePreference = 'sativa';
    }
  }
  
  // Intensity preference
  if (/\b(mild|light|gentle|low dose|microdose|easy|soft)\b/i.test(query)) {
    intent.intensityPref = 'mild';
  } else if (/\b(strong|potent|heavy|intense|high thc|powerful|knockout)\b/i.test(query)) {
    intent.intensityPref = 'strong';
  }
  
  // Experience level
  if (/\b(new|beginner|first time|never tried|newbie|starting out)\b/i.test(query)) {
    intent.experienceLevel = 'beginner';
  } else if (/\b(experienced|regular|tolerance|veteran|daily)\b/i.test(query)) {
    intent.experienceLevel = 'experienced';
  }
  
  // Price extraction
  const priceMatch = query.match(/\$(\d+)|(?:under|below|less than|budget)\s*\$?(\d+)/i);
  if (priceMatch) {
    intent.priceMax = parseInt(priceMatch[1] || priceMatch[2]);
  }
  
  // Specific product detection
  const quotedMatch = query.match(/"([^"]+)"/);
  if (quotedMatch) {
    intent.specificProduct = quotedMatch[1];
  } else {
    const tellMeAbout = query.match(/\b(?:tell me about|do you have|what about)\s+(.+?)(?:\?|$)/i);
    if (tellMeAbout) {
      intent.specificProduct = tellMeAbout[1].trim();
    }
  }
  
  return intent;
}

// Function to score how well a product matches user intent
function scoreProduct(product, intent) {
  let score = 0;
  
  // 1. LINEAGE MATCH (+3 points)
  if (intent.lineagePreference && product.lineage === intent.lineagePreference) {
    score += 3;
  }
  
  // 2. TERPENE MATCH (up to +10 points)
  if (intent.effects && intent.effects.length > 0) {
    const productTerpenes = parseTerpenes(product.store_notes);
    
    // Define which terpenes are relevant for each effect
    const effectTerpeneMap = {
      sleep: ['myrcene', 'linalool', 'terpinolene'],
      energy: ['limonene', 'pinene', 'terpinolene'],
      relax: ['myrcene', 'linalool', 'caryophyllene'],
      focus: ['pinene', 'limonene', 'terpinolene'],
      pain: ['caryophyllene', 'myrcene', 'humulene'],
      creative: ['limonene', 'pinene', 'terpinolene'],
      appetite: ['myrcene', 'caryophyllene'],
      mood: ['limonene', 'linalool', 'pinene']
    };
    
    // Check each effect the user wants
    for (const effect of intent.effects) {
      const relevantTerpenes = effectTerpeneMap[effect];
      if (relevantTerpenes) {
        for (const terpene of relevantTerpenes) {
          if (productTerpenes[terpene]) {
            // Add points based on terpene percentage, capped at 2.0
            score += Math.min(productTerpenes[terpene], 2.0);
          }
        }
      }
    }
  }
  
  // 3. THC RANGE MATCH (+2 points)
  if (intent.intensityPref === 'mild' || intent.experienceLevel === 'beginner') {
    if (product.percent_thc && product.percent_thc >= 5 && product.percent_thc <= 18) {
      score += 2;
    }
  } else if (intent.intensityPref === 'strong' || intent.experienceLevel === 'experienced') {
    if (product.percent_thc && product.percent_thc > 20) {
      score += 2;
    }
  }
  
  // 4. PRICE MATCH (+1 point)
  if (intent.priceMax) {
    const priceInfo = getBestPrice(product);
    if (priceInfo.amount !== null && priceInfo.amount <= intent.priceMax) {
      score += 1;
    }
  }
  
  // 5. CBD BONUS (+1 point)
  if (intent.effects && (intent.effects.includes('relax') || intent.effects.includes('anxiety'))) {
    if (product.percent_cbd && product.percent_cbd > 1.0) {
      score += 1;
    }
  }
  
  return score;
}

// Enhanced terpene effect mapping for complex analysis
const terpeneEffects = {
  myrcene: ['sedating', 'relaxing', 'sleep', 'muscle relaxation', 'couch lock'],
  limonene: ['uplifting', 'mood boost', 'stress relief', 'energy', 'citrus'],
  caryophyllene: ['calming', 'anti-inflammatory', 'stress', 'spicy', 'pepper'],
  pinene: ['alertness', 'memory', 'focus', 'energy', 'pine', 'clarity'],
  linalool: ['calming', 'sleep', 'lavender', 'anxiety relief', 'peaceful'],
  humulene: ['appetite suppression', 'alertness', 'earthy', 'woody'],
  terpinolene: ['sedating', 'antioxidant', 'herbal', 'complex'],
  ocimene: ['uplifting', 'sweet', 'herbaceous', 'decongestant']
};

// Function to parse actual terpene percentages from store_notes field
function parseTerpenes(storeNotes) {
  if (!storeNotes) {
    return {};
  }
  
  // Split at the separator to only parse terpene data, not description text
  const terpeneSection = storeNotes.split('\r\n--\r\n')[0];
  
  // Regex to match patterns like "TerpName: X.XXX%" or "TerpName : X.XXX%"
  // Captures the terpene name and percentage value
  const terpeneRegex = /([a-zA-Z-]+)\s*:\s*(\d+\.?\d*)%/g;
  const terpenes = {};
  
  let match;
  while ((match = terpeneRegex.exec(terpeneSection)) !== null) {
    let terpName = match[1].toLowerCase();
    const percentage = parseFloat(match[2]);
    
    // Normalize specific terpene names
    if (terpName === 'b-pinene') {
      terpName = 'beta-pinene';
    } else if (terpName === 'bisabolol') {
      terpName = 'bisabolol';
    }
    
    terpenes[terpName] = percentage;
  }
  
  return terpenes;
}

// Function to find the best available price for a product
function getBestPrice(product) {
  const kind = (product.kind || '').toLowerCase();
  
  // Helper function to check both regular and discounted prices
  const checkPrice = (regularField, discountedField, label) => {
    const regularPrice = product[regularField];
    const discountedPrice = product[discountedField];
    
    if (discountedPrice != null && regularPrice != null && discountedPrice < regularPrice) {
      return { amount: discountedPrice, label: `$${discountedPrice}${label} (sale)` };
    } else if (regularPrice != null) {
      return { amount: regularPrice, label: `$${regularPrice}${label}` };
    } else if (discountedPrice != null) {
      return { amount: discountedPrice, label: `$${discountedPrice}${label} (sale)` };
    }
    return null;
  };
  
  // Priority order based on product kind
  if (kind === 'edible' || kind === 'tincture') {
    const result = checkPrice('price_each', 'discounted_price_each', '/each');
    if (result) return result;
  }
  
  if (kind === 'extract') {
    // Try price_half_gram first
    let result = checkPrice('price_half_gram', 'discounted_price_half_gram', '/0.5g');
    if (result) return result;
    
    // Then price_gram
    result = checkPrice('price_gram', 'discounted_price_gram', '/g');
    if (result) return result;
    
    // Then price_each
    result = checkPrice('price_each', 'discounted_price_each', '/each');
    if (result) return result;
  }
  
  if (kind === 'flower') {
    // Try price_eighth_ounce first
    let result = checkPrice('price_eighth_ounce', 'discounted_price_eighth_ounce', '/eighth oz');
    if (result) return result;
    
    // Then price_quarter_ounce
    result = checkPrice('price_quarter_ounce', 'discounted_price_quarter_ounce', '/quarter oz');
    if (result) return result;
    
    // Then price_half_ounce
    result = checkPrice('price_half_ounce', 'discounted_price_half_ounce', '/half oz');
    if (result) return result;
    
    // Then price_gram (some flower might have gram pricing)
    result = checkPrice('price_gram', 'discounted_price_gram', '/g');
    if (result) return result;
  }
  
  // Fallback: try any non-null price field
  const priceFields = [
    { regular: 'price_each', discounted: 'discounted_price_each', label: '/each' },
    { regular: 'price_half_gram', discounted: 'discounted_price_half_gram', label: '/0.5g' },
    { regular: 'price_gram', discounted: 'discounted_price_gram', label: '/g' },
    { regular: 'price_eighth_ounce', discounted: 'discounted_price_eighth_ounce', label: '/eighth oz' },
    { regular: 'price_quarter_ounce', discounted: 'discounted_price_quarter_ounce', label: '/quarter oz' },
    { regular: 'price_half_ounce', discounted: 'discounted_price_half_ounce', label: '/half oz' },
    { regular: 'price_ounce', discounted: 'discounted_price_ounce', label: '/oz' }
  ];
  
  for (const field of priceFields) {
    const result = checkPrice(field.regular, field.discounted, field.label);
    if (result) return result;
  }
  
  // If all price fields are null
  return { amount: null, label: 'Price varies' };
}

// Function to build compact product summary for Claude API context window
function buildCompactSummary(product) {
  // Extract product ID
  const id = product.product_id || 'N/A';
  
  // Basic product info
  const name = product.name || 'Unknown';
  const brand = product.brand || 'Unknown';
  const kind = product.kind || 'unknown';
  const subtype = product.kind_subtype || product.root_subtype || '';
  const lineage = product.lineage || 'unknown';
  
  // THC/CBD percentages (using correct field names)
  const thcValue = product.percent_thc != null ? `${product.percent_thc}%` : 'N/A';
  let cannabinoids = `THC:${thcValue}`;
  
  // Only include CBD if > 0.5
  if (product.percent_cbd != null && product.percent_cbd > 0.5) {
    cannabinoids += ` CBD:${product.percent_cbd}%`;
  }
  
  // Parse terpenes and get top 3
  const terpenes = parseTerpenes(product.store_notes);
  let terpeneString;
  
  if (Object.keys(terpenes).length === 0) {
    terpeneString = 'Terpenes: N/A';
  } else {
    const topTerpenes = Object.entries(terpenes)
      .sort((a, b) => b[1] - a[1])  // Sort by percentage descending
      .slice(0, 3)  // Take top 3
      .map(([name, pct]) => `${name} ${pct.toFixed(1)}%`)
      .join(', ');
    terpeneString = `Terps: ${topTerpenes}`;
  }
  
  // Get price
  const priceInfo = getBestPrice(product);
  const price = priceInfo.label;
  
  // Build the compact summary string
  const subtypeString = subtype ? `/${subtype}` : '';
  const summary = `[${id}] ${name} | ${brand} | ${kind}${subtypeString} | ${lineage} | ${cannabinoids} | ${terpeneString} | ${price}`;
  
  return summary;
}

// Function to build product card data for frontend
function buildProductCard(product) {
  const terpenes = parseTerpenes(product.store_notes);
  const topTerpenes = Object.entries(terpenes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, pct]) => ({ name, percentage: pct }));
  
  const priceInfo = getBestPrice(product);
  
  return {
    name: product.name,
    brand: product.brand,
    kind: product.kind,
    kind_subtype: product.kind_subtype || product.root_subtype,
    type: product.type,
    lineage: product.lineage,
    thc: product.percent_thc != null ? `${product.percent_thc}%` : null,
    cbd: product.percent_cbd != null && product.percent_cbd > 0.5 ? `${product.percent_cbd}%` : null,
    price: priceInfo.label,
    priceAmount: priceInfo.amount,
    topTerpenes: topTerpenes,
    description: (product.description || '').substring(0, 200),
    path: generateProductUrl(product),
    image: product.image_urls?.[0] || null,
    product_id: product.product_id
  };
}

// Function to validate AI response and detect hallucinations
function validateAIResponse(responseText, validProductNames) {
  let isValid = true;
  let hasNoMatch = false;
  
  // Check for "no match" language
  const noMatchPhrases = ["I don't have", "not available", "can't find", "no products", "none of"];
  hasNoMatch = noMatchPhrases.some(phrase => 
    responseText.toLowerCase().includes(phrase.toLowerCase())
  );
  if (hasNoMatch) {
    console.log('AI indicated no match found');
  }
  
  // Extract all [ID:XXXXX] patterns and validate them
  const idRegex = /\[ID:(\d+)\]/g;
  const foundIds = [];
  let match;
  while ((match = idRegex.exec(responseText)) !== null) {
    foundIds.push(match[1]);
  }
  
  if (foundIds.length === 0) {
    console.warn('AI response contains no [ID:XXXXX] tags');
    isValid = false;
  }
  
  // Clean the response text - remove ID tags for user display
  const cleanedText = responseText.replace(/\[ID:\d+\]/g, '').trim();
  
  return {
    isValid: isValid,
    hasNoMatch: hasNoMatch,
    cleanedText: cleanedText,
    foundIds: foundIds
  };
}

// Function to analyze with AI
async function analyzeWithAI(products, userQuery, sessionId = null, isRetry = false) {
  // STEP 1 — Extract intent
  const intent = extractUserIntent(userQuery);
  console.log('User intent:', JSON.stringify(intent));

  // STEP 2 — Filter by approved brands (keep this exact logic from the original)
  const approvedBrands = ['hijinks', 'lab', 'nira+', 'nira', 'flower foundry', 'seche', 'tasteology'];
  let filteredProducts = products.filter(p => {
    const brand = (p.brand || '').toLowerCase().trim();
    return approvedBrands.some(approved => brand.includes(approved));
  });
  
  console.log(`After brand filtering: ${filteredProducts.length} products`);

  // STEP 3 — Filter by category (if intent.category is set)
  if (intent.category) {
    filteredProducts = filteredProducts.filter(p => {
      const kind = (p.kind || '').toLowerCase();
      if (kind !== intent.category) return false;
      // Sub-category filtering for extracts
      if (intent.subcategory === 'cartridge') {
        return (p.root_subtype || '').toLowerCase().includes('cartridge');
      }
      if (intent.subcategory === 'concentrate') {
        return !(p.root_subtype || '').toLowerCase().includes('cartridge');
      }
      return true;
    });
    console.log(`After category filtering (${intent.category}${intent.subcategory ? '/' + intent.subcategory : ''}): ${filteredProducts.length} products`);
  }

  // STEP 4 — Handle "specific product" queries
  if (intent.specificProduct) {
    const specificMatches = filteredProducts.filter(p => 
      (p.name || '').toLowerCase().includes(intent.specificProduct.toLowerCase())
    );
    
    if (specificMatches.length > 0) {
      console.log(`Found specific product match: ${specificMatches[0].name}`);
      // Return early with just this product for description
      const productSummary = buildCompactSummary(specificMatches[0]);
      console.log(`Sending specific product to Claude: ${productSummary}`);
      
      const productLookup = new Map();
      productLookup.set(specificMatches[0].product_id, specificMatches[0]);
      productLookup.set(specificMatches[0].name.toLowerCase(), specificMatches[0]);
      
      // TODO: Handle specific product AI call in next prompt
      // For now, continue with normal flow
    }
  }

  // STEP 5 — Score and rank ALL remaining products
  const scoredProducts = filteredProducts.map(p => ({
    product: p,
    score: scoreProduct(p, intent)
  }));
  scoredProducts.sort((a, b) => b.score - a.score);
  
  console.log(`Top 5 scored products: ${scoredProducts.slice(0, 5).map(sp => `${sp.product.name} (${sp.score.toFixed(1)})`).join(', ')}`);

  // STEP 6 — Session memory deduplication (keep the concept from original but simplified)
  let finalProducts = scoredProducts;
  if (sessionId) {
    const sessionMemory = getSessionMemory(sessionId);
    
    // Check if user is asking for different products  
    const isDifferentRequest = userQuery.toLowerCase().match(/\b(different|other|another|new|alternative|else|something else|something different|show me another)\b/);
    
    if (isDifferentRequest && sessionMemory.shownProducts.size > 0) {
      console.log(`User wants something different. Previously shown: ${Array.from(sessionMemory.shownProducts).join(', ')}`);
      
      // Filter out products whose names are in sessionMemory.shownProducts
      finalProducts = scoredProducts.filter(sp => 
        !sessionMemory.shownProducts.has(sp.product.name)
      );
      
      console.log(`After deduplication: ${finalProducts.length} products remaining`);
    }
  }

  // STEP 6.5 — Enrich with live menu data (deals + specials context) and document knowledge
  let liveMenuContext = '';
  let dealMap = null;
  try {
    const [menuContext, menuData, docContext] = await Promise.all([
      buildMenuContext(),
      scrapeMenu(),
      buildDocumentContext(userQuery),
    ]);
    liveMenuContext = menuContext + (docContext || '');
    dealMap = menuData.deal_map;
    
    // Boost scores for products that have active deals/specials
    if (dealMap && dealMap.size > 0) {
      finalProducts.forEach(sp => {
        const pid = String(sp.product.product_id);
        const deal = dealMap.get(pid);
        if (deal) {
          sp.score += 1.5; // Boost products with active deals
          sp.product._deal_info = deal; // Attach deal info for summary building
        }
      });
      // Re-sort after boosting
      finalProducts.sort((a, b) => b.score - a.score);
      console.log(`Live menu: ${dealMap.size} products have active deals, boosted scores`);
    }
  } catch (err) {
    console.warn('Live menu scrape failed (continuing without):', err.message);
  }

  // STEP 7 — Build compact summaries for ALL scored products (send them ALL to Claude)
  const productSummaries = finalProducts
    .filter(sp => sp.score >= 0) // include all, even score 0 when no intent detected
    .map((sp, index) => {
      const dealInfo = sp.product._deal_info;
      const dealTag = dealInfo ? ` [DEAL: ${dealInfo.discount}]` : '';
      return `${index + 1}. ${buildCompactSummary(sp.product)}${dealTag}`;
    });

  console.log(`Sending ${productSummaries.length} products to Claude for selection`);


  // STEP 8 — Keep the full product objects in a lookup map for later
  const productLookup = new Map();
  finalProducts.forEach(sp => {
    productLookup.set(sp.product.product_id, sp.product);
    productLookup.set(sp.product.name.toLowerCase(), sp.product);
  });

  // STEP 9 — Build the system prompt (COMPLETELY NEW)
  const systemPrompt = `You are Daisy Flowers, a knowledgeable and friendly budtender at Beyond Hello dispensary in Bristol, PA.

YOUR JOB: Customers ask you questions about cannabis products. You will receive the store's full product list. Your job is to SELECT the 2-3 best products for the customer and explain why.

ABSOLUTE RULES:
1. ONLY recommend products from the numbered list provided. Use the EXACT product name as shown. Never invent or guess product names.
2. SELECT 2-3 products that genuinely match the customer's needs. Do NOT recommend all products.
3. PREFER products tagged [DEAL: X% OFF] when they are a good match — customers love savings! Mention the deal.
4. If NO products are a great match, say so honestly and recommend the closest options.
5. For each recommendation, explain WHY it fits — mention its terpene profile, lineage (indica/sativa/hybrid), and THC percentage.
6. If a product has an active deal or special, ALWAYS mention it! This is important for customer satisfaction.
7. Never make medical claims. Never say "treat", "cure", "prescribe", or "medicate". Use words like "may help with", "known for", "people often choose this for".
8. Always end with: "This isn't medical advice. Availability may vary by store."

RESPONSE FORMAT:
- Start with a brief warm greeting (1 sentence, vary it naturally — don't always say the same thing)
- For each recommended product: the product name (exactly as listed), why it's a good fit, one specific terpene or cannabinoid detail
- Mention any relevant deals, specials, or promotions
- The disclaimer

CRITICAL: After each product name you recommend, include its product_id in brackets like this: [ID:48743]. This is required for our system to match your recommendations to product cards. Do not skip this.

Keep it conversational — you're a friendly budtender, not writing an essay. 3-4 sentences per product max.`;

  // STEP 10 — Build the user prompt
  let userPrompt = `Customer question: "${userQuery}"
${liveMenuContext}
Here is our current product inventory. Products tagged [DEAL: X% OFF] have active specials. Select the 2-3 best matches for this customer:

${productSummaries.join('\n')}

Remember: Pick the products that best match what the customer is asking for. When products with active deals are a good fit, prefer those and mention the savings. Use EXACT product names from the list above and include the [ID:product_id] after each recommended product name.`;
  
  // Add retry instruction if this is a retry attempt
  if (isRetry) {
    userPrompt += "\n\nIMPORTANT: You must select at least 2 products from the list and include their [ID:product_id] tags.";
  }

  // STEP 11 — Make the API call
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
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
            // STEP 12 — Parse the response and MATCH products
            const responseText = response.content[0].text;
            
            // Extract all [ID:XXXXX] patterns from the response text
            const idRegex = /\[ID:(\d+)\]/g;
            const matchedIds = [];
            let match;
            while ((match = idRegex.exec(responseText)) !== null) {
              matchedIds.push(match[1]);
            }
            
            console.log(`Claude recommended product IDs: ${matchedIds.join(', ')}`);
            
            // Look up each product_id in the productLookup map
            const matchedProducts = [];
            for (const productId of matchedIds) {
              const product = productLookup.get(productId);
              if (product) {
                // Build full product card data using buildProductCard function
                matchedProducts.push(buildProductCard(product));
              } else {
                console.warn(`Product ID ${productId} not found in lookup map`);
              }
            }
            
            // Fallback: if no IDs were matched, try fuzzy name matching
            if (matchedProducts.length === 0) {
              console.log('No ID matches found, trying fuzzy name matching...');
              for (const scoredProduct of finalProducts.slice(0, 5)) { // Check top 5 scored products
                const productName = scoredProduct.product.name;
                if (responseText.toLowerCase().includes(productName.toLowerCase())) {
                  const product = scoredProduct.product;
                  
                  matchedProducts.push(buildProductCard(product));
                  
                  if (matchedProducts.length >= 3) break; // Limit to 3 products
                }
              }
              console.log(`Fuzzy matching found ${matchedProducts.length} products`);
            }
            
            // Clean the [ID:XXXXX] tags from the response text before returning
            const cleanedText = responseText.replace(/\[ID:\d+\]/g, '').trim();
            
            // Validate AI response
            const validProductNames = new Set(finalProducts.map(sp => sp.product.name.toLowerCase()));
            const validation = validateAIResponse(responseText, validProductNames);
            
            // Track shown products in session memory
            if (sessionId && matchedProducts.length > 0) {
              const sessionMemory = getSessionMemory(sessionId);
              matchedProducts.forEach(p => {
                sessionMemory.shownProducts.add(p.name);
              });
              sessionMemory.timestamp = Date.now();
            }
            
            console.log(`Final matched products: ${matchedProducts.map(p => p.name).join(', ')}`);
            
            resolve({
              text: validation.cleanedText,
              products: matchedProducts,
              validation: validation,
              intent: intent,
              scoredProducts: finalProducts
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

// Wrapper function with retry logic and graceful fallback
async function analyzeWithAIWithRetry(products, userQuery, sessionId = null) {
  try {
    // First attempt
    const result = await analyzeWithAI(products, userQuery, sessionId);
    
    // Check if we got product matches or if retry is needed
    const needsRetry = result.products.length === 0 && 
      (result.intent?.category || result.intent?.effects?.length > 0);
    
    if (needsRetry) {
      console.log('No products matched, retrying with more explicit prompt...');
      
      // Retry once with more explicit instructions
      const retryResult = await analyzeWithAI(products, userQuery, sessionId, true);
      
      if (retryResult.products.length > 0) {
        console.log('Retry successful!');
        return retryResult;
      } else {
        console.log('Retry failed, using graceful fallback...');
        
        // GRACEFUL FALLBACK: Return AI text but with top 3 scored products
        const fallbackProducts = result.scoredProducts
          .slice(0, 3)
          .map(sp => buildProductCard(sp.product));
        
        return {
          text: result.text,
          products: fallbackProducts
        };
      }
    }
    
    return {
      text: result.text,
      products: result.products
    };
  } catch (error) {
    console.error('Error in analyzeWithAIWithRetry:', error);
    throw error;
  }
}

// API Endpoints
app.get('/api/health', async (req, res) => {
  let menuStatus = 'unknown';
  try {
    const menu = await scrapeMenu();
    menuStatus = `${menu.deals.length} deals, ${menu.specials.length} specials`;
  } catch { menuStatus = 'unavailable'; }
  
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    products: productsCache ? productsCache.length : 0,
    liveMenu: menuStatus,
    environment: process.env.NODE_ENV || 'development',
    version: require('./package.json').version
  });
});

// Live menu data endpoint
app.get('/api/menu/live', async (req, res) => {
  try {
    const menu = await scrapeMenu(req.query.refresh === 'true');
    res.json({
      timestamp: menu.timestamp,
      deals: menu.deals.map(d => d.text),
      promos: menu.promos.map(p => p.text),
      specials_count: menu.specials.length,
      total_products_on_sale: menu.total_special_products,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch live menu', details: error.message });
  }
});

// Deals endpoint
app.get('/api/menu/deals', async (req, res) => {
  try {
    const menu = await scrapeMenu();
    res.json({
      timestamp: menu.timestamp,
      deals: menu.deals,
      promos: menu.promos,
      specials: menu.specials.map(s => ({
        discount: s.discount_amount,
        description: s.description,
        product_count: s.product_ids.length,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch deals', details: error.message });
  }
});

app.post('/api/chat', async (req, res) => {
  console.log('=== /api/chat endpoint called ===');
  
  try {
    let { message } = req.body;
    console.log('✅ Request body parsed successfully');
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // INPUT VALIDATION
    // 1. Max length check
    if (message.length > 500) {
      console.warn(`Message truncated from ${message.length} to 500 characters`);
      message = message.substring(0, 500);
    }
    
    // 2. Strip HTML tags for basic XSS prevention
    const originalLength = message.length;
    message = message.replace(/<[^>]*>/g, '');
    if (message.length !== originalLength) {
      console.warn('HTML tags stripped from message');
    }
    
    // 3. Check if message is empty after cleaning
    if (!message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
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
    
    // First attempt
    let result = await analyzeWithAIWithRetry(products, message, sessionId);
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
