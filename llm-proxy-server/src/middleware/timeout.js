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
 * @returns {object} Express body parser options
 */
export const createSizeLimitConfig = (options = {}) => {
  return {
    json: {
      limit: options.jsonLimit || '1mb',
      strict: true,
      type: 'application/json',
    },
  };
};
