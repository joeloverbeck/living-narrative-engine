/**
 * @file Security configuration for mod validation system
 * @description Defines security limits, thresholds, and policies for safe mod validation
 */

/**
 * Comprehensive security configuration for mod validation
 * All values are configurable and can be overridden based on environment needs
 */
export const validationSecurityConfig = {
  /**
   * File access security settings
   */
  fileAccess: {
    // Maximum file size allowed (10MB default)
    maxFileSize: 10 * 1024 * 1024,
    
    // Allowed file extensions for processing
    allowedExtensions: ['.json', '.scope'],
    
    // Blocked directory patterns (prevent access to sensitive areas)
    blockedPaths: [
      'node_modules',
      '.git',
      '.env',
      'secrets',
      'private',
      '.ssh',
      '.aws',
      '.config'
    ],
    
    // Timeout for file read operations (5 seconds)
    readTimeout: 5000,
    
    // Maximum directory traversal depth
    maxTraversalDepth: 10,
    
    // Patterns that indicate path traversal attempts
    pathTraversalPatterns: [
      '../',
      '..\\',
      '%2e%2e/',
      '%2e%2e\\',
      '..%2f',
      '..%5c',
      '..',
      '~/',
      '~\\'
    ]
  },
  
  /**
   * JSON parsing security settings (prevent JSON bombs)
   */
  jsonParsing: {
    // Maximum nesting depth for JSON objects
    maxDepth: 50,
    
    // Maximum number of keys in a single object
    maxKeys: 1000,
    
    // Maximum string length for any single value
    maxStringLength: 100000,
    
    // Maximum array length
    maxArrayLength: 10000,
    
    // Maximum total size of parsed JSON object (in characters)
    maxJsonSize: 5 * 1024 * 1024, // 5MB
    
    // Dangerous key patterns to watch for
    dangerousKeys: [
      '__proto__',
      'constructor',
      'prototype'
    ]
  },
  
  /**
   * Scope DSL parsing security settings (prevent ReDoS)
   */
  scopeDsl: {
    // Maximum expression length
    maxExpressionLength: 5000,
    
    // Maximum nesting level for scope expressions
    maxNestingLevel: 20,
    
    // Maximum number of references in a single scope
    maxReferences: 100,
    
    // Timeout for parsing operations (milliseconds)
    timeoutMs: 1000,
    
    // Maximum regex complexity (prevent ReDoS)
    maxRegexLength: 500,
    
    // Patterns that might indicate ReDoS attempts
    dangerousRegexPatterns: [
      '(.*)*',
      '(.*)+',
      '([^\\n]*)*',
      '([^\\n]*)+',
      '(\\w*)*',
      '(\\w*)+'
    ]
  },
  
  /**
   * Resource management settings
   */
  resources: {
    // Maximum memory usage allowed (512MB)
    maxMemoryUsage: 512 * 1024 * 1024,
    
    // Maximum processing time for any single operation (30 seconds)
    maxProcessingTime: 30000,
    
    // Maximum concurrent operations
    maxConcurrentOperations: 10,
    
    // Memory check interval (milliseconds)
    memoryCheckInterval: 1000,
    
    // Memory warning threshold (percentage)
    memoryWarningThreshold: 0.75,
    
    // Memory critical threshold (percentage)
    memoryCriticalThreshold: 0.90
  },
  
  /**
   * Circuit breaker settings for resilience
   */
  circuitBreaker: {
    // Number of failures before opening circuit
    failureThreshold: 5,
    
    // Time to wait before attempting recovery (1 minute)
    recoveryTimeout: 60000,
    
    // Monitoring window for failure tracking (5 minutes)
    monitoringWindow: 300000,
    
    // Success threshold for half-open to closed transition
    successThreshold: 3,
    
    // Timeout for half-open state (30 seconds)
    halfOpenTimeout: 30000
  },
  
  /**
   * Retry policy settings
   */
  retryPolicy: {
    // Maximum number of retry attempts
    maxRetries: 3,
    
    // Initial retry delay (milliseconds)
    initialDelay: 100,
    
    // Maximum retry delay (milliseconds)
    maxDelay: 5000,
    
    // Backoff multiplier for exponential backoff
    backoffMultiplier: 2,
    
    // Jitter factor (0-1) to randomize delays
    jitterFactor: 0.1,
    
    // Retryable error codes
    retryableErrors: [
      'EBUSY',
      'ETIMEDOUT',
      'ECONNRESET',
      'ENOTFOUND',
      'EAGAIN'
    ]
  },
  
  /**
   * Audit and logging settings
   */
  audit: {
    // Enable security audit logging
    enabled: true,
    
    // Log security violations
    logViolations: true,
    
    // Log resource warnings
    logResourceWarnings: true,
    
    // Log circuit breaker events
    logCircuitBreakerEvents: true,
    
    // Minimum severity level to log
    minSeverityLevel: 'MEDIUM',
    
    // Include stack traces in security logs
    includeStackTraces: true,
    
    // Maximum log entries to keep in memory
    maxLogEntries: 1000
  },
  
  /**
   * Validation policies
   */
  validationPolicies: {
    // Strict mode - fail on any security concern
    strictMode: false,
    
    // Allow partial results on non-critical errors
    allowPartialResults: true,
    
    // Skip files that cannot be accessed
    skipInaccessibleFiles: true,
    
    // Continue on non-security errors
    continueOnError: true,
    
    // Quarantine suspicious mods
    quarantineSuspiciousMods: false,
    
    // Report all violations (even if continuing)
    reportAllViolations: true
  },
  
  /**
   * Rate limiting settings
   */
  rateLimiting: {
    // Enable rate limiting
    enabled: true,
    
    // Maximum operations per minute
    maxOperationsPerMinute: 100,
    
    // Maximum file reads per minute
    maxFileReadsPerMinute: 500,
    
    // Burst allowance (temporary spike handling)
    burstAllowance: 20,
    
    // Rate limit window (milliseconds)
    windowMs: 60000
  }
};

/**
 * Get environment-specific configuration overrides
 * @returns {object} Configuration with environment overrides applied
 */
export function getSecurityConfig() {
  const config = { ...validationSecurityConfig };
  
  // Apply environment-specific overrides if needed
  if (globalThis.process?.env?.NODE_ENV === 'production') {
    // Stricter settings for production
    config.validationPolicies.strictMode = true;
    config.validationPolicies.quarantineSuspiciousMods = true;
    config.resources.maxMemoryUsage = 256 * 1024 * 1024; // Lower memory limit
    config.circuitBreaker.failureThreshold = 3; // More sensitive circuit breaker
  } else if (globalThis.process?.env?.NODE_ENV === 'test') {
    // Relaxed settings for testing
    config.resources.maxProcessingTime = 5000; // Shorter timeout
    config.resources.maxMemoryUsage = 128 * 1024 * 1024; // Lower memory for tests
    config.audit.enabled = false; // Disable audit logging in tests
    config.rateLimiting.enabled = false; // Disable rate limiting in tests
  }
  
  return config;
}

export default validationSecurityConfig;