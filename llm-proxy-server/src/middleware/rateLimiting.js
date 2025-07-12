import rateLimit from 'express-rate-limit';
import {
  RATE_LIMIT_GENERAL_WINDOW_MS,
  RATE_LIMIT_GENERAL_MAX_REQUESTS,
  RATE_LIMIT_LLM_WINDOW_MS,
  RATE_LIMIT_LLM_MAX_REQUESTS,
  RATE_LIMIT_AUTH_MAX_REQUESTS,
} from '../config/constants.js';

/**
 * Creates rate limiting middleware for general API requests
 * @returns {Function} Express rate limit middleware
 */
export const createApiRateLimiter = () => {
  return rateLimit({
    windowMs: RATE_LIMIT_GENERAL_WINDOW_MS, // 15 minutes
    max: RATE_LIMIT_GENERAL_MAX_REQUESTS, // Limit each IP to 100 requests per windowMs
    message: {
      error: {
        message: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        details: {
          retryAfter: RATE_LIMIT_GENERAL_WINDOW_MS / 1000, // seconds
        },
      },
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
      res.status(429).json({
        error: {
          message: 'Too many requests from this IP, please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
          details: {
            retryAfter: RATE_LIMIT_GENERAL_WINDOW_MS / 1000, // seconds
          },
        },
      });
    },
  });
};

/**
 * Creates rate limiting middleware for LLM API requests
 * @returns {Function} Express rate limit middleware with stricter limits
 */
export const createLlmRateLimiter = () => {
  return rateLimit({
    windowMs: RATE_LIMIT_LLM_WINDOW_MS, // 1 minute
    max: RATE_LIMIT_LLM_MAX_REQUESTS, // Limit each IP to 10 LLM requests per minute
    message: {
      error: {
        message: 'Too many LLM requests, please try again later.',
        code: 'LLM_RATE_LIMIT_EXCEEDED',
        details: {
          retryAfter: RATE_LIMIT_LLM_WINDOW_MS / 1000, // seconds
        },
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    keyGenerator: (req) => {
      // Use API key for rate limiting if available, otherwise use IP
      const apiKey = req.headers['x-api-key'];
      return apiKey || req.ip;
    },
    handler: (req, res) => {
      res.status(429).json({
        error: {
          message: 'Too many LLM requests, please try again later.',
          code: 'LLM_RATE_LIMIT_EXCEEDED',
          details: {
            retryAfter: RATE_LIMIT_LLM_WINDOW_MS / 1000, // seconds
          },
        },
      });
    },
  });
};

/**
 * Creates a strict rate limiter for authentication endpoints
 * @returns {Function} Express rate limit middleware with very strict limits
 */
export const createAuthRateLimiter = () => {
  return rateLimit({
    windowMs: RATE_LIMIT_GENERAL_WINDOW_MS, // 15 minutes
    max: RATE_LIMIT_AUTH_MAX_REQUESTS, // Limit each IP to 5 auth requests per windowMs
    skipSuccessfulRequests: true, // Don't count successful requests
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        message: 'Too many authentication attempts, please try again later.',
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        details: {
          retryAfter: RATE_LIMIT_GENERAL_WINDOW_MS / 1000, // seconds
        },
      },
    },
  });
};
