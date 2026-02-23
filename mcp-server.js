#!/usr/bin/env node

/**
 * Beyond Hello Menu MCP Server
 * 
 * A Model Context Protocol server that provides tools for examining
 * the Beyond Hello Bristol dispensary menu in real-time.
 * 
 * Tools:
 *   - get_current_menu: Full menu with products, deals, stock levels
 *   - get_deals: Current deals and specials
 *   - check_availability: Check if a specific product is in stock
 *   - get_featured: Get featured/popular/new products
 *   - get_menu_context: Get a compact context string for AI prompts
 * 
 * Usage:
 *   npx node mcp-server.js                    (stdio transport)
 *   npx node mcp-server.js --http PORT        (HTTP/SSE transport)
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

const {
  scrapeMenu,
  checkProductDeal,
  getDealsSummary,
  buildMenuContext,
  annotateProductsWithDeals,
  fetchSpecialsAPI,
} = require('./menu-scraper');

const {
  loadDocument,
  loadAllDocuments,
  searchDocuments,
  getDocumentStatus,
  buildDocumentContext,
} = require('./doc-parser');

// Create the MCP server
const server = new Server(
  {
    name: 'beyond-hello-menu',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ===== TOOL DEFINITIONS =====

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_current_deals',
        description: 
          'Fetches current deals, specials, and promotions at Beyond Hello Bristol dispensary. Returns deal text from the website and product-level specials from the iHeartJane API. Use this to know what discounts are active.',
        inputSchema: {
          type: 'object',
          properties: {
            force_refresh: {
              type: 'boolean',
              description: 'Force a fresh fetch instead of using cached data (default: false)',
              default: false,
            },
          },
          required: [],
        },
      },
      {
        name: 'check_product_deal',
        description:
          'Check if a specific product has an active deal or special at Beyond Hello Bristol. Returns discount info if the product is part of a current promotion.',
        inputSchema: {
          type: 'object',
          properties: {
            product_id: {
              type: 'string',
              description: 'The product ID to check for deals',
            },
          },
          required: ['product_id'],
        },
      },
      {
        name: 'get_specials',
        description:
          'Get detailed specials from the iHeartJane API including which product IDs are included in each special. Returns discount amounts and product counts per special.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'get_menu_context',
        description:
          'Get a compact summary of the live menu state for use as AI context. Includes current deals, active specials, and promotional info in a concise text format ready to inject into an AI prompt.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'get_deals_summary',
        description:
          'Get a high-level summary of current deals: number of specials, total discounted products, deal texts, and promotional info.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'search_patient_guides',
        description:
          'Search the Jushi new patient education guides for information about cannabis strains, terpenes, consumption methods, effects, qualifying conditions, and general patient education. Returns relevant excerpts from the PDF documents.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query — e.g. "terpene myrcene effects", "indica vs sativa", "vaporization methods", "qualifying conditions pennsylvania"',
            },
            max_results: {
              type: 'number',
              description: 'Maximum number of text chunks to return (default: 5)',
              default: 5,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_document_info',
        description:
          'Get status information about the loaded Jushi patient education documents — which PDFs are available, page counts, and chunk counts.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'get_document_section',
        description:
          'Read a specific section (chunk) from a patient guide document by document ID and chunk index. Use search_patient_guides first to find relevant chunks, then use this to read adjacent chunks for more context.',
        inputSchema: {
          type: 'object',
          properties: {
            document_id: {
              type: 'string',
              description: 'The document ID: "new-patient-book" or "new-patient-book-pa-medical"',
            },
            chunk_index: {
              type: 'number',
              description: 'The chunk index to read (0-based). Use search_patient_guides to discover chunk indices.',
            },
          },
          required: ['document_id', 'chunk_index'],
        },
      },
    ],
  };
});

// ===== TOOL HANDLERS =====

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_current_deals': {
        const menu = await scrapeMenu(args?.force_refresh || false);

        const result = {
          timestamp: menu.timestamp,
          deals_from_website: menu.deals.map(d => d.text),
          promotional_info: menu.promos.map(p => p.text),
          api_specials: menu.specials.map(s => ({
            discount: s.discount_amount,
            description: s.description,
            products_count: s.product_ids.length,
          })),
          total_products_on_sale: menu.total_special_products,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'check_product_deal': {
        if (!args?.product_id) {
          return {
            content: [{ type: 'text', text: 'Please provide a product_id to check.' }],
            isError: true,
          };
        }
        
        const dealInfo = await checkProductDeal(args.product_id);
        return {
          content: [{ type: 'text', text: JSON.stringify(dealInfo, null, 2) }],
        };
      }

      case 'get_specials': {
        const specials = await fetchSpecialsAPI();
        
        const result = {
          timestamp: new Date().toISOString(),
          total_specials: specials.length,
          specials: specials.map(s => ({
            id: s.id,
            discount: s.discount_amount,
            description: s.description,
            product_count: s.product_ids.length,
            sample_product_ids: s.product_ids.slice(0, 10),
          })),
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'get_menu_context': {
        const context = await buildMenuContext();
        return {
          content: [{ type: 'text', text: context || 'Unable to fetch live menu data at this time.' }],
        };
      }

      case 'get_deals_summary': {
        const summary = await getDealsSummary();
        return {
          content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
        };
      }

      case 'search_patient_guides': {
        if (!args?.query) {
          return {
            content: [{ type: 'text', text: 'Please provide a search query.' }],
            isError: true,
          };
        }
        const maxResults = args?.max_results || 5;
        const results = await searchDocuments(args.query, maxResults);
        
        if (results.length === 0) {
          const status = getDocumentStatus();
          const available = status.filter(d => d.available);
          if (available.length === 0) {
            return {
              content: [{ type: 'text', text: 'No patient guide documents are loaded. Place PDF files in the docs/ directory.' }],
            };
          }
          return {
            content: [{ type: 'text', text: `No results found for "${args.query}" in ${available.length} loaded document(s).` }],
          };
        }

        const formatted = results.map((r, i) => 
          `--- Result ${i + 1} (score: ${r.score}, from: ${r.doc_title}, chunk: ${r.chunk_index}) ---\n${r.text}`
        ).join('\n\n');

        return {
          content: [{ type: 'text', text: formatted }],
        };
      }

      case 'get_document_info': {
        const status = getDocumentStatus();
        return {
          content: [{ type: 'text', text: JSON.stringify(status, null, 2) }],
        };
      }

      case 'get_document_section': {
        if (!args?.document_id) {
          return {
            content: [{ type: 'text', text: 'Please provide a document_id.' }],
            isError: true,
          };
        }
        
        const doc = await loadDocument(args.document_id);
        if (!doc) {
          return {
            content: [{ type: 'text', text: `Document "${args.document_id}" is not available. Check get_document_info for status.` }],
            isError: true,
          };
        }

        const chunkIdx = args?.chunk_index ?? 0;
        if (chunkIdx < 0 || chunkIdx >= doc.chunks.length) {
          return {
            content: [{ type: 'text', text: `Chunk index ${chunkIdx} is out of range. Document has ${doc.chunks.length} chunks (0-${doc.chunks.length - 1}).` }],
            isError: true,
          };
        }

        return {
          content: [{ 
            type: 'text', 
            text: `[${doc.title}] Chunk ${chunkIdx} of ${doc.chunks.length - 1}:\n\n${doc.chunks[chunkIdx]}` 
          }],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error executing ${name}: ${error.message}` }],
      isError: true,
    };
  }
});

// ===== RESOURCE DEFINITIONS =====

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'beyond-hello://bristol/deals',
        name: 'Beyond Hello Bristol Deals',
        description: 'Current deals, specials, and promotions',
        mimeType: 'application/json',
      },
      {
        uri: 'beyond-hello://bristol/context',
        name: 'Beyond Hello Bristol AI Context',
        description: 'Compact context string for AI prompts with live store data',
        mimeType: 'text/plain',
      },
      {
        uri: 'jushi://docs/new-patient-book',
        name: 'Jushi New Patient Book',
        description: 'Cannabis education guide: strains, terpenes, consumption methods, effects',
        mimeType: 'text/plain',
      },
      {
        uri: 'jushi://docs/new-patient-book-pa-medical',
        name: 'Jushi New Patient Book - PA Medical',
        description: 'Pennsylvania medical cannabis patient guide: regulations, qualifying conditions',
        mimeType: 'text/plain',
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case 'beyond-hello://bristol/deals': {
      const menu = await scrapeMenu();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              timestamp: menu.timestamp,
              deals: menu.deals,
              promos: menu.promos,
              specials: menu.specials,
              total_products_on_sale: menu.total_special_products,
            }, null, 2),
          },
        ],
      };
    }

    case 'beyond-hello://bristol/context': {
      const context = await buildMenuContext();
      return {
        contents: [
          {
            uri,
            mimeType: 'text/plain',
            text: context || 'No live menu data available.',
          },
        ],
      };
    }

    case 'jushi://docs/new-patient-book':
    case 'jushi://docs/new-patient-book-pa-medical': {
      const docId = uri.replace('jushi://docs/', '');
      const doc = await loadDocument(docId);
      if (!doc) {
        return {
          contents: [
            {
              uri,
              mimeType: 'text/plain',
              text: `Document not available. Place the PDF in the docs/ directory.`,
            },
          ],
        };
      }
      return {
        contents: [
          {
            uri,
            mimeType: 'text/plain',
            text: doc.text,
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// ===== START SERVER =====

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP] Beyond Hello Menu server running on stdio');
}

main().catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});
