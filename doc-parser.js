/**
 * Jushi Document Parser
 * 
 * Parses the Jushi "New Patient Book" PDFs to extract cannabis education content
 * including strain information, terpene guides, effects, and patient education material.
 * 
 * Extracted text is cached and chunked for efficient use as AI context.
 * 
 * Source documents:
 *   - NEW-PATIENT-BOOK 8.pdf (General new patient guide)
 *     https://jushi.dash.app/sharing/type/asset/6594e6c9-3684-4b91-9b1d-8c61956d442b/08cf27c7-4e6b-46e7-9f18-8354d54195da
 *   
 *   - NEW-PATIENT-BOOK-PAMEDICAL 5.pdf (PA Medical specific)
 *     https://jushi.dash.app/sharing/type/asset/6594e6c9-3684-4b91-9b1d-8c61956d442b/da0738b8-001e-48f2-958f-9fd3f19f5366
 */

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, 'docs');

// Document registry
const DOCUMENTS = [
  {
    id: 'new-patient-book',
    filename: 'new-patient-book.pdf',
    title: 'New Patient Book',
    description: 'Jushi comprehensive new patient cannabis education guide covering strains, terpenes, consumption methods, effects, and product types.',
    sourceUrl: 'https://jushi.dash.app/sharing/type/asset/6594e6c9-3684-4b91-9b1d-8c61956d442b/08cf27c7-4e6b-46e7-9f18-8354d54195da',
  },
  {
    id: 'new-patient-book-pa-medical',
    filename: 'new-patient-book-pa-medical.pdf',
    title: 'New Patient Book - PA Medical',
    description: 'Pennsylvania-specific medical cannabis patient guide with PA regulations, qualifying conditions, and dispensary information.',
    sourceUrl: 'https://jushi.dash.app/sharing/type/asset/6594e6c9-3684-4b91-9b1d-8c61956d442b/da0738b8-001e-48f2-958f-9fd3f19f5366',
  },
];

// Cache for parsed document text
const documentCache = new Map();

/**
 * Parse a PDF file and return its text content
 */
async function parsePDF(filePath) {
  const { PDFParse } = require('pdf-parse');
  const dataBuffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: dataBuffer });
  const result = await parser.getText();
  return {
    text: result.text,
    numPages: result.total,
  };
}

/**
 * Load and cache a document by ID
 */
async function loadDocument(docId) {
  // Check cache
  if (documentCache.has(docId)) {
    return documentCache.get(docId);
  }

  const docInfo = DOCUMENTS.find(d => d.id === docId);
  if (!docInfo) {
    throw new Error(`Unknown document ID: ${docId}`);
  }

  const filePath = path.join(DOCS_DIR, docInfo.filename);
  
  if (!fs.existsSync(filePath)) {
    console.warn(`[DocParser] PDF not found: ${filePath}`);
    console.warn(`[DocParser] Download from: ${docInfo.sourceUrl}`);
    return null;
  }

  console.log(`[DocParser] Parsing ${docInfo.filename}...`);
  
  try {
    const parsed = await parsePDF(filePath);
    
    // Clean the text
    const cleanedText = parsed.text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\f/g, '\n---PAGE BREAK---\n')
      .trim();

    const result = {
      id: docInfo.id,
      title: docInfo.title,
      description: docInfo.description,
      sourceUrl: docInfo.sourceUrl,
      numPages: parsed.numPages,
      textLength: cleanedText.length,
      text: cleanedText,
      chunks: chunkText(cleanedText, 4000),
    };

    documentCache.set(docId, result);
    console.log(`[DocParser] Parsed ${docInfo.filename}: ${parsed.numPages} pages, ${cleanedText.length} chars, ${result.chunks.length} chunks`);
    
    return result;
  } catch (error) {
    console.error(`[DocParser] Error parsing ${docInfo.filename}:`, error.message);
    return null;
  }
}

/**
 * Split text into chunks of roughly `maxChars` size, breaking at paragraph boundaries
 */
function chunkText(text, maxChars = 4000) {
  const paragraphs = text.split(/\n\n+/);
  const chunks = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if (currentChunk.length + para.length + 2 > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    currentChunk += para + '\n\n';
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Load all available documents
 */
async function loadAllDocuments() {
  const results = {};
  
  for (const doc of DOCUMENTS) {
    const filePath = path.join(DOCS_DIR, doc.filename);
    if (fs.existsSync(filePath)) {
      results[doc.id] = await loadDocument(doc.id);
    } else {
      console.warn(`[DocParser] Missing: ${doc.filename} — download from ${doc.sourceUrl}`);
      results[doc.id] = null;
    }
  }
  
  return results;
}

/**
 * Search documents for content related to a query
 * Returns relevant chunks based on keyword matching
 */
async function searchDocuments(query, maxChunks = 5) {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const results = [];

  for (const doc of DOCUMENTS) {
    const parsed = await loadDocument(doc.id);
    if (!parsed) continue;

    for (let i = 0; i < parsed.chunks.length; i++) {
      const chunk = parsed.chunks[i];
      const chunkLower = chunk.toLowerCase();
      
      // Score based on how many query words appear
      let score = 0;
      for (const word of queryWords) {
        const occurrences = (chunkLower.match(new RegExp(word, 'g')) || []).length;
        score += occurrences;
      }
      
      if (score > 0) {
        results.push({
          doc_id: doc.id,
          doc_title: doc.title,
          chunk_index: i,
          score,
          text: chunk,
        });
      }
    }
  }

  // Sort by score descending and return top matches
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxChunks);
}

/**
 * Get a compact summary of what documents are available
 */
function getDocumentStatus() {
  return DOCUMENTS.map(doc => {
    const filePath = path.join(DOCS_DIR, doc.filename);
    const exists = fs.existsSync(filePath);
    const cached = documentCache.has(doc.id);
    const cacheInfo = cached ? documentCache.get(doc.id) : null;
    
    return {
      id: doc.id,
      title: doc.title,
      filename: doc.filename,
      available: exists,
      cached: cached,
      pages: cacheInfo?.numPages || null,
      chunks: cacheInfo?.chunks?.length || null,
      sourceUrl: doc.sourceUrl,
    };
  });
}

/**
 * Build AI-ready context from documents relevant to a query
 * This gets injected into the AI prompt alongside live menu data
 */
async function buildDocumentContext(query) {
  try {
    const relevant = await searchDocuments(query, 3);
    
    if (relevant.length === 0) return '';

    let context = '\nRELEVANT PATIENT EDUCATION (from Jushi guides):\n';
    
    for (const result of relevant) {
      // Truncate each chunk to ~1500 chars to keep context manageable
      const text = result.text.length > 1500 
        ? result.text.substring(0, 1500) + '...'
        : result.text;
      context += `\n[From ${result.doc_title}]:\n${text}\n`;
    }
    
    context += '\nUse this education material to provide more informed recommendations, but prioritize the actual product inventory list.\n';
    
    return context;
  } catch (error) {
    console.error('[DocParser] Error building document context:', error.message);
    return '';
  }
}

module.exports = {
  DOCUMENTS,
  loadDocument,
  loadAllDocuments,
  searchDocuments,
  getDocumentStatus,
  buildDocumentContext,
  chunkText,
};
