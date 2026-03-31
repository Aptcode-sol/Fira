# Alternative CI/CD Approaches

If GitHub Actions doesn't meet your needs, here are other options:

---

## Option 1: GitLab CI/CD (If using GitLab)

### .gitlab-ci.yml

```yaml
stages:
  - build
  - deploy

variables:
  NODE_VERSION: "18"

build:
  stage: build
  image: node:18
  script:
    - cd server && npm ci --production && cd ..
    - cd admin && npm ci && npm run build && cd ..
    - cd client && npm ci && npm run build && cd ..
  artifacts:
    paths:
      - server/node_modules
      - admin/dist
      - client/.next
    expire_in: 1 hour

deploy:
  stage: deploy
  image: alpine:latest
  before_script:
    - apk add --no-cache openssh-client
    - mkdir -p ~/.ssh
    - chmod 700 ~/.ssh
    - echo "$EC2_PRIVATE_KEY" > ~/.ssh/deploy_key
    - chmod 600 ~/.ssh/deploy_key
    - echo -e "Host *\n\tStrictHostKeyChecking no\n\tUserKnownHostsFile=/dev/null" > ~/.ssh/config
  script:
    - ssh -i ~/.ssh/deploy_key ec2-user@$EC2_HOST "cd ~/fira && git pull origin main && ./build.sh && pm2 restart all"
  only:
    - main
  environment:
    name: production
```

---

## Option 2: Webhook-Based Deployment (Self-hosted)

Deploy directly on push using a simple webhook listener.

### deploy-server.js

```javascript
const express = require("express");
const { execSync } = require("child_process");
const crypto = require("crypto");

const app = express();
const SECRET = process.env.WEBHOOK_SECRET || "your-secret-key";
const DEPLOY_PATH = "/home/ec2-user/fira";

app.use(express.json());

// Verify GitHub webhook signature
const verifySignature = (req, secret) => {
  const signature = req.headers["x-hub-signature-256"];
  if (!signature) return false;

  const payload = JSON.stringify(req.body);
  const hash =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(payload).digest("hex");

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hash));
};

app.post("/webhook/deploy", (req, res) => {
  // Verify signature
  if (!verifySignature(req, SECRET)) {
    console.log("Invalid signature");
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Only deploy on push to main
  if (req.body.ref !== "refs/heads/main") {
    return res.status(200).json({ message: "Not main branch, skipping" });
  }

  console.log("Deployment triggered by webhook");

  try {
    // Pull latest code
    execSync(`cd ${DEPLOY_PATH} && git pull origin main`, { stdio: "inherit" });

    // Build
    execSync(`cd ${DEPLOY_PATH} && chmod +x build.sh && ./build.sh`, {
      stdio: "inherit",
    });

    // Restart PM2 apps
    execSync("pm2 restart all", { stdio: "inherit" });

    console.log("Deployment successful");
    res.json({ success: true, message: "Deployment complete" });
  } catch (error) {
    console.error("Deployment failed:", error);
    res
      .status(500)
      .json({ error: "Deployment failed", message: error.message });
  }
});

app.listen(3333, () => {
  console.log("Webhook server listening on port 3333");
});
```

### Setup Instructions for Webhook

1. Add to systemd (auto-start):

```bash
sudo nano /etc/systemd/system/webhook-deploy.service
```

```ini
[Unit]
Description=Webhook Deploy Server
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/fira
ExecStart=/usr/bin/node /home/ec2-user/fira/deploy-server.js
Restart=always
RestartSec=10

Environment="WEBHOOK_SECRET=your-random-secret-key"

[Install]
WantedBy=multi-user.target
```

2. Enable and start:

```bash
sudo systemctl enable webhook-deploy
sudo systemctl start webhook-deploy
```

3. Add to GitHub:
   - Go to Settings → Webhooks
   - Payload URL: `http://your-ec2-ip:3333/webhook/deploy`
   - Secret: Your secret from above
   - Events: Push events
   - Active: Yes

---

## Option 3: Jenkins (For Complex Workflows)

### Jenkinsfile

```groovy
pipeline {
    agent any

    parameters {
        choice(name: 'DEPLOY_ENV', choices: ['staging', 'production'], description: 'Deploy environment')
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'main', url: 'https://github.com/your-username/fira.git'
            }
        }

        stage('Build') {
            parallel {
                stage('Backend') {
                    steps {
                        dir('server') {
                            sh 'npm ci --production'
                        }
                    }
                }
                stage('Admin') {
                    steps {
                        dir('admin') {
                            sh 'npm ci && npm run build'
                        }
                    }
                }
                stage('Frontend') {
                    steps {
                        dir('client') {
                            sh 'npm ci && npm run build'
                        }
                    }
                }
            }
        }

        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                sh '''
                    ssh -i ~/.ssh/deploy_key ec2-user@${EC2_HOST} << 'EOF'
                    cd ~/fira
                    git pull origin main
                    ./build.sh
                    pm2 restart all
                    pm2 save
                    EOF
                '''
            }
        }

        stage('Notify') {
            steps {
                script {
                    if (currentBuild.result == 'SUCCESS') {
                        echo 'Deployment successful!'
                    } else {
                        echo 'Deployment failed!'
                    }
                }
            }
        }
    }

    post {
        always {
            cleanWs()
        }
    }
}
```

--- ## Option 4: GitHub Actions - Manual Trigger (If you prefer)

### Modify .github/workflows/deploy.yml

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch: # Add this for manual trigger
    inputs:
      environment:
        description: "Deployment environment"
        required: true
        default: "production"
        type: choice
        options:
          - staging
          - production
```

Now you can manually trigger from GitHub UI: Actions → Deploy → Run Workflow

---

## Option 5: Docker + Kubernetes (For Scalability)

If you want containerization:

### docker-compose.yml

```yaml
version: "3.8"

services:
  backend:
    build:
      context: ./server
      dockerfile: Dockerfile
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=${MONGODB_URI}
      - JWT_SECRET=${JWT_SECRET}
    restart: always

  admin:
    build:
      context: ./admin
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    restart: always

  client:
    build:
      context: ./client
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: always

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - backend
      - admin
      - client
    restart: always
```

### Dockerfile for Backend

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

EXPOSE 5000

CMD ["node", "index.js"]
```

### Dockerfile for Admin/Frontend

```dockerfile
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Deploy with:

```bash
docker-compose -f docker-compose.yml up -d
```

---

## Option 6: Serverless (AWS Lambda)

Not recommended for your use case, but possible with AWS Lambda + API Gateway.

---

## Comparison Table

| Approach                         | Complexity  | Cost               | Maintenance | Auto-Deploy                     |
| -------------------------------- | ----------- | ------------------ | ----------- | ------------------------------- |
| **GitHub Actions** (Recommended) | ⭐ Low      | Free               | Low         | ✅ Yes                          |
| **Webhook**                      | ⭐⭐ Medium | Free               | Medium      | ✅ Yes                          |
| **Jenkins**                      | ⭐⭐⭐ High | $0-$               | High        | ✅ Yes                          |
| **Docker**                       | ⭐⭐⭐ High | $0-$$              | High        | ✅ Yes (via Docker Hub/Actions) |
| **GitLab CI**                    | ⭐⭐ Medium | Free (self-hosted) | Medium      | ✅ Yes                          |

---

## Recommendation

**Use GitHub Actions** because it:

- ✅ Integrates seamlessly with GitHub
- ✅ Free for public repos
- ✅ Easy to understand and modify
- ✅ No additional server to manage
- ✅ Great logging and debugging
- ✅ Perfect for team collaboration

Use **Webhook** only if you:

- Want to avoid GitHub Actions
- Prefer everything on your EC2
- Need more control over deployment timing

Use **Docker** if you:

- Plan to scale significantly
- Want multi-environment setups
- Will eventually use Kubernetes
- Want true infrastructure-as-code

---

## My Recommendation for You

### Stick with GitHub Actions + PM2 because:

1. **Simplest Setup** - Already provided configuration
2. **Zero Additional Cost** - Free GitHub Actions
3. **No Operational Overhead** - GitHub manages CI/CD
4. **Easy Debugging** - GitHub Actions logs are clear
5. **Great for Small Teams** - Secure secrets management
6. **Best Documentation** - Huge community support
7. **Easy Rollback** - Just revert the commit

If later you want to scale, you can migrate to Docker/Kubernetes while keeping the same GitHub Actions pipeline!

---

**Start with the provided GitHub Actions setup. You can always switch later!**
