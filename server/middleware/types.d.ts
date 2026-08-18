/**
 * Type definitions for server middleware layer.
 * Provides type safety via JSDoc annotations without requiring a build step.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';

/** Extended request with auth fields attached by auth middleware */
export interface AuthenticatedRequest extends Request {
  user?: import('mongoose').Document & {
    _id: string;
    role: string;
    email?: string;
    phone?: string;
    name?: string;
  };
  token?: string;
  csrfToken?: string;
}

/** User roles supported by the auth system */
export type UserRole = 'user' | 'admin' | 'venueOwner' | 'brand';

/** CORS middleware configuration (derived from environment) */
export interface CorsConfig {
  allowedOrigins: Set<string>;
  isDev: boolean;
}

/** CSRF cookie options */
export interface CsrfCookieOptions {
  httpOnly: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  secure: boolean;
  path: string;
}

/**
 * Factory function that returns auth middleware restricted to specified roles.
 * If no roles specified, any authenticated user is allowed.
 */
export type RequireAuthFn = (...roles: UserRole[]) => RequestHandler;

/** Async route handler — wraps async functions to forward errors to Express */
export type AsyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => RequestHandler;

/** Sanitization result — path to the offending key, or null if clean */
export type SanitizeResult = string | null;
