// PM2 ecosystem config for fira-api (zero-downtime deployment)
//
// Zero-downtime rolling restart procedure:
//   pm2 reload fira-api
//
// This performs a graceful rolling restart: PM2 starts a new instance, waits
// for process.send('ready'), then kills the old one — at least one instance
// serves traffic throughout the cycle.
//
// Full restart (NOT zero-downtime, use only if reload hangs):
//   pm2 restart fira-api
//
// Monitor:
//   pm2 monit
//   pm2 logs fira-api

module.exports = {
  apps: [
    {
      name: 'fira-api',
      script: 'index.js',
      instances: 2,
      exec_mode: 'cluster',
      wait_ready: true,
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      // Graceful shutdown: PM2 sends SIGINT, shutdown.js drains connections
      kill_timeout: 30000,
      max_memory_restart: '1G',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
