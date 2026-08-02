/**
 * Generate a VAPID key pair for Web Push.
 *
 * VAPID is how a push service (FCM, Mozilla, Apple) verifies that the push
 * really came from your server. The pair is generated ONCE and then lives in
 * the environment - regenerating it invalidates every existing subscription,
 * so only do that if the private key leaks.
 *
 * Usage: node server/scripts/generateVapidKeys.js
 */

const webpush = require('web-push');

const keys = webpush.generateVAPIDKeys();

console.log('\nAdd to server/.env:\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:no-reply@letsfira.com');
console.log('\nAdd to client/.env (public key only - it is safe to expose):\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log('\nThe two public keys MUST match or subscriptions will be rejected.\n');
