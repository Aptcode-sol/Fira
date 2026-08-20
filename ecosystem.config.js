module.exports = {
    apps: [
        // Backend API - Cluster Mode (zero-downtime via `pm2 reload fira-api`)
        {
            name: 'fira-api',
            script: 'index.js',
            instances: 2,
            exec_mode: 'cluster',
            cwd: './server',
            wait_ready: true,
            listen_timeout: 10000,
            // ponytail: PM2 only applies `env_production` when started with
            // `--env production` (as deploy.sh does). Without this block PM2 warns
            // "Environment [production] is not defined in process file" and the
            // intended NODE_ENV/PORT are easy to lose. Both blocks are defined so
            // `pm2 start ecosystem.config.js` and `--env production` behave alike.
            env: {
                NODE_ENV: 'production',
                PORT: 5000
            },
            env_production: {
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
            kill_timeout: 30000
        },

        // Admin Dashboard - Fork Mode (static SPA built to admin/dist)
        //
        // ponytail: was `vite preview`, which Vite documents as a local preview of
        // a production build and explicitly not a production server. `serve -s` is
        // purpose-built for static SPAs and does history-API fallback, so deep links
        // like /events/123 resolve to index.html instead of 404ing on refresh.
        //
        // Invoked through `npm run start` rather than a direct path into
        // node_modules: this is an npm workspaces repo, so `serve` hoists to the
        // ROOT node_modules on some installs and stays in admin/node_modules on
        // others. npm resolves the bin either way; a hardcoded path silently breaks
        // on whichever layout it did not assume.
        {
            name: 'fira-admin',
            script: 'npm',
            args: 'run start',
            interpreter: 'none',
            instances: 1,
            exec_mode: 'fork',
            cwd: './admin',
            env: {
                NODE_ENV: 'production'
            },
            env_production: {
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
        }

        // ponytail: `fira-client` (Next.js on :3000) removed. The client is deployed
        // to AWS Amplify (see build.sh) — running it here too booted a second, stale
        // copy of the frontend that nothing routed to.

        // ponytail: the `deploy:` block was removed. It held unedited placeholders
        // ('your-ec2-ip-or-domain.com', '/path/to/your/key.pem', 'origin/main') and
        // was never used — deployment happens by running deploy.sh on the box.
    ]
};
