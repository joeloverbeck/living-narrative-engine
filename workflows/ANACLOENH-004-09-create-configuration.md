# ANACLOENH-004-09: Create Error Handling Configuration

## Overview
Create comprehensive configuration for the error handling framework, including retry policies, circuit breaker settings, reporting endpoints, and fallback values.

## Parent Ticket
- ANACLOENH-004: Establish Error Handling Framework

## Depends On
- ANACLOENH-004-01 through ANACLOENH-004-08 (All previous implementation tickets)

## Current State
- No centralized error handling configuration
- Settings hardcoded in various places
- No environment-specific configuration

## Objectives
1. Create centralized configuration file
2. Support environment-specific settings
3. Define default retry and circuit breaker policies
4. Configure error reporting endpoints
5. Set domain-specific fallback values

## Technical Requirements

### Main Configuration File
```javascript
// src/config/errorHandling.config.js
import { ErrorSeverity } from '../errors/BaseError.js';

/**
 * Comprehensive error handling configuration
 * @module errorHandling.config
 */
export const errorHandlingConfig = {
  // Global settings
  global: {
    enabled: process.env.ERROR_HANDLING_ENABLED !== 'false',
    logLevel: process.env.ERROR_LOG_LEVEL || 'error',
    includeStackTrace: process.env.NODE_ENV !== 'production',
    correlationIdHeader: 'X-Correlation-ID',
    maxContextSize: 1000, // Max size of error context object
  },

  // Retry configuration
  retry: {
    default: {
      maxAttempts: 3,
      backoff: {
        type: 'exponential', // exponential, linear, constant
        initialDelay: 100,
        maxDelay: 5000,
        factor: 2,
        jitter: 0.1, // 10% jitter
      },
      timeout: 5000,
    },
    // Domain-specific overrides
    overrides: {
      'ClothingServiceError': {
        maxAttempts: 3,
        backoff: { type: 'exponential', initialDelay: 200 },
      },
      'AnatomyGenerationError': {
        maxAttempts: 2,
        backoff: { type: 'exponential', initialDelay: 500 },
      },
      'LLMInteractionError': {
        maxAttempts: 2,
        backoff: { type: 'linear', initialDelay: 1000 },
      },
      'NetworkError': {
        maxAttempts: 5,
        backoff: { type: 'exponential', initialDelay: 100, maxDelay: 10000 },
      },
    },
    // Non-retriable error types
    nonRetriable: [
      'ValidationError',
      'ConfigurationError',
      'InitializationError',
      'AuthenticationError',
      'AuthorizationError',
      'NotFoundError',
      'ConflictError',
    ],
  },

  // Circuit breaker configuration
  circuitBreaker: {
    default: {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 30000, // 30 seconds
      halfOpenRequests: 3,
      volumeThreshold: 10, // Min requests before opening
      errorThresholdPercentage: 50,
    },
    // Service-specific overrides
    overrides: {
      'clothing-service': {
        failureThreshold: 3,
        timeout: 60000,
      },
      'anatomy-service': {
        failureThreshold: 4,
        timeout: 45000,
      },
      'llm-service': {
        failureThreshold: 2,
        timeout: 120000, // 2 minutes for LLM
      },
      'external-api': {
        failureThreshold: 5,
        timeout: 60000,
        errorThresholdPercentage: 30,
      },
    },
  },

  // Error reporting configuration
  reporting: {
    enabled: process.env.ERROR_REPORTING_ENABLED === 'true',
    endpoint: process.env.ERROR_REPORTING_ENDPOINT,
    apiKey: process.env.ERROR_REPORTING_API_KEY,
    batchSize: parseInt(process.env.ERROR_BATCH_SIZE || '50'),
    flushInterval: parseInt(process.env.ERROR_FLUSH_INTERVAL || '30000'),
    includeStackTrace: process.env.NODE_ENV !== 'production',
    // Sampling configuration for high-volume scenarios
    sampling: {
      enabled: process.env.ERROR_SAMPLING_ENABLED === 'true',
      rate: parseFloat(process.env.ERROR_SAMPLING_RATE || '1.0'), // 1.0 = 100%
      // Always report these error types regardless of sampling
      alwaysReport: [
        'critical',
        'SecurityError',
        'DataCorruptionError',
        'SystemFailureError',
      ],
    },
    // Alert thresholds
    alerts: {
      criticalErrors: 5,
      errorRate: 10, // errors per minute
      specificError: 20, // same error count
      failureRate: 0.1, // 10% failure rate
    },
  },

  // Fallback values by domain
  fallback: {
    useCache: true,
    cacheTimeout: 60000, // 1 minute
    // Default fallback values by operation type
    defaults: {
      fetch: null,
      list: [],
      count: 0,
      validate: false,
      generate: {},
      calculate: 0,
      parse: null,
      render: '',
    },
    // Domain-specific fallback values
    domains: {
      clothing: {
        getEquipment: [],
        getAccessibility: { accessible: true, items: [] },
        calculatePriority: { priorities: {} },
        analyzeCoverage: { blocking: [] },
      },
      anatomy: {
        generateAnatomy: {
          parts: [
            { id: 'head', type: 'head' },
            { id: 'torso', type: 'torso' },
            { id: 'leftArm', type: 'arm' },
            { id: 'rightArm', type: 'arm' },
            { id: 'leftLeg', type: 'leg' },
            { id: 'rightLeg', type: 'leg' },
          ],
        },
        generateDescription: 'A standard humanoid form.',
        buildGraph: { nodes: [], edges: [] },
      },
      llm: {
        generateText: '[Text generation unavailable]',
        analyzePrompt: { tokens: 0, valid: false },
        complete: null,
      },
    },
  },

  // Recovery strategies
  recovery: {
    // Strategy selection based on error severity
    strategies: {
      [ErrorSeverity.CRITICAL]: {
        strategy: 'fail-fast',
        notify: true,
        fallback: false,
      },
      [ErrorSeverity.ERROR]: {
        strategy: 'retry-with-fallback',
        notify: false,
        fallback: true,
      },
      [ErrorSeverity.WARNING]: {
        strategy: 'retry-with-fallback',
        notify: false,
        fallback: true,
      },
      [ErrorSeverity.INFO]: {
        strategy: 'log-only',
        notify: false,
        fallback: false,
      },
    },
    // Maximum time to spend on recovery attempts
    maxRecoveryTime: 30000, // 30 seconds
    // Use cached results during recovery
    useCachedResults: true,
  },

  // Performance settings
  performance: {
    // Maximum errors to keep in memory
    maxErrorHistory: 1000,
    // Error metrics retention
    metricsRetention: 24 * 60 * 60 * 1000, // 24 hours
    // Cleanup interval
    cleanupInterval: 60 * 60 * 1000, // 1 hour
  },

  // Environment-specific overrides
  environments: {
    development: {
      global: { includeStackTrace: true },
      retry: { default: { maxAttempts: 2 } },
      reporting: { enabled: false },
    },
    test: {
      global: { enabled: true },
      retry: { default: { maxAttempts: 1 } },
      circuitBreaker: { default: { failureThreshold: 2 } },
      reporting: { enabled: false },
    },
    production: {
      global: { includeStackTrace: false },
      reporting: { enabled: true },
      fallback: { useCache: true },
    },
  },
};

/**
 * Get configuration for current environment
 * @returns {object} Merged configuration
 */
export function getErrorConfig() {
  const env = process.env.NODE_ENV || 'development';
  const envConfig = errorHandlingConfig.environments[env] || {};

  // Deep merge environment config with base config
  return deepMerge(errorHandlingConfig, envConfig);
}

/**
 * Get retry configuration for specific error type
 * @param {string} errorType - Error type name
 * @returns {object} Retry configuration
 */
export function getRetryConfig(errorType) {
  const config = getErrorConfig();
  return config.retry.overrides[errorType] || config.retry.default;
}

/**
 * Get circuit breaker configuration for specific service
 * @param {string} serviceName - Service name
 * @returns {object} Circuit breaker configuration
 */
export function getCircuitBreakerConfig(serviceName) {
  const config = getErrorConfig();
  return config.circuitBreaker.overrides[serviceName] || config.circuitBreaker.default;
}

/**
 * Get fallback value for specific operation
 * @param {string} domain - Domain name
 * @param {string} operation - Operation name
 * @returns {*} Fallback value
 */
export function getFallbackValue(domain, operation) {
  const config = getErrorConfig();

  // Check domain-specific fallback
  if (config.fallback.domains[domain]?.[operation] !== undefined) {
    return config.fallback.domains[domain][operation];
  }

  // Check default fallback
  return config.fallback.defaults[operation] ?? null;
}

/**
 * Check if error type is retriable
 * @param {string} errorType - Error type name
 * @returns {boolean} Whether error is retriable
 */
export function isRetriable(errorType) {
  const config = getErrorConfig();
  return !config.retry.nonRetriable.includes(errorType);
}

/**
 * Deep merge utility
 * @private
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

export default errorHandlingConfig;
```

### Environment Variables Template
```bash
# .env.example
# Error Handling Configuration
ERROR_HANDLING_ENABLED=true
ERROR_LOG_LEVEL=error
ERROR_REPORTING_ENABLED=false
ERROR_REPORTING_ENDPOINT=https://errors.example.com/api/v1/errors
ERROR_REPORTING_API_KEY=your-api-key-here
ERROR_BATCH_SIZE=50
ERROR_FLUSH_INTERVAL=30000
ERROR_SAMPLING_ENABLED=false
ERROR_SAMPLING_RATE=1.0
```

## Implementation Steps

1. **Create configuration file**
   - Implement main config structure
   - Add helper functions
   - Add environment merging

2. **Create environment template**
   - Document all environment variables
   - Provide example values

3. **Update services to use config**
   - CentralErrorHandler
   - RecoveryStrategyManager
   - ErrorReporter
   - MonitoringCoordinator

4. **Add configuration validation**
   - Validate on startup
   - Log configuration in development

## File Changes

### New Files
- `src/config/errorHandling.config.js` - Main configuration
- `.env.example` - Environment variables template (update existing)

### Modified Files
- All error handling services to use configuration

## Dependencies
- **Prerequisites**: All previous implementation tickets
- **External**: Environment variables

## Acceptance Criteria
1. ✅ Configuration file created with all settings
2. ✅ Environment-specific overrides work
3. ✅ Helper functions return correct values
4. ✅ Services use configuration
5. ✅ Configuration validates on startup
6. ✅ Documentation complete

## Testing Requirements

### Unit Tests
Create `tests/unit/config/errorHandling.config.test.js`:
- Test configuration loading
- Test environment merging
- Test helper functions
- Test validation

### Integration Tests
- Test services with configuration
- Test environment overrides
- Test runtime configuration changes

## Estimated Effort
- **Development**: 2 hours
- **Testing**: 1 hour
- **Total**: 3 hours

## Risk Assessment
- **Low Risk**: Configuration only
- **Consideration**: Sensitive data in config
- **Mitigation**: Use environment variables for secrets

## Success Metrics
- All services use configuration
- No hardcoded values remain
- Configuration changes without code changes
- Environment-specific behavior works

## Notes
- Keep configuration well-documented
- Provide sensible defaults
- Make configuration testable
- Consider adding configuration validation schema
- Plan for configuration hot-reloading in future