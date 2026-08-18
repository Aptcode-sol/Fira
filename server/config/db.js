const mongoose = require('mongoose');

// ponytail: pool monitor uses interval + flag to rate-limit warnings to once/60s
let _poolWarningCooldown = false;
let _monitorInterval = null;

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            minPoolSize: 10,
            maxPoolSize: 50,
            maxIdleTimeMS: 30000,
            connectTimeoutMS: 10000,
        });
        console.log('✅ MongoDB Connected Successfully');
        startPoolMonitor();
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error.message);
        process.exit(1);
    }
};

function startPoolMonitor() {
    // ponytail: ceiling is polling-based (not event-driven); upgrade path is MongoDB CMAP events
    _monitorInterval = setInterval(() => {
        const pool = mongoose.connection?.client?.topology?.s?.pool;
        if (!pool) return;

        const totalConnectionCount = pool.totalConnectionCount ?? 0;
        const maxPoolSize = 50;
        const threshold = maxPoolSize * 0.8;

        if (totalConnectionCount > threshold && !_poolWarningCooldown) {
            console.warn(
                `⚠️ MongoDB pool utilization high: ${totalConnectionCount}/${maxPoolSize} active connections (>${Math.round(threshold)})`
            );
            _poolWarningCooldown = true;
            setTimeout(() => { _poolWarningCooldown = false; }, 60000);
        }
    }, 5000);

    _monitorInterval.unref(); // don't block process exit
}

// Exposed for graceful shutdown / testing
connectDB._stopMonitor = () => {
    if (_monitorInterval) {
        clearInterval(_monitorInterval);
        _monitorInterval = null;
    }
};

module.exports = connectDB;
