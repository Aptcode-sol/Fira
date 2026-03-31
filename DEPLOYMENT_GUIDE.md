# FIRA Deployment Guide - EC2 + PM2 + CI/CD

## 📋 Prerequisites

- EC2 instance (Ubuntu or Amazon Linux)
- Git installed on EC2
- Node.js 18+ installed on EC2
- PM2 globally installed
- GitHub repository
- SSH key pair for EC2 access

---

## 🚀 PART 1: EC2 Initial Setup

### 1.1 Connect to your EC2 instance

```bash
ssh -i your-key.pem ec2-user@your-ec2-ip
# or for Ubuntu AMI:
ssh -i your-key.pem ubuntu@your-ec2-ip
```

### 1.2 Install Node.js and PM2

```bash
# Update system
sudo yum update -y  # Amazon Linux
# or: sudo apt update && sudo apt upgrade -y  # Ubuntu

# Install Node.js 18 LTS
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install nodejs -y

# or for Ubuntu:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
sudo apt install nodejs -y

# Install PM2 globally
sudo npm install -g pm2

# Enable PM2 to restart on system reboot
pm2 startup
# Run the output command that appears

# Create logs directory
mkdir -p ~/logs
```

### 1.3 Clone your repository

```bash
cd ~
git clone https://github.com/your-username/fira.git
cd fira
```

### 1.4 Setup environment files

```bash
# Create .env files for each service
# Server
cat > server/.env << 'EOF'
NODE_ENV=production
PORT=5000
MONGODB_URI=your_mongodb_connection
JWT_SECRET=your_jwt_secret
# Add other required variables
EOF

# Admin (if needed)
cat > admin/.env << 'EOF'
VITE_API_URL=https://your-domain.com/api
EOF

# Client (Next.js)
cat > client/.env.production << 'EOF'
NEXT_PUBLIC_API_URL=https://your-domain.com/api
EOF
```

### 1.5 Build all applications

```bash
cd ~/fira
chmod +x build.sh
./build.sh
```

---

## 🎯 PART 2: PM2 Configuration & Start

### 2.1 Update ecosystem.config.js with your settings

```bash
# Edit the configuration file
nano ecosystem.config.js

# Change these values:
# - EC2 user (ec2-user or ubuntu)
# - Your EC2 public IP/domain
# - Path to your EC2 key pair
```

### 2.2 Start all applications

```bash
cd ~/fira

# Start with ecosystem config
pm2 start ecosystem.config.js --env production

# Save PM2 config (auto-restart on reboot)
pm2 save

# View all running processes
pm2 status

# View logs
pm2 logs
```

### 2.3 Verify all apps are running

```bash
# Check individual app logs
pm2 logs fira-backend
pm2 logs fira-admin
pm2 logs fira-client

# Check if ports are listening
lsof -i :5000  # Backend
lsof -i :3001  # Admin
lsof -i :3000  # Frontend
```

---

## 🔄 PART 3: CI/CD Setup with GitHub Actions

### 3.1 Add SSH keys to GitHub Secrets

1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Add these secrets:

**`EC2_HOST`**

```
your-ec2-public-ip-or-domain
```

**`EC2_PRIVATE_KEY`**

```bash
# Copy content of your .pem file
cat /path/to/your-key.pem
# Paste entire content in GitHub secret
```

### 3.2 Configure EC2 to accept GitHub Actions

On your EC2 instance, add GitHub's IP ranges to allow SSH (optional but recommended):

```bash
# Or simply ensure your security group allows SSH from your GitHub Actions IP
# For testing, you can allow 0.0.0.0/0 for SSH temporarily (not recommended for production)
```

### 3.3 Test GitHub Actions Workflow

1. Push a change to `main` branch
2. Go to GitHub → Actions tab
3. Watch the workflow execute
4. Verify deployment on EC2:

```bash
ssh -i your-key.pem ec2-user@your-ec2-ip
pm2 status
pm2 logs
```

---

## ⚙️ PART 4: Manual Deployment (If needed)

### 4.1 Deploy without CI/CD

```bash
ssh -i your-key.pem ec2-user@your-ec2-ip
cd fira
git pull origin main

# Rebuild and restart
chmod +x build.sh
./build.sh

pm2 restart all
```

### 4.2 Restart individual services

```bash
pm2 restart fira-backend
pm2 restart fira-admin
pm2 restart fira-client
```

---

## 🔧 PART 5: Nginx Reverse Proxy (Recommended)

Setup Nginx to route traffic to your PM2 apps:

### 5.1 Install Nginx

```bash
sudo yum install nginx -y  # Amazon Linux
# or: sudo apt install nginx -y  # Ubuntu

sudo systemctl start nginx
sudo systemctl enable nginx
```

### 5.2 Configure Nginx

```bash
sudo nano /etc/nginx/conf.d/fira.conf
```

Add this configuration:

```nginx
upstream backend {
    server localhost:5000;
}

upstream admin {
    server localhost:3001;
}

upstream frontend {
    server localhost:3000;
}

server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Frontend (Next.js)
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Admin Dashboard
    location /admin {
        proxy_pass http://admin;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5.3 Enable SSL (using Let's Encrypt)

```bash
sudo yum install certbot python3-certbot-nginx -y
# or: sudo apt install certbot python3-certbot-nginx -y

sudo certbot certonly --nginx -d your-domain.com -d www.your-domain.com

sudo systemctl reload nginx
```

---

## 📊 Monitoring & Logging

### View real-time logs

```bash
pm2 logs                    # All apps
pm2 logs fira-backend      # Specific app
pm2 logs -f               # Follow logs
```

### Monitor resource usage

```bash
pm2 monit
```

### View process details

```bash
pm2 info fira-backend
pm2 show fira-backend
```

---

## 🔄 Common Operations

### Restart all apps

```bash
pm2 restart all
```

### Stop all apps

```bash
pm2 stop all
```

### Delete all apps

```bash
pm2 delete all
```

### Update code and redeploy

```bash
cd ~/fira
git pull origin main
./build.sh
pm2 restart all
```

---

## 🛡️ Security Best Practices

1. **Never commit .env files** - Use `.env.example` instead
2. **Use SSH keys** - Never use password authentication on EC2
3. **Enable Security Groups** - Restrict SSH access to your IP
4. **Use HTTPS only** - Configure SSL certificates
5. **Monitor logs** - Check PM2 logs regularly
6. **Update dependencies** - Run `npm audit fix` regularly
7. **Use environment variables** - Never hardcode secrets

---

## ❌ Troubleshooting

### Apps not starting

```bash
pm2 logs
pm2 show fira-backend
```

### Port already in use

```bash
# Kill process on port
sudo lsof -i :5000 | grep LISTEN | awk '{print $2}' | xargs sudo kill -9
```

### GitHub Actions failing

- Check logs in GitHub Actions tab
- Verify EC2_HOST and EC2_PRIVATE_KEY secrets
- Ensure EC2 security group allows SSH
- Check EC2 instance has internet access

### Memory issues

- Check PM2 memory limits in ecosystem.config.js
- Monitor with: `pm2 monit`

---

## 📱 Backup & Recovery

### Backup PM2 configuration

```bash
pm2 save
pm2 startup
```

### Export/Import PM2 config

```bash
pm2 ecosystem
pm2 start ecosystem.config.js
```

---

**Deployment complete! Your FIRA application is now running on EC2 with automatic CI/CD updates.**
