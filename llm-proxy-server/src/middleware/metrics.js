/**
 * @file Metrics middleware for HTTP request tracking
 * @description Automatic metrics collection for all HTTP requests
 */

/**
 * Creates middleware for automatic HTTP request metrics collection
 * @param {object} options - Configuration options
 * @param {object} options.metricsService - MetricsService instance
 * @param {object} options.logger - Logger instance
 * @param {boolean} options.enabled - Whether metrics collection is enabled (default: true)
 * @param {Function} options.routeResolver - Function to resolve route names from request (optional)
 * @returns {Function} Express middleware
 */
export const createMetricsMiddleware = (options = {}) => {
  const {
    metricsService,
    logger = console,
    enabled = true,
    routeResolver = defaultRouteResolver,
  } = options;

  if (!enabled) {
    return (req, res, next) => next();
  }

  if (!metricsService) {
    throw new Error('metricsService is required for metrics middleware');
  }

  return (req, res, next) => {
    // Skip metrics collection for metrics endpoint to avoid recursion
    if (req.path === '/metrics') {
      return next();
    }

    const startTime = process.hrtime.bigint();

    // Track request size
    const requestSize = getRequestSize(req);

    // Store original res.end to capture response metrics
    const originalEnd = res.end;
    let responseSize = 0;
    let responseCaptured = false;

    res.end = function (data, encoding) {
      // Capture response size if not already captured
      if (!responseCaptured) {
        responseSize = getResponseSize(res, data);
        recordRequestMetrics();
        responseCaptured = true;
      }

      return originalEnd.call(this, data, encoding);
    };

    // Also listen for response finish event as backup
    res.on('finish', () => {
      if (!responseCaptured) {
        recordRequestMetrics();
        responseCaptured = true;
      }
    });

    /**
     * Records HTTP request metrics when response completes
     */
    function recordRequestMetrics() {
      try {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1e9; // Convert to seconds

        const method = req.method;
        const route = routeResolver(req);
        const statusCode = res.statusCode;

        // Record HTTP request metrics
        metricsService.recordHttpRequest({
          method,
          route,
          statusCode,
          duration,
          requestSize,
          responseSize,
        });

        // Record specific error metrics if status indicates an error
        if (statusCode >= 400) {
          const errorType = getErrorType(statusCode);
          const severity = getErrorSeverity(statusCode);

          metricsService.recordError({
            errorType,
            component: 'http_server',
            severity,
          });
        }

        // Log request details for debugging
        logger.debug('HTTP request metrics recorded', {
          method,
          route,
          statusCode,
          duration,
          requestSize,
          responseSize,
          correlationId: req.correlationId,
        });
      } catch (error) {
        logger.error('Error recording HTTP request metrics', error);
      }
    }

    next();
  };
};

/**
 * Creates middleware specifically for LLM request metrics
 * @param {object} options - Configuration options
 * @param {object} options.metricsService - MetricsService instance
 * @param {object} options.logger - Logger instance
 * @returns {Function} Express middleware
 */
export const createLlmMetricsMiddleware = (options = {}) => {
  const { metricsService, logger = console } = options;

  if (!metricsService) {
    throw new Error('metricsService is required for LLM metrics middleware');
  }

  return (req, res, next) => {
    const startTime = process.hrtime.bigint();

    // Store original res.json to capture LLM response data
    const originalJson = res.json;

    res.json = function (data) {
      // Extract LLM request information and record metrics
      recordLlmRequestMetrics(req, res, data, startTime);
      return originalJson.call(this, data);
    };

    next();
  };

  /**
   * Records LLM request metrics from response data
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @param {object} responseData - LLM response data
   * @param {bigint} startTime - Request start time in nanoseconds
   */
  function recordLlmRequestMetrics(req, res, responseData, startTime) {
    try {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1e9;

      // Extract LLM information from request body
      const llmId = req.body?.llmId || 'unknown';
      const [provider, model] = parseLlmId(llmId);

      // Determine status based on response
      const status =
        res.statusCode >= 200 && res.statusCode < 300 ? 'success' : 'error';

      // Extract token information if available
      const tokens = extractTokens(responseData);

      metricsService.recordLlmRequest({
        provider,
        model,
        status,
        duration,
        tokens,
      });

      logger.debug('LLM request metrics recorded', {
        provider,
        model,
        status,
        duration,
        tokens,
        correlationId: req.correlationId,
      });
    } catch (error) {
      logger.error('Error recording LLM request metrics', error);
    }
  }
};

/**
 * Creates middleware for cache operation metrics
 * @param {object} options - Configuration options
 * @param {object} options.metricsService - MetricsService instance
 * @param {string} options.cacheType - Type of cache being monitored
 * @returns {Function} Cache operation recorder function
 */
export const createCacheMetricsRecorder = (options = {}) => {
  const { metricsService, cacheType = 'general' } = options;

  if (!metricsService) {
    throw new Error('metricsService is required for cache metrics recorder');
  }

  return {
    recordOperation: (operation, result, additionalData = {}) => {
      metricsService.recordCacheOperation({
        operation,
        result,
        cacheType,
        ...additionalData,
      });
    },

    recordStats: (size, memoryUsage) => {
      metricsService.recordCacheOperation({
        operation: 'stats_update',
        result: 'success',
        cacheType,
        size,
        memoryUsage,
      });
    },
  };
};

/**
 * Default route resolver that extracts route patterns from request URLs
 * @param {object} req - Express request object
 * @returns {string} Resolved route name
 */
function defaultRouteResolver(req) {
  const url = req.originalUrl || req.url || '';

  // Health check endpoints
  if (url === '/health') return '/health';
  if (url === '/health/ready') return '/health/ready';

  // Metrics endpoint
  if (url === '/metrics') return '/metrics';

  // API endpoints - check specific ones first
  if (url.startsWith('/api/llm-request')) return '/api/llm-request';

  // Root endpoint
  if (url === '/' || url === '') return '/';

  // Default to URL path without query parameters
  const path = url.split('?')[0];

  // Apply pattern replacements first
  const parameterizedPath = path
    .replace(/\/\d+/g, '/:id') // Replace numeric IDs
    .replace(/\/[a-fA-F0-9]{8,}/g, '/:hash') // Replace long hashes
    .replace(/\/v\d+/g, '/v*'); // Replace version numbers

  // Check for generic API pattern after parameterization
  if (parameterizedPath.startsWith('/api/')) {
    // If it's still just /api/* after parameterization, return that
    if (
      parameterizedPath === '/api/' ||
      parameterizedPath.match(/^\/api\/[^/]+$/)
    ) {
      return '/api/*';
    }
    // Otherwise return the parameterized path
    return parameterizedPath;
  }

  return parameterizedPath;
}

/**
 * Estimates request payload size
 * @param {object} req - Express request object
 * @returns {number} Estimated request size in bytes
 */
function getRequestSize(req) {
  try {
    // Try to get from Content-Length header first
    const contentLength = req.get('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (!isNaN(size) && size > 0) {
        return size;
      }
    }

    // Estimate from request body if available
    if (req.body) {
      if (typeof req.body === 'string') {
        return Buffer.byteLength(req.body, 'utf8');
      }
      if (typeof req.body === 'object') {
        try {
          return Buffer.byteLength(JSON.stringify(req.body), 'utf8');
        } catch (_error) {
          // Fallback estimation
          return 1000; // Default estimate for object bodies
        }
      }
    }

    return 0;
  } catch (_error) {
    return 0;
  }
}

/**
 * Estimates response payload size
 * @param {object} res - Express response object
 * @param {*} data - Response data
 * @returns {number} Estimated response size in bytes
 */
function getResponseSize(res, data) {
  try {
    // Try to get from Content-Length header first
    const contentLength = res.get('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (!isNaN(size) && size > 0) {
        return size;
      }
    }

    // Estimate from response data
    if (data) {
      if (typeof data === 'string') {
        return Buffer.byteLength(data, 'utf8');
      }
      if (Buffer.isBuffer(data)) {
        return data.length;
      }
      if (typeof data === 'object') {
        try {
          return Buffer.byteLength(JSON.stringify(data), 'utf8');
        } catch (_error) {
          return 1000; // Default estimate
        }
      }
    }

    return 0;
  } catch (_error) {
    return 0;
  }
}

/**
 * Determines error type from HTTP status code
 * @param {number} statusCode - HTTP status code
 * @returns {string} Error type
 */
function getErrorType(statusCode) {
  if (statusCode >= 400 && statusCode < 500) {
    switch (statusCode) {
      case 400:
        return 'bad_request';
      case 401:
        return 'unauthorized';
      case 403:
        return 'forbidden';
      case 404:
        return 'not_found';
      case 405:
        return 'method_not_allowed';
      case 408:
        return 'request_timeout';
      case 409:
        return 'conflict';
      case 413:
        return 'payload_too_large';
      case 429:
        return 'rate_limit_exceeded';
      default:
        return 'client_error';
    }
  }

  if (statusCode >= 500) {
    switch (statusCode) {
      case 500:
        return 'internal_server_error';
      case 501:
        return 'not_implemented';
      case 502:
        return 'bad_gateway';
      case 503:
        return 'service_unavailable';
      case 504:
        return 'gateway_timeout';
      default:
        return 'server_error';
    }
  }

  return 'unknown_error';
}

/**
 * Determines error severity from HTTP status code
 * @param {number} statusCode - HTTP status code
 * @returns {string} Error severity
 */
function getErrorSeverity(statusCode) {
  if (statusCode >= 400 && statusCode < 500) {
    // Client errors are generally low to medium severity
    if (statusCode === 429) return 'medium'; // Rate limiting
    if (statusCode === 401 || statusCode === 403) return 'medium'; // Auth errors
    return 'low';
  }

  if (statusCode >= 500) {
    // Server errors are high severity
    return 'high';
  }

  return 'low';
}

/**
 * Parses LLM ID into provider and model components
 * @param {string} llmId - LLM identifier (e.g., "openai-gpt-3.5-turbo")
 * @returns {[string, string]} Array of [provider, model]
 */
function parseLlmId(llmId) {
  if (!llmId || typeof llmId !== 'string') {
    return ['unknown', 'unknown'];
  }

  // Common patterns for LLM IDs
  const patterns = [
    // OpenAI pattern: openai-gpt-3.5-turbo
    /^(openai)[-_](.+)$/i,
    // Anthropic pattern: anthropic-claude-3-haiku
    /^(anthropic)[-_](.+)$/i,
    // OpenRouter pattern: openrouter/anthropic/claude-3-haiku
    /^(openrouter)\/([^/]+)\/(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = llmId.match(pattern);
    if (match) {
      if (match.length === 3) {
        // Simple provider-model pattern
        return [match[1].toLowerCase(), match[2].toLowerCase()];
      } else if (match.length === 4) {
        // OpenRouter pattern with nested provider
        return [
          `${match[1]}_${match[2]}`.toLowerCase(),
          match[3].toLowerCase(),
        ];
      }
    }
  }

  // Fallback: use the entire ID as the model with unknown provider
  return ['unknown', llmId.toLowerCase()];
}

/**
 * Extracts token usage information from LLM response
 * @param {object} responseData - LLM response data
 * @returns {object|null} Token usage object or null
 */
function extractTokens(responseData) {
  try {
    // Common token usage patterns in LLM responses
    if (responseData?.usage) {
      return {
        input:
          responseData.usage.prompt_tokens ||
          responseData.usage.input_tokens ||
          0,
        output:
          responseData.usage.completion_tokens ||
          responseData.usage.output_tokens ||
          0,
      };
    }

    // Alternative patterns
    if (responseData?.token_usage) {
      return {
        input: responseData.token_usage.input || 0,
        output: responseData.token_usage.output || 0,
      };
    }

    // OpenAI format
    if (responseData?.data?.usage) {
      return {
        input: responseData.data.usage.prompt_tokens || 0,
        output: responseData.data.usage.completion_tokens || 0,
      };
    }

    return null;
  } catch (_error) {
    return null;
  }
}
