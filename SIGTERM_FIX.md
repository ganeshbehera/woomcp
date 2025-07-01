# SIGTERM Error Fix Guide

## 🚨 Problem Identified

Your WooCommerce SSE server is **starting correctly** but crashing with `SIGTERM` error. This happens because:

1. **Package.json had syntax error** (`git` text accidentally added)
2. **Health checks are failing** (Easypanel sends SIGTERM when health checks fail)
3. **Old cached npm command** still being used by Easypanel
4. **Insufficient startup time** for health checks

## ✅ Fixes Applied

### 1. **Fixed Package.json Syntax Error**
- Removed accidental `git` text from dependencies
- Updated npm start script

### 2. **Enhanced Server Stability**
- Added graceful shutdown handling
- Improved error handling for uncaught exceptions
- Added server timeout configurations
- Added startup delay for proper initialization

### 3. **Improved Health Checks**
- Enhanced `/health` endpoint with more details
- Added `/ready` endpoint for readiness probes
- Added error handling in health check responses
- Added root endpoint (`/`) for basic connectivity test

### 4. **Better Resource Configuration**
- Increased memory allocation
- Longer health check timeouts
- Multiple probe configurations

## 🚀 How to Fix in Easypanel

### **Method 1: Clear Cache & Redeploy (Recommended)**

1. **Go to your app** in Easypanel dashboard
2. **Delete the app completely**
3. **Create new app** with these settings:

#### **Build Settings:**
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Port**: `80`

#### **Environment Variables:**
```env
SERVER_MODE=http
PORT=80
NODE_ENV=production
EASYPANEL_DOMAIN=https://others-woomcp.g5n7ma.easypanel.host
DEBUG=true
WORDPRESS_SITE_URL=https://your-wordpress-site.com
WOOCOMMERCE_CONSUMER_KEY=ck_your_consumer_key_here
WOOCOMMERCE_CONSUMER_SECRET=cs_your_consumer_secret_here
```

#### **Resources:**
- **Memory**: `1024 MB`
- **CPU**: `1.0`

#### **Health Check:**
- **Path**: `/health`
- **Port**: `80`
- **Initial Delay**: `90 seconds`
- **Period**: `30 seconds`
- **Timeout**: `15 seconds`
- **Failure Threshold**: `5`

#### **Readiness Probe:**
- **Path**: `/ready`
- **Port**: `80`
- **Initial Delay**: `45 seconds`
- **Period**: `15 seconds`

### **Method 2: Use Config File**

Upload `easypanel-debug.yml` to Easypanel with all correct settings.

### **Method 3: Manual Update (If keeping existing app)**

1. **Clear Build Cache** in Easypanel
2. **Update Environment Variables** (add the ones above)
3. **Update Resource Settings** (increase memory to 1024MB)
4. **Update Health Check Settings** (increase timeouts)
5. **Force Rebuild** the application

## 🧪 Expected Results After Fix

### **Correct Startup Logs:**
```
Node.js version: v20.x.x
Environment: production
Starting WooCommerce server in http mode...
WooCommerce HTTP/SSE Server running on port 80
SSE endpoints available at: https://others-woomcp.g5n7ma.easypanel.host/events/{channel}
API endpoint available at: https://others-woomcp.g5n7ma.easypanel.host/api/woocommerce
Health check: https://others-woomcp.g5n7ma.easypanel.host/health
Server ready and accepting connections
```

### **No More Errors:**
```
❌ npm error signal SIGTERM          ← Should be GONE
❌ npm error command failed          ← Should be GONE  
❌ Service is not reachable          ← Should be GONE
```

## 🔍 Test Your Fixed Server

### **1. Health Check**
```bash
curl https://others-woomcp.g5n7ma.easypanel.host/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "server": "WooCommerce MCP/SSE Server",
  "timestamp": "2025-07-01T18:00:00Z",
  "mode": "http",
  "port": "80",
  "uptime": 120.5,
  "memory": {...},
  "pid": 1234
}
```

### **2. Root Endpoint**
```bash
curl https://others-woomcp.g5n7ma.easypanel.host/
```

**Expected Response:**
```json
{
  "message": "WooCommerce MCP/SSE Server",
  "version": "1.0.0",
  "endpoints": {
    "health": "/health",
    "ready": "/ready",
    "sse": "/events/{channel}",
    "api": "/api/woocommerce"
  }
}
```

### **3. SSE Stream**
```bash
curl -N -H "Accept: text/event-stream" \
  https://others-woomcp.g5n7ma.easypanel.host/events/orders
```

**Expected Response:**
```
data: {"type":"connected","channel":"orders","timestamp":"2025-07-01T18:00:00Z"}
```

### **4. API Call**
```bash
curl -X POST https://others-woomcp.g5n7ma.easypanel.host/api/woocommerce \
  -H "Content-Type: application/json" \
  -d '{"method": "get_products", "params": {"perPage": 5}}'
```

## 🔧 Troubleshooting

### **If still getting SIGTERM:**

1. **Check logs** for specific error messages
2. **Increase health check delays** even more (try 180 seconds initial delay)
3. **Verify environment variables** are set correctly
4. **Check resource limits** (increase memory to 2GB if needed)
5. **Test locally** first with `npm start`

### **If health checks are failing:**

1. **Test health endpoint directly** in browser
2. **Check if port 80 is accessible** internally
3. **Verify server is binding to 0.0.0.0** not just localhost
4. **Look for firewall/network issues**

### **If domain is not accessible:**

1. **Check domain configuration** in Easypanel
2. **Verify SSL certificate** is working
3. **Test with HTTP first** then enable HTTPS
4. **Check proxy/load balancer settings**

## 📝 Summary

The key issues were:
1. **Syntax error in package.json** ✅ Fixed
2. **Missing graceful shutdown** ✅ Fixed  
3. **Inadequate health check timeouts** ✅ Fixed
4. **Insufficient startup delay** ✅ Fixed
5. **Missing error handling** ✅ Fixed

**After applying these fixes and redeploying, your SIGTERM errors should be resolved and your SSE server should run stably!** 🎉

## 🎯 Final Commit

```bash
git add -A
git commit -m "Fix: Resolve SIGTERM errors and stabilize Easypanel deployment

- Fix package.json syntax error (remove accidental 'git' text)
- Add graceful shutdown handling for SIGTERM/SIGINT signals
- Enhance health check endpoints with error handling
- Add server error handling and keep-alive timeouts
- Improve startup process with initialization delay
- Add debugging output for better troubleshooting
- Update Easypanel configuration with extended timeouts
- Add root endpoint for basic connectivity testing"
```

Once you redeploy with these fixes, your server should be stable and accessible at:
**https://others-woomcp.g5n7ma.easypanel.host/** 🚀 