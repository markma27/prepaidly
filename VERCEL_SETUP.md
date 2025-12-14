# Vercel Deployment Setup

## Environment Variables Configuration

To deploy the frontend to Vercel, you need to configure the following environment variable:

### Required Environment Variable

**`NEXT_PUBLIC_API_URL`** - The URL of your backend API server

#### For Production:
```
NEXT_PUBLIC_API_URL=https://your-backend-domain.com
```

#### For Preview/Development:
```
NEXT_PUBLIC_API_URL=https://your-backend-domain.com
```

### How to Set Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new environment variable:
   - **Name**: `NEXT_PUBLIC_API_URL`
   - **Value**: Your backend API URL (e.g., `https://prepaidly-backend.onrender.com` or your custom domain)
   - **Environment**: Select all environments (Production, Preview, Development)
4. Click **Save**
5. Redeploy your application for the changes to take effect

### Backend CORS Configuration

Make sure your backend CORS configuration allows requests from your Vercel domain:

```java
// In WebConfig.java
registry.addMapping("/api/**")
    .allowedOrigins(
        "http://localhost:3000",  // Local development
        "https://prepaidly.vercel.app",  // Vercel production
        "https://*.vercel.app"  // All Vercel preview deployments
    )
    .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
    .allowedHeaders("*")
    .allowCredentials(true);
```

### Troubleshooting

#### "Failed to fetch" Error

If you see "Failed to fetch" error in Vercel:

1. **Check Environment Variables**: Ensure `NEXT_PUBLIC_API_URL` is set correctly in Vercel
2. **Check Backend Status**: Verify your backend is running and accessible
3. **Check CORS**: Ensure backend CORS allows your Vercel domain
4. **Check Network Tab**: Open browser DevTools → Network tab to see the actual request URL and error

#### Common Issues

- **Backend URL not set**: The frontend will show "Failed to fetch" if `NEXT_PUBLIC_API_URL` is not configured
- **CORS errors**: Backend must allow requests from Vercel domain
- **Backend not accessible**: Ensure backend is publicly accessible (not behind firewall)
- **HTTPS required**: Vercel uses HTTPS, so backend should also use HTTPS or configure CORS properly

### Example Backend URLs

- **Render**: `https://prepaidly-backend.onrender.com`
- **Fly.io**: `https://prepaidly-backend.fly.dev`
- **Railway**: `https://prepaidly-backend.railway.app`
- **Custom Domain**: `https://api.prepaidly.io`
