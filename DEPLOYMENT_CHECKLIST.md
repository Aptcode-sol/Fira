# EC2 + PM2 Deployment Checklist

## Pre-Deployment Phase

- [ ] Have your EC2 instance running (Ubuntu or Amazon Linux)
- [ ] Have SSH access to EC2 (.pem key file)
- [ ] GitHub repository created and code pushed
- [ ] All sensitive data in .env files (not committed)
- [ ] package.json files have correct start commands

## Local Setup (Before Pushing to GitHub)

- [ ] Test each application locally:
  - [ ] Server: `npm run dev` works
  - [ ] Admin: `npm run dev` works
  - [ ] Client: `npm run dev` works
- [ ] Create .env.example files (no secrets):
  - [ ] server/.env.example
  - [ ] admin/.env.example
  - [ ] client/.env.example

- [ ] Commit all deployment files to GitHub:
  - [ ] `ecosystem.config.js`
  - [ ] `build.sh`
  - [ ] `.github/workflows/deploy.yml`
  - [ ] `pm2-helper.sh`
  - [ ] `DEPLOYMENT_GUIDE.md`
  - [ ] `.env.example` files

## EC2 Initial Setup

### EC2 Instance Configuration

- [ ] EC2 instance is running
- [ ] Security group allows:
  - [ ] SSH (port 22) - from your IP
  - [ ] HTTP (port 80) - from 0.0.0.0
  - [ ] HTTPS (port 443) - from 0.0.0.0
- [ ] Elastic IP assigned (optional but recommended)
- [ ] Instance storage is sufficient (at least 20GB)

### SSH Connection Test

```bash
ssh -i /path/to/key.pem ec2-user@your-ec2-ip
# Should connect without issues
```

- [ ] Can SSH into EC2

### Install Required Software

```bash
# On EC2 terminal, run:
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install nodejs git -y
sudo npm install -g pm2
pm2 startup
mkdir -p ~/logs
```

- [ ] Node.js installed (verify: `node --version`)
- [ ] PM2 installed (verify: `pm2 --version`)
- [ ] PM2 startup configured
- [ ] Created logs directory

## Application Setup on EC2

### Clone Repository

```bash
cd ~
git clone https://github.com/your-username/fira.git
cd fira
```

- [ ] Repository cloned to `/home/ec2-user/fira` (or your path)
- [ ] All code present

### Environment Files

Create .env files with actual values (don't commit these):

**server/.env**

```
NODE_ENV=production
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
# Add other required variables
```

- [ ] `server/.env` created with all required variables

**admin/.env**

```
VITE_API_URL=http://your-ec2-ip:5000/api
```

- [ ] `admin/.env` created

**client/.env.production**

```
NEXT_PUBLIC_API_URL=http://your-ec2-ip:5000/api
```

- [ ] `client/.env.production` created

### Build Applications

```bash
cd ~/fira
chmod +x build.sh
./build.sh
```

- [ ] No build errors
- [ ] All dependencies installed
- [ ] All applications compiled successfully

### Verify Build Outputs

```bash
# Check if build directories exist
ls admin/dist/
ls client/.next/
```

- [ ] `admin/dist/` directory created
- [ ] `client/.next/` directory created

### Update PM2 Configuration

Edit `ecosystem.config.js`:

```bash
nano ecosystem.config.js
```

- [ ] `user` field updated (ec2-user or ubuntu)
- [ ] `host` field has your EC2 IP
- [ ] `key` field points to correct .pem path
- [ ] `path` field is `/home/ec2-user/fira`
- [ ] `repo` field is your GitHub URL

### Start with PM2

```bash
cd ~/fira
pm2 start ecosystem.config.js --env production
pm2 save
pm2 status
```

- [ ] PM2 apps started without errors
- [ ] `pm2 status` shows all 3 apps online:
  - [ ] fira-backend (cluster mode, max instances)
  - [ ] fira-admin (fork mode)
  - [ ] fira-client (fork mode)

### Verify Running Services

```bash
# Check if ports are open
lsof -i :5000
lsof -i :3001
lsof -i :3000

# Or test from local machine
curl http://your-ec2-ip:5000/api/health
curl http://your-ec2-ip:3001
curl http://your-ec2-ip:3000
```

- [ ] Port 5000 (Backend) - process running
- [ ] Port 3001 (Admin) - process running
- [ ] Port 3000 (Frontend) - process running
- [ ] Can access from browser or curl

## GitHub Actions CI/CD Setup

### Add Secrets to GitHub

Go to: `GitHub Repo → Settings → Secrets and variables → Actions`

**Create Secret 1: EC2_HOST**

- [ ] Secret name: `EC2_HOST`
- [ ] Value: Your EC2 public IP (e.g., `54.123.456.789`)

**Create Secret 2: EC2_PRIVATE_KEY**

- [ ] Secret name: `EC2_PRIVATE_KEY`
- [ ] Value: Entire content of your `.pem` file

```bash
cat /path/to/your-key.pem
# Copy entire output and paste in secret
```

### Verify Workflow File

```bash
# Check if workflow file exists
cat .github/workflows/deploy.yml
```

- [ ] `.github/workflows/deploy.yml` exists
- [ ] GitHub Actions can read the file

### Test Workflow (First Deployment)

```bash
# Make a small change and push
echo "# Test" >> README.md
git add README.md
git commit -m "Test CI/CD deployment"
git push origin main
```

**Monitor Deployment:**

1. Go to GitHub Actions tab
2. Click on the latest workflow run
3. Watch the build and deploy jobs

- [ ] Build job completes successfully
- [ ] Deploy job completes successfully
- [ ] No errors in logs

### Verify Deployed Application

After GitHub Actions completes:

```bash
# SSH into EC2
ssh -i your-key.pem ec2-user@your-ec2-ip

# Check PM2 status
pm2 status

# Check logs
pm2 logs

# Verify services
curl http://localhost:5000/api/health
curl http://localhost:3001
curl http://localhost:3000
```

- [ ] All PM2 apps still running
- [ ] New code deployed successfully
- [ ] Services accessible

## Optional: Setup Nginx Reverse Proxy

### Install Nginx

```bash
sudo yum install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

- [ ] Nginx installed
- [ ] Nginx running (verify: `sudo systemctl status nginx`)

### Configure Nginx

See DEPLOYMENT_GUIDE.md for full configuration

- [ ] Nginx config created at `/etc/nginx/conf.d/fira.conf`
- [ ] Config has routing rules for all 3 services
- [ ] Nginx restarts without errors: `sudo nginx -t && sudo systemctl reload nginx`

### Setup SSL (Let's Encrypt)

```bash
sudo certbot certonly --standalone -d your-domain.com
sudo certbot renew --dry-run  # Test auto-renewal
```

- [ ] SSL certificate obtained
- [ ] Certificate auto-renewal configured

### Test Through Nginx

```bash
curl https://your-domain.com/
curl https://your-domain.com/admin
curl https://your-domain.com/api/health
```

- [ ] HTTPS works
- [ ] All routes accessible through Nginx

## Monitoring & Maintenance

### Setup Monitoring

```bash
# Check real-time resource usage
pm2 monit

# View historical logs
pm2 logs
```

- [ ] PM2 monit command works
- [ ] Logs accessible

### Backup PM2 Configuration

```bash
pm2 save
pm2 startup  # Ensures auto-restart on reboot
```

- [ ] PM2 state saved
- [ ] PM2 startup configured for auto-restart

### Test PM2 Auto-restart

```bash
# Reboot EC2 and verify apps restart
sudo reboot
# Wait 2 minutes
pm2 status  # Should show all apps running
```

- [ ] Apps auto-restart after EC2 reboot

## Final Testing

### Local Development

- [ ] Test each app locally still works
- [ ] Make a feature change on local

### GitHub Actions Pipeline

```bash
git push origin main
```

- [ ] GitHub Actions triggered
- [ ] Build stage passes
- [ ] Deploy stage passes
- [ ] Email/notification received (if configured)

### EC2 Verification

```bash
ssh -i your-key.pem ec2-user@your-ec2-ip
pm2 status
pm2 logs
```

- [ ] New code deployed
- [ ] Apps running without errors
- [ ] Feature changes visible in running app

### End-to-End

- [ ] User can access frontend at domain
- [ ] Frontend connects to backend API
- [ ] Admin dashboard accessible
- [ ] All interactive features work

## Post-Deployment Maintenance

### Daily Checks

- [ ] Monitor PM2 logs for errors
- [ ] Check disk usage: `df -h`
- [ ] Check memory usage: `free -h`
- [ ] Verify services accessible

### Weekly Checks

- [ ] Review PM2 logs for patterns
- [ ] Check for failed deployments in GitHub Actions
- [ ] Test manual backup procedure

### Monthly Checks

- [ ] Update dependencies: `npm audit`
- [ ] Review security settings
- [ ] Test disaster recovery plan
- [ ] Update certificates if using custom domain

## Emergency Procedures

### If Services Down

```bash
ssh -i your-key.pem ec2-user@your-ec2-ip
pm2 status  # Check status
pm2 logs    # Check logs
pm2 restart all  # Restart if needed
```

- [ ] Know how to manually restart services

### If Deployment Failed

1. Check GitHub Actions logs
2. SSH into EC2 and check PM2 logs
3. Manual pull and restart: `./pm2-helper.sh pull-and-deploy`

- [ ] Know how to manually deploy

### If EC2 Down

- [ ] Have backup AMI image available
- [ ] Know how to launch new instance
- [ ] Have code backed up in GitHub
- [ ] Have database backup procedure

## Documentation & Knowledge Transfer

- [ ] **QUICK_START.md** - Read and understood
- [ ] **DEPLOYMENT_GUIDE.md** - Read and understood
- [ ] **pm2-helper.sh** - Know how to use helper commands
- [ ] **ecosystem.config.js** - Understand configuration
- [ ] Share credentials securely with team members (if applicable)
- [ ] Document any custom environment variables
- [ ] Create runbook for team

---

## ✅ DEPLOYMENT COMPLETE!

If you've checked all boxes above, your FIRA application is now:

- ✅ Running on EC2 with PM2
- ✅ Automatically deployed via GitHub Actions
- ✅ Monitored and accessible
- ✅ Scalable and maintainable

---

**Questions?** Refer to DEPLOYMENT_GUIDE.md or check PM2 documentation at: https://pm2.keymetrics.io
