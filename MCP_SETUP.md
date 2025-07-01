# WooCommerce MCP Server Configuration Guide

This guide shows you how to configure the WooCommerce MCP server for use with MCP-compatible clients like Claude Desktop, Continue, or other AI assistants.

## Configuration Files

Two configuration files are provided:

1. **`mcp-config.json`** - Basic configuration template
2. **`mcp-config-example.json`** - Detailed example with proper key formats

## Setup Instructions

### Step 1: Get Your WooCommerce API Credentials

1. Log into your WordPress admin dashboard
2. Navigate to **WooCommerce → Settings → Advanced → REST API**
3. Click **"Add Key"**
4. Set the following:
   - **Description**: MCP Server Access
   - **User**: Select an admin user
   - **Permissions**: Read/Write (or Read if you only need read access)
5. Click **"Generate API Key"**
6. Copy the **Consumer Key** (starts with `ck_`) and **Consumer Secret** (starts with `cs_`)

### Step 2: Get WordPress Credentials (Optional)

Only needed if you want to manage WordPress posts/content:

1. For **Username**: Use your WordPress admin username
2. For **Password**: 
   - **Recommended**: Create an Application Password in **Users → Your Profile → Application Passwords**
   - **Alternative**: Use your regular WordPress password (less secure)

### Step 3: Configure Your MCP Client

#### For Claude Desktop:

1. Locate your Claude Desktop config file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. Add the WooCommerce server configuration:

```json
{
  "mcpServers": {
    "woocommerce": {
      "command": "node",
      "args": ["/path/to/woocommerce-mcp-server/build/index.js"],
      "env": {
        "WORDPRESS_SITE_URL": "https://yourstore.com",
        "WOOCOMMERCE_CONSUMER_KEY": "ck_your_actual_consumer_key_here",
        "WOOCOMMERCE_CONSUMER_SECRET": "cs_your_actual_consumer_secret_here",
        "WORDPRESS_USERNAME": "your_wp_username",
        "WORDPRESS_PASSWORD": "your_wp_app_password"
      }
    }
  }
}
```

#### For Other MCP Clients:

Use the same configuration format, adjusting the file path as needed for your system.

### Step 4: Replace Placeholder Values

Update the configuration with your actual values:

- **`WORDPRESS_SITE_URL`**: Your full WordPress site URL (e.g., `https://mystore.com`)
- **`WOOCOMMERCE_CONSUMER_KEY`**: The consumer key from Step 1 (starts with `ck_`)
- **`WOOCOMMERCE_CONSUMER_SECRET`**: The consumer secret from Step 1 (starts with `cs_`)
- **`WORDPRESS_USERNAME`**: Your WordPress username (only if using WordPress API methods)
- **`WORDPRESS_PASSWORD`**: Your WordPress application password (only if using WordPress API methods)

### Step 5: Update File Paths

Make sure the path in `"args"` points to your actual build directory:

- **Development**: `["build/index.js"]` (if running from project directory)
- **Production**: `["/full/path/to/woocommerce-mcp-server/build/index.js"]`

## Security Best Practices

1. **Use Application Passwords**: Instead of your main WordPress password, create application passwords
2. **Limit API Permissions**: Set WooCommerce API permissions to the minimum required (Read vs Read/Write)
3. **Secure Your Config**: Keep your configuration files secure and don't commit them to version control
4. **HTTPS Required**: Ensure your WordPress site uses HTTPS for API security

## Testing Your Configuration

After setting up, restart your MCP client and test with basic commands:

- "Show me my recent WooCommerce orders"
- "List my products" 
- "Get my store information"

## Available Features

Once configured, you can use the MCP server to:

### WooCommerce Operations:
- Manage products, categories, tags, and attributes
- Handle orders, customers, and order notes
- Configure shipping zones and methods
- Manage taxes, coupons, and payment gateways
- Generate reports and view system status

### WordPress Operations (if credentials provided):
- Create and manage WordPress posts
- Handle post metadata
- Content management tasks

## Troubleshooting

### Common Issues:

1. **"Authentication failed"**: Check your consumer key/secret
2. **"Site not found"**: Verify your WordPress site URL
3. **"Permission denied"**: Ensure API user has proper WooCommerce permissions
4. **"Command not found"**: Check the file path in your configuration

### Debug Mode:

To enable debug logging, you can modify the environment variables or check your MCP client's logs for detailed error messages.

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `WORDPRESS_SITE_URL` | Yes | Your WordPress site URL |
| `WOOCOMMERCE_CONSUMER_KEY` | Yes | WooCommerce REST API consumer key |
| `WOOCOMMERCE_CONSUMER_SECRET` | Yes | WooCommerce REST API consumer secret |
| `WORDPRESS_USERNAME` | Optional | WordPress username for post management |
| `WORDPRESS_PASSWORD` | Optional | WordPress password/app password |

## Support

For issues with the MCP server itself, check the [GitHub repository](https://github.com/techspawn/woocommerce-mcp-server) for documentation and support. 