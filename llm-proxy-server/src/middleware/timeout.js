import {
  SECURITY_DEFAULT_REQUEST_SIZE,
  SECURITY_MAX_REQUEST_SIZE,
  SECURITY_MAX_REQUEST_SIZE_BYTES,
} from '../config/constants.js';

/**
 * Creates a timeout middleware for Express requests
 * @param {number} ms - Timeout duration in milliseconds
 * @returns {Function} Express middleware function
 */
export const createTimeoutMiddleware = (ms = 30000) => {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(503).json({
          error: true,
          message: 'Request timeout - the server took too long to respond.',
          stage: 'request_timeout',
          details: {
            timeoutMs: ms,
            path: req.path,
            method: req.method,
          },
          originalStatusCode: 503,
        });
      }
    }, ms);

    // Clear timeout when response is sent
    const originalSend = res.send;
    const originalJson = res.json;
    const originalEnd = res.end;

    const clearTimeoutWrapper = (fn) => {
      return function (...args) {
        clearTimeout(timeout);
        return fn.apply(this, args);
      };
    };

    res.send = clearTimeoutWrapper(originalSend);
    res.json = clearTimeoutWrapper(originalJson);
    res.end = clearTimeoutWrapper(originalEnd);

    // Also clear on response finish
    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));

    next();
  };
};

/**
 * Request size limit configuration for Express
 * @param {object} options - Size limit options
 * @param {string} options.jsonLimit - JSON body size limit
 * @param {boolean} options.enforceMaxLimit - Whether to enforce maximum security limit
 * @returns {object} Express body parser options
 */
export const createSizeLimitConfig = (options = {}) => {
  const { jsonLimit, enforceMaxLimit = true } = options;

  let limit = jsonLimit || SECURITY_DEFAULT_REQUEST_SIZE;

  // Enforce maximum security limit if requested
  if (enforceMaxLimit) {
    // If a custom limit is provided, ensure it doesn't exceed the security maximum
    if (jsonLimit) {
      const customLimitBytes = parseSize(jsonLimit);
      if (customLimitBytes > SECURITY_MAX_REQUEST_SIZE_BYTES) {
        limit = SECURITY_MAX_REQUEST_SIZE;
      }
    }
  }

  return {
    json: {
      limit,
      strict: true,
      type: 'application/json',
      // Add error handling for size limit exceeded
      verify: (req, res, buf) => {
        const size = buf.length;
        if (size > SECURITY_MAX_REQUEST_SIZE_BYTES) {
          const error = new Error('Request payload too large');
          error.status = 413;
          error.code = 'LIMIT_FILE_SIZE';
          throw error;
        }
      },
    },
  };
};

/**
 * Parse size string to bytes
 * @param {string} sizeStr - Size string (e.g., '1mb', '10mb', '500kb')
 * @returns {number} Size in bytes
 */
const parseSize = (sizeStr) => {
  if (typeof sizeStr === 'number') return sizeStr;

  const match = String(sizeStr)
    .toLowerCase()
    .match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';

  const multipliers = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  return Math.floor(value * (multipliers[unit] || 1));
};
