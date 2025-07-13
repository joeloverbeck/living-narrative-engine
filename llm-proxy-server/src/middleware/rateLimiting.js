import rateLimit from 'express-rate-limit';
import {
  RATE_LIMIT_GENERAL_WINDOW_MS,
  RATE_LIMIT_GENERAL_MAX_REQUESTS,
  RATE_LIMIT_LLM_WINDOW_MS,
  RATE_LIMIT_LLM_MAX_REQUESTS,
  RATE_LIMIT_AUTH_MAX_REQUESTS,
} from '../config/constants.js';

/**
 * Extracts the real client IP from request headers with proxy awareness
 * @param {object} req - Express request object
 * @returns {string} Real client IP address
 */
function extractRealClientIP(req) {
  // Try X-Forwarded-For header (most common proxy header)
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    // X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
    // Take the first (leftmost) IP which should be the original client
    const ips = xForwardedFor.split(',').map((ip) => ip.trim());
    const clientIP = ips[0];

    // Validate IP format and reject private/internal IPs to prevent spoofing
    if (isValidPublicIP(clientIP)) {
      return clientIP;
    }
  }

  // Try other common proxy headers as fallbacks
  const proxyHeaders = [
    'x-real-ip',
    'x-client-ip',
    'x-forwarded',
    'forwarded-for',
    'forwarded',
  ];

  for (const header of proxyHeaders) {
    const headerValue = req.headers[header];
    if (headerValue) {
      const ip = Array.isArray(headerValue) ? headerValue[0] : headerValue;
      if (isValidPublicIP(ip.trim())) {
        return ip.trim();
      }
    }
  }

  // Fallback to direct connection IP
  return req.ip || req.connection.remoteAddress || 'unknown';
}

/**
 * Validates if an IP address is a valid public IP (not private/internal)
 * @param {string} ip - IP address to validate
 * @returns {boolean} True if valid public IP
 */
function isValidPublicIP(ip) {
  if (!ip || typeof ip !== 'string') return false;

  // Basic IP format validation (IPv4)
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) {
    // Could be IPv6, allow it for now
    return ip.length > 0 && ip !== 'unknown';
  }

  const octets = ip.split('.').map(Number);

  // Check if all octets are valid (0-255)
  if (octets.some((octet) => octet < 0 || octet > 255)) return false;

  // Reject private/internal IP ranges to prevent spoofing
  const [a, b] = octets;

  // 10.0.0.0/8 (private)
  if (a === 10) return false;

  // 172.16.0.0/12 (private)
  if (a === 172 && b >= 16 && b <= 31) return false;

  // 192.168.0.0/16 (private)
  if (a === 192 && b === 168) return false;

  // 127.0.0.0/8 (loopback)
  if (a === 127) return false;

  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) return false;

  // 224.0.0.0/4 (multicast)
  if (a >= 224) return false;

  return true;
}

/**
 * Generates a comprehensive rate limiting key with fallback strategies
 * @param {object} req - Express request object
 * @param {object} options - Rate limiting options
 * @returns {string} Rate limiting key
 */
function generateRateLimitKey(req, options = {}) {
  const { useApiKey = false, trustProxy = true } = options;

  // Primary: Use API key if available and requested
  if (useApiKey) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey && typeof apiKey === 'string' && apiKey.length > 0) {
      return `api:${apiKey.substring(0, 8)}...`; // Use first 8 chars for identification
    }
  }

  // Secondary: Use real client IP with proxy awareness
  if (trustProxy) {
    const realIP = extractRealClientIP(req);
    if (realIP && realIP !== 'unknown') {
      return `ip:${realIP}`;
    }
  }

  // Tertiary: Use direct connection IP
  const directIP = req.ip || req.connection.remoteAddress;
  if (directIP) {
    return `direct:${directIP}`;
  }

  // Fallback: Use User-Agent hash for some level of differentiation
  const userAgent = req.headers['user-agent'];
  if (userAgent) {
    const hash = hashString(userAgent);
    return `ua:${hash}`;
  }

  // Last resort: Use a constant key (effectively global rate limiting)
  return 'global:unknown';
}

/**
 * Simple hash function for generating consistent identifiers
 * @param {string} str - String to hash
 * @returns {string} Hash string
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Creates rate limiting middleware for general API requests with proxy awareness
 * @param {object} options - Rate limiting options
 * @returns {Function} Express rate limit middleware
 */
export const createApiRateLimiter = (options = {}) => {
  const { trustProxy = true } = options;

  return rateLimit({
    windowMs: RATE_LIMIT_GENERAL_WINDOW_MS, // 15 minutes
    max: RATE_LIMIT_GENERAL_MAX_REQUESTS, // Limit each client to 100 requests per windowMs
    message: {
      error: {
        message: 'Too many requests from this client, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        details: {
          retryAfter: RATE_LIMIT_GENERAL_WINDOW_MS / 1000, // seconds
        },
      },
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    keyGenerator: (req) => {
      return generateRateLimitKey(req, { useApiKey: false, trustProxy });
    },
    handler: (req, res) => {
      const clientKey = generateRateLimitKey(req, {
        useApiKey: false,
        trustProxy,
      });
      res.status(429).json({
        error: {
          message:
            'Too many requests from this client, please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
          details: {
            retryAfter: RATE_LIMIT_GENERAL_WINDOW_MS / 1000, // seconds
            clientId: clientKey.split(':')[0], // Don't expose full key
          },
        },
      });
    },
  });
};

/**
 * Creates rate limiting middleware for LLM API requests with enhanced client identification
 * @param {object} options - Rate limiting options
 * @returns {Function} Express rate limit middleware with stricter limits
 */
export const createLlmRateLimiter = (options = {}) => {
  const { trustProxy = true, useApiKey = true } = options;

  return rateLimit({
    windowMs: RATE_LIMIT_LLM_WINDOW_MS, // 1 minute
    max: RATE_LIMIT_LLM_MAX_REQUESTS, // Limit each client to 10 LLM requests per minute
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
      return generateRateLimitKey(req, { useApiKey, trustProxy });
    },
    handler: (req, res) => {
      const clientKey = generateRateLimitKey(req, { useApiKey, trustProxy });
      const clientType = clientKey.split(':')[0];

      res.status(429).json({
        error: {
          message: 'Too many LLM requests, please try again later.',
          code: 'LLM_RATE_LIMIT_EXCEEDED',
          details: {
            retryAfter: RATE_LIMIT_LLM_WINDOW_MS / 1000, // seconds
            clientType,
            rateLimitType: 'llm',
          },
        },
      });
    },
  });
};

/**
 * Creates a strict rate limiter for authentication endpoints with enhanced security
 * @param {object} options - Rate limiting options
 * @returns {Function} Express rate limit middleware with very strict limits
 */
export const createAuthRateLimiter = (options = {}) => {
  const { trustProxy = true } = options;

  return rateLimit({
    windowMs: RATE_LIMIT_GENERAL_WINDOW_MS, // 15 minutes
    max: RATE_LIMIT_AUTH_MAX_REQUESTS, // Limit each client to 5 auth requests per windowMs
    skipSuccessfulRequests: true, // Don't count successful requests
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // For auth endpoints, prioritize IP-based limiting for security
      return generateRateLimitKey(req, { useApiKey: false, trustProxy });
    },
    message: {
      error: {
        message: 'Too many authentication attempts, please try again later.',
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        details: {
          retryAfter: RATE_LIMIT_GENERAL_WINDOW_MS / 1000, // seconds
        },
      },
    },
    handler: (req, res) => {
      res.status(429).json({
        error: {
          message: 'Too many authentication attempts, please try again later.',
          code: 'AUTH_RATE_LIMIT_EXCEEDED',
          details: {
            retryAfter: RATE_LIMIT_GENERAL_WINDOW_MS / 1000, // seconds
            rateLimitType: 'auth',
          },
        },
      });
    },
  });
};

/**
 * Creates an adaptive rate limiter that adjusts limits based on detected patterns
 * @param {object} options - Rate limiting options
 * @returns {Function} Express rate limit middleware with adaptive limits
 */
export const createAdaptiveRateLimiter = (options = {}) => {
  const {
    baseWindowMs = RATE_LIMIT_GENERAL_WINDOW_MS,
    baseMaxRequests = RATE_LIMIT_GENERAL_MAX_REQUESTS,
    trustProxy = true,
    useApiKey = false,
  } = options;

  // Track suspicious patterns
  const suspiciousPatterns = new Map();

  return rateLimit({
    windowMs: baseWindowMs,
    max: (req) => {
      const clientKey = generateRateLimitKey(req, { useApiKey, trustProxy });

      // Check for suspicious patterns
      const pattern = suspiciousPatterns.get(clientKey);
      if (pattern && pattern.suspiciousScore > 3) {
        // Reduce limits for suspicious clients
        return Math.max(1, Math.floor(baseMaxRequests * 0.1));
      }

      return baseMaxRequests;
    },
    keyGenerator: (req) => {
      const clientKey = generateRateLimitKey(req, { useApiKey, trustProxy });

      // Track patterns for adaptive response
      const now = Date.now();
      let pattern = suspiciousPatterns.get(clientKey);

      if (!pattern) {
        pattern = {
          requests: [],
          suspiciousScore: 0,
          lastRequest: now,
        };
        suspiciousPatterns.set(clientKey, pattern);
      }

      // Add current request
      pattern.requests.push(now);
      pattern.lastRequest = now;

      // Clean old requests (keep last hour)
      const hourAgo = now - 60 * 60 * 1000;
      pattern.requests = pattern.requests.filter(
        (timestamp) => timestamp > hourAgo
      );

      // Calculate suspicious score based on request frequency
      const recentRequests = pattern.requests.filter(
        (timestamp) => timestamp > now - 60000
      );
      if (recentRequests.length > baseMaxRequests * 0.8) {
        pattern.suspiciousScore = Math.min(10, pattern.suspiciousScore + 1);
      } else if (recentRequests.length < baseMaxRequests * 0.2) {
        pattern.suspiciousScore = Math.max(0, pattern.suspiciousScore - 0.1);
      }

      return clientKey;
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const clientKey = generateRateLimitKey(req, { useApiKey, trustProxy });
      const pattern = suspiciousPatterns.get(clientKey);

      res.status(429).json({
        error: {
          message: 'Rate limit exceeded. Please slow down your requests.',
          code: 'ADAPTIVE_RATE_LIMIT_EXCEEDED',
          details: {
            retryAfter: baseWindowMs / 1000,
            rateLimitType: 'adaptive',
            severity: pattern?.suspiciousScore > 3 ? 'high' : 'normal',
          },
        },
      });
    },
  });
};
