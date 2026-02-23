/**
 * Beyond Hello Menu Scraper
 * 
 * Provides live menu intelligence by combining:
 * 1. Static HTML scraping of the Beyond Hello website for deals, specials, and promotions
 * 2. iHeartJane specials API for deal-to-product mappings (when accessible)
 * 3. Product availability validation against the existing API catalog
 * 
 * This data supplements the iHeartJane partner API to provide more accurate
 * recommendations — especially around deals, specials, and what the dispensary
 * is currently promoting.
 */

const https = require('https');
const http = require('http');

const MENU_URL = 'https://beyond-hello.com/pennsylvania-dispensaries/bristol/medical-menu/';
const SPECIALS_API = 'https://api.iheartjane.com/v1/stores/1635/specials';

// Cache for scraped menu data
let menuCache = null;
let menuCacheTime = null;
const MENU_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes (more frequent than product API cache)

// Cache for specials API data
let specialsCache = null;
let specialsCacheTime = null;
const SPECIALS_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

/**
 * Fetch a URL and return the response body
 */
function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const reqOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': options.accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        ...options.headers,
      },
      timeout: 30000,
    };

    const req = client.get(url, reqOptions, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location, options).then(resolve).catch(reject);
        return;
      }

      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, data }));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

/**
 * Parse deals/specials from the Beyond Hello static HTML
 * This works reliably because deals are in the WordPress HTML, not the Jane embed
 */
function parseDeals(html) {
  const deals = [];
  const seenDeals = new Set();

  // Decode HTML entities
  const decode = (str) => str
    .replace(/&amp;/g, '&')
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

  // Pattern 1: Percentage off deals (e.g., "35% Off Flower Foundry/Hijinks/The Lab+")
  const pctOffRegex = /(\d+%\s+Off[^<"\n]{3,100})/gi;
  let match;
  while ((match = pctOffRegex.exec(html)) !== null) {
    const dealText = decode(match[1]).substring(0, 150);
    const key = dealText.toLowerCase().replace(/[^a-z0-9%]/g, '');
    if (dealText.length > 8 && !seenDeals.has(key)) {
      seenDeals.add(key);
      deals.push({ type: 'percentage', text: dealText });
    }
  }

  // Pattern 2: Fixed price deals (e.g., "$15 Seche Select 3.5gs")
  const priceRegex = /(\$\d+\s+(?:selected|Seche|Lab|Flower|Hijinks|Nira|Tasteology)[^<"\n]{3,80})/gi;
  while ((match = priceRegex.exec(html)) !== null) {
    const dealText = decode(match[1]).substring(0, 150);
    const key = dealText.toLowerCase().replace(/[^a-z0-9$]/g, '');
    if (!seenDeals.has(key)) {
      seenDeals.add(key);
      deals.push({ type: 'fixed_price', text: dealText });
    }
  }

  // Pattern 3: Bundle deals (e.g., "2 for $50 The Lab 1G Cartridges")
  const bundleRegex = /(\d+\s+for\s+\$\d+[^<"\n]{3,80})/gi;
  while ((match = bundleRegex.exec(html)) !== null) {
    const dealText = decode(match[1]).substring(0, 150);
    const key = dealText.toLowerCase().replace(/[^a-z0-9$]/g, '');
    if (!seenDeals.has(key)) {
      seenDeals.add(key);
      deals.push({ type: 'bundle', text: dealText });
    }
  }

  // Pattern 4: Build Your Own deals
  const byoRegex = /((?:Build Your Own|BYOO?)[^<"\n]{3,80})/gi;
  while ((match = byoRegex.exec(html)) !== null) {
    const dealText = decode(match[1]).substring(0, 150);
    const key = dealText.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!seenDeals.has(key)) {
      seenDeals.add(key);
      deals.push({ type: 'build_your_own', text: dealText });
    }
  }

  // Pattern 5: Storewide deals
  const storewideRegex = /(\d+%\s+Off\s+Storewide[^<"\n]*)/gi;
  while ((match = storewideRegex.exec(html)) !== null) {
    const dealText = decode(match[1]).substring(0, 150);
    const key = dealText.toLowerCase().replace(/[^a-z0-9%]/g, '');
    if (!seenDeals.has(key)) {
      seenDeals.add(key);
      deals.push({ type: 'storewide', text: dealText });
    }
  }

  return deals;
}

/**
 * Parse promotional banners and featured deal validity dates from HTML
 */
function parsePromotionalInfo(html) {
  const promos = [];

  // Look for date validity patterns like "Valid 2/20-2/21"
  const dateRegex = /(?:valid|offer valid|expires?)\s+(\d{1,2}\/\d{1,2}(?:\s*[-–]\s*\d{1,2}\/\d{1,2})?)/gi;
  let match;
  while ((match = dateRegex.exec(html)) !== null) {
    promos.push({
      type: 'validity',
      text: match[0].trim(),
    });
  }

  // Look for "Every Day Low Prices" and similar persistent deals
  const edlpRegex = /(Every\s+Day\s+Low\s+Prices?[^<"\n]{0,60})/gi;
  while ((match = edlpRegex.exec(html)) !== null) {
    promos.push({
      type: 'everyday_low_price',
      text: match[1].trim(),
    });
  }

  return promos;
}

/**
 * Try to fetch specials from the iHeartJane V1 API
 * This returns deal-to-product-ID mappings when accessible
 * Falls back gracefully if Cloudflare blocks the request
 */
async function fetchSpecialsAPI() {
  // Check cache
  if (specialsCache && specialsCacheTime && (Date.now() - specialsCacheTime < SPECIALS_CACHE_DURATION)) {
    return specialsCache;
  }

  try {
    const result = await fetchUrl(SPECIALS_API, {
      accept: 'application/json',
    });

    if (result.status === 200) {
      const data = JSON.parse(result.data);
      const specials = (data.specials || []).map(s => ({
        id: s.id,
        description: s.description || '',
        discount_amount: s.discount_amount || '',
        product_ids: s.conditions?.product?.included_product_ids || [],
        badge: s.custom_badge || '',
      }));

      specialsCache = specials;
      specialsCacheTime = Date.now();
      console.log(`[MenuScraper] Fetched ${specials.length} specials from Jane API`);
      return specials;
    }
  } catch (error) {
    console.log('[MenuScraper] Jane specials API not accessible:', error.message);
  }

  return specialsCache || []; // Return stale cache or empty array
}

/**
 * Build a product-to-deals mapping from API specials
 * Returns Map<product_id, { discount, description }>
 */
async function buildDealMap() {
  const specials = await fetchSpecialsAPI();
  const dealMap = new Map();

  for (const special of specials) {
    for (const pid of special.product_ids) {
      const existing = dealMap.get(String(pid));
      // Keep the best (highest) discount
      if (!existing || parseDiscount(special.discount_amount) > parseDiscount(existing.discount)) {
        dealMap.set(String(pid), {
          discount: special.discount_amount,
          description: special.description,
        });
      }
    }
  }

  return dealMap;
}

/**
 * Parse discount string like "25% OFF" to a number
 */
function parseDiscount(str) {
  if (!str) return 0;
  const match = str.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * Main function: scrape the Beyond Hello menu and return structured data
 * Combines static HTML scraping with API data for the best context
 */
async function scrapeMenu(forceRefresh = false) {
  // Check cache
  if (!forceRefresh && menuCache && menuCacheTime && (Date.now() - menuCacheTime < MENU_CACHE_DURATION)) {
    console.log('[MenuScraper] Returning cached menu data');
    return menuCache;
  }

  console.log('[MenuScraper] Fetching live menu data from Beyond Hello...');
  
  try {
    // Fetch in parallel: static HTML + specials API
    const [htmlResult, specials] = await Promise.all([
      fetchUrl(MENU_URL).catch(err => ({ status: 0, data: '', error: err.message })),
      fetchSpecialsAPI().catch(() => []),
    ]);

    const html = htmlResult.status === 200 ? htmlResult.data : '';
    
    // Parse deals from static HTML
    const deals = html ? parseDeals(html) : [];
    const promos = html ? parsePromotionalInfo(html) : [];

    // Build deal map from API specials
    const dealMap = new Map();
    const specialProductIds = new Set();
    for (const special of specials) {
      for (const pid of special.product_ids) {
        specialProductIds.add(String(pid));
        const existing = dealMap.get(String(pid));
        if (!existing || parseDiscount(special.discount_amount) > parseDiscount(existing.discount)) {
          dealMap.set(String(pid), {
            discount: special.discount_amount,
            description: special.description,
          });
        }
      }
    }

    const result = {
      timestamp: new Date().toISOString(),
      deals: deals,
      promos: promos,
      specials: specials,
      deal_map: dealMap,
      special_product_ids: specialProductIds,
      total_special_products: specialProductIds.size,
    };

    // Cache the result
    menuCache = result;
    menuCacheTime = Date.now();

    console.log(`[MenuScraper] Found ${deals.length} deals, ${specials.length} API specials covering ${specialProductIds.size} products`);
    
    return result;
  } catch (error) {
    console.error('[MenuScraper] Error scraping menu:', error.message);
    
    if (menuCache) {
      console.log('[MenuScraper] Returning stale cached data');
      return menuCache;
    }
    
    // Return minimal empty result instead of throwing
    return {
      timestamp: new Date().toISOString(),
      deals: [],
      promos: [],
      specials: [],
      deal_map: new Map(),
      special_product_ids: new Set(),
      total_special_products: 0,
    };
  }
}

/**
 * Check if a product has an active deal/special
 */
async function checkProductDeal(productId) {
  const menu = await scrapeMenu();
  const deal = menu.deal_map.get(String(productId));
  
  return {
    product_id: productId,
    has_deal: !!deal,
    discount: deal ? deal.discount : null,
    description: deal ? deal.description : null,
  };
}

/**
 * Get a summary of current deals for use in AI prompts
 */
async function getDealsSummary() {
  const menu = await scrapeMenu();
  return {
    deals: menu.deals.map(d => d.text),
    promos: menu.promos.map(p => p.text),
    specials_count: menu.specials.length,
    total_discounted_products: menu.total_special_products,
  };
}

/**
 * Build a context string for the AI prompt with live menu data
 * This is injected into Claude's prompt to improve recommendation accuracy
 */
async function buildMenuContext() {
  try {
    const menu = await scrapeMenu();
    
    let context = '';
    
    // Current deals from website
    if (menu.deals.length > 0) {
      context += `\nCURRENT DEALS & SPECIALS (live from website):\n`;
      menu.deals.forEach(deal => {
        context += `- ${deal.text}\n`;
      });
    }
    
    // Deal validity dates
    if (menu.promos.length > 0) {
      menu.promos.forEach(promo => {
        context += `- ${promo.text}\n`;
      });
    }
    
    // Specials from API with product counts
    if (menu.specials.length > 0) {
      context += `\nACTIVE SPECIALS (${menu.total_special_products} products on sale):\n`;
      menu.specials.forEach(special => {
        if (special.discount_amount && special.description) {
          context += `- ${special.discount_amount}: ${special.description} (${special.product_ids.length} products)\n`;
        }
      });
    }

    if (context) {
      context = `\nLIVE STORE DATA (fetched ${menu.timestamp}):` + context;
      context += `\nIMPORTANT: When recommending products that are part of a deal, mention the deal to the customer!\n`;
    }

    return context;
  } catch (error) {
    console.error('[MenuScraper] Failed to build menu context:', error.message);
    return '';
  }
}

/**
 * Annotate a list of products with deal information
 * Adds deal_info field to products that have active specials
 */
async function annotateProductsWithDeals(products) {
  try {
    const menu = await scrapeMenu();
    const dealMap = menu.deal_map;
    
    let annotated = 0;
    for (const product of products) {
      const pid = String(product.product_id || product.product?.product_id);
      const deal = dealMap.get(pid);
      if (deal) {
        product.deal_info = deal;
        annotated++;
      }
    }
    
    console.log(`[MenuScraper] Annotated ${annotated}/${products.length} products with deal info`);
    return products;
  } catch (error) {
    console.error('[MenuScraper] Deal annotation failed:', error.message);
    return products;
  }
}

module.exports = {
  scrapeMenu,
  checkProductDeal,
  getDealsSummary,
  buildMenuContext,
  annotateProductsWithDeals,
  buildDealMap,
  fetchSpecialsAPI,
  parseDeals,
  parsePromotionalInfo,
};