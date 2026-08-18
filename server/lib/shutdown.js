'use strict';

const mongoose = require('mongoose');
const { getRedisClient } = require('../services/cacheService');

const SHUTDOWN_TIMEOUT_MS = 30_000;

/**
 * Sets up graceful shutdown for the HTTP server.
 * On SIGTERM/SIGINT: stops accepting connections, waits for in-flight requests,
 * closes Redis and MongoDB, then exits cleanly.
 *
 * @param {import('http').Server} server
 */
function setupGracefulShutdown(server) {
    let shuttingDown = false;

    async function shutdown(signal) {
        if (shuttingDown) return;
        shuttingDown = true;

        console.log(`\n⚡ ${signal} received — starting graceful shutdown…`);

        let forceTimer;
        let forcedExit = false;

        // Start the 30s countdown. If we exceed it, force-terminate.
        forceTimer = setTimeout(() => {
            forcedExit = true;
            // server.getConnections gives the count of remaining sockets
            server.getConnections((err, count) => {
                const remaining = err ? '(unknown)' : count;
                console.warn(
                    `⚠️  Shutdown timeout reached — ${remaining} request(s) forcibly terminated`
                );
                process.exit(1);
            });
            // If getConnections callback doesn't fire quickly, exit anyway
            setTimeout(() => process.exit(1), 500);
        }, SHUTDOWN_TIMEOUT_MS);

        // Prevent the timer from keeping the process alive if everything closes in time
        if (forceTimer.unref) forceTimer.unref();

        try {
            // 1. Stop accepting new connections
            await new Promise((resolve, reject) => {
                server.close((err) => (err ? reject(err) : resolve()));
            });

            if (forcedExit) return; // timer already fired

            // 2. Close Redis (if connected)
            const redisClient = getRedisClient();
            if (redisClient) {
                try {
                    await redisClient.quit();
                    console.log('✅ Redis connection closed');
                } catch (e) {
                    console.warn('⚠️  Redis quit error:', e.message);
                }
            }

            // 3. Close MongoDB
            try {
                await mongoose.disconnect();
                console.log('✅ MongoDB connection closed');
            } catch (e) {
                console.warn('⚠️  MongoDB disconnect error:', e.message);
            }

            clearTimeout(forceTimer);
            console.log('✅ Graceful shutdown complete');
            process.exit(0);
        } catch (err) {
            console.error('❌ Error during shutdown:', err.message);
            clearTimeout(forceTimer);
            process.exit(1);
        }
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { setupGracefulShutdown };
