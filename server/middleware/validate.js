/**
 * Route-specific validation middleware factory.
 * Accepts a zod schema and returns Express middleware that validates req.body.
 * Returns 400 with field-level errors on failure.
 *
 * Usage:
 *   const { z } = require('zod');
 *   const validate = require('../middleware/validate');
 *   const schema = z.object({ email: z.string().email() });
 *   router.post('/signup', validate(schema), handler);
 */

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fieldErrors = result.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message
      }));
      return res.status(400).json({
        error: 'Validation failed',
        details: fieldErrors
      });
    }
    // Replace body with parsed (coerced/defaulted) values
    req.body = result.data;
    next();
  };
}

module.exports = validate;
