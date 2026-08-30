// The admin role the current session carries, read from the stored JWT. Lives
// here rather than inside a component so every surface that hides a control by
// role reads the same value the nav does — one function, no copy.

// ponytail: decode JWT payload without a library — it's just base64url JSON.
export function getAdminRoleFromToken() {
    try {
        const token = localStorage.getItem('fira_admin_token');
        if (!token) return null;
        const payload = token.split('.')[1];
        if (!payload) return null;
        const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
        return decoded.adminRole || null;
    } catch {
        return null;
    }
}
