# AetherLog Free Deployment Guide
## Vercel (Frontend) + Railway (Backend) + Neon (Database)

This guide gets you deployed in **~15 minutes** with **$0 cost**.

---

## Step 1: Database (Neon PostgreSQL) 🗄️

### 1.1 Create Neon Account
1. Go to [neon.tech](https://neon.tech)
2. Sign up with GitHub
3. Click **"Create Project"**
4. Name: `aetherlog`
5. Region: Choose closest to you

### 1.2 Get Connection String
1. Click your project → **"Connection Details"**
2. Copy the connection string (looks like):
   ```
   postgresql://username:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
3. **Save this** - you'll need it for Railway!

---

## Step 2: Backend (Railway) 🚂

### 2.1 Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub

### 2.2 Deploy Backend
1. Click **"New Project"** → **"Deploy from GitHub repo"**
2. Select your `aetherlog` repository
3. Railway will detect it - click **"Add Service"**
4. **Important**: Set the root directory to `/backend`

### 2.3 Configure Environment Variables
Go to your service → **Variables** tab → Add these:

```env
# Database (from Neon)
DATABASE_URL=postgresql://username:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require

# JWT Secret (generate random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-to-random-string

# Frontend URL (update after Vercel deploy)
FRONTEND_URL=https://your-app.vercel.app

# Email (Resend - optional)
RESEND_API_KEY=re_your_key
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASS=re_your_key
SMTP_FROM_EMAIL=alerts@yourdomain.com
SMTP_FROM_NAME=AetherLog

# AI (optional)
GEMINI_API_KEY=your_gemini_key
PYTHON_SERVICE_URL=https://your-python-service.railway.app

# Port (Railway sets this automatically, but just in case)
PORT=4000
NODE_ENV=production
```

### 2.4 Configure Build Settings
Go to **Settings** tab:
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start`
- **Root Directory**: `/backend`

### 2.5 Get Your Backend URL
After deploy, Railway gives you a URL like:
```
https://aetherlog-backend-production.up.railway.app
```
**Save this** - you'll need it for the frontend!

---

## Step 3: Frontend (Vercel) ▲

### 3.1 Update Frontend Config
Before deploying, update `src/config.ts` with your Railway URL:

```typescript
const prodConfig: Config = {
  apiUrl: 'https://YOUR-RAILWAY-URL.up.railway.app',
  wsUrl: 'wss://YOUR-RAILWAY-URL.up.railway.app',
  pythonUrl: 'https://YOUR-PYTHON-RAILWAY-URL.up.railway.app'  // or remove if not using
};
```

### 3.2 Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub

### 3.3 Deploy Frontend
1. Click **"Add New Project"**
2. Import your `aetherlog` repository
3. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `.` (root, not /backend)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 3.4 Add Environment Variables in Vercel
In the Vercel project settings → Environment Variables, add:

```env
VITE_WS_URL=wss://YOUR-RAILWAY-URL.up.railway.app
```

> ⚠️ **Do NOT set `VITE_API_URL`!** The `vercel.json` rewrite proxies `/api/*` to Railway,
> which avoids CORS issues. Setting `VITE_API_URL` would cause direct cross-origin requests.

### 3.5 Deploy!
Click **"Deploy"** - Vercel will build and deploy your frontend.

Your app will be live at:
```
https://your-app.vercel.app
```

---

## Step 4: Update Railway CORS 🔗

Go back to Railway and update `FRONTEND_URL`:
```env
FRONTEND_URL=https://your-app.vercel.app
```

---

## Step 5: Python Service (Optional) 🐍

If you want AI features, deploy Python service to Railway too:

1. In Railway, click **"New Service"** → **"Deploy from GitHub"**
2. Set **Root Directory**: `/python-service`
3. Add variables:
   ```env
   PORT=5001
   ```
4. Railway auto-detects Python and deploys

---

## Quick Reference

| Service | URL Pattern |
|---------|-------------|
| Frontend | `https://aetherlog.vercel.app` |
| Backend | `https://aetherlog-backend.up.railway.app` |
| Python AI | `https://aetherlog-python.up.railway.app` |

---

## CI/CD (Automatic!)

Both Vercel and Railway auto-deploy when you push to `main`:

```bash
git add .
git commit -m "New feature"
git push origin main
# ✅ Both frontend and backend auto-deploy!
```

---

## Troubleshooting

### CORS Errors
Make sure `FRONTEND_URL` in Railway matches your Vercel URL exactly.

### Database Connection Failed
1. Check Neon connection string has `?sslmode=require`
2. Verify the string is copied correctly (no extra spaces)

### WebSocket Not Connecting
Update `wsUrl` in `src/config.ts` to use `wss://` (not `ws://`)

---

## Cost Summary

| Service | Cost |
|---------|------|
| Vercel (Frontend) | **FREE** |
| Railway (Backend) | **FREE** ($5 credit/month) |
| Neon (Database) | **FREE** (512MB) |
| **Total** | **$0/month** |

---

## Need Custom Domain?

Both Vercel and Railway support free custom domains:

1. **Vercel**: Settings → Domains → Add your domain
2. **Railway**: Settings → Domains → Add your domain
3. Update DNS A/CNAME records to point to their servers
