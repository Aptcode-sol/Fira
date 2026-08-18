// @ts-check
/**
 * Wraps an async route handler so that any thrown/rejected value is forwarded
 * to the Express error-handling middleware via next(err).
 *
 * Usage:
 *   const asyncHandler = require('../middleware/asyncHandler');
 *   router.get('/foo', asyncHandler(async (req, res) => { ... }));
 *
 * @type {import('./types').AsyncHandler}
 */
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
