# Ticket 3: Target Reference Resolver Service

## Overview

Create a dedicated service for mapping placeholder names to resolved entity IDs, providing a clean architectural layer that separates target resolution concerns from rule execution logic. This service acts as the central authority for placeholder-to-entity mapping and enables better testing, caching, and error handling.

## Problem Statement

**Current Issue**: Placeholder resolution logic is scattered across different operation handlers and rule execution components, making it difficult to maintain consistency, add caching, and ensure comprehensive error handling.

**Root Cause**: No centralized service responsible for target reference resolution, leading to duplicated logic and inconsistent behavior across different parts of the system.

**Target Architecture**: A dedicated `TargetReferenceResolver` service that provides a clean API for resolving placeholder names to entity IDs, with comprehensive caching, validation, and error handling.

## Dependencies

- **Ticket 1**: Enhanced event payload structure with resolved target IDs
- **Ticket 2**: Enhanced entity reference resolution logic (to be replaced/enhanced)
- Dependency injection system for service registration
- Logging system for debugging and monitoring
- Entity query manager for entity validation

## Implementation Details

### 1. Service Interface Design

**Step 1.1**: Define the service interface and contracts

```javascript
/**
 * @file targetReferenceResolver.js
 * @description Service for resolving placeholder names to entity IDs in multi-target actions
 */

/**
 * Target reference resolver interface
 */
class ITargetReferenceResolver {
  /**
   * Resolve a placeholder name to an entity ID
   * @param {string} placeholder - Placeholder name (e.g., "primary", "secondary")
   * @param {Object} eventPayload - Event payload containing target information
   * @returns {Promise<string|null>} - Resolved entity ID or null if not found
   */
  async resolvePlaceholder(placeholder, eventPayload) {
    throw new Error('Method must be implemented');
  }
  
  /**
   * Resolve multiple placeholders in batch
   * @param {Array<string>} placeholders - Array of placeholder names
   * @param {Object} eventPayload - Event payload containing target information
   * @returns {Promise<Map<string, string|null>>} - Map of placeholder to entity ID
   */
  async resolvePlaceholdersBatch(placeholders, eventPayload) {
    throw new Error('Method must be implemented');
  }
  
  /**
   * Validate that all required placeholders can be resolved
   * @param {Array<string>} placeholders - Array of placeholder names to validate
   * @param {Object} eventPayload - Event payload to validate against
   * @returns {Promise<ValidationResult>} - Validation result with details
   */
  async validatePlaceholders(placeholders, eventPayload) {
    throw new Error('Method must be implemented');
  }
  
  /**
   * Get all available placeholder names from event payload
   * @param {Object} eventPayload - Event payload to analyze
   * @returns {Array<string>} - Array of available placeholder names
   */
  getAvailablePlaceholders(eventPayload) {
    throw new Error('Method must be implemented');
  }
  
  /**
   * Check if a string is a recognized placeholder name
   * @param {string} name - Name to check
   * @returns {boolean} - True if it's a placeholder name
   */
  isPlaceholderName(name) {
    throw new Error('Method must be implemented');
  }
}

/**
 * Validation result structure
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether all placeholders are valid
 * @property {Array<string>} resolved - Successfully resolved placeholders
 * @property {Array<string>} missing - Missing/unresolvable placeholders
 * @property {Array<string>} available - Available placeholders in payload
 * @property {Map<string, string>} mappings - Placeholder to entity ID mappings
 * @property {Array<ValidationError>} errors - Detailed error information
 */

/**
 * Validation error structure
 * @typedef {Object} ValidationError
 * @property {string} placeholder - Placeholder that failed validation
 * @property {string} errorType - Type of error (MISSING, INVALID_FORMAT, ENTITY_NOT_FOUND)
 * @property {string} message - Human-readable error message
 * @property {Object} context - Additional context for debugging
 */
```

### 2. Core Service Implementation

**Step 2.1**: Implement the main service class

```javascript
import { validateDependency, assertNonBlankString } from '../utils/validationUtils.js';
import { ensureValidLogger } from '../utils/loggerUtils.js';

/**
 * Target reference resolver service implementation
 */
class TargetReferenceResolver {
  // Supported placeholder names
  static PLACEHOLDER_NAMES = ['primary', 'secondary', 'tertiary'];
  
  // Cache TTL in milliseconds (5 minutes)
  static CACHE_TTL = 5 * 60 * 1000;
  
  constructor({ logger, entityQueryManager }) {
    this.#logger = ensureValidLogger(logger);
    this.#entityQueryManager = validateDependency(entityQueryManager, 'IEntityQueryManager');
    
    // Resolution cache: Map<cacheKey, {result, timestamp}>
    this.#resolutionCache = new Map();
    
    // Performance metrics
    this.#metrics = {
      resolutionCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      validationCount: 0,
      errorCount: 0
    };
  }
  
  #logger;
  #entityQueryManager;
  #resolutionCache;
  #metrics;
  
  /**
   * Resolve a placeholder name to an entity ID
   * @param {string} placeholder - Placeholder name
   * @param {Object} eventPayload - Event payload with target information
   * @returns {Promise<string|null>} - Resolved entity ID or null
   */
  async resolvePlaceholder(placeholder, eventPayload) {
    const startTime = Date.now();
    
    try {
      // Input validation
      assertNonBlankString(placeholder, 'Placeholder name');
      this.#validateEventPayload(eventPayload);
      
      // Check if it's a valid placeholder name
      if (!this.isPlaceholderName(placeholder)) {
        this.#logger.warn('Invalid placeholder name', { placeholder });
        return null;
      }
      
      // Check cache first
      const cacheKey = this.#generateCacheKey(placeholder, eventPayload);
      const cached = this.#getCachedResult(cacheKey);
      if (cached !== undefined) {
        this.#metrics.cacheHits++;
        return cached;
      }
      
      // Perform resolution
      const entityId = await this.#performPlaceholderResolution(placeholder, eventPayload);
      
      // Cache result
      this.#setCachedResult(cacheKey, entityId);
      this.#metrics.cacheMisses++;
      this.#metrics.resolutionCount++;
      
      // Log resolution
      const duration = Date.now() - startTime;
      this.#logger.debug('Placeholder resolved', {
        placeholder,
        entityId,
        duration,
        cached: false
      });
      
      return entityId;
      
    } catch (error) {
      this.#metrics.errorCount++;
      this.#logger.error('Placeholder resolution failed', {
        placeholder,
        error: error.message,
        duration: Date.now() - startTime
      });
      return null;
    }
  }
  
  /**
   * Resolve multiple placeholders in batch for performance
   * @param {Array<string>} placeholders - Array of placeholder names
   * @param {Object} eventPayload - Event payload with target information
   * @returns {Promise<Map<string, string|null>>} - Map of results
   */
  async resolvePlaceholdersBatch(placeholders, eventPayload) {
    const startTime = Date.now();
    const results = new Map();
    
    try {
      // Input validation
      if (!Array.isArray(placeholders)) {
        throw new Error('Placeholders must be an array');
      }
      
      this.#validateEventPayload(eventPayload);
      
      // Process each placeholder
      const resolutionPromises = placeholders.map(async (placeholder) => {
        const entityId = await this.resolvePlaceholder(placeholder, eventPayload);
        return { placeholder, entityId };
      });
      
      // Wait for all resolutions
      const resolutions = await Promise.all(resolutionPromises);
      
      // Build result map
      resolutions.forEach(({ placeholder, entityId }) => {
        results.set(placeholder, entityId);
      });
      
      const duration = Date.now() - startTime;
      this.#logger.debug('Batch placeholder resolution completed', {
        placeholderCount: placeholders.length,
        resolvedCount: Array.from(results.values()).filter(id => id !== null).length,
        duration
      });
      
      return results;
      
    } catch (error) {
      this.#metrics.errorCount++;
      this.#logger.error('Batch placeholder resolution failed', {
        placeholderCount: placeholders.length,
        error: error.message,
        duration: Date.now() - startTime
      });
      
      // Return partial results
      return results;
    }
  }
  
  /**
   * Validate that all required placeholders can be resolved
   * @param {Array<string>} placeholders - Placeholder names to validate
   * @param {Object} eventPayload - Event payload to validate against
   * @returns {Promise<ValidationResult>} - Comprehensive validation result
   */
  async validatePlaceholders(placeholders, eventPayload) {
    const startTime = Date.now();
    this.#metrics.validationCount++;
    
    const result = {
      valid: true,
      resolved: [],
      missing: [],
      available: this.getAvailablePlaceholders(eventPayload),
      mappings: new Map(),
      errors: []
    };
    
    try {
      // Input validation
      if (!Array.isArray(placeholders)) {
        throw new Error('Placeholders must be an array');
      }
      
      this.#validateEventPayload(eventPayload);
      
      // Resolve all placeholders and track results
      for (const placeholder of placeholders) {
        try {
          const entityId = await this.resolvePlaceholder(placeholder, eventPayload);
          
          if (entityId) {
            // Validate that entity exists
            const entityExists = await this.#validateEntityExists(entityId);
            
            if (entityExists) {
              result.resolved.push(placeholder);
              result.mappings.set(placeholder, entityId);
            } else {
              result.missing.push(placeholder);
              result.errors.push({
                placeholder,
                errorType: 'ENTITY_NOT_FOUND',
                message: `Entity ${entityId} does not exist`,
                context: { resolvedId: entityId }
              });
            }
          } else {
            result.missing.push(placeholder);
            result.errors.push({
              placeholder,
              errorType: 'PLACEHOLDER_NOT_RESOLVED',
              message: `Placeholder '${placeholder}' could not be resolved to entity ID`,
              context: { available: result.available }
            });
          }
        } catch (error) {
          result.missing.push(placeholder);
          result.errors.push({
            placeholder,
            errorType: 'RESOLUTION_ERROR',
            message: error.message,
            context: { error: error.toString() }
          });
        }
      }
      
      // Overall validation result
      result.valid = result.missing.length === 0;
      
      const duration = Date.now() - startTime;
      this.#logger.debug('Placeholder validation completed', {
        totalPlaceholders: placeholders.length,
        resolved: result.resolved.length,
        missing: result.missing.length,
        valid: result.valid,
        duration
      });
      
      return result;
      
    } catch (error) {
      this.#metrics.errorCount++;
      this.#logger.error('Placeholder validation failed', {
        placeholders,
        error: error.message,
        duration: Date.now() - startTime
      });
      
      result.valid = false;
      result.errors.push({
        placeholder: 'ALL',
        errorType: 'VALIDATION_SYSTEM_ERROR',
        message: error.message,
        context: { systemError: true }
      });
      
      return result;
    }
  }
  
  /**
   * Get all available placeholder names from event payload
   * @param {Object} eventPayload - Event payload to analyze
   * @returns {Array<string>} - Available placeholder names
   */
  getAvailablePlaceholders(eventPayload) {
    const available = [];
    
    if (!eventPayload) {
      return available;
    }
    
    // Check legacy format fields
    TargetReferenceResolver.PLACEHOLDER_NAMES.forEach(placeholder => {
      const legacyField = `${placeholder}Id`;
      if (eventPayload[legacyField]) {
        available.push(placeholder);
      }
    });
    
    // Check comprehensive format
    if (eventPayload.targets && typeof eventPayload.targets === 'object') {
      Object.keys(eventPayload.targets).forEach(key => {
        if (this.isPlaceholderName(key) && !available.includes(key)) {
          available.push(key);
        }
      });
    }
    
    return available.sort(); // Consistent ordering
  }
  
  /**
   * Check if a string is a recognized placeholder name
   * @param {string} name - Name to check
   * @returns {boolean} - True if it's a placeholder name
   */
  isPlaceholderName(name) {
    return typeof name === 'string' && 
           TargetReferenceResolver.PLACEHOLDER_NAMES.includes(name);
  }
  
  /**
   * Get service performance metrics
   * @returns {Object} - Performance metrics
   */
  getMetrics() {
    const totalRequests = this.#metrics.cacheHits + this.#metrics.cacheMisses;
    
    return {
      ...this.#metrics,
      cacheHitRate: totalRequests > 0 ? (this.#metrics.cacheHits / totalRequests) : 0,
      errorRate: this.#metrics.resolutionCount > 0 
        ? (this.#metrics.errorCount / this.#metrics.resolutionCount) 
        : 0,
      cacheSize: this.#resolutionCache.size
    };
  }
  
  /**
   * Clear resolution cache
   */
  clearCache() {
    const previousSize = this.#resolutionCache.size;
    this.#resolutionCache.clear();
    
    this.#logger.debug('Resolution cache cleared', { previousSize });
  }
  
  // Private helper methods
  
  /**
   * Perform the actual placeholder resolution logic
   * @private
   * @param {string} placeholder - Placeholder name
   * @param {Object} eventPayload - Event payload
   * @returns {Promise<string|null>} - Resolved entity ID
   */
  async #performPlaceholderResolution(placeholder, eventPayload) {
    // Try comprehensive format first
    if (eventPayload.targets && eventPayload.targets[placeholder]) {
      const targetInfo = eventPayload.targets[placeholder];
      if (targetInfo.entityId) {
        return targetInfo.entityId;
      }
    }
    
    // Fall back to legacy format
    const legacyField = `${placeholder}Id`;
    const legacyEntityId = eventPayload[legacyField];
    if (legacyEntityId) {
      return legacyEntityId;
    }
    
    // No resolution found
    return null;
  }
  
  /**
   * Validate event payload structure
   * @private
   * @param {Object} eventPayload - Event payload to validate
   * @throws {Error} - If payload is invalid
   */
  #validateEventPayload(eventPayload) {
    if (!eventPayload || typeof eventPayload !== 'object') {
      throw new Error('Event payload must be a valid object');
    }
    
    // Basic structure validation
    if (!eventPayload.type) {
      throw new Error('Event payload must have a type field');
    }
  }
  
  /**
   * Generate cache key for resolution result
   * @private
   * @param {string} placeholder - Placeholder name
   * @param {Object} eventPayload - Event payload
   * @returns {string} - Cache key
   */
  #generateCacheKey(placeholder, eventPayload) {
    // Create key based on placeholder and relevant payload fields
    const keyParts = [
      placeholder,
      eventPayload.actionId || 'no-action',
      eventPayload.primaryId || 'no-primary',
      eventPayload.secondaryId || 'no-secondary',
      eventPayload.tertiaryId || 'no-tertiary'
    ];
    
    return keyParts.join('|');
  }
  
  /**
   * Get cached resolution result
   * @private
   * @param {string} cacheKey - Cache key
   * @returns {string|null|undefined} - Cached result or undefined if not found
   */
  #getCachedResult(cacheKey) {
    const cached = this.#resolutionCache.get(cacheKey);
    
    if (cached) {
      // Check if cache entry is still valid
      const now = Date.now();
      if (now - cached.timestamp < TargetReferenceResolver.CACHE_TTL) {
        return cached.result;
      } else {
        // Remove expired cache entry
        this.#resolutionCache.delete(cacheKey);
      }
    }
    
    return undefined;
  }
  
  /**
   * Set cached resolution result
   * @private
   * @param {string} cacheKey - Cache key
   * @param {string|null} result - Resolution result
   */
  #setCachedResult(cacheKey, result) {
    this.#resolutionCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries periodically
    if (this.#resolutionCache.size > 1000) {
      this.#cleanupCache();
    }
  }
  
  /**
   * Clean up expired cache entries
   * @private
   */
  #cleanupCache() {
    const now = Date.now();
    const toDelete = [];
    
    for (const [key, value] of this.#resolutionCache.entries()) {
      if (now - value.timestamp >= TargetReferenceResolver.CACHE_TTL) {
        toDelete.push(key);
      }
    }
    
    toDelete.forEach(key => this.#resolutionCache.delete(key));
    
    this.#logger.debug('Cache cleanup completed', {
      removedEntries: toDelete.length,
      remainingEntries: this.#resolutionCache.size
    });
  }
  
  /**
   * Validate that an entity exists in the system
   * @private
   * @param {string} entityId - Entity ID to validate
   * @returns {Promise<boolean>} - True if entity exists
   */
  async #validateEntityExists(entityId) {
    try {
      const entity = await this.#entityQueryManager.getEntity(entityId);
      return !!entity;
    } catch (error) {
      this.#logger.warn('Entity existence check failed', {
        entityId,
        error: error.message
      });
      return false;
    }
  }
}

export default TargetReferenceResolver;
```

### 3. Dependency Injection Integration

**Step 3.1**: Add service registration and dependency tokens

```javascript
// In dependency injection tokens file
export const tokens = {
  // Existing tokens...
  ITargetReferenceResolver: Symbol('ITargetReferenceResolver'),
};

// In service registration
container.register(tokens.ITargetReferenceResolver, TargetReferenceResolver, {
  dependencies: {
    logger: tokens.ILogger,
    entityQueryManager: tokens.IEntityQueryManager
  }
});
```

**Step 3.2**: Update dependent services to use the resolver

```javascript
// Example: Enhanced rule context using the service
class EnhancedRuleContext {
  constructor({ eventPayload, logger, entityQueryManager, targetReferenceResolver, ruleId }) {
    // ... existing initialization ...
    this.#targetReferenceResolver = validateDependency(
      targetReferenceResolver, 
      'ITargetReferenceResolver'
    );
  }
  
  #targetReferenceResolver;
  
  /**
   * Resolve entity reference using the dedicated service
   * @param {string|Object} entityRef - Entity reference to resolve
   * @returns {Promise<string|null>} - Resolved entity ID
   */
  async resolveEntityReference(entityRef) {
    // Handle non-placeholder references
    if (typeof entityRef === 'object' && entityRef.entity_id) {
      return entityRef.entity_id;
    }
    
    if (typeof entityRef !== 'string') {
      return null;
    }
    
    // Traditional keywords
    if (entityRef === 'actor') {
      return this.eventPayload.actorId;
    }
    
    if (entityRef === 'target') {
      return this.eventPayload.targetId || this.eventPayload.primaryId;
    }
    
    // Use service for placeholder resolution
    if (this.#targetReferenceResolver.isPlaceholderName(entityRef)) {
      return await this.#targetReferenceResolver.resolvePlaceholder(entityRef, this.eventPayload);
    }
    
    // Direct entity ID
    return entityRef;
  }
  
  /**
   * Validate required targets using the service
   * @param {Array<string>} requiredPlaceholders - Required placeholder names
   * @returns {Promise<ValidationResult>} - Validation result
   */
  async validateRequiredTargets(requiredPlaceholders) {
    return await this.#targetReferenceResolver.validatePlaceholders(
      requiredPlaceholders, 
      this.eventPayload
    );
  }
}
```

### 4. Error Handling and Custom Exceptions

**Step 4.1**: Define custom error types

```javascript
/**
 * @file targetReferenceErrors.js
 * @description Custom error types for target reference resolution
 */

/**
 * Base error for target reference resolution issues
 */
class TargetReferenceError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = 'TargetReferenceError';
    this.code = code;
    this.context = context;
  }
}

/**
 * Error when placeholder cannot be resolved to entity ID
 */
class PlaceholderResolutionError extends TargetReferenceError {
  constructor(placeholder, eventPayload, availableTargets = []) {
    const message = `Unable to resolve placeholder '${placeholder}' to entity ID`;
    super(message, 'PLACEHOLDER_NOT_RESOLVED', {
      placeholder,
      availableTargets,
      eventType: eventPayload.type,
      actionId: eventPayload.actionId
    });
  }
}

/**
 * Error when resolved entity ID doesn't exist in system
 */
class EntityNotFoundError extends TargetReferenceError {
  constructor(entityId, placeholder) {
    const message = `Entity '${entityId}' resolved from placeholder '${placeholder}' does not exist`;
    super(message, 'ENTITY_NOT_FOUND', {
      entityId,
      placeholder
    });
  }
}

/**
 * Error when event payload structure is invalid
 */
class InvalidEventPayloadError extends TargetReferenceError {
  constructor(reason) {
    const message = `Invalid event payload for target resolution: ${reason}`;
    super(message, 'INVALID_EVENT_PAYLOAD', { reason });
  }
}

export {
  TargetReferenceError,
  PlaceholderResolutionError,
  EntityNotFoundError,
  InvalidEventPayloadError
};
```

### 5. Testing Utilities and Helpers

**Step 5.1**: Create comprehensive test utilities

```javascript
/**
 * @file targetReferenceResolverTestUtils.js
 * @description Test utilities for target reference resolver
 */

class TargetReferenceResolverTestUtils {
  /**
   * Create mock event payload with target information
   * @param {Object} options - Payload configuration
   * @returns {Object} - Mock event payload
   */
  static createMockEventPayload(options = {}) {
    const defaults = {
      type: 'core:attempt_action',
      actorId: 'test_actor',
      actionId: 'test:action',
      primaryId: 'test_primary_entity',
      secondaryId: 'test_secondary_entity',
      tertiaryId: null,
      targets: {
        primary: {
          entityId: 'test_primary_entity',
          placeholder: 'primary',
          description: 'Test Primary Entity'
        },
        secondary: {
          entityId: 'test_secondary_entity',
          placeholder: 'secondary',
          description: 'Test Secondary Entity'
        }
      }
    };
    
    return { ...defaults, ...options };
  }
  
  /**
   * Create mock entity query manager
   * @param {Object} options - Configuration options
   * @returns {Object} - Mock entity query manager
   */
  static createMockEntityQueryManager(options = {}) {
    const entities = options.entities || new Map([
      ['test_primary_entity', { id: 'test_primary_entity', name: 'Test Primary' }],
      ['test_secondary_entity', { id: 'test_secondary_entity', name: 'Test Secondary' }]
    ]);
    
    return {
      getEntity: jest.fn().mockImplementation((id) => {
        const entity = entities.get(id);
        if (!entity) {
          throw new Error(`Entity not found: ${id}`);
        }
        return Promise.resolve(entity);
      }),
      entityExists: jest.fn().mockImplementation((id) => {
        return Promise.resolve(entities.has(id));
      })
    };
  }
  
  /**
   * Create target reference resolver instance for testing
   * @param {Object} options - Configuration options
   * @returns {TargetReferenceResolver} - Resolver instance
   */
  static createResolver(options = {}) {
    const mockLogger = options.logger || {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    
    const mockEntityQueryManager = options.entityQueryManager || 
      this.createMockEntityQueryManager();
    
    return new TargetReferenceResolver({
      logger: mockLogger,
      entityQueryManager: mockEntityQueryManager
    });
  }
  
  /**
   * Assert resolution results
   * @param {Map} results - Resolution results to validate
   * @param {Object} expected - Expected results
   */
  static assertResolutionResults(results, expected) {
    Object.entries(expected).forEach(([placeholder, expectedId]) => {
      expect(results.get(placeholder)).toBe(expectedId);
    });
  }
  
  /**
   * Assert validation results
   * @param {ValidationResult} result - Validation result
   * @param {Object} expectations - Expected validation outcome
   */
  static assertValidationResult(result, expectations) {
    expect(result.valid).toBe(expectations.valid);
    expect(result.resolved).toEqual(expect.arrayContaining(expectations.resolved || []));
    expect(result.missing).toEqual(expect.arrayContaining(expectations.missing || []));
    
    if (expectations.errorCount !== undefined) {
      expect(result.errors).toHaveLength(expectations.errorCount);
    }
  }
}

export default TargetReferenceResolverTestUtils;
```

### 6. Performance Monitoring and Metrics

**Step 6.1**: Add comprehensive metrics collection

```javascript
/**
 * Extended metrics collection for target reference resolver
 */
class TargetReferenceResolverMetrics {
  constructor() {
    this.reset();
  }
  
  /**
   * Reset all metrics
   */
  reset() {
    this.metrics = {
      // Resolution metrics
      singleResolutions: 0,
      batchResolutions: 0,
      totalPlaceholdersResolved: 0,
      successfulResolutions: 0,
      failedResolutions: 0,
      
      // Validation metrics
      validationRequests: 0,
      successfulValidations: 0,
      failedValidations: 0,
      
      // Cache metrics
      cacheHits: 0,
      cacheMisses: 0,
      cacheEvictions: 0,
      
      // Performance metrics
      averageResolutionTime: 0,
      averageValidationTime: 0,
      averageBatchTime: 0,
      
      // Error metrics
      errorsByType: new Map(),
      totalErrors: 0
    };
    
    this.timings = [];
  }
  
  /**
   * Record resolution attempt
   * @param {boolean} success - Whether resolution succeeded
   * @param {number} duration - Duration in milliseconds
   * @param {string} type - Type of resolution (single, batch, validation)
   */
  recordResolution(success, duration, type = 'single') {
    this.timings.push({ duration, type, success, timestamp: Date.now() });
    
    // Keep only recent timings (last 1000)
    if (this.timings.length > 1000) {
      this.timings = this.timings.slice(-1000);
    }
    
    if (type === 'single') {
      this.metrics.singleResolutions++;
    } else if (type === 'batch') {
      this.metrics.batchResolutions++;
    } else if (type === 'validation') {
      this.metrics.validationRequests++;
    }
    
    if (success) {
      this.metrics.successfulResolutions++;
    } else {
      this.metrics.failedResolutions++;
    }
    
    // Update average timings
    this.#updateAverageTimings();
  }
  
  /**
   * Record cache event
   * @param {string} eventType - hit, miss, eviction
   */
  recordCacheEvent(eventType) {
    switch (eventType) {
      case 'hit':
        this.metrics.cacheHits++;
        break;
      case 'miss':
        this.metrics.cacheMisses++;
        break;
      case 'eviction':
        this.metrics.cacheEvictions++;
        break;
    }
  }
  
  /**
   * Record error by type
   * @param {string} errorType - Type of error
   */
  recordError(errorType) {
    const current = this.metrics.errorsByType.get(errorType) || 0;
    this.metrics.errorsByType.set(errorType, current + 1);
    this.metrics.totalErrors++;
  }
  
  /**
   * Get comprehensive metrics report
   * @returns {Object} - Metrics report
   */
  getReport() {
    const totalRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
    
    return {
      ...this.metrics,
      
      // Calculated metrics
      successRate: this.#calculateSuccessRate(),
      cacheHitRate: totalRequests > 0 ? (this.metrics.cacheHits / totalRequests) : 0,
      errorRate: this.#calculateErrorRate(),
      
      // Performance percentiles
      performancePercentiles: this.#calculatePercentiles(),
      
      // Error breakdown
      errorBreakdown: Object.fromEntries(this.metrics.errorsByType),
      
      // Summary
      summary: {
        totalOperations: this.metrics.singleResolutions + this.metrics.batchResolutions + this.metrics.validationRequests,
        averagePerformance: this.metrics.averageResolutionTime,
        healthScore: this.#calculateHealthScore()
      }
    };
  }
  
  // Private helper methods
  
  #updateAverageTimings() {
    const recentTimings = this.timings.slice(-100); // Last 100 operations
    
    if (recentTimings.length === 0) return;
    
    const byType = {
      single: recentTimings.filter(t => t.type === 'single'),
      batch: recentTimings.filter(t => t.type === 'batch'),
      validation: recentTimings.filter(t => t.type === 'validation')
    };
    
    this.metrics.averageResolutionTime = this.#average(byType.single.map(t => t.duration));
    this.metrics.averageBatchTime = this.#average(byType.batch.map(t => t.duration));
    this.metrics.averageValidationTime = this.#average(byType.validation.map(t => t.duration));
  }
  
  #average(numbers) {
    return numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
  }
  
  #calculateSuccessRate() {
    const total = this.metrics.successfulResolutions + this.metrics.failedResolutions;
    return total > 0 ? (this.metrics.successfulResolutions / total) : 1;
  }
  
  #calculateErrorRate() {
    const total = this.metrics.singleResolutions + this.metrics.batchResolutions + this.metrics.validationRequests;
    return total > 0 ? (this.metrics.totalErrors / total) : 0;
  }
  
  #calculatePercentiles() {
    const durations = this.timings.map(t => t.duration).sort((a, b) => a - b);
    
    if (durations.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0 };
    }
    
    return {
      p50: durations[Math.floor(durations.length * 0.5)],
      p90: durations[Math.floor(durations.length * 0.9)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)]
    };
  }
  
  #calculateHealthScore() {
    const successRate = this.#calculateSuccessRate();
    const errorRate = this.#calculateErrorRate();
    const avgPerformance = this.metrics.averageResolutionTime;
    
    // Health score based on success rate, error rate, and performance
    let score = successRate * 100; // Base score from success rate
    score -= errorRate * 50; // Penalty for errors
    
    // Performance penalty (assuming >10ms is slow)
    if (avgPerformance > 10) {
      score -= Math.min((avgPerformance - 10) * 2, 30);
    }
    
    return Math.max(0, Math.min(100, score));
  }
}
```

## Acceptance Criteria

### Core Functionality Criteria
1. ✅ **Service Interface**: Clean API for resolving placeholder names to entity IDs
2. ✅ **Batch Resolution**: Support for resolving multiple placeholders efficiently
3. ✅ **Validation Support**: Comprehensive validation of placeholder requirements
4. ✅ **Placeholder Recognition**: Correctly identifies valid placeholder names
5. ✅ **Available Target Detection**: Identifies available placeholders in event payload

### Performance Criteria
6. ✅ **Caching System**: Implements intelligent caching with TTL and cleanup
7. ✅ **Batch Performance**: Batch operations are more efficient than individual calls
8. ✅ **Resolution Speed**: Single placeholder resolution completes in <2ms
9. ✅ **Memory Management**: Cache cleanup prevents memory leaks
10. ✅ **Metrics Collection**: Comprehensive performance and error metrics

### Integration Criteria
11. ✅ **Dependency Injection**: Properly registered in DI container
12. ✅ **Error Handling**: Custom error types with detailed context
13. ✅ **Logging Integration**: Comprehensive logging for debugging
14. ✅ **Event Payload Formats**: Supports both legacy and comprehensive formats
15. ✅ **Entity Validation**: Validates that resolved entities exist in system

### Quality Criteria
16. ✅ **Input Validation**: Robust validation of all input parameters
17. ✅ **Error Recovery**: Graceful handling of resolution failures
18. ✅ **Test Coverage**: Comprehensive unit and integration tests
19. ✅ **Documentation**: Clear JSDoc documentation for all public methods
20. ✅ **Backward Compatibility**: Works with existing event payload formats

## Testing Requirements

### Unit Tests
```javascript
describe('TargetReferenceResolver', () => {
  let resolver;
  let mockLogger;
  let mockEntityQueryManager;
  
  beforeEach(() => {
    const testUtils = TargetReferenceResolverTestUtils;
    mockLogger = testUtils.createMockLogger();
    mockEntityQueryManager = testUtils.createMockEntityQueryManager();
    resolver = testUtils.createResolver({ mockLogger, mockEntityQueryManager });
  });
  
  describe('Placeholder Recognition', () => {
    it('should recognize valid placeholder names', () => {
      expect(resolver.isPlaceholderName('primary')).toBe(true);
      expect(resolver.isPlaceholderName('secondary')).toBe(true);
      expect(resolver.isPlaceholderName('tertiary')).toBe(true);
      expect(resolver.isPlaceholderName('invalid')).toBe(false);
    });
  });
  
  describe('Single Placeholder Resolution', () => {
    it('should resolve placeholder from comprehensive format', async () => {
      const eventPayload = TargetReferenceResolverTestUtils.createMockEventPayload({
        targets: {
          primary: { entityId: 'entity_123', placeholder: 'primary' }
        }
      });
      
      const result = await resolver.resolvePlaceholder('primary', eventPayload);
      expect(result).toBe('entity_123');
    });
    
    it('should resolve placeholder from legacy format', async () => {
      const eventPayload = TargetReferenceResolverTestUtils.createMockEventPayload({
        primaryId: 'entity_456',
        targets: {} // Empty comprehensive format
      });
      
      const result = await resolver.resolvePlaceholder('primary', eventPayload);
      expect(result).toBe('entity_456');
    });
    
    it('should return null for unresolvable placeholder', async () => {
      const eventPayload = TargetReferenceResolverTestUtils.createMockEventPayload({
        primaryId: null,
        targets: {}
      });
      
      const result = await resolver.resolvePlaceholder('primary', eventPayload);
      expect(result).toBeNull();
    });
  });
  
  describe('Batch Resolution', () => {
    it('should resolve multiple placeholders efficiently', async () => {
      const eventPayload = TargetReferenceResolverTestUtils.createMockEventPayload();
      
      const results = await resolver.resolvePlaceholdersBatch(
        ['primary', 'secondary'],
        eventPayload
      );
      
      expect(results.size).toBe(2);
      expect(results.get('primary')).toBe('test_primary_entity');
      expect(results.get('secondary')).toBe('test_secondary_entity');
    });
  });
  
  describe('Validation', () => {
    it('should validate successful placeholder resolution', async () => {
      const eventPayload = TargetReferenceResolverTestUtils.createMockEventPayload();
      
      const result = await resolver.validatePlaceholders(
        ['primary', 'secondary'],
        eventPayload
      );
      
      TargetReferenceResolverTestUtils.assertValidationResult(result, {
        valid: true,
        resolved: ['primary', 'secondary'],
        missing: [],
        errorCount: 0
      });
    });
    
    it('should detect missing placeholders', async () => {
      const eventPayload = TargetReferenceResolverTestUtils.createMockEventPayload({
        primaryId: null,
        targets: {}
      });
      
      const result = await resolver.validatePlaceholders(['primary'], eventPayload);
      
      TargetReferenceResolverTestUtils.assertValidationResult(result, {
        valid: false,
        resolved: [],
        missing: ['primary'],
        errorCount: 1
      });
    });
  });
  
  describe('Caching', () => {
    it('should cache resolution results', async () => {
      const eventPayload = TargetReferenceResolverTestUtils.createMockEventPayload();
      
      // First resolution
      await resolver.resolvePlaceholder('primary', eventPayload);
      
      // Second resolution should use cache
      await resolver.resolvePlaceholder('primary', eventPayload);
      
      const metrics = resolver.getMetrics();
      expect(metrics.cacheHits).toBe(1);
      expect(metrics.cacheMisses).toBe(1);
    });
    
    it('should expire cached results after TTL', async () => {
      // Test with mocked time
      jest.useFakeTimers();
      
      const eventPayload = TargetReferenceResolverTestUtils.createMockEventPayload();
      
      await resolver.resolvePlaceholder('primary', eventPayload);
      
      // Advance time beyond cache TTL
      jest.advanceTimersByTime(6 * 60 * 1000); // 6 minutes
      
      await resolver.resolvePlaceholder('primary', eventPayload);
      
      const metrics = resolver.getMetrics();
      expect(metrics.cacheMisses).toBe(2); // Both should be cache misses
      
      jest.useRealTimers();
    });
  });
  
  describe('Metrics', () => {
    it('should collect performance metrics', async () => {
      const eventPayload = TargetReferenceResolverTestUtils.createMockEventPayload();
      
      await resolver.resolvePlaceholder('primary', eventPayload);
      await resolver.validatePlaceholders(['secondary'], eventPayload);
      
      const metrics = resolver.getMetrics();
      expect(metrics.resolutionCount).toBeGreaterThan(0);
      expect(metrics.validationCount).toBe(1);
      expect(metrics.errorRate).toBeLessThanOrEqual(1);
    });
  });
});
```

### Integration Tests
```javascript
describe('TargetReferenceResolver Integration', () => {
  it('should integrate with EnhancedRuleContext', async () => {
    const resolver = new TargetReferenceResolver(dependencies);
    const context = new EnhancedRuleContext({
      targetReferenceResolver: resolver,
      eventPayload: mockEventPayload,
      // ... other dependencies
    });
    
    const entityId = await context.resolveEntityReference('primary');
    expect(entityId).toBeTruthy();
    expect(entityId).not.toBe('Unnamed Character');
  });
  
  it('should work with real adjust_clothing scenario', async () => {
    const testBed = new ActionTestBed();
    const { amaia, iker, jacket } = await testBed.setupIntimacyScenario();
    
    const eventPayload = {
      type: 'core:attempt_action',
      actorId: amaia.id,
      actionId: 'intimacy:adjust_clothing',
      primaryId: iker.id,
      secondaryId: jacket.id,
      targets: {
        primary: { entityId: iker.id, placeholder: 'primary' },
        secondary: { entityId: jacket.id, placeholder: 'secondary' }
      }
    };
    
    const resolver = new TargetReferenceResolver(testBed.dependencies);
    
    const primaryId = await resolver.resolvePlaceholder('primary', eventPayload);
    const secondaryId = await resolver.resolvePlaceholder('secondary', eventPayload);
    
    expect(primaryId).toBe(iker.id);
    expect(secondaryId).toBe(jacket.id);
  });
});
```

## Performance Benchmarks

- Single placeholder resolution: <2ms average
- Batch resolution (3 placeholders): <5ms average
- Validation with entity checks: <10ms average
- Cache hit resolution: <0.1ms average
- Memory usage: <1MB for typical cache size

## Dependencies and Prerequisites

### System Dependencies
- **Ticket 1**: Enhanced event payload structure
- Dependency injection system
- Entity query manager for entity validation
- Logging system for debugging and monitoring

### Testing Dependencies
- Jest testing framework
- Test utilities and mock implementations
- Performance testing tools

## Notes and Considerations

### Implementation Order
1. **Phase 1**: Core service interface and basic resolution logic
2. **Phase 2**: Caching system and performance optimization
3. **Phase 3**: Validation and error handling
4. **Phase 4**: Metrics collection and monitoring
5. **Phase 5**: Integration with existing components
6. **Phase 6**: Comprehensive testing and documentation

### Risk Mitigation
- **Service Isolation**: Dedicated service prevents coupling with rule execution logic
- **Caching Strategy**: TTL-based caching prevents stale data issues
- **Error Handling**: Graceful degradation maintains system stability
- **Performance Monitoring**: Metrics enable proactive optimization

### Future Enhancements
- Support for custom placeholder names beyond primary/secondary/tertiary
- Relationship-based resolution (e.g., "primary.owner")
- Distributed caching for multi-instance deployments
- Machine learning-based performance optimization
- Integration with system-wide monitoring and alerting

This service provides a clean architectural foundation for target reference resolution, enabling better maintainability, testing, and performance optimization across the multi-target action system.