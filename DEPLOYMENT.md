# Mama Talk - Render.com Deployment Guide

## 🚀 Quick Deployment Steps

### 1. Prepare Your Repository

```bash
# Make sure all changes are committed
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### 2. Create New Web Service on Render.com

1. **Go to [Render.com](https://render.com)** and sign in
2. **Click "New +"** → **"Web Service"**
3. **Connect your GitHub repository**
4. **Configure the service:**

#### Service Configuration:

- **Name:** `mama-talk` (or your preferred name)
- **Environment:** `Node`
- **Region:** Choose closest to your users
- **Branch:** `main`
- **Build Command:**
  ```bash
  npm install && npm run build
  ```
- **Start Command:**
  ```bash
  npm start
  ```

#### Environment Variables:

Add these in the Render dashboard:

```
NODE_ENV=production
PORT=10000
```

### 3. Update CORS Configuration

After deployment, update `server.js` with your actual Render URL:

```javascript
origin: process.env.NODE_ENV === 'production'
  ? ['https://YOUR-APP-NAME.onrender.com']
  : ['http://localhost:5173', 'http://localhost:3000'],
```

### 4. HTTPS Requirements

⚠️ **Important for WebRTC:**

- Render provides HTTPS by default
- WebRTC requires HTTPS in production
- Camera/microphone access requires secure context

## 🔧 File Changes Made for Deployment

### package.json

- Added `"start": "node server.js"`
- Added `"postinstall": "npm run build"`

### server.js

- Updated CORS configuration for production
- Added client-side routing support
- Environment-based socket configuration

### App.vue

- Dynamic socket URL based on environment
- Production vs development detection

## 🌐 Post-Deployment Steps

1. **Test the deployed application**
2. **Update CORS origins** with actual Render URL
3. **Test video calling** (requires HTTPS)
4. **Monitor logs** in Render dashboard

## 🔍 Troubleshooting

### Common Issues:

1. **Build fails:** Check that all dependencies are in `dependencies`, not `devDependencies`
2. **Socket connection fails:** Verify CORS configuration
3. **Camera not working:** Ensure HTTPS and permissions
4. **404 on refresh:** Client-side routing should be handled by server

### Logs:

- Check Render dashboard logs for errors
- Use browser DevTools for client-side debugging

## 📊 Production Considerations

### Performance:

- Static files served from `dist/` folder
- Gzip compression (Render handles this)
- CDN distribution (Render provides global CDN)

### Security:

- HTTPS enforcement
- CORS properly configured
- Environment variables for sensitive data

### Monitoring:

- Use Render's built-in monitoring
- Set up health checks if needed
- Monitor WebRTC connection success rates

## 🎯 Next Steps

1. **Custom Domain:** Add your own domain in Render settings
2. **SSL Certificate:** Render provides free SSL
3. **Scaling:** Upgrade plan if needed for more resources
4. **Monitoring:** Set up alerts for downtime

Your video calling app will be available at:
`https://YOUR-APP-NAME.onrender.com`
