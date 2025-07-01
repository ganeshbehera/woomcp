# WooCommerce SSE Server Usage Guide

This enhanced WooCommerce MCP server now supports **Server-Sent Events (SSE)** for real-time data streaming from your WooCommerce store.

## Server Modes

The server supports three operating modes:

### 1. **Hybrid Mode** (Default)
- Automatically detects if it should run as MCP (stdin/stdout) or HTTP server
- **MCP Mode**: When stdin is piped (for AI assistants)
- **HTTP Mode**: When running in terminal

### 2. **HTTP Mode** 
Set `SERVER_MODE=http` for dedicated HTTP server with SSE support

### 3. **MCP Mode**
Set `SERVER_MODE=mcp` for dedicated MCP (stdin/stdout) server

## Easypanel Deployment for SSE

### 1. Using the Configuration File

Use the provided `easypanel.yml`:

```yaml
name: woocommerce-sse-server
services:
  - type: app
    data:
      projectName: woocommerce-sse-server
      serviceName: woocommerce-sse-server
      source:
        type: github
        owner: techspawn
        repo: woocommerce-mcp-server
        branch: main
      build:
        type: buildpacks
        buildCommand: npm install && npm run build
        startCommand: npm run start:http
      env:
        - name: SERVER_MODE
          value: http
        - name: PORT
          value: "3000"
        - name: WORDPRESS_SITE_URL
          value: https://your-wordpress-site.com
        - name: WOOCOMMERCE_CONSUMER_KEY
          value: ck_your_consumer_key_here
        - name: WOOCOMMERCE_CONSUMER_SECRET
          value: cs_your_consumer_secret_here
```

### 2. Environment Variables for Easypanel

Configure these in your Easypanel environment:

| Variable | Required | Example |
|----------|----------|---------|
| `SERVER_MODE` | Yes | `http` |
| `PORT` | Yes | `3000` |
| `WORDPRESS_SITE_URL` | Yes | `https://yourstore.com` |
| `WOOCOMMERCE_CONSUMER_KEY` | Yes | `ck_abc123...` |
| `WOOCOMMERCE_CONSUMER_SECRET` | Yes | `cs_def456...` |

## SSE Endpoints

Once deployed, your server provides these endpoints:

### **Health Check**
```
GET https://your-easypanel-domain.com/health
```

Response:
```json
{
  "status": "healthy",
  "server": "WooCommerce MCP/SSE Server",
  "timestamp": "2025-01-24T10:30:00Z"
}
```

### **Server-Sent Events Streams**

#### Real-time Orders Stream
```
GET https://your-easypanel-domain.com/events/orders
```

#### Real-time Products Stream  
```
GET https://your-easypanel-domain.com/events/products
```

#### Real-time Customers Stream
```
GET https://your-easypanel-domain.com/events/customers
```

### **REST API Endpoint**
```
POST https://your-easypanel-domain.com/api/woocommerce
```

Request body:
```json
{
  "method": "get_products",
  "params": {
    "perPage": 10,
    "page": 1
  }
}
```

### **Polling Endpoint**
```
GET https://your-easypanel-domain.com/api/poll/orders?since=2025-01-24T10:00:00Z
GET https://your-easypanel-domain.com/api/poll/products?since=2025-01-24T10:00:00Z
```

## Real-time Events

When WooCommerce data changes, SSE clients receive events like:

### Product Events
```json
{
  "type": "product_created",
  "data": {
    "id": 123,
    "name": "New Product",
    "price": "29.99",
    // ... full product data
  },
  "timestamp": "2025-01-24T10:30:00Z"
}
```

### Order Events
```json
{
  "type": "order_updated", 
  "data": {
    "id": 456,
    "status": "processing",
    "total": "99.99",
    // ... full order data
  },
  "timestamp": "2025-01-24T10:30:00Z"
}
```

## JavaScript Client Example

```javascript
// Connect to SSE stream
const eventSource = new EventSource('https://your-easypanel-domain.com/events/orders');

eventSource.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
  
  if (data.type === 'order_created') {
    console.log('New order:', data.data);
  } else if (data.type === 'order_updated') {
    console.log('Order updated:', data.data);
  }
};

eventSource.onerror = function(event) {
  console.error('SSE error:', event);
};
```

## cURL Examples

### Test Health Check
```bash
curl https://your-easypanel-domain.com/health
```

### Test SSE Stream
```bash
curl -N -H "Accept: text/event-stream" \
  https://your-easypanel-domain.com/events/orders
```

### Test API Endpoint
```bash
curl -X POST https://your-easypanel-domain.com/api/woocommerce \
  -H "Content-Type: application/json" \
  -d '{
    "method": "get_products",
    "params": {"perPage": 5}
  }'
```

## Integration Examples

### React/Next.js
```jsx
import { useEffect, useState } from 'react';

function OrdersStream() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const eventSource = new EventSource('/api/events/orders');
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'order_created') {
        setOrders(prev => [data.data, ...prev]);
      }
    };

    return () => eventSource.close();
  }, []);

  return (
    <div>
      {orders.map(order => (
        <div key={order.id}>
          Order #{order.id} - ${order.total}
        </div>
      ))}
    </div>
  );
}
```

### Node.js Backend
```javascript
import axios from 'axios';

// Make API calls
const response = await axios.post('https://your-domain.com/api/woocommerce', {
  method: 'get_orders',
  params: { status: 'processing' }
});

console.log('Orders:', response.data.data);
```

## Use Cases

### 1. **Real-time Dashboards**
- Live order notifications
- Inventory level updates
- Sales metrics streaming

### 2. **Mobile Apps**
- Push notifications for new orders
- Real-time product updates
- Customer activity tracking

### 3. **Third-party Integrations**
- Webhook alternatives
- Real-time synchronization
- Event-driven workflows

### 4. **Analytics Platforms**
- Live data streaming
- Real-time reporting
- Business intelligence feeds

## Troubleshooting

### Common Issues

1. **SSE Connection Drops**
   - Check network stability
   - Implement reconnection logic
   - Verify CORS settings

2. **No Events Received**
   - Verify WooCommerce credentials
   - Check API permissions
   - Test with REST endpoint first

3. **Authentication Errors**
   - Validate consumer key/secret
   - Check WordPress site URL
   - Verify API access permissions

### Debug Mode

Set `NODE_ENV=development` for detailed logging:

```bash
NODE_ENV=development npm run start:http
```

This SSE-enabled server gives you real-time capabilities while maintaining full compatibility with the original MCP functionality! 