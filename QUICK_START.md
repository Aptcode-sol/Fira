# FIRA Deployment - Quick Start Summary

## 📦 What I Created For You

1. **ecosystem.config.js** - PM2 configuration for all 3 apps
   - Backend: Cluster mode (multi-core, port 5000)
   - Admin: Fork mode (port 3001)
   - Frontend (Next.js): Fork mode (port 3000)

2. **build.sh** - Script to build all applications at once

3. **.github/workflows/deploy.yml** - Automated CI/CD pipeline
   - Triggers on push to `main`
   - Auto-builds and deploys to EC2
   - Restarts PM2 apps automatically

4. **pm2-helper.sh** - Helper script for common operations

5. **DEPLOYMENT_GUIDE.md** - Comprehensive setup guide

---

## 🚀 Quick EC2 Setup (10 minutes)

```bash
# 1. SSH into EC2
ssh -i your-key.pem ec2-user@your-ec2-ip

# 2. Install Node.js & PM2 (run this full block)
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install nodejs -y
sudo npm install -g pm2
pm2 startup
mkdir -p ~/logs

# 3. Clone your repo
cd ~
git clone https://github.com/your-username/fira.git
cd fira

# 4. Create environment files
cat > server/.env << 'EOF'
NODE_ENV=production
PORT=5000
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
# Add other required env vars
EOF

# 5. Build & start
chmod +x build.sh
./build.sh

pm2 start ecosystem.config.js --env production
pm2 save
pm2 status
```

---

## 🔄 Setup GitHub Actions CI/CD (5 minutes)

### Step 1: Add GitHub Secrets

Go to: `GitHub Repo → Settings → Secrets → Actions`

Add two secrets:

**Secret 1: `EC2_HOST`**

```
your-ec2-public-ip
```

**Secret 2: `EC2_PRIVATE_KEY`**

```
# Paste the entire content of your .pem file
cat /path/to/your-key.pem
```

### Step 2: Update ecosystem.config.js

Edit the `deploy` section with your actual values:

- `user`: ec2-user (or ubuntu)
- `host`: Your EC2 public IP
- `key`: Path to your .pem key
- `path`: /home/ec2-user/fira (or your chosen path)
- `repo`: Your GitHub repo URL

### Step 3: Done!

Now every time you push to `main`:

```
git push origin main → GitHub Actions builds → Auto-deploys to EC2
```

---

## 📱 Quick Commands After Setup

```bash
# Check status
pm2 status

# View logs
pm2 logs

# Restart everything
pm2 restart all

# Or use helper script
chmod +x pm2-helper.sh
./pm2-helper.sh status
./pm2-helper.sh restart
./pm2-helper.sh logs

# Manual deployment
./pm2-helper.sh pull-and-deploy
```

---

## ✅ Verify Running Apps

In EC2 terminal:

```bash
# Check if ports are listening
lsof -i :5000  # Backend
lsof -i :3001  # Admin
lsof -i :3000  # Frontend

# Or from your computer
curl http://your-ec2-ip:5000/api/status
curl http://your-ec2-ip:3001
curl http://your-ec2-ip:3000
```

---

## 🔐 Add HTTPS (Recommended)

```bash
# On EC2
sudo yum install nginx certbot python3-certbot-nginx -y
sudo systemctl start nginx

# Get SSL certificate
sudo certbot certonly --standalone -d your-domain.com

# See DEPLOYMENT_GUIDE.md for full Nginx config
```

---

## 📊 Monitoring

```bash
# Real-time resource usage
pm2 monit

# Watch logs in real-time
pm2 logs -f

# Follow specific app
pm2 logs fira-backend -f
```

---

## ⚠️ Important Notes

1. **Update ecosystem.config.js** before deployment:
   - Change `ec2-user` if using Ubuntu
   - Add your EC2 IP
   - Update repo URL

2. **Add your .env files** on EC2:
   - MongoDB connection string
   - JWT secret
   - API keys
   - Never commit .env to GitHub

3. **Security**:
   - Use SSH keys (never password SSH)
   - Restrict SSH in security group
   - Use HTTPS
   - Keep pm2 logs checked

4. **CI/CD Pipeline**:
   - GitHub Actions secrets are encrypted
   - SSH connection only runs on your EC2
   - All builds happen in GitHub, then deployed

---

## 🆘 Troubleshooting

**Apps won't start?**

```bash
pm2 logs
pm2 show fira-backend
```

**Port conflict?**

```bash
lsof -i :5000
# Kill process and restart
```

**GitHub Actions failing?**

- Check GitHub Actions tab for logs
- Verify EC2_HOST and EC2_PRIVATE_KEY secrets
- Ensure EC2 security group allows SSH

**Need manual updates?**

```bash
ssh -i your-key.pem ec2-user@your-ec2-ip
cd fira
git pull origin main
./build.sh
pm2 restart all
```

---

## 📖 Full Details

See **DEPLOYMENT_GUIDE.md** for:

- Complete EC2 setup
- Detailed PM2 configuration
- Nginx reverse proxy setup
- SSL/HTTPS configuration
- Monitoring & logging
- Backup & recovery
- Security best practices

---

## 🎯 What Happens When You Push to `main`

```
1. You push to GitHub
   ↓
2. GitHub Actions workflow triggers
   ↓
3. Build all applications (verify no errors)
   ↓
4. SSH into your EC2 instance
   ↓
5. Pull latest code
   ↓
6. Install dependencies
   ↓
7. Build apps (Vite, Next.js)
   ↓
8. Delete old PM2 apps
   ↓
9. Start new PM2 apps
   ↓
10. Application updated on EC2 ✅
```

**No manual intervention needed!**

---

## 📞 Need Help?

Run helper script:

```bash
./pm2-helper.sh
```

View full deployment guide:

```bash
cat DEPLOYMENT_GUIDE.md
```

---

**Happy Deploying! 🚀**
