/**
 * @file Request tracking middleware for correlation IDs and response state management
 * @see ../handlers/llmRequestController.js
 */

import { randomUUID } from 'crypto';

/**
 * Request states for tracking lifecycle
 * @enum {string}
 */
export const REQUEST_STATE = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  RESPONDING: 'responding',
  COMPLETED: 'completed',
  TIMEOUT: 'timeout',
  ERROR: 'error',
};

/**
 * Creates request tracking middleware that adds correlation IDs and response commitment tracking
 * @param {object} options - Configuration options
 * @param {object} options.logger - Logger instance
 * @returns {Function} Express middleware function
 */
export const createRequestTrackingMiddleware = (options = {}) => {
  const { logger } = options;

  return (req, res, next) => {
    // Generate unique correlation ID
    const requestId = randomUUID();
    req.requestId = requestId;

    // Initialize request state tracking
    req.requestState = REQUEST_STATE.PENDING;
    req.stateTransitions = [];

    // Track state transitions
    const transitionState = (newState, metadata = {}) => {
      const transition = {
        from: req.requestState,
        to: newState,
        timestamp: Date.now(),
        metadata,
      };
      req.stateTransitions.push(transition);
      req.requestState = newState;

      if (logger) {
        logger.debug(
          `Request ${requestId}: State ${transition.from} → ${transition.to}`,
          {
            requestId,
            ...metadata,
          }
        );
      }
    };

    // Add state transition method to request
    req.transitionState = transitionState;

    // Response commitment tracking
    let responseCommitted = false;
    let commitmentSource = null;

    /**
     * Atomically commit to sending a response
     * @param {string} source - Source of the commitment (e.g., 'success', 'timeout', 'error')
     * @returns {boolean} True if commitment succeeded, false if already committed
     */
    const commitResponse = (source) => {
      if (responseCommitted) {
        if (logger) {
          logger.warn(
            `Request ${requestId}: Response already committed to '${commitmentSource}', cannot commit to '${source}'`,
            {
              requestId,
              existingSource: commitmentSource,
              attemptedSource: source,
            }
          );
        }
        return false;
      }

      responseCommitted = true;
      commitmentSource = source;
      transitionState(REQUEST_STATE.RESPONDING, { source });

      if (logger) {
        logger.debug(
          `Request ${requestId}: Response committed to '${source}'`,
          {
            requestId,
            source,
          }
        );
      }

      return true;
    };

    /**
     * Check if response is already committed
     * @returns {boolean} True if response has been committed, false otherwise
     */
    const isResponseCommitted = () => responseCommitted;

    /**
     * Get commitment source if committed
     * @returns {string|null} The source that committed the response, or null if not committed
     */
    const getCommitmentSource = () => commitmentSource;

    // Add commitment methods to response object
    res.commitResponse = commitResponse;
    res.isResponseCommitted = isResponseCommitted;
    res.getCommitmentSource = getCommitmentSource;

    // Wrap response methods to track completion
    const originalJson = res.json;
    const originalSend = res.send;
    const originalEnd = res.end;

    res.json = function (...args) {
      if (
        req.requestState !== REQUEST_STATE.ERROR &&
        req.requestState !== REQUEST_STATE.TIMEOUT
      ) {
        transitionState(REQUEST_STATE.COMPLETED, { method: 'json' });
      }
      return originalJson.apply(this, args);
    };

    res.send = function (...args) {
      if (
        req.requestState !== REQUEST_STATE.ERROR &&
        req.requestState !== REQUEST_STATE.TIMEOUT
      ) {
        transitionState(REQUEST_STATE.COMPLETED, { method: 'send' });
      }
      return originalSend.apply(this, args);
    };

    res.end = function (...args) {
      if (
        req.requestState !== REQUEST_STATE.ERROR &&
        req.requestState !== REQUEST_STATE.TIMEOUT
      ) {
        transitionState(REQUEST_STATE.COMPLETED, { method: 'end' });
      }
      return originalEnd.apply(this, args);
    };

    // Add request ID to response headers for client correlation
    res.setHeader('X-Request-ID', requestId);

    // Log request start
    if (logger) {
      logger.debug(`Request ${requestId}: Started ${req.method} ${req.path}`, {
        requestId,
        method: req.method,
        path: req.path,
      });
    }

    // Transition to processing state
    transitionState(REQUEST_STATE.PROCESSING);

    next();
  };
};

/**
 * Creates a response commitment guard for controllers
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {object} logger - Logger instance
 * @returns {object} Guard methods for safe response handling
 */
export const createResponseGuard = (req, res, logger) => {
  return {
    /**
     * Safely send success response with commitment check
     * @param {number} statusCode - HTTP status code
     * @param {object} data - Response data
     * @param {string} [contentType] - Optional content type
     * @returns {boolean} True if response sent, false if blocked
     */
    sendSuccess: (statusCode, data, contentType = 'application/json') => {
      if (!res.commitResponse('success')) {
        logger.warn(
          `Request ${req.requestId}: Cannot send success response - already committed to '${res.getCommitmentSource()}'`,
          {
            requestId: req.requestId,
            statusCode,
            blockedBy: res.getCommitmentSource(),
          }
        );
        return false;
      }

      if (res.headersSent) {
        logger.error(
          `Request ${req.requestId}: Headers already sent, cannot send success response`,
          { requestId: req.requestId }
        );
        return false;
      }

      res.status(statusCode).set('Content-Type', contentType).json(data);
      return true;
    },

    /**
     * Safely send error response with commitment check
     * @param {number} statusCode - HTTP status code
     * @param {string} stage - Error stage
     * @param {string} message - Error message
     * @param {object} details - Error details
     * @returns {boolean} True if response sent, false if blocked
     */
    sendError: (statusCode, stage, message, details = {}) => {
      const source = stage.includes('timeout') ? 'timeout' : 'error';

      if (!res.commitResponse(source)) {
        logger.warn(
          `Request ${req.requestId}: Cannot send error response - already committed to '${res.getCommitmentSource()}'`,
          {
            requestId: req.requestId,
            statusCode,
            stage,
            blockedBy: res.getCommitmentSource(),
          }
        );
        return false;
      }

      if (res.headersSent) {
        logger.error(
          `Request ${req.requestId}: Headers already sent, cannot send error response`,
          { requestId: req.requestId, stage }
        );
        return false;
      }

      req.transitionState(REQUEST_STATE.ERROR, { stage, statusCode });

      res.status(statusCode).json({
        error: true,
        message,
        stage,
        details: {
          ...details,
          requestId: req.requestId,
        },
        originalStatusCode: statusCode,
      });
      return true;
    },

    /**
     * Check if response can be sent
     * @returns {object} Commitment status
     */
    canSendResponse: () => ({
      canSend: !res.isResponseCommitted() && !res.headersSent,
      committed: res.isResponseCommitted(),
      source: res.getCommitmentSource(),
      headersSent: res.headersSent,
      requestId: req.requestId,
    }),
  };
};
