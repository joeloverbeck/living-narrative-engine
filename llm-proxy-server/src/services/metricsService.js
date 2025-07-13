/**
 * @file Prometheus metrics service for observability
 * @description Provides comprehensive metrics collection for HTTP requests, LLM operations, caching, and security
 */

import {
  register,
  collectDefaultMetrics,
  Counter,
  Histogram,
  Gauge,
} from 'prom-client';

/**
 * Metrics service for collecting and exposing Prometheus metrics
 * Tracks HTTP requests, LLM operations, cache performance, and security events
 */
class MetricsService {
  #logger;
  #isEnabled;

  /**
   * Creates a new MetricsService instance
   * @param {object} options - Configuration options
   * @param {object} options.logger - Logger instance
   * @param {boolean} options.enabled - Whether metrics collection is enabled (default: true)
   * @param {boolean} options.collectDefaultMetrics - Whether to collect Node.js default metrics (default: true)
   * @param {number} options.defaultMetricsInterval - Interval for default metrics collection in ms (default: 10000)
   */
  constructor(options = {}) {
    const {
      logger = console,
      enabled = true,
      collectDefaultMetrics: shouldCollectDefault = true,
      defaultMetricsInterval = 10000,
    } = options;

    this.#logger = logger;
    this.#isEnabled = enabled;

    if (!this.#isEnabled) {
      this.#logger.info('Metrics collection is disabled');
      return;
    }

    // Clear any existing metrics to avoid conflicts
    register.clear();

    // Collect default Node.js metrics
    if (shouldCollectDefault) {
      collectDefaultMetrics({
        register,
        prefix: 'llm_proxy_',
        timeout: defaultMetricsInterval,
      });
    }

    this.#initializeCustomMetrics();
    this.#logger.info('Metrics service initialized', {
      defaultMetrics: shouldCollectDefault,
      customMetrics: true,
    });
  }

  /**
   * Initialize custom application-specific metrics
   * @private
   */
  #initializeCustomMetrics() {
    // HTTP Request Metrics
    this.httpRequestsTotal = new Counter({
      name: 'llm_proxy_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [register],
    });

    this.httpRequestDuration = new Histogram({
      name: 'llm_proxy_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [register],
    });

    this.httpRequestSize = new Histogram({
      name: 'llm_proxy_http_request_size_bytes',
      help: 'Size of HTTP request payloads in bytes',
      labelNames: ['method', 'route'],
      buckets: [100, 1000, 10000, 100000, 1000000, 10000000],
      registers: [register],
    });

    this.httpResponseSize = new Histogram({
      name: 'llm_proxy_http_response_size_bytes',
      help: 'Size of HTTP response payloads in bytes',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [100, 1000, 10000, 100000, 1000000, 10000000],
      registers: [register],
    });

    // LLM Request Metrics
    this.llmRequestsTotal = new Counter({
      name: 'llm_proxy_llm_requests_total',
      help: 'Total number of LLM requests',
      labelNames: ['llm_provider', 'model', 'status'],
      registers: [register],
    });

    this.llmRequestDuration = new Histogram({
      name: 'llm_proxy_llm_request_duration_seconds',
      help: 'Duration of LLM requests in seconds',
      labelNames: ['llm_provider', 'model', 'status'],
      buckets: [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300],
      registers: [register],
    });

    this.llmTokensProcessed = new Counter({
      name: 'llm_proxy_llm_tokens_processed_total',
      help: 'Total number of tokens processed by LLM requests',
      labelNames: ['llm_provider', 'model', 'token_type'],
      registers: [register],
    });

    // Cache Metrics
    this.cacheOperationsTotal = new Counter({
      name: 'llm_proxy_cache_operations_total',
      help: 'Total number of cache operations',
      labelNames: ['operation', 'result'],
      registers: [register],
    });

    this.cacheSize = new Gauge({
      name: 'llm_proxy_cache_size_entries',
      help: 'Current number of entries in cache',
      labelNames: ['cache_type'],
      registers: [register],
    });

    this.cacheMemoryUsage = new Gauge({
      name: 'llm_proxy_cache_memory_usage_bytes',
      help: 'Current cache memory usage in bytes',
      labelNames: ['cache_type'],
      registers: [register],
    });

    // Rate Limiting Metrics
    this.rateLimitHits = new Counter({
      name: 'llm_proxy_rate_limit_hits_total',
      help: 'Total number of rate limit hits',
      labelNames: ['limit_type', 'client_type'],
      registers: [register],
    });

    this.suspiciousPatternsDetected = new Counter({
      name: 'llm_proxy_suspicious_patterns_detected_total',
      help: 'Total number of suspicious patterns detected',
      labelNames: ['pattern_type', 'severity'],
      registers: [register],
    });

    this.rateLimitMapSize = new Gauge({
      name: 'llm_proxy_rate_limit_map_size_entries',
      help: 'Current size of rate limiting patterns map',
      registers: [register],
    });

    // Security Metrics
    this.securityValidationResults = new Counter({
      name: 'llm_proxy_security_validation_results_total',
      help: 'Total number of security validation results',
      labelNames: ['result', 'validation_type'],
      registers: [register],
    });

    this.securityIncidents = new Counter({
      name: 'llm_proxy_security_incidents_total',
      help: 'Total number of security incidents detected',
      labelNames: ['incident_type', 'severity'],
      registers: [register],
    });

    // API Key Metrics
    this.apiKeyOperations = new Counter({
      name: 'llm_proxy_api_key_operations_total',
      help: 'Total number of API key operations',
      labelNames: ['operation', 'result', 'key_source'],
      registers: [register],
    });

    // Health Check Metrics
    this.healthCheckResults = new Counter({
      name: 'llm_proxy_health_check_results_total',
      help: 'Total number of health check results',
      labelNames: ['check_type', 'result'],
      registers: [register],
    });

    this.healthCheckDuration = new Histogram({
      name: 'llm_proxy_health_check_duration_seconds',
      help: 'Duration of health checks in seconds',
      labelNames: ['check_type'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [register],
    });

    // Error Metrics
    this.errorsTotal = new Counter({
      name: 'llm_proxy_errors_total',
      help: 'Total number of errors',
      labelNames: ['error_type', 'component', 'severity'],
      registers: [register],
    });
  }

  /**
   * Records an HTTP request metric
   * @param {object} data - Request data
   * @param {string} data.method - HTTP method
   * @param {string} data.route - Route path
   * @param {number} data.statusCode - HTTP status code
   * @param {number} data.duration - Request duration in seconds
   * @param {number} data.requestSize - Request payload size in bytes
   * @param {number} data.responseSize - Response payload size in bytes
   */
  recordHttpRequest(data) {
    if (!this.#isEnabled) return;

    const { method, route, statusCode, duration, requestSize, responseSize } =
      data;
    const labels = { method, route, status_code: statusCode };

    try {
      this.httpRequestsTotal.inc(labels);
      this.httpRequestDuration.observe(labels, duration);

      if (typeof requestSize === 'number' && requestSize > 0) {
        this.httpRequestSize.observe({ method, route }, requestSize);
      }

      if (typeof responseSize === 'number' && responseSize > 0) {
        this.httpResponseSize.observe(labels, responseSize);
      }
    } catch (error) {
      this.#logger.error('Error recording HTTP request metrics', error);
    }
  }

  /**
   * Records an LLM request metric
   * @param {object} data - LLM request data
   * @param {string} data.provider - LLM provider name
   * @param {string} data.model - Model name
   * @param {string} data.status - Request status (success, error, timeout, etc.)
   * @param {number} data.duration - Request duration in seconds
   * @param {object} data.tokens - Token counts { input: number, output: number }
   */
  recordLlmRequest(data) {
    if (!this.#isEnabled) return;

    const { provider, model, status, duration, tokens } = data;
    const labels = { llm_provider: provider, model, status };

    try {
      this.llmRequestsTotal.inc(labels);
      this.llmRequestDuration.observe(labels, duration);

      if (tokens) {
        if (typeof tokens.input === 'number' && tokens.input > 0) {
          this.llmTokensProcessed.inc(
            { llm_provider: provider, model, token_type: 'input' },
            tokens.input
          );
        }
        if (typeof tokens.output === 'number' && tokens.output > 0) {
          this.llmTokensProcessed.inc(
            { llm_provider: provider, model, token_type: 'output' },
            tokens.output
          );
        }
      }
    } catch (error) {
      this.#logger.error('Error recording LLM request metrics', error);
    }
  }

  /**
   * Records cache operation metrics
   * @param {object} data - Cache operation data
   * @param {string} data.operation - Operation type (get, set, delete, clear)
   * @param {string} data.result - Operation result (hit, miss, success, error)
   * @param {string} data.cacheType - Type of cache (api_key, general, etc.)
   * @param {number} data.size - Current cache size
   * @param {number} data.memoryUsage - Current memory usage in bytes
   */
  recordCacheOperation(data) {
    if (!this.#isEnabled) return;

    const { operation, result, cacheType, size, memoryUsage } = data;

    try {
      this.cacheOperationsTotal.inc({ operation, result });

      if (cacheType) {
        if (typeof size === 'number') {
          this.cacheSize.set({ cache_type: cacheType }, size);
        }
        if (typeof memoryUsage === 'number') {
          this.cacheMemoryUsage.set({ cache_type: cacheType }, memoryUsage);
        }
      }
    } catch (error) {
      this.#logger.error('Error recording cache operation metrics', error);
    }
  }

  /**
   * Records rate limiting metrics
   * @param {object} data - Rate limiting data
   * @param {string} data.limitType - Type of rate limit (general, llm, auth)
   * @param {string} data.clientType - Type of client (ip, api_key, etc.)
   * @param {string} data.patternType - Type of suspicious pattern detected
   * @param {string} data.severity - Severity level (low, medium, high)
   * @param {number} data.mapSize - Current size of rate limiting map
   */
  recordRateLimiting(data) {
    if (!this.#isEnabled) return;

    const { limitType, clientType, patternType, severity, mapSize } = data;

    try {
      if (limitType && clientType) {
        this.rateLimitHits.inc({
          limit_type: limitType,
          client_type: clientType,
        });
      }

      if (patternType && severity) {
        this.suspiciousPatternsDetected.inc({
          pattern_type: patternType,
          severity,
        });
      }

      if (typeof mapSize === 'number') {
        this.rateLimitMapSize.set(mapSize);
      }
    } catch (error) {
      this.#logger.error('Error recording rate limiting metrics', error);
    }
  }

  /**
   * Records security validation metrics
   * @param {object} data - Security validation data
   * @param {string} data.result - Validation result (pass, fail, warning)
   * @param {string} data.validationType - Type of validation (headers, csp, ip, etc.)
   * @param {string} data.incidentType - Type of security incident
   * @param {string} data.severity - Incident severity (low, medium, high, critical)
   */
  recordSecurityValidation(data) {
    if (!this.#isEnabled) return;

    const { result, validationType, incidentType, severity } = data;

    try {
      if (result && validationType) {
        this.securityValidationResults.inc({
          result,
          validation_type: validationType,
        });
      }

      if (incidentType && severity) {
        this.securityIncidents.inc({ incident_type: incidentType, severity });
      }
    } catch (error) {
      this.#logger.error('Error recording security validation metrics', error);
    }
  }

  /**
   * Records API key operation metrics
   * @param {object} data - API key operation data
   * @param {string} data.operation - Operation type (retrieve, cache_hit, cache_miss)
   * @param {string} data.result - Operation result (success, error, not_found)
   * @param {string} data.keySource - Source of the key (file, env, cache)
   */
  recordApiKeyOperation(data) {
    if (!this.#isEnabled) return;

    const { operation, result, keySource } = data;

    try {
      if (operation && result && keySource) {
        this.apiKeyOperations.inc({ operation, result, key_source: keySource });
      }
    } catch (error) {
      this.#logger.error('Error recording API key operation metrics', error);
    }
  }

  /**
   * Records health check metrics
   * @param {object} data - Health check data
   * @param {string} data.checkType - Type of health check (liveness, readiness)
   * @param {string} data.result - Check result (success, failure)
   * @param {number} data.duration - Check duration in seconds
   */
  recordHealthCheck(data) {
    if (!this.#isEnabled) return;

    const { checkType, result, duration } = data;

    try {
      if (checkType && result) {
        this.healthCheckResults.inc({ check_type: checkType, result });
      }

      if (checkType && typeof duration === 'number') {
        this.healthCheckDuration.observe({ check_type: checkType }, duration);
      }
    } catch (error) {
      this.#logger.error('Error recording health check metrics', error);
    }
  }

  /**
   * Records error metrics
   * @param {object} data - Error data
   * @param {string} data.errorType - Type of error (validation, network, timeout, etc.)
   * @param {string} data.component - Component where error occurred
   * @param {string} data.severity - Error severity (low, medium, high, critical)
   */
  recordError(data) {
    if (!this.#isEnabled) return;

    const { errorType, component, severity } = data;

    try {
      if (errorType && component && severity) {
        this.errorsTotal.inc({ error_type: errorType, component, severity });
      }
    } catch (error) {
      this.#logger.error('Error recording error metrics', error);
    }
  }

  /**
   * Gets all metrics in Prometheus format
   * @returns {Promise<string>} Prometheus formatted metrics
   */
  async getMetrics() {
    if (!this.#isEnabled) {
      return '# Metrics collection is disabled\n';
    }

    try {
      return await register.metrics();
    } catch (error) {
      this.#logger.error('Error getting metrics', error);
      throw error;
    }
  }

  /**
   * Gets metrics registry for testing or advanced usage
   * @returns {object} Prometheus registry
   */
  getRegistry() {
    return register;
  }

  /**
   * Resets all metrics (useful for testing)
   */
  reset() {
    if (!this.#isEnabled) return;

    try {
      register.resetMetrics();
      this.#logger.debug('Metrics reset successfully');
    } catch (error) {
      this.#logger.error('Error resetting metrics', error);
    }
  }

  /**
   * Clears all metrics and unregisters them
   */
  clear() {
    try {
      register.clear();
      this.#logger.debug('Metrics cleared successfully');
    } catch (error) {
      this.#logger.error('Error clearing metrics', error);
    }
  }

  /**
   * Checks if metrics collection is enabled
   * @returns {boolean} True if metrics are enabled
   */
  isEnabled() {
    return this.#isEnabled;
  }

  /**
   * Gets current metrics statistics
   * @returns {object} Statistics about metrics collection
   */
  getStats() {
    if (!this.#isEnabled) {
      return { enabled: false };
    }

    try {
      const metricsResult = register.getMetricsAsJSON();
      // Defensive programming: ensure we have an array
      const metrics = Array.isArray(metricsResult) ? metricsResult : [];

      return {
        enabled: true,
        totalMetrics: metrics.length,
        customMetrics: metrics.filter((m) => m.name.startsWith('llm_proxy_'))
          .length,
        defaultMetrics: metrics.filter((m) => !m.name.startsWith('llm_proxy_'))
          .length,
      };
    } catch (error) {
      this.#logger.error('Error getting metrics stats', error);
      return { enabled: true, error: error.message };
    }
  }
}

export default MetricsService;
