/**
 * Role-based access guard for admin sub-roles.
 *
 * Use AFTER adminAuth middleware (which sets req.user via JWT verification).
 * Checks req.user.adminRole against the allowed roles array.
 *
 * Backward compat: if adminRole is null/undefined (legacy admin without sub-role assigned),
 * treat them as 'super_admin' — they already passed the adminAuth gate which verifies
 * role === 'admin', so they're a legitimate admin from before the sub-role system existed.
 *
 * Usage:
 *   router.patch('/admin/users/:id/role', adminAuth, roleGuard(['super_admin']), handler)
 *   router.patch('/admin/events/:id/featured', adminAuth, roleGuard(['super_admin', 'admin']), handler)
 *
 * @param {string[]} allowedRoles - Array of permitted adminRole values
 * @returns {import('express').RequestHandler}
 */
function roleGuard(allowedRoles) {
  return (req, res, next) => {
    const adminRole = req.user && req.user.adminRole;

    // ponytail: legacy admins without adminRole assigned are treated as super_admin
    // since they already passed adminAuth (role === 'admin'). This prevents lockout
    // before adminRole migration is complete.
    if (!adminRole) {
      return next();
    }

    if (!allowedRoles.includes(adminRole)) {
      return res.status(403).json({ error: 'Insufficient permissions for this action' });
    }

    next();
  };
}

module.exports = roleGuard;
