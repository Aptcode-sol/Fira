module.exports = {
    apps: [
        // Backend API - Cluster Mode (multi-core)
        {
            name: 'fira-backend',
            script: 'index.js',
            instances: '2',
            exec_mode: 'cluster',
            cwd: './server',
            env: {
                NODE_ENV: 'production',
                PORT: 5000
            },
            watch: false,
            max_memory_restart: '1G',
            error_file: './logs/backend-error.log',
            out_file: './logs/backend-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
            autorestart: true,
            max_restarts: 10,
            min_uptime: '10s',
            listen_timeout: 3000,
            kill_timeout: 5000
        },

        // Admin Dashboard - Fork Mode (Static served via serve)
        {
            name: 'fira-admin',
            script: 'node',
            args: ['./node_modules/vite/bin/vite.js', 'preview', '--host', '0.0.0.0', '--port', '3001'],
            instances: 1,
            exec_mode: 'fork',
            cwd: './admin',
            env: {
                NODE_ENV: 'production'
            },
            watch: false,
            max_memory_restart: '512M',
            error_file: './logs/admin-error.log',
            out_file: './logs/admin-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            autorestart: true,
            max_restarts: 10,
            min_uptime: '10s'
        },

        // Frontend Client - Fork Mode
        {
            name: 'fira-client',
            script: 'node_modules/next/dist/bin/next',
            args: 'start -p 3000',
            instances: 1,
            exec_mode: 'fork',
            cwd: './client',
            env: {
                NODE_ENV: 'production',
                PORT: 3000
            },
            watch: false,
            max_memory_restart: '1G',
            error_file: './logs/client-error.log',
            out_file: './logs/client-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            autorestart: true,
            max_restarts: 10,
            min_uptime: '10s'
        }
    ],

    deploy: {
        production: {
            user: 'ec2-user', // Change to your EC2 user (ubuntu, ec2-user, etc.)
            host: 'your-ec2-ip-or-domain.com', // Replace with your EC2 public IP/domain
            key: '/path/to/your/key.pem', // Path to your EC2 key pair
            ref: 'origin/main',
            repo: 'https://github.com/your-username/fira.git', // Your repo URL
            path: '/home/ec2-user/fira', // Deployment path on EC2
            'post-deploy': 'npm install && npm run build:all && pm2 startOrRestart ecosystem.config.js --env production'
        }
    }
};
