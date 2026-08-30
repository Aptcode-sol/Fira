/**
 * Server-Sent Events fan-out.
 *
 * One registry of userId -> open responses, shared by every feature that needs
 * to push to a signed-in user (notifications, chat messages, read receipts).
 * This used to live inside routes/notification.js and was reachable only as
 * `notificationRouter.sendNotification`, which meant anything else wanting to
 * push had to require a route module. Nothing ever did, so the stream was
 * registered but never written to.
 *
 * Every frame is a plain `data:` frame carrying a JSON payload with a `type`
 * field, rather than a named SSE `event:`. The browser client reads the stream
 * with fetch (EventSource cannot send an Authorization header) and switches on
 * `type`, so one connection serves all features and an unknown type is simply
 * ignored by older clients.
 *
 * ponytail: in-process Map. Ceiling: this only fans out to sockets held by THIS
 * process, so with more than one server instance a user connected to instance A
 * misses events published on instance B. Redis is already configured
 * (server/config/redis.js) - the upgrade is to publish to a Redis channel here
 * and have each instance relay from its subscriber into its local map.
 */

// userId (string) -> Set<Response>
const clients = new Map();

const HEARTBEAT_MS = 30_000;

/**
 * Attach an SSE response to a user's connection set and start its heartbeat.
 * Returns a teardown function the caller must invoke on request close.
 */
function register(userId, res) {
    const key = String(userId);

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // disable Nginx buffering
    });

    // Tell the client the stream is live before any real payload.
    res.write(':connected\n\n');

    // Comment-only frames keep proxies from closing an idle connection.
    const heartbeat = setInterval(() => {
        try {
            res.write(':heartbeat\n\n');
        } catch {
            // Socket died between ticks; cleanup runs via the close handler.
        }
    }, HEARTBEAT_MS);

    if (!clients.has(key)) clients.set(key, new Set());
    clients.get(key).add(res);

    return function unregister() {
        clearInterval(heartbeat);
        const set = clients.get(key);
        if (!set) return;
        set.delete(res);
        if (set.size === 0) clients.delete(key);
    };
}

/**
 * Push a payload to every open connection for one user. No-op when the user has
 * no connection, which is the normal case - delivery here is a live-view
 * optimisation, never the system of record. Persist first, then send.
 */
function send(userId, payload) {
    const set = clients.get(String(userId));
    if (!set || set.size === 0) return false;

    const frame = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of set) {
        try {
            res.write(frame);
        } catch (err) {
            // A broken socket must not stop the remaining recipients.
            console.error('SSE write failed:', err.message);
        }
    }
    return true;
}

/** Push the same payload to several users (e.g. both sides of a conversation). */
function sendToMany(userIds, payload) {
    for (const id of userIds) send(id, payload);
}

module.exports = { register, send, sendToMany };
