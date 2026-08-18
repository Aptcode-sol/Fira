// @ts-check
/**
 * Input sanitization middleware — NoSQL injection prevention.
 * Recursively walks req.body, req.query, req.params and rejects any key
 * starting with '$' (Mongo operator injection).
 *
 * ponytail: single recursive walk, no deps. Covers the trust boundary
 * between client input and Mongoose queries.
 */

/**
 * Recursively search for any object key starting with '$'.
 * @param {any} obj - The object to scan
 * @param {string} path - Dot-path accumulator for error reporting
 * @returns {string | null} The offending path, or null if clean
 */
function findDollarKey(obj, path) {
  if (obj === null || typeof obj !== 'object') return null;

  for (const key of Object.keys(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (key.startsWith('$')) return currentPath;
    const nested = findDollarKey(obj[key], currentPath);
    if (nested) return nested;
  }
  return null;
}

/**
 * Express middleware that rejects requests containing MongoDB operator keys.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function sanitize(req, res, next) {
  /** @type {{ label: string; obj: any }[]} */
  const sources = [
    { label: 'body', obj: req.body },
    { label: 'query', obj: req.query },
    { label: 'params', obj: req.params }
  ];
  for (const { label, obj } of sources) {
    if (!obj) continue;
    const offending = findDollarKey(obj, '');
    if (offending) {
      res.status(400).json({
        error: `Input contains prohibited key "${offending}" in ${label}. MongoDB operator keys are not allowed.`
      });
      return;
    }
  }
  next();
}

module.exports = sanitize;
