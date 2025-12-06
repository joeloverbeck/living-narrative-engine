import {
  SECURITY_DEFAULT_REQUEST_SIZE,
  SECURITY_MAX_REQUEST_SIZE,
  SECURITY_MAX_REQUEST_SIZE_BYTES,
} from '../config/constants.js';

/**
 * Creates a timeout middleware for Express requests with response tracking integration
 * @param {number} ms - Timeout duration in milliseconds
 * @param {object} options - Configuration options
 * @param {object} [options.logger] - Logger instance for debugging
 * @param {number} [options.gracePeriod] - Grace period after timeout before forcing response
 * @returns {Function} Express middleware function
 */
export const createTimeoutMiddleware = (ms = 30000, options = {}) => {
  const { logger, gracePeriod = 0 } = options;

  return (req, res, next) => {
    const requestId = req.requestId || 'unknown';
    let timeoutFired = false;
    let gracePeriodTimer = null;

    const timeout = setTimeout(() => {
      timeoutFired = true;

      if (logger) {
        logger.warn(`Request ${requestId}: Timeout fired after ${ms}ms`, {
          requestId,
          path: req.path,
          method: req.method,
          responseCommitted: res.isResponseCommitted
            ? res.isResponseCommitted()
            : false,
          headersSent: res.headersSent,
        });
      }

      // Check if response is already committed via tracking middleware
      if (res.commitResponse && !res.commitResponse('timeout')) {
        if (logger) {
          logger.warn(
            `Request ${requestId}: Timeout cannot commit response - already committed to '${res.getCommitmentSource()}'`,
            {
              requestId,
              existingCommitment: res.getCommitmentSource
                ? res.getCommitmentSource()
                : 'unknown',
            }
          );
        }
        return;
      }

      // If grace period is configured, delay the actual timeout response
      if (gracePeriod > 0) {
        if (logger) {
          logger.debug(
            `Request ${requestId}: Entering grace period of ${gracePeriod}ms`,
            {
              requestId,
            }
          );
        }

        gracePeriodTimer = setTimeout(() => {
          sendTimeoutResponse();
        }, gracePeriod);
      } else {
        sendTimeoutResponse();
      }
    }, ms);

    const sendTimeoutResponse = () => {
      if (!res.headersSent) {
        if (req.transitionState) {
          req.transitionState('timeout', { timeoutMs: ms });
        }

        res.status(503).json({
          error: true,
          message: 'Request timeout - the server took too long to respond.',
          stage: 'request_timeout',
          details: {
            timeoutMs: ms,
            path: req.path,
            method: req.method,
            requestId,
          },
          originalStatusCode: 503,
        });

        if (logger) {
          logger.warn(`Request ${requestId}: Timeout response sent`, {
            requestId,
          });
        }
      } else {
        if (logger) {
          logger.warn(
            `Request ${requestId}: Cannot send timeout response - headers already sent`,
            { requestId }
          );
        }
      }
    };

    // Clear timeout when response is sent
    const originalSend = res.send;
    const originalJson = res.json;
    const originalEnd = res.end;

    const clearTimeoutWrapper = (fn, methodName) => {
      return function (...args) {
        if (timeoutFired && logger) {
          logger.debug(
            `Request ${requestId}: Response method '${methodName}' called after timeout`,
            {
              requestId,
              method: methodName,
              timeElapsed: ms,
            }
          );
        }

        clearTimeout(timeout);
        if (gracePeriodTimer) {
          clearTimeout(gracePeriodTimer);
        }

        return fn.apply(this, args);
      };
    };

    res.send = clearTimeoutWrapper(originalSend, 'send');
    res.json = clearTimeoutWrapper(originalJson, 'json');
    res.end = clearTimeoutWrapper(originalEnd, 'end');

    // Also clear on response finish
    res.on('finish', () => {
      clearTimeout(timeout);
      if (gracePeriodTimer) {
        clearTimeout(gracePeriodTimer);
      }
    });

    res.on('close', () => {
      clearTimeout(timeout);
      if (gracePeriodTimer) {
        clearTimeout(gracePeriodTimer);
      }

      if (timeoutFired && logger) {
        logger.debug(`Request ${requestId}: Connection closed after timeout`, {
          requestId,
        });
      }
    });

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
