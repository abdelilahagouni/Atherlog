# AetherLog Ubuntu Server Deployment Guide

This guide covers deploying AetherLog to a free Ubuntu VPS with:
- **3 Subdomains**: `app.yourdomain.com`, `api.yourdomain.com`, `ai.yourdomain.com`
- **SSL Certificates**: Free via Let's Encrypt
- **CI/CD**: GitHub Actions auto-deploy on push

---

## 1. Get a Free Ubuntu Server

### Option A: Oracle Cloud Free Tier (Recommended - Best Free Option)
- **24GB RAM, 4 CPUs** - Always Free!
- Sign up at [cloud.oracle.com](https://cloud.oracle.com)
- Create a "Compute Instance" with Ubuntu 22.04

### Option B: Google Cloud Free Tier
- **e2-micro** (1 vCPU, 1GB RAM) - Free for 1 year
- Sign up at [cloud.google.com](https://cloud.google.com)

### Option C: AWS Free Tier
- **t2.micro** (1 vCPU, 1GB RAM) - Free for 12 months
- Sign up at [aws.amazon.com](https://aws.amazon.com)

---

## 2. Domain Setup

### Buy a Domain (or use free)
- **Paid**: Namecheap, Cloudflare ($10-15/year)
- **Free**: Freenom (.tk, .ml domains) or use Cloudflare Tunnel

### DNS Configuration
Add these A records pointing to your server IP:

| Type | Name | Value |
|------|------|-------|
| A | app | YOUR_SERVER_IP |
| A | api | YOUR_SERVER_IP |
| A | ai | YOUR_SERVER_IP |

---

## 3. Server Initial Setup

SSH into your server:

```bash
ssh ubuntu@YOUR_SERVER_IP
```

### Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python 3.11 & pip
sudo apt install -y python3.11 python3-pip python3.11-venv

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx

# Install Git
sudo apt install -y git
```

---

## 4. PostgreSQL Database Setup

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE aetherlog;
CREATE USER aetherlog_user WITH ENCRYPTED PASSWORD 'YOUR_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE aetherlog TO aetherlog_user;
\q
```

---

## 5. Clone & Setup Application

```bash
# Create app directory
sudo mkdir -p /var/www/aetherlog
sudo chown -R $USER:$USER /var/www/aetherlog
cd /var/www/aetherlog

# Clone from GitHub
git clone https://github.com/YOUR_USERNAME/aetherlog.git .

# Install frontend dependencies
npm install

# Build frontend for production
npm run build

# Install backend dependencies
cd backend
npm install

# Create environment file
cp .env.example .env
nano .env
```

### Backend .env Configuration

```env
# Database
DATABASE_URL=postgresql://aetherlog_user:YOUR_STRONG_PASSWORD@localhost:5432/aetherlog

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your-super-secret-jwt-key-here

# Frontend URL
FRONTEND_URL=https://app.yourdomain.com

# Email (Resend)
RESEND_API_KEY=re_your_key
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASS=re_your_key
SMTP_FROM_EMAIL=alerts@yourdomain.com
SMTP_FROM_NAME=AetherLog

# AI Services
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
PYTHON_SERVICE_URL=http://localhost:5001

# Port
PORT=4000
```

---

## 6. Python AI Service Setup

```bash
cd /var/www/aetherlog/python-service

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
echo "PORT=5001" > .env
```

---

## 7. PM2 Process Management

Create PM2 ecosystem file:

```bash
cd /var/www/aetherlog
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [
    {
      name: 'aetherlog-backend',
      cwd: '/var/www/aetherlog/backend',
      script: 'npm',
      args: 'run start',
      env: {
        NODE_ENV: 'production',
        PORT: 4000
      }
    },
    {
      name: 'aetherlog-python',
      cwd: '/var/www/aetherlog/python-service',
      script: 'venv/bin/python',
      args: 'app.py',
      env: {
        PORT: 5001
      }
    }
  ]
};
```

Start services:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow the instructions it prints
```

---

## 8. Nginx Configuration

### Frontend (app.yourdomain.com)

```bash
sudo nano /etc/nginx/sites-available/app.yourdomain.com
```

```nginx
server {
    listen 80;
    server_name app.yourdomain.com;

    root /var/www/aetherlog/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}
```

### Backend API (api.yourdomain.com)

```bash
sudo nano /etc/nginx/sites-available/api.yourdomain.com
```

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Python AI Service (ai.yourdomain.com)

```bash
sudo nano /etc/nginx/sites-available/ai.yourdomain.com
```

```nginx
server {
    listen 80;
    server_name ai.yourdomain.com;

    location / {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Enable Sites

```bash
sudo ln -s /etc/nginx/sites-available/app.yourdomain.com /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/api.yourdomain.com /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/ai.yourdomain.com /etc/nginx/sites-enabled/

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

---

## 9. SSL Certificates (Let's Encrypt)

```bash
sudo certbot --nginx -d app.yourdomain.com -d api.yourdomain.com -d ai.yourdomain.com
```

Certbot will automatically configure SSL and set up auto-renewal.

---

## 10. Firewall Setup

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 11. GitHub CI/CD Setup

### Create Deploy Key

On your server:

```bash
ssh-keygen -t ed25519 -C "deploy@aetherlog" -f ~/.ssh/deploy_key
cat ~/.ssh/deploy_key.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/deploy_key  # Copy this private key
```

### GitHub Secrets

Go to your GitHub repo → Settings → Secrets → Actions:

| Secret Name | Value |
|-------------|-------|
| `SERVER_HOST` | YOUR_SERVER_IP |
| `SERVER_USER` | ubuntu |
| `SSH_PRIVATE_KEY` | (paste the private key) |

### Create GitHub Action

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Deploy to Server
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/aetherlog
            
            # Pull latest changes
            git pull origin main
            
            # Frontend
            npm install
            npm run build
            
            # Backend
            cd backend
            npm install
            
            # Restart services
            pm2 restart all
            
            echo "✅ Deployment complete!"
```

---

## 12. Update Frontend API URLs

Before deploying, update your frontend to use the production API:

Create `src/config.ts`:

```typescript
const config = {
  apiUrl: import.meta.env.PROD 
    ? 'https://api.yourdomain.com' 
    : '/api',
  wsUrl: import.meta.env.PROD 
    ? 'wss://api.yourdomain.com' 
    : `ws://${window.location.hostname}:4000`,
  pythonUrl: import.meta.env.PROD 
    ? 'https://ai.yourdomain.com' 
    : 'http://localhost:5001'
};

export default config;
```

---

## Quick Commands Reference

```bash
# View logs
pm2 logs

# Restart all services
pm2 restart all

# Check status
pm2 status

# Manual deploy
cd /var/www/aetherlog && git pull && npm run build && pm2 restart all

# Check Nginx status
sudo systemctl status nginx

# Renew SSL (auto, but manual if needed)
sudo certbot renew
```

---

## Cost Summary

| Service | Cost |
|---------|------|
| Oracle Cloud VM | **FREE** (Always Free Tier) |
| Domain (.com) | ~$12/year |
| SSL Certificate | **FREE** (Let's Encrypt) |
| **Total** | **~$12/year** or **$0** with free domain |

---

## Need Help?

- **Oracle Cloud Setup**: [Oracle Free Tier Guide](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm)
- **Nginx**: [nginx.org/docs](https://nginx.org/en/docs/)
- **PM2**: [pm2.keymetrics.io](https://pm2.keymetrics.io/)
- **Let's Encrypt**: [certbot.eff.org](https://certbot.eff.org/)
