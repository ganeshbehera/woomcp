#!/usr/bin/env node
import axios from "axios";
import express from "express";
import cors from "cors";
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

// Get WordPress credentials from environment variables
const DEFAULT_SITE_URL = process.env.WORDPRESS_SITE_URL || "";
const DEFAULT_USERNAME = process.env.WORDPRESS_USERNAME || "";
const DEFAULT_PASSWORD = process.env.WORDPRESS_PASSWORD || "";
const DEFAULT_CONSUMER_KEY = process.env.WOOCOMMERCE_CONSUMER_KEY || "";
const DEFAULT_CONSUMER_SECRET = process.env.WOOCOMMERCE_CONSUMER_SECRET || "";

// MCP Server Capabilities - Complete tool definitions from README
const MCP_CAPABILITIES = {
  experimental: {},
  prompts: {},
  resources: {},
  tools: {
    // === WordPress Content Management ===
    create_post: { description: "Create a new WordPress post" },
    get_posts: { description: "Retrieve WordPress posts" },
    update_post: { description: "Update an existing WordPress post" },
    get_post_meta: { description: "Get post metadata" },
    update_post_meta: { description: "Update post metadata" },
    create_post_meta: { description: "Create post metadata" },
    delete_post_meta: { description: "Delete post metadata" },
    
    // === WooCommerce Products ===
    get_products: { 
      description: "Retrieve a list of products",
      inputSchema: {
        type: "object",
        properties: {
          perPage: { type: "number", description: "Number of products to retrieve (max 100)" },
          page: { type: "number", description: "Page number" },
          search: { type: "string", description: "Search term" },
          category: { type: "string", description: "Product category ID" },
          tag: { type: "string", description: "Product tag ID" },
          status: { type: "string", enum: ["draft", "pending", "private", "publish"] },
          type: { type: "string", enum: ["simple", "grouped", "external", "variable"] },
          sku: { type: "string", description: "Product SKU" },
          featured: { type: "boolean", description: "Limit to featured products" },
          siteUrl: { type: "string", description: "WordPress site URL" },
          consumerKey: { type: "string", description: "WooCommerce consumer key" },
          consumerSecret: { type: "string", description: "WooCommerce consumer secret" }
        }
      }
    },
    get_product: { 
      description: "Get a single product by ID",
      inputSchema: {
        type: "object",
        properties: {
          productId: { type: "number", description: "Product ID", required: true },
          siteUrl: { type: "string", description: "WordPress site URL" },
          consumerKey: { type: "string", description: "WooCommerce consumer key" },
          consumerSecret: { type: "string", description: "WooCommerce consumer secret" }
        },
        required: ["productId"]
      }
    },
    create_product: { 
      description: "Create a new product",
      inputSchema: {
        type: "object",
        properties: {
          productData: {
            type: "object",
            description: "Product data object",
            properties: {
              name: { type: "string", description: "Product name" },
              type: { type: "string", enum: ["simple", "grouped", "external", "variable"], description: "Product type" },
              regular_price: { type: "string", description: "Product regular price" },
              sale_price: { type: "string", description: "Product sale price" },
              description: { type: "string", description: "Product description" },
              short_description: { type: "string", description: "Product short description" },
              sku: { type: "string", description: "Product SKU" },
              manage_stock: { type: "boolean", description: "Enable stock management" },
              stock_quantity: { type: "number", description: "Stock quantity" },
              stock_status: { type: "string", enum: ["instock", "outofstock", "onbackorder"], description: "Stock status" },
              weight: { type: "string", description: "Product weight" },
              dimensions: {
                type: "object",
                properties: {
                  length: { type: "string", description: "Product length" },
                  width: { type: "string", description: "Product width" },
                  height: { type: "string", description: "Product height" }
                }
              },
              categories: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "number", description: "Category ID" }
                  }
                },
                description: "Product categories"
              },
              tags: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "number", description: "Tag ID" }
                  }
                },
                description: "Product tags"
              },
              images: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    src: { type: "string", description: "Image URL" },
                    alt: { type: "string", description: "Image alt text" }
                  }
                },
                description: "Product images"
              },
              attributes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "number", description: "Attribute ID" },
                    name: { type: "string", description: "Attribute name" },
                    options: { type: "array", items: { type: "string" }, description: "Attribute options" }
                  }
                },
                description: "Product attributes"
              }
            },
            required: ["name", "type"]
          },
          siteUrl: { type: "string", description: "WordPress site URL" },
          consumerKey: { type: "string", description: "WooCommerce consumer key" },
          consumerSecret: { type: "string", description: "WooCommerce consumer secret" }
        },
        required: ["productData"]
      }
    },
    update_product: { 
      description: "Update an existing product",
      inputSchema: {
        type: "object",
        properties: {
          productId: { type: "number", description: "Product ID to update", required: true },
          productData: {
            type: "object",
            description: "Product data to update",
            properties: {
              name: { type: "string", description: "Product name" },
              type: { type: "string", enum: ["simple", "grouped", "external", "variable"], description: "Product type" },
              regular_price: { type: "string", description: "Product regular price" },
              sale_price: { type: "string", description: "Product sale price" },
              description: { type: "string", description: "Product description" },
              short_description: { type: "string", description: "Product short description" },
              sku: { type: "string", description: "Product SKU" },
              stock_status: { type: "string", enum: ["instock", "outofstock", "onbackorder"], description: "Stock status" }
            }
          },
          siteUrl: { type: "string", description: "WordPress site URL" },
          consumerKey: { type: "string", description: "WooCommerce consumer key" },
          consumerSecret: { type: "string", description: "WooCommerce consumer secret" }
        },
        required: ["productId", "productData"]
      }
    },
    delete_product: { 
      description: "Delete a product",
      inputSchema: {
        type: "object",
        properties: {
          productId: { type: "number", description: "Product ID to delete", required: true },
          force: { type: "boolean", description: "Whether to bypass trash and force deletion" },
          siteUrl: { type: "string", description: "WordPress site URL" },
          consumerKey: { type: "string", description: "WooCommerce consumer key" },
          consumerSecret: { type: "string", description: "WooCommerce consumer secret" }
        },
        required: ["productId"]
      }
    },
    get_product_meta: { description: "Get product metadata" },
    create_product_meta: { description: "Create/update product metadata" },
    update_product_meta: { description: "Update product metadata" },
    delete_product_meta: { description: "Delete product metadata" },
    
    // === Product Categories ===
    get_product_categories: { description: "Retrieve product categories" },
    get_product_category: { description: "Get a single product category" },
    create_product_category: { description: "Create a new product category" },
    update_product_category: { description: "Update a product category" },
    delete_product_category: { description: "Delete a product category" },
    
    // === Product Tags ===
    get_product_tags: { description: "Retrieve product tags" },
    get_product_tag: { description: "Get a single product tag" },
    create_product_tag: { description: "Create a new product tag" },
    update_product_tag: { description: "Update a product tag" },
    delete_product_tag: { description: "Delete a product tag" },
    
    // === Product Attributes ===
    get_product_attributes: { description: "Retrieve product attributes" },
    get_product_attribute: { description: "Get a single product attribute" },
    create_product_attribute: { description: "Create a new product attribute" },
    update_product_attribute: { description: "Update a product attribute" },
    delete_product_attribute: { description: "Delete a product attribute" },
    get_attribute_terms: { description: "Retrieve attribute terms" },
    get_attribute_term: { description: "Get a single attribute term" },
    create_attribute_term: { description: "Create a new attribute term" },
    update_attribute_term: { description: "Update an attribute term" },
    delete_attribute_term: { description: "Delete an attribute term" },
    
    // === Product Variations ===
    get_product_variations: { description: "Retrieve product variations" },
    get_product_variation: { description: "Get a single product variation" },
    create_product_variation: { description: "Create a new product variation" },
    update_product_variation: { description: "Update a product variation" },
    delete_product_variation: { description: "Delete a product variation" },
    
    // === Product Reviews ===
    get_product_reviews: { description: "Retrieve product reviews" },
    get_product_review: { description: "Get a single product review" },
    create_product_review: { description: "Create a new product review" },
    update_product_review: { description: "Update a product review" },
    delete_product_review: { description: "Delete a product review" },
    
    // === WooCommerce Orders ===
    get_orders: { 
      description: "Retrieve a list of orders",
      inputSchema: {
        type: "object",
        properties: {
          perPage: { type: "number", description: "Number of orders to retrieve (max 100)" },
          page: { type: "number", description: "Page number" },
          search: { type: "string", description: "Search term" },
          status: { type: "string", enum: ["pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed", "trash"] },
          customer: { type: "number", description: "Customer ID" },
          product: { type: "number", description: "Product ID" },
          after: { type: "string", description: "Limit to orders created after date (ISO8601)" },
          before: { type: "string", description: "Limit to orders created before date (ISO8601)" },
          siteUrl: { type: "string", description: "WordPress site URL" },
          consumerKey: { type: "string", description: "WooCommerce consumer key" },
          consumerSecret: { type: "string", description: "WooCommerce consumer secret" }
        }
      }
    },
    get_order: { 
      description: "Get a single order by ID",
      inputSchema: {
        type: "object",
        properties: {
          orderId: { type: "number", description: "Order ID", required: true },
          siteUrl: { type: "string", description: "WordPress site URL" },
          consumerKey: { type: "string", description: "WooCommerce consumer key" },
          consumerSecret: { type: "string", description: "WooCommerce consumer secret" }
        },
        required: ["orderId"]
      }
    },
    create_order: { 
      description: "Create a new order",
      inputSchema: {
        type: "object",
        properties: {
          orderData: {
            type: "object",
            description: "Order data object",
            properties: {
              status: { type: "string", enum: ["pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed"], description: "Order status" },
              customer_id: { type: "number", description: "Customer ID" },
              billing: {
                type: "object",
                properties: {
                  first_name: { type: "string", description: "First name" },
                  last_name: { type: "string", description: "Last name" },
                  company: { type: "string", description: "Company name" },
                  address_1: { type: "string", description: "Address line 1" },
                  address_2: { type: "string", description: "Address line 2" },
                  city: { type: "string", description: "City" },
                  state: { type: "string", description: "State" },
                  postcode: { type: "string", description: "Postal code" },
                  country: { type: "string", description: "Country code" },
                  email: { type: "string", description: "Email address" },
                  phone: { type: "string", description: "Phone number" }
                }
              },
              shipping: {
                type: "object",
                properties: {
                  first_name: { type: "string", description: "First name" },
                  last_name: { type: "string", description: "Last name" },
                  company: { type: "string", description: "Company name" },
                  address_1: { type: "string", description: "Address line 1" },
                  address_2: { type: "string", description: "Address line 2" },
                  city: { type: "string", description: "City" },
                  state: { type: "string", description: "State" },
                  postcode: { type: "string", description: "Postal code" },
                  country: { type: "string", description: "Country code" }
                }
              },
              line_items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    product_id: { type: "number", description: "Product ID" },
                    variation_id: { type: "number", description: "Variation ID" },
                    quantity: { type: "number", description: "Quantity" }
                  },
                  required: ["product_id", "quantity"]
                },
                description: "Order line items"
              },
              shipping_lines: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    method_id: { type: "string", description: "Shipping method ID" },
                    method_title: { type: "string", description: "Shipping method title" },
                    total: { type: "string", description: "Shipping total" }
                  }
                },
                description: "Shipping lines"
              }
            }
          },
          siteUrl: { type: "string", description: "WordPress site URL" },
          consumerKey: { type: "string", description: "WooCommerce consumer key" },
          consumerSecret: { type: "string", description: "WooCommerce consumer secret" }
        },
        required: ["orderData"]
      }
    },
    update_order: { 
      description: "Update an existing order",
      inputSchema: {
        type: "object",
        properties: {
          orderId: { type: "number", description: "Order ID to update", required: true },
          orderData: {
            type: "object",
            description: "Order data to update",
            properties: {
              status: { type: "string", enum: ["pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed"], description: "Order status" },
              customer_note: { type: "string", description: "Customer note" }
            }
          },
          siteUrl: { type: "string", description: "WordPress site URL" },
          consumerKey: { type: "string", description: "WooCommerce consumer key" },
          consumerSecret: { type: "string", description: "WooCommerce consumer secret" }
        },
        required: ["orderId", "orderData"]
      }
    },
    delete_order: { 
      description: "Delete an order",
      inputSchema: {
        type: "object",
        properties: {
          orderId: { type: "number", description: "Order ID to delete", required: true },
          force: { type: "boolean", description: "Whether to bypass trash and force deletion" },
          siteUrl: { type: "string", description: "WordPress site URL" },
          consumerKey: { type: "string", description: "WooCommerce consumer key" },
          consumerSecret: { type: "string", description: "WooCommerce consumer secret" }
        },
        required: ["orderId"]
      }
    },
    get_order_meta: { description: "Get order metadata" },
    create_order_meta: { description: "Create/update order metadata" },
    update_order_meta: { description: "Update order metadata" },
    delete_order_meta: { description: "Delete order metadata" },
    
    // === Order Notes ===
    get_order_notes: { description: "Retrieve order notes" },
    get_order_note: { description: "Get a single order note" },
    create_order_note: { description: "Create a new order note" },
    delete_order_note: { description: "Delete an order note" },
    
    // === Order Refunds ===
    get_order_refunds: { description: "Retrieve order refunds" },
    get_order_refund: { description: "Get a single order refund" },
    create_order_refund: { description: "Create a new order refund" },
    delete_order_refund: { description: "Delete an order refund" },
    
    // === WooCommerce Customers ===
    get_customers: { 
      description: "Retrieve a list of customers",
      inputSchema: {
        type: "object",
        properties: {
          perPage: { type: "number", description: "Number of customers to retrieve (max 100)" },
          page: { type: "number", description: "Page number" },
          search: { type: "string", description: "Search term" },
          email: { type: "string", description: "Customer email" },
          role: { type: "string", description: "Customer role" },
          orderby: { type: "string", enum: ["id", "include", "name", "registered_date"] },
          order: { type: "string", enum: ["asc", "desc"] },
          siteUrl: { type: "string", description: "WordPress site URL" },
          consumerKey: { type: "string", description: "WooCommerce consumer key" },
          consumerSecret: { type: "string", description: "WooCommerce consumer secret" }
        }
      }
    },
    get_customer: { 
      description: "Get a single customer by ID",
      inputSchema: {
        type: "object",
        properties: {
          customerId: { type: "number", description: "Customer ID", required: true },
          siteUrl: { type: "string", description: "WordPress site URL" },
          consumerKey: { type: "string", description: "WooCommerce consumer key" },
          consumerSecret: { type: "string", description: "WooCommerce consumer secret" }
        },
        required: ["customerId"]
      }
    },
    create_customer: { 
      description: "Create a new customer",
      inputSchema: {
        type: "object",
        properties: {
          customerData: {
            type: "object",
            description: "Customer data object",
            properties: {
              email: { type: "string", description: "Customer email address" },
              first_name: { type: "string", description: "Customer first name" },
              last_name: { type: "string", description: "Customer last name" },
              username: { type: "string", description: "Customer username" },
              password: { type: "string", description: "Customer password" },
              billing: {
                type: "object",
                properties: {
                  first_name: { type: "string", description: "First name" },
                  last_name: { type: "string", description: "Last name" },
                  company: { type: "string", description: "Company name" },
                  address_1: { type: "string", description: "Address line 1" },
                  address_2: { type: "string", description: "Address line 2" },
                  city: { type: "string", description: "City" },
                  state: { type: "string", description: "State" },
                  postcode: { type: "string", description: "Postal code" },
                  country: { type: "string", description: "Country code" },
                  email: { type: "string", description: "Email address" },
                  phone: { type: "string", description: "Phone number" }
                }
              },
              shipping: {
                type: "object",
                properties: {
                  first_name: { type: "string", description: "First name" },
                  last_name: { type: "string", description: "Last name" },
                  company: { type: "string", description: "Company name" },
                  address_1: { type: "string", description: "Address line 1" },
                  address_2: { type: "string", description: "Address line 2" },
                  city: { type: "string", description: "City" },
                  state: { type: "string", description: "State" },
                  postcode: { type: "string", description: "Postal code" },
                  country: { type: "string", description: "Country code" }
                }
              }
            },
            required: ["email"]
          },
          siteUrl: { type: "string", description: "WordPress site URL" },
          consumerKey: { type: "string", description: "WooCommerce consumer key" },
          consumerSecret: { type: "string", description: "WooCommerce consumer secret" }
        },
        required: ["customerData"]
      }
    },
    update_customer: { 
      description: "Update an existing customer",
      inputSchema: {
        type: "object",
        properties: {
          customerId: { type: "number", description: "Customer ID to update", required: true },
          customerData: {
            type: "object",
            description: "Customer data to update",
            properties: {
              email: { type: "string", description: "Customer email address" },
              first_name: { type: "string", description: "Customer first name" },
              last_name: { type: "string", description: "Customer last name" },
              username: { type: "string", description: "Customer username" }
            }
          },
          siteUrl: { type: "string", description: "WordPress site URL" },
          consumerKey: { type: "string", description: "WooCommerce consumer key" },
          consumerSecret: { type: "string", description: "WooCommerce consumer secret" }
        },
        required: ["customerId", "customerData"]
      }
    },
    delete_customer: { 
      description: "Delete a customer",
      inputSchema: {
        type: "object",
        properties: {
          customerId: { type: "number", description: "Customer ID to delete", required: true },
          force: { type: "boolean", description: "Whether to bypass trash and force deletion" },
          reassign: { type: "number", description: "User ID to reassign posts to" },
          siteUrl: { type: "string", description: "WordPress site URL" },
          consumerKey: { type: "string", description: "WooCommerce consumer key" },
          consumerSecret: { type: "string", description: "WooCommerce consumer secret" }
        },
        required: ["customerId"]
      }
    },
    get_customer_meta: { description: "Get customer metadata" },
    create_customer_meta: { description: "Create/update customer metadata" },
    update_customer_meta: { description: "Update customer metadata" },
    delete_customer_meta: { description: "Delete customer metadata" },
    
    // === Shipping ===
    get_shipping_zones: { description: "Retrieve shipping zones" },
    get_shipping_zone: { description: "Get a single shipping zone" },
    create_shipping_zone: { description: "Create a new shipping zone" },
    update_shipping_zone: { description: "Update a shipping zone" },
    delete_shipping_zone: { description: "Delete a shipping zone" },
    get_shipping_methods: { description: "Retrieve shipping methods" },
    get_shipping_zone_methods: { description: "Get shipping methods for a zone" },
    create_shipping_zone_method: { description: "Create a new shipping method for a zone" },
    update_shipping_zone_method: { description: "Update a shipping method for a zone" },
    delete_shipping_zone_method: { description: "Delete a shipping method from a zone" },
    get_shipping_zone_locations: { description: "Get locations for a shipping zone" },
    update_shipping_zone_locations: { description: "Update locations for a shipping zone" },
    
    // === Taxes ===
    get_tax_classes: { description: "Retrieve tax classes" },
    create_tax_class: { description: "Create a new tax class" },
    delete_tax_class: { description: "Delete a tax class" },
    get_tax_rates: { description: "Retrieve tax rates" },
    get_tax_rate: { description: "Get a single tax rate" },
    create_tax_rate: { description: "Create a new tax rate" },
    update_tax_rate: { description: "Update a tax rate" },
    delete_tax_rate: { description: "Delete a tax rate" },
    
    // === Discounts/Coupons ===
    get_coupons: { description: "Retrieve coupons" },
    get_coupon: { description: "Get a single coupon" },
    create_coupon: { description: "Create a new coupon" },
    update_coupon: { description: "Update a coupon" },
    delete_coupon: { description: "Delete a coupon" },
    
    // === Payment Gateways ===
    get_payment_gateways: { description: "Retrieve payment gateways" },
    get_payment_gateway: { description: "Get a single payment gateway" },
    update_payment_gateway: { description: "Update a payment gateway" },
    
    // === Reports ===
    get_sales_report: { description: "Retrieve sales reports" },
    get_products_report: { description: "Retrieve products reports" },
    get_orders_report: { description: "Retrieve orders reports" },
    get_categories_report: { description: "Retrieve categories reports" },
    get_customers_report: { description: "Retrieve customers reports" },
    get_stock_report: { description: "Retrieve stock reports" },
    get_coupons_report: { description: "Retrieve coupons reports" },
    get_taxes_report: { description: "Retrieve taxes reports" },
    
    // === Settings ===
    get_settings: { description: "Retrieve all settings" },
    get_setting_options: { description: "Retrieve options for a setting" },
    update_setting_option: { description: "Update a setting option" },
    
    // === System Status ===
    get_system_status: { description: "Retrieve system status" },
    get_system_status_tools: { description: "Retrieve system status tools" },
    run_system_status_tool: { description: "Run a system status tool" },
    
    // === Data ===
    get_data: { description: "Retrieve store data" },
    get_continents: { description: "Retrieve continents data" },
    get_countries: { description: "Retrieve countries data" },
    get_currencies: { description: "Retrieve currencies data" },
    get_current_currency: { description: "Get the current currency" }
  }
};

// Handle MCP initialization
async function handleMcpInitialization(): Promise<any> {
  return {
    protocolVersion: "2024-11-05",
    capabilities: MCP_CAPABILITIES,
    serverInfo: {
      name: "woocommerce-mcp-server",
      version: "1.0.0"
    }
  };
}

// Handle tools list request
async function handleListTools(): Promise<any> {
  return {
    tools: Object.entries(MCP_CAPABILITIES.tools).map(([name, tool]) => ({
      name,
      description: tool.description,
      inputSchema: (tool as any).inputSchema || { type: "object", properties: {} }
    }))
  };
}

async function handleWooCommerceRequest(
  method: string,
  params: any
): Promise<any> {
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

    // For standard WordPress API endpoints
    const wpMethods = [
      "create_post",
      "get_posts",
      "update_post",
      "get_post_meta",
      "update_post_meta",
      "create_post_meta",
      "delete_post_meta",
    ];

    // For WooCommerce API endpoints
    const wooMethods = [
      "get_products",
      "get_product",
      "create_product",
      "update_product",
      "delete_product",
      "get_orders",
      "get_order",
      "create_order",
      "update_order",
      "delete_order",
      "get_customers",
      "get_customer",
      "create_customer",
      "update_customer",
      "delete_customer",
      "get_sales_report",
      "get_products_report",
      "get_orders_report",
      "get_categories_report",
      "get_customers_report",
      "get_stock_report",
      "get_coupons_report",
      "get_taxes_report",
      // Shipping methods
      "get_shipping_zones",
      "get_shipping_zone",
      "create_shipping_zone",
      "update_shipping_zone",
      "delete_shipping_zone",
      "get_shipping_methods",
      "get_shipping_zone_methods",
      "create_shipping_zone_method",
      "update_shipping_zone_method",
      "delete_shipping_zone_method",
      "get_shipping_zone_locations",
      "update_shipping_zone_locations",
      // Tax settings
      "get_tax_classes",
      "create_tax_class",
      "delete_tax_class",
      "get_tax_rates",
      "get_tax_rate",
      "create_tax_rate",
      "update_tax_rate",
      "delete_tax_rate",
      // Discount/Coupon settings
      "get_coupons",
      "get_coupon",
      "create_coupon",
      "update_coupon",
      "delete_coupon",
      // Order notes
      "get_order_notes",
      "get_order_note",
      "create_order_note",
      "delete_order_note",
      // Order refunds
      "get_order_refunds",
      "get_order_refund",
      "create_order_refund",
      "delete_order_refund",
      // Product variations
      "get_product_variations",
      "get_product_variation",
      "create_product_variation",
      "update_product_variation",
      "delete_product_variation",
      // Product attributes
      "get_product_attributes",
      "get_product_attribute",
      "create_product_attribute",
      "update_product_attribute",
      "delete_product_attribute",
      // Product attribute terms
      "get_attribute_terms",
      "get_attribute_term",
      "create_attribute_term",
      "update_attribute_term",
      "delete_attribute_term",
      // Product categories
      "get_product_categories",
      "get_product_category",
      "create_product_category",
      "update_product_category",
      "delete_product_category",
      // Product tags
      "get_product_tags",
      "get_product_tag",
      "create_product_tag",
      "update_product_tag",
      "delete_product_tag",
      // Product reviews
      "get_product_reviews",
      "get_product_review",
      "create_product_review",
      "update_product_review",
      "delete_product_review",
      // Payment gateways
      "get_payment_gateways",
      "get_payment_gateway",
      "update_payment_gateway",
      // Settings
      "get_settings",
      "get_setting_options",
      "update_setting_option",
      // System status
      "get_system_status",
      "get_system_status_tools",
      "run_system_status_tool",
      // Data
      "get_data",
      "get_continents",
      "get_countries",
      "get_currencies",
      "get_current_currency",
      // Meta data operations for products
      "get_product_meta",
      "update_product_meta",
      "create_product_meta",
      "delete_product_meta",
      // Meta data operations for orders
      "get_order_meta",
      "update_order_meta",
      "create_order_meta",
      "delete_order_meta",
      // Meta data operations for customers
      "get_customer_meta",
      "update_customer_meta",
      "create_customer_meta",
      "delete_customer_meta",
    ];

    // Create WordPress REST API client
    let client;

    if (wpMethods.includes(method)) {
      if (!username || !password) {
        throw new Error(
          "WordPress credentials not provided in environment variables or request parameters"
        );
      }

      const auth = Buffer.from(`${username}:${password}`).toString("base64");
      client = axios.create({
        baseURL: `${siteUrl}/wp-json/wp/v2`,
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      });
    } else if (wooMethods.includes(method)) {
      // For WooCommerce API requests
      if (!consumerKey || !consumerSecret) {
        throw new Error(
          "WooCommerce API credentials not provided in environment variables or request parameters"
        );
      }

      client = axios.create({
        baseURL: `${siteUrl}/wp-json/wc/v3`,
        params: {
          consumer_key: consumerKey,
          consumer_secret: consumerSecret,
        },
        headers: {
          "Content-Type": "application/json",
        },
      });
    } else {
      throw new Error(`Unknown method: ${method}`);
    }

    // Handle WordPress API methods
    switch (method) {
      case "create_post":
        if (!params.title || !params.content) {
          throw new Error("Title and content are required for creating a post");
        }
        const createResponse = await client.post("/posts", {
          title: params.title,
          content: params.content,
          status: params.status || "draft",
        });
        return createResponse.data;

      case "get_posts":
        const getResponse = await client.get("/posts", {
          params: {
            per_page: params.perPage || 10,
            page: params.page || 1,
          },
        });
        return getResponse.data;

      case "update_post":
        if (!params.postId) {
          throw new Error("Post ID is required for updating a post");
        }
        const updateData: Record<string, any> = {};
        if (params.title) updateData.title = params.title;
        if (params.content) updateData.content = params.content;
        if (params.status) updateData.status = params.status;

        const updateResponse = await client.post(
          `/posts/${params.postId}`,
          updateData
        );
        return updateResponse.data;

      // Handle WooCommerce API methods
      // Products
      case "get_products":
        const productsResponse = await client.get("/products", {
          params: {
            per_page: params.perPage || 10,
            page: params.page || 1,
            ...params.filters,
          },
        });
        return productsResponse.data;

      case "get_product":
        if (!params.productId) {
          throw new Error("Product ID is required");
        }
        const productResponse = await client.get(
          `/products/${params.productId}`
        );
        return productResponse.data;

      case "create_product":
        if (!params.productData) {
          throw new Error("Product data is required for creating a product");
        }
        const createProductResponse = await client.post(
          "/products",
          params.productData
        );
        return createProductResponse.data;

      case "update_product":
        if (!params.productId) {
          throw new Error("Product ID is required for updating a product");
        }
        if (!params.productData) {
          throw new Error("Product data is required for updating a product");
        }
        const updateProductResponse = await client.put(
          `/products/${params.productId}`,
          params.productData
        );
        return updateProductResponse.data;

      case "delete_product":
        if (!params.productId) {
          throw new Error("Product ID is required for deleting a product");
        }
        const deleteProductResponse = await client.delete(
          `/products/${params.productId}`,
          {
            params: {
              force: params.force || false,
            },
          }
        );
        return deleteProductResponse.data;

      // Orders
      case "get_orders":
        const ordersResponse = await client.get("/orders", {
          params: {
            per_page: params.perPage || 10,
            page: params.page || 1,
            ...params.filters,
          },
        });
        return ordersResponse.data;

      case "get_order":
        if (!params.orderId) {
          throw new Error("Order ID is required");
        }
        const orderResponse = await client.get(`/orders/${params.orderId}`);
        return orderResponse.data;

      case "create_order":
        if (!params.orderData) {
          throw new Error("Order data is required for creating an order");
        }
        const createOrderResponse = await client.post(
          "/orders",
          params.orderData
        );
        return createOrderResponse.data;

      case "update_order":
        if (!params.orderId) {
          throw new Error("Order ID is required for updating an order");
        }
        if (!params.orderData) {
          throw new Error("Order data is required for updating an order");
        }
        const updateOrderResponse = await client.put(
          `/orders/${params.orderId}`,
          params.orderData
        );
        return updateOrderResponse.data;

      case "delete_order":
        if (!params.orderId) {
          throw new Error("Order ID is required for deleting an order");
        }
        const deleteOrderResponse = await client.delete(
          `/orders/${params.orderId}`,
          {
            params: {
              force: params.force || false,
            },
          }
        );
        return deleteOrderResponse.data;

      // Customers
      case "get_customers":
        const customersResponse = await client.get("/customers", {
          params: {
            per_page: params.perPage || 10,
            page: params.page || 1,
            ...params.filters,
          },
        });
        return customersResponse.data;

      case "get_customer":
        if (!params.customerId) {
          throw new Error("Customer ID is required");
        }
        const customerResponse = await client.get(
          `/customers/${params.customerId}`
        );
        return customerResponse.data;

      case "create_customer":
        if (!params.customerData) {
          throw new Error("Customer data is required for creating a customer");
        }
        const createCustomerResponse = await client.post(
          "/customers",
          params.customerData
        );
        return createCustomerResponse.data;

      case "update_customer":
        if (!params.customerId) {
          throw new Error("Customer ID is required for updating a customer");
        }
        if (!params.customerData) {
          throw new Error("Customer data is required for updating a customer");
        }
        const updateCustomerResponse = await client.put(
          `/customers/${params.customerId}`,
          params.customerData
        );
        return updateCustomerResponse.data;

      case "delete_customer":
        if (!params.customerId) {
          throw new Error("Customer ID is required for deleting a customer");
        }
        const deleteCustomerResponse = await client.delete(
          `/customers/${params.customerId}`,
          {
            params: {
              force: params.force || false,
            },
          }
        );
        return deleteCustomerResponse.data;

      // Reports
      case "get_sales_report":
        const salesReportResponse = await client.get("/reports/sales", {
          params: {
            period: params.period || "month",
            date_min: params.dateMin || "",
            date_max: params.dateMax || "",
            ...params.filters,
          },
        });
        return salesReportResponse.data;

      case "get_products_report":
        const productsReportResponse = await client.get("/reports/products", {
          params: {
            period: params.period || "month",
            date_min: params.dateMin || "",
            date_max: params.dateMax || "",
            per_page: params.perPage || 10,
            page: params.page || 1,
            ...params.filters,
          },
        });
        return productsReportResponse.data;

      case "get_orders_report":
        const ordersReportResponse = await client.get("/reports/orders", {
          params: {
            period: params.period || "month",
            date_min: params.dateMin || "",
            date_max: params.dateMax || "",
            per_page: params.perPage || 10,
            page: params.page || 1,
            ...params.filters,
          },
        });
        return ordersReportResponse.data;

      case "get_categories_report":
        const categoriesReportResponse = await client.get(
          "/reports/categories",
          {
            params: {
              per_page: params.perPage || 10,
              page: params.page || 1,
              ...params.filters,
            },
          }
        );
        return categoriesReportResponse.data;

      case "get_customers_report":
        const customersReportResponse = await client.get("/reports/customers", {
          params: {
            per_page: params.perPage || 10,
            page: params.page || 1,
            ...params.filters,
          },
        });
        return customersReportResponse.data;

      case "get_stock_report":
        const stockReportResponse = await client.get("/reports/stock", {
          params: {
            per_page: params.perPage || 10,
            page: params.page || 1,
            ...params.filters,
          },
        });
        return stockReportResponse.data;

      case "get_coupons_report":
        const couponsReportResponse = await client.get("/reports/coupons", {
          params: {
            period: params.period || "month",
            date_min: params.dateMin || "",
            date_max: params.dateMax || "",
            per_page: params.perPage || 10,
            page: params.page || 1,
            ...params.filters,
          },
        });
        return couponsReportResponse.data;

      case "get_taxes_report":
        const taxesReportResponse = await client.get("/reports/taxes", {
          params: {
            period: params.period || "month",
            date_min: params.dateMin || "",
            date_max: params.dateMax || "",
            per_page: params.perPage || 10,
            page: params.page || 1,
            ...params.filters,
          },
        });
        return taxesReportResponse.data;

      // Shipping Zones
      case "get_shipping_zones":
        const shippingZonesResponse = await client.get("/shipping/zones", {
          params: {
            ...params.filters,
          },
        });
        return shippingZonesResponse.data;

      case "get_shipping_zone":
        if (!params.zoneId) {
          throw new Error("Zone ID is required");
        }
        const shippingZoneResponse = await client.get(
          `/shipping/zones/${params.zoneId}`
        );
        return shippingZoneResponse.data;

      case "create_shipping_zone":
        if (!params.zoneData) {
          throw new Error("Zone data is required for creating a shipping zone");
        }
        const createShippingZoneResponse = await client.post(
          "/shipping/zones",
          params.zoneData
        );
        return createShippingZoneResponse.data;

      case "update_shipping_zone":
        if (!params.zoneId) {
          throw new Error("Zone ID is required for updating a shipping zone");
        }
        if (!params.zoneData) {
          throw new Error("Zone data is required for updating a shipping zone");
        }
        const updateShippingZoneResponse = await client.put(
          `/shipping/zones/${params.zoneId}`,
          params.zoneData
        );
        return updateShippingZoneResponse.data;

      case "delete_shipping_zone":
        if (!params.zoneId) {
          throw new Error("Zone ID is required for deleting a shipping zone");
        }
        const deleteShippingZoneResponse = await client.delete(
          `/shipping/zones/${params.zoneId}`,
          {
            params: {
              force: params.force || true,
            },
          }
        );
        return deleteShippingZoneResponse.data;

      // Shipping Methods
      case "get_shipping_methods":
        const shippingMethodsResponse = await client.get("/shipping_methods");
        return shippingMethodsResponse.data;

      case "get_shipping_zone_methods":
        if (!params.zoneId) {
          throw new Error("Zone ID is required");
        }
        const zoneMethodsResponse = await client.get(
          `/shipping/zones/${params.zoneId}/methods`
        );
        return zoneMethodsResponse.data;

      case "create_shipping_zone_method":
        if (!params.zoneId) {
          throw new Error("Zone ID is required");
        }
        if (!params.methodData) {
          throw new Error(
            "Method data is required for creating a shipping method"
          );
        }
        const createMethodResponse = await client.post(
          `/shipping/zones/${params.zoneId}/methods`,
          params.methodData
        );
        return createMethodResponse.data;

      case "update_shipping_zone_method":
        if (!params.zoneId) {
          throw new Error("Zone ID is required");
        }
        if (!params.instanceId) {
          throw new Error("Method instance ID is required");
        }
        if (!params.methodData) {
          throw new Error(
            "Method data is required for updating a shipping method"
          );
        }
        const updateMethodResponse = await client.put(
          `/shipping/zones/${params.zoneId}/methods/${params.instanceId}`,
          params.methodData
        );
        return updateMethodResponse.data;

      case "delete_shipping_zone_method":
        if (!params.zoneId) {
          throw new Error("Zone ID is required");
        }
        if (!params.instanceId) {
          throw new Error("Method instance ID is required");
        }
        const deleteMethodResponse = await client.delete(
          `/shipping/zones/${params.zoneId}/methods/${params.instanceId}`,
          {
            params: {
              force: params.force || true,
            },
          }
        );
        return deleteMethodResponse.data;

      // Shipping Zone Locations
      case "get_shipping_zone_locations":
        if (!params.zoneId) {
          throw new Error("Zone ID is required");
        }
        const locationsResponse = await client.get(
          `/shipping/zones/${params.zoneId}/locations`
        );
        return locationsResponse.data;

      case "update_shipping_zone_locations":
        if (!params.zoneId) {
          throw new Error("Zone ID is required");
        }
        if (!params.locations) {
          throw new Error("Locations data is required");
        }
        const updateLocationsResponse = await client.put(
          `/shipping/zones/${params.zoneId}/locations`,
          params.locations
        );
        return updateLocationsResponse.data;

      // Tax Classes
      case "get_tax_classes":
        const taxClassesResponse = await client.get("/taxes/classes");
        return taxClassesResponse.data;

      case "create_tax_class":
        if (!params.taxClassData) {
          throw new Error("Tax class data is required");
        }
        const createTaxClassResponse = await client.post(
          "/taxes/classes",
          params.taxClassData
        );
        return createTaxClassResponse.data;

      case "delete_tax_class":
        if (!params.slug) {
          throw new Error("Tax class slug is required");
        }
        const deleteTaxClassResponse = await client.delete(
          `/taxes/classes/${params.slug}`,
          {
            params: {
              force: params.force || true,
            },
          }
        );
        return deleteTaxClassResponse.data;

      // Tax Rates
      case "get_tax_rates":
        const taxRatesResponse = await client.get("/taxes", {
          params: {
            per_page: params.perPage || 10,
            page: params.page || 1,
            ...params.filters,
          },
        });
        return taxRatesResponse.data;

      case "get_tax_rate":
        if (!params.rateId) {
          throw new Error("Tax rate ID is required");
        }
        const taxRateResponse = await client.get(`/taxes/${params.rateId}`);
        return taxRateResponse.data;

      case "create_tax_rate":
        if (!params.taxRateData) {
          throw new Error("Tax rate data is required");
        }
        const createTaxRateResponse = await client.post(
          "/taxes",
          params.taxRateData
        );
        return createTaxRateResponse.data;

      case "update_tax_rate":
        if (!params.rateId) {
          throw new Error("Tax rate ID is required");
        }
        if (!params.taxRateData) {
          throw new Error("Tax rate data is required");
        }
        const updateTaxRateResponse = await client.put(
          `/taxes/${params.rateId}`,
          params.taxRateData
        );
        return updateTaxRateResponse.data;

      case "delete_tax_rate":
        if (!params.rateId) {
          throw new Error("Tax rate ID is required");
        }
        const deleteTaxRateResponse = await client.delete(
          `/taxes/${params.rateId}`,
          {
            params: {
              force: params.force || true,
            },
          }
        );
        return deleteTaxRateResponse.data;

      // Coupons
      case "get_coupons":
        const couponsResponse = await client.get("/coupons", {
          params: {
            per_page: params.perPage || 10,
            page: params.page || 1,
            ...params.filters,
          },
        });
        return couponsResponse.data;

      case "get_coupon":
        if (!params.couponId) {
          throw new Error("Coupon ID is required");
        }
        const couponResponse = await client.get(`/coupons/${params.couponId}`);
        return couponResponse.data;

      case "create_coupon":
        if (!params.couponData) {
          throw new Error("Coupon data is required");
        }
        const createCouponResponse = await client.post(
          "/coupons",
          params.couponData
        );
        return createCouponResponse.data;

      case "update_coupon":
        if (!params.couponId) {
          throw new Error("Coupon ID is required");
        }
        if (!params.couponData) {
          throw new Error("Coupon data is required");
        }
        const updateCouponResponse = await client.put(
          `/coupons/${params.couponId}`,
          params.couponData
        );
        return updateCouponResponse.data;

      case "delete_coupon":
        if (!params.couponId) {
          throw new Error("Coupon ID is required");
        }
        const deleteCouponResponse = await client.delete(
          `/coupons/${params.couponId}`,
          {
            params: {
              force: params.force || true,
            },
          }
        );
        return deleteCouponResponse.data;

      // Order Notes
      case "get_order_notes":
        if (!params.orderId) {
          throw new Error("Order ID is required");
        }
        const orderNotesResponse = await client.get(
          `/orders/${params.orderId}/notes`,
          {
            params: {
              per_page: params.perPage || 10,
              page: params.page || 1,
              ...params.filters,
            },
          }
        );
        return orderNotesResponse.data;

      case "get_order_note":
        if (!params.orderId) {
          throw new Error("Order ID is required");
        }
        if (!params.noteId) {
          throw new Error("Note ID is required");
        }
        const orderNoteResponse = await client.get(
          `/orders/${params.orderId}/notes/${params.noteId}`
        );
        return orderNoteResponse.data;

      case "create_order_note":
        if (!params.orderId) {
          throw new Error("Order ID is required");
        }
        if (!params.noteData) {
          throw new Error("Note data is required");
        }
        const createOrderNoteResponse = await client.post(
          `/orders/${params.orderId}/notes`,
          params.noteData
        );
        return createOrderNoteResponse.data;

      case "delete_order_note":
        if (!params.orderId) {
          throw new Error("Order ID is required");
        }
        if (!params.noteId) {
          throw new Error("Note ID is required");
        }
        const deleteOrderNoteResponse = await client.delete(
          `/orders/${params.orderId}/notes/${params.noteId}`,
          {
            params: {
              force: params.force || true,
            },
          }
        );
        return deleteOrderNoteResponse.data;

      // Order Refunds
      case "get_order_refunds":
        if (!params.orderId) {
          throw new Error("Order ID is required");
        }
        const refundsResponse = await client.get(
          `/orders/${params.orderId}/refunds`,
          {
            params: {
              per_page: params.perPage || 10,
              page: params.page || 1,
              ...params.filters,
            },
          }
        );
        return refundsResponse.data;

      case "get_order_refund":
        if (!params.orderId) {
          throw new Error("Order ID is required");
        }
        if (!params.refundId) {
          throw new Error("Refund ID is required");
        }
        const refundResponse = await client.get(
          `/orders/${params.orderId}/refunds/${params.refundId}`
        );
        return refundResponse.data;

      case "create_order_refund":
        if (!params.orderId) {
          throw new Error("Order ID is required");
        }
        if (!params.refundData) {
          throw new Error("Refund data is required");
        }
        const createRefundResponse = await client.post(
          `/orders/${params.orderId}/refunds`,
          params.refundData
        );
        return createRefundResponse.data;

      case "delete_order_refund":
        if (!params.orderId) {
          throw new Error("Order ID is required");
        }
        if (!params.refundId) {
          throw new Error("Refund ID is required");
        }
        const deleteRefundResponse = await client.delete(
          `/orders/${params.orderId}/refunds/${params.refundId}`,
          {
            params: {
              force: params.force || true,
            },
          }
        );
        return deleteRefundResponse.data;

      // Product Variations
      case "get_product_variations":
        if (!params.productId) {
          throw new Error("Product ID is required");
        }
        const variationsResponse = await client.get(
          `/products/${params.productId}/variations`,
          {
            params: {
              per_page: params.perPage || 10,
              page: params.page || 1,
              ...params.filters,
            },
          }
        );
        return variationsResponse.data;

      case "get_product_variation":
        if (!params.productId) {
          throw new Error("Product ID is required");
        }
        if (!params.variationId) {
          throw new Error("Variation ID is required");
        }
        const variationResponse = await client.get(
          `/products/${params.productId}/variations/${params.variationId}`
        );
        return variationResponse.data;

      case "create_product_variation":
        if (!params.productId) {
          throw new Error("Product ID is required");
        }
        if (!params.variationData) {
          throw new Error("Variation data is required");
        }
        const createVariationResponse = await client.post(
          `/products/${params.productId}/variations`,
          params.variationData
        );
        return createVariationResponse.data;

      case "update_product_variation":
        if (!params.productId) {
          throw new Error("Product ID is required");
        }
        if (!params.variationId) {
          throw new Error("Variation ID is required");
        }
        if (!params.variationData) {
          throw new Error("Variation data is required");
        }
        const updateVariationResponse = await client.put(
          `/products/${params.productId}/variations/${params.variationId}`,
          params.variationData
        );
        return updateVariationResponse.data;

      case "delete_product_variation":
        if (!params.productId) {
          throw new Error("Product ID is required");
        }
        if (!params.variationId) {
          throw new Error("Variation ID is required");
        }
        const deleteVariationResponse = await client.delete(
          `/products/${params.productId}/variations/${params.variationId}`,
          {
            params: {
              force: params.force || true,
            },
          }
        );
        return deleteVariationResponse.data;

      // Product Attributes
      case "get_product_attributes":
        const attributesResponse = await client.get("/products/attributes", {
          params: {
            per_page: params.perPage || 10,
            page: params.page || 1,
            ...params.filters,
          },
        });
        return attributesResponse.data;

      case "get_product_attribute":
        if (!params.attributeId) {
          throw new Error("Attribute ID is required");
        }
        const attributeResponse = await client.get(
          `/products/attributes/${params.attributeId}`
        );
        return attributeResponse.data;

      case "create_product_attribute":
        if (!params.attributeData) {
          throw new Error("Attribute data is required");
        }
        const createAttributeResponse = await client.post(
          "/products/attributes",
          params.attributeData
        );
        return createAttributeResponse.data;

      case "update_product_attribute":
        if (!params.attributeId) {
          throw new Error("Attribute ID is required");
        }
        if (!params.attributeData) {
          throw new Error("Attribute data is required");
        }
        const updateAttributeResponse = await client.put(
          `/products/attributes/${params.attributeId}`,
          params.attributeData
        );
        return updateAttributeResponse.data;

      case "delete_product_attribute":
        if (!params.attributeId) {
          throw new Error("Attribute ID is required");
        }
        const deleteAttributeResponse = await client.delete(
          `/products/attributes/${params.attributeId}`,
          {
            params: {
              force: params.force || true,
            },
          }
        );
        return deleteAttributeResponse.data;

      // Product Attribute Terms
      case "get_attribute_terms":
        if (!params.attributeId) {
          throw new Error("Attribute ID is required");
        }
        const termsResponse = await client.get(
          `/products/attributes/${params.attributeId}/terms`,
          {
            params: {
              per_page: params.perPage || 10,
              page: params.page || 1,
              ...params.filters,
            },
          }
        );
        return termsResponse.data;

      case "get_attribute_term":
        if (!params.attributeId) {
          throw new Error("Attribute ID is required");
        }
        if (!params.termId) {
          throw new Error("Term ID is required");
        }
        const termResponse = await client.get(
          `/products/attributes/${params.attributeId}/terms/${params.termId}`
        );
        return termResponse.data;

      case "create_attribute_term":
        if (!params.attributeId) {
          throw new Error("Attribute ID is required");
        }
        if (!params.termData) {
          throw new Error("Term data is required");
        }
        const createTermResponse = await client.post(
          `/products/attributes/${params.attributeId}/terms`,
          params.termData
        );
        return createTermResponse.data;

      case "update_attribute_term":
        if (!params.attributeId) {
          throw new Error("Attribute ID is required");
        }
        if (!params.termId) {
          throw new Error("Term ID is required");
        }
        if (!params.termData) {
          throw new Error("Term data is required");
        }
        const updateTermResponse = await client.put(
          `/products/attributes/${params.attributeId}/terms/${params.termId}`,
          params.termData
        );
        return updateTermResponse.data;

      case "delete_attribute_term":
        if (!params.attributeId) {
          throw new Error("Attribute ID is required");
        }
        if (!params.termId) {
          throw new Error("Term ID is required");
        }
        const deleteTermResponse = await client.delete(
          `/products/attributes/${params.attributeId}/terms/${params.termId}`,
          {
            params: {
              force: params.force || true,
            },
          }
        );
        return deleteTermResponse.data;

      // Product Categories
      case "get_product_categories":
        const categoriesResponse = await client.get("/products/categories", {
          params: {
            per_page: params.perPage || 10,
            page: params.page || 1,
            ...params.filters,
          },
        });
        return categoriesResponse.data;

      case "get_product_category":
        if (!params.categoryId) {
          throw new Error("Category ID is required");
        }
        const categoryResponse = await client.get(
          `/products/categories/${params.categoryId}`
        );
        return categoryResponse.data;

      case "create_product_category":
        if (!params.categoryData) {
          throw new Error("Category data is required");
        }
        const createCategoryResponse = await client.post(
          "/products/categories",
          params.categoryData
        );
        return createCategoryResponse.data;

      case "update_product_category":
        if (!params.categoryId) {
          throw new Error("Category ID is required");
        }
        if (!params.categoryData) {
          throw new Error("Category data is required");
        }
        const updateCategoryResponse = await client.put(
          `/products/categories/${params.categoryId}`,
          params.categoryData
        );
        return updateCategoryResponse.data;

      case "delete_product_category":
        if (!params.categoryId) {
          throw new Error("Category ID is required");
        }
        const deleteCategoryResponse = await client.delete(
          `/products/categories/${params.categoryId}`,
          {
            params: {
              force: params.force || true,
            },
          }
        );
        return deleteCategoryResponse.data;

      // Product Tags
      case "get_product_tags":
        const tagsResponse = await client.get("/products/tags", {
          params: {
            per_page: params.perPage || 10,
            page: params.page || 1,
            ...params.filters,
          },
        });
        return tagsResponse.data;

      case "get_product_tag":
        if (!params.tagId) {
          throw new Error("Tag ID is required");
        }
        const tagResponse = await client.get(`/products/tags/${params.tagId}`);
        return tagResponse.data;

      case "create_product_tag":
        if (!params.tagData) {
          throw new Error("Tag data is required");
        }
        const createTagResponse = await client.post(
          "/products/tags",
          params.tagData
        );
        return createTagResponse.data;

      case "update_product_tag":
        if (!params.tagId) {
          throw new Error("Tag ID is required");
        }
        if (!params.tagData) {
          throw new Error("Tag data is required");
        }
        const updateTagResponse = await client.put(
          `/products/tags/${params.tagId}`,
          params.tagData
        );
        return updateTagResponse.data;

      case "delete_product_tag":
        if (!params.tagId) {
          throw new Error("Tag ID is required");
        }
        const deleteTagResponse = await client.delete(
          `/products/tags/${params.tagId}`,
          {
            params: {
              force: params.force || true,
            },
          }
        );
        return deleteTagResponse.data;

      // Product Reviews
      case "get_product_reviews":
        const reviewsParams = params.productId
          ? `/products/${params.productId}/reviews`
          : "/products/reviews";

        const reviewsResponse = await client.get(reviewsParams, {
          params: {
            per_page: params.perPage || 10,
            page: params.page || 1,
            ...params.filters,
          },
        });
        return reviewsResponse.data;

      case "get_product_review":
        if (!params.reviewId) {
          throw new Error("Review ID is required");
        }
        const reviewParams = params.productId
          ? `/products/${params.productId}/reviews/${params.reviewId}`
          : `/products/reviews/${params.reviewId}`;

        const reviewResponse = await client.get(reviewParams);
        return reviewResponse.data;

      case "create_product_review":
        if (!params.productId) {
          throw new Error("Product ID is required");
        }
        if (!params.reviewData) {
          throw new Error("Review data is required");
        }
        const createReviewResponse = await client.post(
          `/products/${params.productId}/reviews`,
          params.reviewData
        );
        return createReviewResponse.data;

      case "update_product_review":
        if (!params.reviewId) {
          throw new Error("Review ID is required");
        }
        if (!params.reviewData) {
          throw new Error("Review data is required");
        }
        const reviewPath = params.productId
          ? `/products/${params.productId}/reviews/${params.reviewId}`
          : `/products/reviews/${params.reviewId}`;

        const updateReviewResponse = await client.put(
          reviewPath,
          params.reviewData
        );
        return updateReviewResponse.data;

      case "delete_product_review":
        if (!params.reviewId) {
          throw new Error("Review ID is required");
        }
        const deletePath = params.productId
          ? `/products/${params.productId}/reviews/${params.reviewId}`
          : `/products/reviews/${params.reviewId}`;

        const deleteReviewResponse = await client.delete(deletePath, {
          params: {
            force: params.force || true,
          },
        });
        return deleteReviewResponse.data;

      // Payment Gateways
      case "get_payment_gateways":
        const gatewaysResponse = await client.get("/payment_gateways");
        return gatewaysResponse.data;

      case "get_payment_gateway":
        if (!params.gatewayId) {
          throw new Error("Gateway ID is required");
        }
        const gatewayResponse = await client.get(
          `/payment_gateways/${params.gatewayId}`
        );
        return gatewayResponse.data;

      case "update_payment_gateway":
        if (!params.gatewayId) {
          throw new Error("Gateway ID is required");
        }
        if (!params.gatewayData) {
          throw new Error("Gateway data is required");
        }
        const updateGatewayResponse = await client.put(
          `/payment_gateways/${params.gatewayId}`,
          params.gatewayData
        );
        return updateGatewayResponse.data;

      // Settings
      case "get_settings":
        const settingsResponse = await client.get("/settings");
        return settingsResponse.data;

      case "get_setting_options":
        if (!params.group) {
          throw new Error("Settings group is required");
        }
        const settingOptionsResponse = await client.get(
          `/settings/${params.group}`
        );
        return settingOptionsResponse.data;

      case "update_setting_option":
        if (!params.group) {
          throw new Error("Settings group is required");
        }
        if (!params.id) {
          throw new Error("Setting ID is required");
        }
        if (!params.settingData) {
          throw new Error("Setting data is required");
        }
        const updateSettingResponse = await client.put(
          `/settings/${params.group}/${params.id}`,
          params.settingData
        );
        return updateSettingResponse.data;

      // System Status
      case "get_system_status":
        const statusResponse = await client.get("/system_status");
        return statusResponse.data;

      case "get_system_status_tools":
        const toolsResponse = await client.get("/system_status/tools");
        return toolsResponse.data;

      case "run_system_status_tool":
        if (!params.toolId) {
          throw new Error("Tool ID is required");
        }
        const runToolResponse = await client.put(
          `/system_status/tools/${params.toolId}`
        );
        return runToolResponse.data;

      // Data
      case "get_data":
        const dataResponse = await client.get("/data");
        return dataResponse.data;

      case "get_continents":
        const continentsResponse = await client.get("/data/continents");
        return continentsResponse.data;

      case "get_countries":
        const countriesResponse = await client.get("/data/countries");
        return countriesResponse.data;

      case "get_currencies":
        const currenciesResponse = await client.get("/data/currencies");
        return currenciesResponse.data;

      case "get_current_currency":
        const currentCurrencyResponse = await client.get(
          "/data/currencies/current"
        );
        return currentCurrencyResponse.data;

      // Meta operations for WordPress posts
      case "get_post_meta":
        if (!params.postId) {
          throw new Error("Post ID is required");
        }
        // Get all meta or a specific meta key
        let metaEndpoint = params.metaKey
          ? `/posts/${params.postId}/meta/${params.metaKey}`
          : `/posts/${params.postId}/meta`;

        const getPostMetaResponse = await client.get(metaEndpoint);
        return getPostMetaResponse.data;

      case "create_post_meta":
        if (!params.postId) {
          throw new Error("Post ID is required");
        }
        if (!params.metaKey) {
          throw new Error("Meta key is required");
        }
        if (params.metaValue === undefined) {
          throw new Error("Meta value is required");
        }

        const createPostMetaResponse = await client.post(
          `/posts/${params.postId}/meta`,
          {
            key: params.metaKey,
            value: params.metaValue,
          }
        );
        return createPostMetaResponse.data;

      case "update_post_meta":
        if (!params.postId) {
          throw new Error("Post ID is required");
        }
        if (!params.metaId) {
          throw new Error("Meta ID is required");
        }
        if (params.metaValue === undefined) {
          throw new Error("Meta value is required");
        }

        const updatePostMetaResponse = await client.put(
          `/posts/${params.postId}/meta/${params.metaId}`,
          {
            value: params.metaValue,
          }
        );
        return updatePostMetaResponse.data;

      case "delete_post_meta":
        if (!params.postId) {
          throw new Error("Post ID is required");
        }
        if (!params.metaId) {
          throw new Error("Meta ID is required");
        }

        const deletePostMetaResponse = await client.delete(
          `/posts/${params.postId}/meta/${params.metaId}`,
          {
            params: {
              force: params.force || true,
            },
          }
        );
        return deletePostMetaResponse.data;

      // Meta operations for WooCommerce products
      case "get_product_meta":
        if (!params.productId) {
          throw new Error("Product ID is required");
        }

        const getProductResponse = await client.get(
          `/products/${params.productId}`
        );
        // WooCommerce keeps meta in the meta_data array
        const productMetaData = getProductResponse.data.meta_data || [];

        // If a specific key is requested, filter the meta data
        if (params.metaKey) {
          return productMetaData.filter(
            (meta: WooMetaData) => meta.key === params.metaKey
          );
        }

        return productMetaData;

      case "create_product_meta":
      case "update_product_meta":
        if (!params.productId) {
          throw new Error("Product ID is required");
        }
        if (!params.metaKey) {
          throw new Error("Meta key is required");
        }
        if (params.metaValue === undefined) {
          throw new Error("Meta value is required");
        }

        // First get the product to see if the meta key exists
        const productMetaResponse = await client.get(
          `/products/${params.productId}`
        );
        let product = productMetaResponse.data;
        let metaData: WooMetaData[] = product.meta_data || [];

        // Look for existing meta with the same key
        const existingMetaIndex = metaData.findIndex(
          (meta: WooMetaData) => meta.key === params.metaKey
        );

        if (existingMetaIndex >= 0) {
          // Update existing meta
          metaData[existingMetaIndex].value = params.metaValue;
        } else {
          // Add new meta
          metaData.push({
            key: params.metaKey,
            value: params.metaValue,
          });
        }

        // Update the product with the modified meta_data
        const updateProductMetaResponse = await client.put(
          `/products/${params.productId}`,
          {
            meta_data: metaData,
          }
        );

        return updateProductMetaResponse.data.meta_data;

      case "delete_product_meta":
        if (!params.productId) {
          throw new Error("Product ID is required");
        }
        if (!params.metaKey) {
          throw new Error("Meta key is required");
        }

        // First get the product to see if the meta key exists
        const getProductForDeleteResponse = await client.get(
          `/products/${params.productId}`
        );
        let productForDelete = getProductForDeleteResponse.data;
        let currentMetaData: WooMetaData[] = productForDelete.meta_data || [];

        // Filter out the meta key to delete
        const updatedMetaData = currentMetaData.filter(
          (meta: WooMetaData) => meta.key !== params.metaKey
        );

        // Update the product with the filtered meta_data
        const deleteProductMetaResponse = await client.put(
          `/products/${params.productId}`,
          {
            meta_data: updatedMetaData,
          }
        );

        return deleteProductMetaResponse.data.meta_data;

      // Meta operations for WooCommerce orders
      case "get_order_meta":
        if (!params.orderId) {
          throw new Error("Order ID is required");
        }

        const getOrderResponse = await client.get(`/orders/${params.orderId}`);
        // WooCommerce keeps meta in the meta_data array
        const orderMetaData = getOrderResponse.data.meta_data || [];

        // If a specific key is requested, filter the meta data
        if (params.metaKey) {
          return orderMetaData.filter(
            (meta: WooMetaData) => meta.key === params.metaKey
          );
        }

        return orderMetaData;

      case "create_order_meta":
      case "update_order_meta":
        if (!params.orderId) {
          throw new Error("Order ID is required");
        }
        if (!params.metaKey) {
          throw new Error("Meta key is required");
        }
        if (params.metaValue === undefined) {
          throw new Error("Meta value is required");
        }

        // First get the order to see if the meta key exists
        const orderMetaResponse = await client.get(`/orders/${params.orderId}`);
        let order = orderMetaResponse.data;
        let orderMeta: WooMetaData[] = order.meta_data || [];

        // Look for existing meta with the same key
        const existingOrderMetaIndex = orderMeta.findIndex(
          (meta: WooMetaData) => meta.key === params.metaKey
        );

        if (existingOrderMetaIndex >= 0) {
          // Update existing meta
          orderMeta[existingOrderMetaIndex].value = params.metaValue;
        } else {
          // Add new meta
          orderMeta.push({
            key: params.metaKey,
            value: params.metaValue,
          });
        }

        // Update the order with the modified meta_data
        const updateOrderMetaResponse = await client.put(
          `/orders/${params.orderId}`,
          {
            meta_data: orderMeta,
          }
        );

        return updateOrderMetaResponse.data.meta_data;

      case "delete_order_meta":
        if (!params.orderId) {
          throw new Error("Order ID is required");
        }
        if (!params.metaKey) {
          throw new Error("Meta key is required");
        }

        // First get the order to see if the meta key exists
        const getOrderForDeleteResponse = await client.get(
          `/orders/${params.orderId}`
        );
        let orderForDelete = getOrderForDeleteResponse.data;
        let currentOrderMeta: WooMetaData[] = orderForDelete.meta_data || [];

        // Filter out the meta key to delete
        const updatedOrderMeta = currentOrderMeta.filter(
          (meta: WooMetaData) => meta.key !== params.metaKey
        );

        // Update the order with the filtered meta_data
        const deleteOrderMetaResponse = await client.put(
          `/orders/${params.orderId}`,
          {
            meta_data: updatedOrderMeta,
          }
        );

        return deleteOrderMetaResponse.data.meta_data;

      // Meta operations for WooCommerce customers
      case "get_customer_meta":
        if (!params.customerId) {
          throw new Error("Customer ID is required");
        }

        const getCustomerResponse = await client.get(
          `/customers/${params.customerId}`
        );
        // WooCommerce keeps meta in the meta_data array
        const customerMetaData = getCustomerResponse.data.meta_data || [];

        // If a specific key is requested, filter the meta data
        if (params.metaKey) {
          return customerMetaData.filter(
            (meta: WooMetaData) => meta.key === params.metaKey
          );
        }

        return customerMetaData;

      case "create_customer_meta":
      case "update_customer_meta":
        if (!params.customerId) {
          throw new Error("Customer ID is required");
        }
        if (!params.metaKey) {
          throw new Error("Meta key is required");
        }
        if (params.metaValue === undefined) {
          throw new Error("Meta value is required");
        }

        // First get the customer to see if the meta key exists
        const customerMetaResponse = await client.get(
          `/customers/${params.customerId}`
        );
        let customer = customerMetaResponse.data;
        let customerMeta: WooMetaData[] = customer.meta_data || [];

        // Look for existing meta with the same key
        const existingCustomerMetaIndex = customerMeta.findIndex(
          (meta: WooMetaData) => meta.key === params.metaKey
        );

        if (existingCustomerMetaIndex >= 0) {
          // Update existing meta
          customerMeta[existingCustomerMetaIndex].value = params.metaValue;
        } else {
          // Add new meta
          customerMeta.push({
            key: params.metaKey,
            value: params.metaValue,
          });
        }

        // Update the customer with the modified meta_data
        const updateCustomerMetaResponse = await client.put(
          `/customers/${params.customerId}`,
          {
            meta_data: customerMeta,
          }
        );

        return updateCustomerMetaResponse.data.meta_data;

      case "delete_customer_meta":
        if (!params.customerId) {
          throw new Error("Customer ID is required");
        }
        if (!params.metaKey) {
          throw new Error("Meta key is required");
        }

        // First get the customer to see if the meta key exists
        const getCustomerForDeleteResponse = await client.get(
          `/customers/${params.customerId}`
        );
        let customerForDelete = getCustomerForDeleteResponse.data;
        let currentCustomerMeta: WooMetaData[] =
          customerForDelete.meta_data || [];

        // Filter out the meta key to delete
        const updatedCustomerMeta = currentCustomerMeta.filter(
          (meta: WooMetaData) => meta.key !== params.metaKey
        );

        // Update the customer with the filtered meta_data
        const deleteCustomerMetaResponse = await client.put(
          `/customers/${params.customerId}`,
          {
            meta_data: updatedCustomerMeta,
          }
        );

        return deleteCustomerMetaResponse.data.meta_data;

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

// Create Express app with CORS
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// MCP /message endpoint for Streamable HTTP Transport  
app.post('/message', async (req, res) => {
  let request: JsonRpcRequest;
  
  try {
    request = req.body;
    if (request.jsonrpc !== "2.0") {
      throw new Error("Invalid JSON-RPC version");
    }
  } catch (error) {
    return res.json({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "Parse error",
          data: error instanceof Error ? error.message : String(error),
        },
    });
  }

  try {
    let result;
    
    // Handle MCP protocol methods
    switch (request.method) {
      case "initialize":
        result = await handleMcpInitialization();
        break;
      case "tools/list":
        result = await handleListTools();
        break;
      default:
        // Handle WooCommerce/WordPress methods
        result = await handleWooCommerceRequest(request.method, request.params);
        break;
    }

    res.json({
        jsonrpc: "2.0",
        id: request.id,
        result,
    });
  } catch (error) {
    res.json({
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : String(error),
        },
    });
  }
});

// Start the server
const PORT = parseInt(process.env.PORT || '80', 10);
const HOST = process.env.HOST || '0.0.0.0';
const BASE_URL = process.env.BASE_URL || `https://others-woomcp.g5n7ma.easypanel.host`;

app.listen(PORT, HOST, () => {
  console.log(`🚀 WooCommerce MCP Server running on ${HOST}:${PORT}`);
  console.log(`📡 MCP endpoint: ${BASE_URL}/message`);
  console.log(`❤️  Health check: ${BASE_URL}/health`);
  console.log(`🌍 Deployment: Easypanel (${BASE_URL})`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Gracefully shutting down server...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
  process.exit(0);
});
