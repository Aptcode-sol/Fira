const auth = require('./auth');

/**
 * Require a signed-in user with role === 'admin'.
 *
 * Every /api/admin route was previously wide open: no token, no role check.
 * `GET /api/admin/users` returned the full user table - emails, phone numbers
 * and bank account details - to any anonymous caller, and the block/approve
 * endpoints could be invoked by anyone who knew the path. The admin UI's
 * "login" was a hardcoded string comparison in client-side JavaScript, so it
 * protected nothing at all.
 *
 * Layered on top of `auth` so token verification stays in one place: auth
 * resolves the user from the JWT, this adds the role gate.
 */
const adminAuth = (req, res, next) => {
    auth(req, res, (err) => {
        if (err) return next(err);

        // auth() already responded (401) if the token was missing or invalid.
        if (!req.user) return;

        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required.' });
        }

        next();
    });
};

module.exports = adminAuth;
