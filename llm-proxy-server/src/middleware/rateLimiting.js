import rateLimit from 'express-rate-limit';
import {
  RATE_LIMIT_GENERAL_WINDOW_MS,
  RATE_LIMIT_GENERAL_MAX_REQUESTS,
  RATE_LIMIT_LLM_WINDOW_MS,
  RATE_LIMIT_LLM_MAX_REQUESTS,
  RATE_LIMIT_AUTH_MAX_REQUESTS,
  RATE_LIMIT_SUSPICIOUS_PATTERNS_MAX_SIZE,
  RATE_LIMIT_SUSPICIOUS_PATTERNS_CLEANUP_INTERVAL,
  RATE_LIMIT_SUSPICIOUS_PATTERNS_MAX_AGE,
  RATE_LIMIT_SUSPICIOUS_PATTERNS_CLEANUP_BATCH_SIZE,
  RATE_LIMIT_SUSPICIOUS_PATTERNS_MIN_CLEANUP_INTERVAL,
} from '../config/constants.js';
import {
  isValidPublicIPv6,
  isIPv6Hostname,
  extractIPv6FromHostname,
} from '../utils/ipv6Utils.js';

/**
 * LRU-based suspicious patterns manager to prevent memory leaks
 * Implements automatic cleanup and size limits for the suspicious patterns map
 */
class SuspiciousPatternsManager {
  /**
   * Creates a new SuspiciousPatternsManager instance
   * @param {object} options - Configuration options for the manager
   */
  constructor(options = {}) {
    this.maxSize = options.maxSize || RATE_LIMIT_SUSPICIOUS_PATTERNS_MAX_SIZE;
    this.maxAge = options.maxAge || RATE_LIMIT_SUSPICIOUS_PATTERNS_MAX_AGE;
    this.cleanupInterval =
      options.cleanupInterval ||
      RATE_LIMIT_SUSPICIOUS_PATTERNS_CLEANUP_INTERVAL;
    this.batchSize =
      options.batchSize || RATE_LIMIT_SUSPICIOUS_PATTERNS_CLEANUP_BATCH_SIZE;
    this.minCleanupInterval =
      options.minCleanupInterval ||
      RATE_LIMIT_SUSPICIOUS_PATTERNS_MIN_CLEANUP_INTERVAL;

    // Use Map to maintain insertion order for LRU implementation
    this.patterns = new Map();

    // Track access order for LRU eviction
    this.accessOrder = new Map();

    // Cleanup tracking
    this.lastCleanup = Date.now();
    this.cleanupTimer = null;
    this.periodicCleanupInterval = null;

    // Start periodic cleanup
    this.startPeriodicCleanup();
  }

  /**
   * Gets a pattern entry and updates access order
   * @param {string} clientKey - Client key to look up
   * @returns {object|undefined} Pattern entry or undefined if not found
   */
  get(clientKey) {
    if (!clientKey || typeof clientKey !== 'string') {
      return undefined;
    }

    const pattern = this.patterns.get(clientKey);
    if (pattern) {
      // Update access order for LRU
      this.accessOrder.set(clientKey, Date.now());
      return pattern;
    }
    return undefined;
  }

  /**
   * Sets a pattern entry and manages size limits
   * @param {string} clientKey - Client key
   * @param {object} pattern - Pattern data
   */
  set(clientKey, pattern) {
    if (!clientKey || typeof clientKey !== 'string') {
      return;
    }

    const now = Date.now();

    // Handle null/undefined patterns safely
    const safePattern = pattern || {};

    // Update or create entry
    this.patterns.set(clientKey, {
      ...safePattern,
      createdAt: safePattern.createdAt || now,
      updatedAt: now,
    });

    // Update access order
    this.accessOrder.set(clientKey, now);

    // Enforce size limit with LRU eviction
    this.enforceSize();

    // Trigger cleanup if needed (but not too frequently)
    if (now - this.lastCleanup > this.minCleanupInterval) {
      this.scheduleCleanup();
    }
  }

  /**
   * Deletes a pattern entry
   * @param {string} clientKey - Client key to delete
   */
  delete(clientKey) {
    if (!clientKey || typeof clientKey !== 'string') {
      return;
    }

    this.patterns.delete(clientKey);
    this.accessOrder.delete(clientKey);
  }

  /**
   * Gets the current size of the patterns map
   * @returns {number} Number of entries
   */
  size() {
    return this.patterns.size;
  }

  /**
   * Gets memory usage statistics
   * @returns {object} Memory usage stats
   */
  getStats() {
    const now = Date.now();
    let expiredCount = 0;
    let totalRequestsTracked = 0;

    for (const [, pattern] of this.patterns) {
      if (now - pattern.updatedAt > this.maxAge) {
        expiredCount++;
      }
      totalRequestsTracked += pattern.requests ? pattern.requests.length : 0;
    }

    return {
      totalEntries: this.patterns.size,
      expiredEntries: expiredCount,
      totalRequestsTracked,
      memoryUsageEstimate: this.estimateMemoryUsage(),
      lastCleanup: this.lastCleanup,
      timeSinceLastCleanup: now - this.lastCleanup,
    };
  }

  /**
   * Estimates memory usage of the patterns map
   * @returns {number} Estimated memory usage in bytes
   */
  estimateMemoryUsage() {
    let estimate = 0;
    for (const [key, pattern] of this.patterns) {
      // Rough estimate: key size + pattern object size
      estimate += key.length * 2; // UTF-16 characters
      estimate += 200; // Base object overhead
      if (pattern.requests) {
        estimate += pattern.requests.length * 8; // Timestamp array
      }
    }
    return estimate;
  }

  /**
   * Enforces size limit by evicting least recently used entries
   */
  enforceSize() {
    if (this.patterns.size <= this.maxSize) {
      return;
    }

    // Sort by access time and remove oldest entries
    const sortedByAccess = Array.from(this.accessOrder.entries()).sort(
      (a, b) => a[1] - b[1]
    ); // Sort by timestamp (oldest first)

    const entriesToRemove = this.patterns.size - this.maxSize;
    for (let i = 0; i < entriesToRemove && i < sortedByAccess.length; i++) {
      const [clientKey] = sortedByAccess[i];
      this.delete(clientKey);
    }
  }

  /**
   * Cleans up expired entries in batches to prevent blocking
   * @param {number} batchSize - Number of entries to process in this batch
   * @returns {number} Number of entries cleaned up
   */
  cleanupExpired(batchSize = this.batchSize) {
    const now = Date.now();
    let cleanedCount = 0;
    let processedCount = 0;

    for (const [clientKey, pattern] of this.patterns) {
      if (processedCount >= batchSize) {
        break; // Limit batch size to prevent blocking
      }

      processedCount++;

      // Check if entry is expired
      if (now - pattern.updatedAt > this.maxAge) {
        this.delete(clientKey);
        cleanedCount++;
        continue;
      }

      // Also clean up old requests within the pattern
      if (pattern.requests && Array.isArray(pattern.requests)) {
        const originalLength = pattern.requests.length;
        pattern.requests = pattern.requests.filter(
          (timestamp) => now - timestamp < this.maxAge
        );

        // Update the pattern if we cleaned up requests
        if (pattern.requests.length !== originalLength) {
          this.patterns.set(clientKey, {
            ...pattern,
            updatedAt: now,
          });
        }
      }
    }

    this.lastCleanup = now;
    return cleanedCount;
  }

  /**
   * Schedules cleanup to run asynchronously
   */
  scheduleCleanup() {
    if (this.cleanupTimer) {
      return; // Cleanup already scheduled
    }

    this.cleanupTimer = setTimeout(() => {
      try {
        this.cleanupExpired();
      } catch (_error) {
        // Silent cleanup failure - will retry on next schedule
      } finally {
        this.cleanupTimer = null;
      }
    }, 0); // Run on next tick
  }

  /**
   * Starts periodic cleanup process
   */
  startPeriodicCleanup() {
    this.periodicCleanupInterval = setInterval(() => {
      try {
        this.cleanupExpired();
      } catch (_error) {
        // Silent cleanup failure - will retry on next interval
      }
    }, this.cleanupInterval);
  }

  /**
   * Performs a full cleanup of all expired entries
   * @returns {number} Number of entries cleaned up
   */
  fullCleanup() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [clientKey, pattern] of this.patterns) {
      if (now - pattern.updatedAt > this.maxAge) {
        this.delete(clientKey);
        cleanedCount++;
      }
    }

    this.lastCleanup = now;
    return cleanedCount;
  }

  /**
   * Clears all entries (for testing or emergency cleanup)
   */
  clear() {
    this.patterns.clear();
    this.accessOrder.clear();
    this.lastCleanup = Date.now();
  }

  /**
   * Destroys the manager and cleans up all resources
   * This should be called when the manager is no longer needed to prevent memory leaks
   */
  destroy() {
    // Clear periodic cleanup interval
    if (this.periodicCleanupInterval) {
      clearInterval(this.periodicCleanupInterval);
      this.periodicCleanupInterval = null;
    }

    // Clear any pending cleanup timer
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Clear all data
    this.clear();
  }
}

/**
 * Extracts the real client IP from request headers with proxy awareness
 * @param {object} req - Express request object
 * @returns {string} Real client IP address
 */
function extractRealClientIP(req) {
  // Handle invalid request objects
  if (!req || typeof req !== 'object') {
    return 'unknown';
  }

  // Ensure headers exist
  const headers = req.headers || {};

  // Try X-Forwarded-For header (most common proxy header)
  const xForwardedFor = headers['x-forwarded-for'];
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
    const headerValue = headers[header];
    if (headerValue) {
      const ip = Array.isArray(headerValue) ? headerValue[0] : headerValue;
      if (isValidPublicIP(ip.trim())) {
        return ip.trim();
      }
    }
  }

  // Fallback to direct connection IP
  const connection = req.connection || {};
  return req.ip || connection.remoteAddress || 'unknown';
}

/**
 * Validates if an IP address is a valid public IP (not private/internal)
 * Enhanced with comprehensive IPv6 support using ipaddr.js-based validation
 * @param {string} ip - IP address to validate (IPv4 or IPv6)
 * @returns {boolean} True if valid public IP
 */
function isValidPublicIP(ip) {
  if (!ip || typeof ip !== 'string') return false;

  // Check if this might be an IPv6 address
  if (isIPv6Hostname(ip)) {
    const ipv6Address = extractIPv6FromHostname(ip);
    return ipv6Address ? isValidPublicIPv6(ipv6Address) : false;
  }

  // IPv4 validation (existing logic preserved)
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) {
    // If it's not IPv4 and not recognized as IPv6, reject
    return false;
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

  // Handle invalid request objects
  if (!req || typeof req !== 'object') {
    return 'global:unknown';
  }

  // Ensure headers exist
  const headers = req.headers || {};

  // Primary: Use API key if available and requested
  if (useApiKey) {
    const apiKey = headers['x-api-key'];
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
  const connection = req.connection || {};
  const directIP = req.ip || connection.remoteAddress;
  if (directIP) {
    return `direct:${directIP}`;
  }

  // Fallback: Use User-Agent hash for some level of differentiation
  const userAgent = headers['user-agent'];
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

  // Track suspicious patterns with LRU eviction to prevent memory leaks
  const suspiciousPatterns = new SuspiciousPatternsManager(options);

  const middleware = rateLimit({
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
      } else {
        // Create a copy to avoid mutating the stored object directly
        pattern = { ...pattern };
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

      // Update the pattern in the manager (this handles LRU eviction automatically)
      suspiciousPatterns.set(clientKey, pattern);

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

  // Attach cleanup method for testing
  middleware.destroy = () => {
    suspiciousPatterns.destroy();
  };

  return middleware;
};

// Export SuspiciousPatternsManager for testing
export { SuspiciousPatternsManager };
