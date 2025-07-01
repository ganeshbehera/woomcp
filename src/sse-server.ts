#!/usr/bin/env node
import axios from "axios";
import express, { Request, Response } from "express";
import cors from "cors";
import { createInterface } from "readline";
import { WooMetaData } from "./types";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface WordPressError {
  message: string;
  code?: string;
}

type AxiosError = {
  response?: {
    data?: WordPressError;
  };
  message: string;
};

const isAxiosError = (error: unknown): error is AxiosError => {
  return (
    error !== null &&
    typeof error === "object" &&
    "message" in error &&
    (error as any).response !== undefined
  );
};

// Environment variables
const DEFAULT_SITE_URL = process.env.WORDPRESS_SITE_URL || "";
const DEFAULT_USERNAME = process.env.WORDPRESS_USERNAME || "";
const DEFAULT_PASSWORD = process.env.WORDPRESS_PASSWORD || "";
const DEFAULT_CONSUMER_KEY = process.env.WOOCOMMERCE_CONSUMER_KEY || "";
const DEFAULT_CONSUMER_SECRET = process.env.WOOCOMMERCE_CONSUMER_SECRET || "";
const HTTP_PORT = process.env.PORT || process.env.HTTP_PORT || 3000;
const MODE = process.env.SERVER_MODE || "http"; // "mcp", "http", or "hybrid" - default to http for cloud deployments

// Store SSE connections
const sseConnections = new Map<string, express.Response[]>();

// WooCommerce API function (reusing existing logic)
async function handleWooCommerceRequest(method: string, params: any): Promise<any> {
  try {
    const siteUrl = params.siteUrl || DEFAULT_SITE_URL;
    const username = params.username || DEFAULT_USERNAME;
    const password = params.password || DEFAULT_PASSWORD;
    const consumerKey = params.consumerKey || DEFAULT_CONSUMER_KEY;
    const consumerSecret = params.consumerSecret || DEFAULT_CONSUMER_SECRET;

    if (!siteUrl) {
      throw new Error(
        "WordPress site URL not provided in environment variables or request parameters"
      );
    }

    // WooCommerce client setup
    const client = axios.create({
      baseURL: `${siteUrl}/wp-json/wc/v3`,
      auth: {
        username: consumerKey,
        password: consumerSecret,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    // WordPress client setup for WP-specific methods
    const wpClient = axios.create({
      baseURL: `${siteUrl}/wp-json/wp/v2`,
      auth: username && password ? {
        username: username,
        password: password,
      } : undefined,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Handle different WooCommerce methods
    switch (method) {
      case "get_products":
        const productsParams = new URLSearchParams();
        if (params.perPage) productsParams.append("per_page", params.perPage);
        if (params.page) productsParams.append("page", params.page);
        if (params.filters) {
          Object.entries(params.filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              productsParams.append(key, String(value));
            }
          });
        }
        const productsResponse = await client.get(`/products?${productsParams}`);
        return productsResponse.data;

      case "get_product":
        if (!params.productId) {
          throw new Error("Product ID is required");
        }
        const productResponse = await client.get(`/products/${params.productId}`);
        return productResponse.data;

      case "create_product":
        if (!params.productData) {
          throw new Error("Product data is required");
        }
        const createProductResponse = await client.post("/products", params.productData);
        
        // Broadcast new product via SSE
        broadcastSSE("products", {
          type: "product_created",
          data: createProductResponse.data,
          timestamp: new Date().toISOString()
        });
        
        return createProductResponse.data;

      case "update_product":
        if (!params.productId) {
          throw new Error("Product ID is required");
        }
        if (!params.productData) {
          throw new Error("Product data is required");
        }
        const updateProductResponse = await client.put(`/products/${params.productId}`, params.productData);
        
        // Broadcast product update via SSE
        broadcastSSE("products", {
          type: "product_updated",
          data: updateProductResponse.data,
          timestamp: new Date().toISOString()
        });
        
        return updateProductResponse.data;

      case "get_orders":
        const ordersParams = new URLSearchParams();
        if (params.perPage) ordersParams.append("per_page", params.perPage);
        if (params.page) ordersParams.append("page", params.page);
        if (params.filters) {
          Object.entries(params.filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              ordersParams.append(key, String(value));
            }
          });
        }
        const ordersResponse = await client.get(`/orders?${ordersParams}`);
        return ordersResponse.data;

      case "get_order":
        if (!params.orderId) {
          throw new Error("Order ID is required");
        }
        const orderResponse = await client.get(`/orders/${params.orderId}`);
        return orderResponse.data;

      case "create_order":
        if (!params.orderData) {
          throw new Error("Order data is required");
        }
        const createOrderResponse = await client.post("/orders", params.orderData);
        
        // Broadcast new order via SSE
        broadcastSSE("orders", {
          type: "order_created",
          data: createOrderResponse.data,
          timestamp: new Date().toISOString()
        });
        
        return createOrderResponse.data;

      case "update_order":
        if (!params.orderId) {
          throw new Error("Order ID is required");
        }
        if (!params.orderData) {
          throw new Error("Order data is required");
        }
        const updateOrderResponse = await client.put(`/orders/${params.orderId}`, params.orderData);
        
        // Broadcast order update via SSE
        broadcastSSE("orders", {
          type: "order_updated",
          data: updateOrderResponse.data,
          timestamp: new Date().toISOString()
        });
        
        return updateOrderResponse.data;

      case "get_customers":
        const customersParams = new URLSearchParams();
        if (params.perPage) customersParams.append("per_page", params.perPage);
        if (params.page) customersParams.append("page", params.page);
        const customersResponse = await client.get(`/customers?${customersParams}`);
        return customersResponse.data;

      case "get_system_status":
        const statusResponse = await client.get("/system_status");
        return statusResponse.data;

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  } catch (error: unknown) {
    if (isAxiosError(error)) {
      throw new Error(
        `API error: ${error.response?.data?.message || error.message}`
      );
    }
    throw error;
  }
}

// SSE Broadcasting function
function broadcastSSE(channel: string, data: any) {
  const connections = sseConnections.get(channel);
  if (connections) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    connections.forEach((res, index) => {
      try {
        res.write(message);
      } catch (error) {
        // Remove disconnected connections
        connections.splice(index, 1);
      }
    });
  }
}

// HTTP Server with SSE
function startHttpServer() {
  const app = express();
  
  app.use(cors({
    origin: true,
    credentials: true
  }));
  app.use(express.json());

  // Health check endpoint
  app.get("/health", (req: Request, res: Response) => {
    res.json({ 
      status: "healthy", 
      server: "WooCommerce MCP/SSE Server",
      timestamp: new Date().toISOString()
    });
  });

  // SSE endpoint for real-time updates
  app.get("/events/:channel", (req: Request, res: Response) => {
    const channel = req.params.channel;
    
    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control"
    });

    // Add connection to the channel
    if (!sseConnections.has(channel)) {
      sseConnections.set(channel, []);
    }
    sseConnections.get(channel)!.push(res);

    // Send initial connection message
    res.write(`data: ${JSON.stringify({
      type: "connected",
      channel: channel,
      timestamp: new Date().toISOString()
    })}\n\n`);

    // Handle client disconnect
    req.on("close", () => {
      const connections = sseConnections.get(channel);
      if (connections) {
        const index = connections.indexOf(res);
        if (index !== -1) {
          connections.splice(index, 1);
        }
      }
    });
  });

  // REST API endpoints
  app.post("/api/woocommerce", async (req: Request, res: Response) => {
    try {
      const { method, params } = req.body;
      const result = await handleWooCommerceRequest(method, params || {});
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Polling endpoint for real-time updates
  app.get("/api/poll/:resource", async (req: Request, res: Response) => {
    try {
      const resource = req.params.resource;
      const lastUpdate = req.query.since as string;
      
      let method = "";
      let params: any = {};
      
      switch (resource) {
        case "orders":
          method = "get_orders";
          params = { 
            perPage: 10, 
            page: 1,
            filters: lastUpdate ? { modified_after: lastUpdate } : {}
          };
          break;
        case "products":
          method = "get_products";
          params = { 
            perPage: 10, 
            page: 1,
            filters: lastUpdate ? { modified_after: lastUpdate } : {}
          };
          break;
        default:
          throw new Error(`Unknown resource: ${resource}`);
      }

      const result = await handleWooCommerceRequest(method, params);
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Start server
  const port = typeof HTTP_PORT === 'string' ? parseInt(HTTP_PORT) : HTTP_PORT;
  app.listen(port, "0.0.0.0", () => {
    const domain = process.env.EASYPANEL_DOMAIN || `http://localhost:${port}`;
    console.error(`WooCommerce HTTP/SSE Server running on port ${port}`);
    console.error(`SSE endpoints available at: ${domain}/events/{channel}`);
    console.error(`API endpoint available at: ${domain}/api/woocommerce`);
    console.error(`Health check: ${domain}/health`);
  });

  return app;
}

// MCP Server (original stdin/stdout functionality)
function startMcpServer() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on("line", async (line) => {
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(line);
      if (request.jsonrpc !== "2.0") {
        throw new Error("Invalid JSON-RPC version");
      }
    } catch (error) {
      console.log(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32700,
            message: "Parse error",
            data: error instanceof Error ? error.message : String(error),
          },
        })
      );
      return;
    }

    try {
      const result = await handleWooCommerceRequest(
        request.method,
        request.params
      );
      console.log(
        JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          result,
        })
      );
    } catch (error) {
      console.log(
        JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32000,
            message: error instanceof Error ? error.message : String(error),
          },
        })
      );
    }
  });

  process.on("SIGINT", () => {
    rl.close();
    process.exit(0);
  });

  console.error("WooCommerce MCP server running on stdin/stdout");
}

// Main server startup
function main() {
  console.error(`Starting WooCommerce server in ${MODE} mode...`);
  
  switch (MODE) {
    case "http":
      startHttpServer();
      break;
    case "mcp":
      startMcpServer();
      break;
    case "hybrid":
    default:
      // Start both MCP and HTTP servers
      if (process.stdin.isTTY) {
        // If running in terminal (not piped), start HTTP server
        startHttpServer();
      } else {
        // If stdin is piped (MCP mode), start MCP server
        startMcpServer();
      }
      break;
  }
}

// Start the server
main(); 