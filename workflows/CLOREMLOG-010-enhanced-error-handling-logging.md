# CLOREMLOG-010: Enhanced Error Handling and Logging

## Overview
**Priority**: Low  
**Phase**: 3 (System Enhancement)  
**Estimated Effort**: 4-8 hours  
**Dependencies**: CLOREMLOG-008 (Test suite provides error scenarios)  
**Blocks**: None

## Problem Statement

The current clothing system has basic error handling but lacks comprehensive error recovery, detailed logging, and debugging support. As the system becomes more complex with the unified architecture, robust error handling and logging become critical for:

- **Production reliability**: Graceful degradation when components fail
- **Development debugging**: Clear error messages and detailed logging
- **System monitoring**: Visibility into clothing system health and performance
- **User experience**: Meaningful error feedback instead of system crashes

**Current Gaps**:
- Inconsistent error handling across clothing components
- Limited logging for debugging complex clothing scenarios
- No centralized error management for clothing-related operations
- Missing error recovery strategies for service failures

## Root Cause

**Incremental Development**: Error handling was added as needed during implementation without a comprehensive strategy. The unified architecture now requires coordinated error handling across multiple services and components.

## Acceptance Criteria

### 1. Centralized Error Handling System
- [ ] **Create error hierarchy**: Clothing-specific error types with clear inheritance
- [ ] **Error handler service**: Centralized error processing and recovery
- [ ] **Error recovery strategies**: Graceful fallbacks for different failure modes
- [ ] **Error reporting**: Structured error reporting for debugging and monitoring

### 2. Enhanced Logging Framework
- [ ] **Structured logging**: Consistent log format across all clothing components
- [ ] **Debug tracing**: Detailed execution tracing for complex scenarios
- [ ] **Performance logging**: Operation timing and performance metrics
- [ ] **Context preservation**: Maintain context through service boundaries

### 3. Error Recovery Mechanisms
- [ ] **Service fallbacks**: Graceful degradation when services are unavailable
- [ ] **Data validation**: Comprehensive input validation with clear error messages
- [ ] **Circuit breaker**: Prevent cascading failures in service calls
- [ ] **Retry logic**: Intelligent retry for transient failures

### 4. Debugging and Monitoring Support
- [ ] **Debug utilities**: Tools for debugging complex clothing scenarios
- [ ] **Health checks**: System health monitoring for clothing components
- [ ] **Error analytics**: Error pattern analysis and reporting
- [ ] **Documentation**: Troubleshooting guide for common error scenarios

## Implementation Details

### Clothing Error Hierarchy

#### Error Type Definitions
```javascript
// src/clothing/errors/clothingErrors.js

/**
 * Base class for all clothing-related errors
 */
export class ClothingError extends Error {
  constructor(message, context = {}, cause = null) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;
    this.cause = cause;
    this.timestamp = new Date().toISOString();
    this.errorId = this.generateErrorId();
  }

  private generateErrorId() {
    return `clothing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  toJSON() {
    return {
      errorId: this.errorId,
      name: this.name,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
      cause: this.cause?.message
    };
  }
}

/**
 * Errors related to clothing accessibility and coverage
 */
export class ClothingAccessibilityError extends ClothingError {
  constructor(message, entityId, itemId, context = {}) {
    super(message, { entityId, itemId, ...context });
  }
}

/**
 * Errors related to coverage blocking analysis
 */
export class CoverageAnalysisError extends ClothingError {
  constructor(message, equipmentState, context = {}) {
    super(message, { equipmentState, ...context });
  }
}

/**
 * Errors related to priority calculations
 */
export class PriorityCalculationError extends ClothingError {
  constructor(message, layer, context, modifiers, error = {}) {
    super(message, { layer, context, modifiers, ...error });
  }
}

/**
 * Errors related to service integration
 */
export class ClothingServiceError extends ClothingError {
  constructor(message, serviceName, operation, context = {}) {
    super(message, { serviceName, operation, ...context });
  }
}

/**
 * Errors related to data validation
 */
export class ClothingValidationError extends ClothingError {
  constructor(message, field, value, expectedType, context = {}) {
    super(message, { field, value, expectedType, ...context });
  }
}
```

#### Error Handler Service
```javascript
// src/clothing/errors/clothingErrorHandler.js
import { validateDependency } from '../../utils/dependencyUtils.js';

export class ClothingErrorHandler {
  #logger;
  #eventBus;
  #recoveryStrategies;
  #errorMetrics;

  constructor({ logger, eventBus }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['error', 'warn', 'info', 'debug']
    });
    validateDependency(eventBus, 'IEventBus', logger, {
      requiredMethods: ['dispatch']
    });

    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#recoveryStrategies = new Map();
    this.#errorMetrics = new Map();
    
    this.initializeRecoveryStrategies();
  }

  /**
   * Handle clothing-related errors with appropriate recovery strategy
   * @param {Error} error - The error to handle
   * @param {Object} context - Additional context for error handling
   * @returns {Object} Recovery result with fallback data if applicable
   */
  handleError(error, context = {}) {
    const errorId = error.errorId || this.generateErrorId();
    
    // Log error with full context
    this.logError(error, context, errorId);
    
    // Update error metrics
    this.updateErrorMetrics(error);
    
    // Dispatch error event for monitoring
    this.dispatchErrorEvent(error, context, errorId);
    
    // Attempt recovery
    const recovery = this.attemptRecovery(error, context);
    
    return {
      errorId,
      recovered: recovery.success,
      fallbackData: recovery.data,
      recoveryStrategy: recovery.strategy
    };
  }

  private logError(error, context, errorId) {
    const logContext = {
      errorId,
      errorType: error.constructor.name,
      errorMessage: error.message,
      errorContext: error.context || {},
      handlerContext: context,
      stack: error.stack
    };

    if (error instanceof ClothingError) {
      this.#logger.error('Clothing system error occurred', logContext);
    } else {
      this.#logger.error('Unexpected error in clothing system', logContext);
    }
  }

  private attemptRecovery(error, context) {
    const strategy = this.#recoveryStrategies.get(error.constructor.name);
    
    if (!strategy) {
      this.#logger.warn(`No recovery strategy for error type: ${error.constructor.name}`);
      return { success: false, data: null, strategy: 'none' };
    }

    try {
      const recoveryResult = strategy(error, context);
      this.#logger.info(`Error recovery successful: ${strategy.name}`, {
        errorId: error.errorId,
        strategy: strategy.name
      });
      return { success: true, data: recoveryResult, strategy: strategy.name };
    } catch (recoveryError) {
      this.#logger.error('Error recovery failed', {
        originalError: error.message,
        recoveryError: recoveryError.message,
        strategy: strategy.name
      });
      return { success: false, data: null, strategy: strategy.name };
    }
  }

  private initializeRecoveryStrategies() {
    // Recovery strategy for accessibility service failures
    this.#recoveryStrategies.set('ClothingServiceError', (error, context) => {
      if (error.context.serviceName === 'ClothingAccessibilityService') {
        return this.fallbackToLegacyClothingLogic(context);
      }
      return null;
    });

    // Recovery strategy for coverage analysis failures
    this.#recoveryStrategies.set('CoverageAnalysisError', (error, context) => {
      return this.fallbackToLayerPriorityOnly(context);
    });

    // Recovery strategy for priority calculation failures
    this.#recoveryStrategies.set('PriorityCalculationError', (error, context) => {
      return this.fallbackToDefaultPriorities(context);
    });

    // Recovery strategy for validation errors
    this.#recoveryStrategies.set('ClothingValidationError', (error, context) => {
      return this.sanitizeAndRetry(error, context);
    });
  }

  private fallbackToLegacyClothingLogic(context) {
    this.#logger.warn('Falling back to legacy clothing logic');
    // Implement fallback to pre-Phase 2 clothing logic
    return { mode: 'legacy', items: [] };
  }

  private fallbackToLayerPriorityOnly(context) {
    this.#logger.warn('Coverage analysis failed, using layer priority only');
    // Implement simple layer-based priority without coverage blocking
    return { mode: 'layer_only', blockingDisabled: true };
  }

  private fallbackToDefaultPriorities(context) {
    this.#logger.warn('Priority calculation failed, using default priorities');
    // Use hardcoded priority values
    return { mode: 'default_priorities' };
  }

  private sanitizeAndRetry(error, context) {
    this.#logger.warn('Validation error, attempting data sanitization');
    // Implement data sanitization and retry logic
    return { mode: 'sanitized', retryable: true };
  }

  private dispatchErrorEvent(error, context, errorId) {
    this.#eventBus.dispatch({
      type: 'CLOTHING_ERROR_OCCURRED',
      payload: {
        errorId,
        errorType: error.constructor.name,
        message: error.message,
        context: error.context,
        timestamp: new Date().toISOString()
      }
    });
  }

  private updateErrorMetrics(error) {
    const errorType = error.constructor.name;
    const current = this.#errorMetrics.get(errorType) || { count: 0, lastOccurrence: null };
    
    this.#errorMetrics.set(errorType, {
      count: current.count + 1,
      lastOccurrence: new Date().toISOString()
    });
  }

  getErrorMetrics() {
    return Object.fromEntries(this.#errorMetrics);
  }
}
```

### Enhanced Logging Framework

#### Structured Logging for Clothing Operations
```javascript
// src/clothing/logging/clothingLogger.js
export class ClothingLogger {
  #baseLogger;
  #context;

  constructor(baseLogger, context = {}) {
    this.#baseLogger = baseLogger;
    this.#context = context;
  }

  /**
   * Log clothing accessibility query with detailed context
   */
  logAccessibilityQuery(entityId, options, startTime, result) {
    const duration = performance.now() - startTime;
    
    this.#baseLogger.debug('Clothing accessibility query', {
      operation: 'getAccessibleItems',
      entityId,
      queryOptions: options,
      resultCount: result?.length || 0,
      duration: `${duration.toFixed(2)}ms`,
      timestamp: new Date().toISOString(),
      ...this.#context
    });
  }

  /**
   * Log coverage analysis operation
   */
  logCoverageAnalysis(equipped, entityId, startTime, result) {
    const duration = performance.now() - startTime;
    const itemCount = Object.values(equipped).reduce((count, slot) => 
      count + Object.keys(slot || {}).length, 0
    );

    this.#baseLogger.debug('Coverage analysis performed', {
      operation: 'analyzeCoverageBlocking',
      entityId,
      itemCount,
      duration: `${duration.toFixed(2)}ms`,
      blockedItems: result?.blockedCount || 0,
      timestamp: new Date().toISOString(),
      ...this.#context
    });
  }

  /**
   * Log priority calculation operation
   */
  logPriorityCalculation(layer, context, modifiers, result, cached = false) {
    this.#baseLogger.debug('Priority calculation', {
      operation: 'calculatePriority',
      layer,
      context,
      modifiers,
      result,
      cached,
      timestamp: new Date().toISOString(),
      ...this.#context
    });
  }

  /**
   * Log service call with performance metrics
   */
  logServiceCall(serviceName, method, parameters, startTime, result, error = null) {
    const duration = performance.now() - startTime;
    const logLevel = error ? 'error' : 'debug';
    
    this.#baseLogger[logLevel]('Clothing service call', {
      operation: 'serviceCall',
      serviceName,
      method,
      parameters: this.sanitizeParameters(parameters),
      duration: `${duration.toFixed(2)}ms`,
      success: !error,
      error: error?.message,
      resultType: typeof result,
      timestamp: new Date().toISOString(),
      ...this.#context
    });
  }

  /**
   * Create child logger with additional context
   */
  withContext(additionalContext) {
    return new ClothingLogger(this.#baseLogger, {
      ...this.#context,
      ...additionalContext
    });
  }

  private sanitizeParameters(params) {
    // Remove sensitive or large data from logged parameters
    if (params && typeof params === 'object') {
      const sanitized = { ...params };
      if (sanitized.equipped && Object.keys(sanitized.equipped).length > 5) {
        sanitized.equipped = `[${Object.keys(sanitized.equipped).length} slots]`;
      }
      return sanitized;
    }
    return params;
  }
}
```

#### Debug Tracing System
```javascript
// src/clothing/logging/clothingTracer.js
export class ClothingTracer {
  #traces;
  #currentTrace;
  #maxTraces;

  constructor(maxTraces = 100) {
    this.#traces = new Map();
    this.#currentTrace = null;
    this.#maxTraces = maxTraces;
  }

  startTrace(operationName, context = {}) {
    const traceId = this.generateTraceId();
    const trace = {
      traceId,
      operationName,
      context,
      startTime: performance.now(),
      steps: [],
      metadata: {}
    };

    this.#traces.set(traceId, trace);
    this.#currentTrace = traceId;

    // Cleanup old traces
    if (this.#traces.size > this.#maxTraces) {
      const oldestTrace = this.#traces.keys().next().value;
      this.#traces.delete(oldestTrace);
    }

    return traceId;
  }

  addStep(step, data = {}) {
    if (!this.#currentTrace) return;

    const trace = this.#traces.get(this.#currentTrace);
    if (trace) {
      trace.steps.push({
        step,
        data,
        timestamp: performance.now() - trace.startTime
      });
    }
  }

  addMetadata(key, value) {
    if (!this.#currentTrace) return;

    const trace = this.#traces.get(this.#currentTrace);
    if (trace) {
      trace.metadata[key] = value;
    }
  }

  endTrace(result = null) {
    if (!this.#currentTrace) return null;

    const trace = this.#traces.get(this.#currentTrace);
    if (trace) {
      trace.endTime = performance.now();
      trace.duration = trace.endTime - trace.startTime;
      trace.result = result;
    }

    const traceId = this.#currentTrace;
    this.#currentTrace = null;
    return traceId;
  }

  getTrace(traceId) {
    return this.#traces.get(traceId);
  }

  getAllTraces() {
    return Array.from(this.#traces.values());
  }

  private generateTraceId() {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### Service Integration with Error Handling

#### Enhanced ClothingAccessibilityService
```javascript
// Enhanced error handling in ClothingAccessibilityService
export class ClothingAccessibilityService {
  #errorHandler;
  #logger;
  #tracer;

  getAccessibleItems(entityId, options = {}) {
    const traceId = this.#tracer.startTrace('getAccessibleItems', { entityId, options });
    const startTime = performance.now();

    try {
      // Validate inputs
      this.validateInputs(entityId, options);
      this.#tracer.addStep('Input validation passed');

      // Get equipment state with error handling
      const equipmentState = this.getEquipmentStateSafely(entityId);
      this.#tracer.addStep('Equipment state retrieved', { 
        itemCount: this.countItems(equipmentState) 
      });

      // Perform coverage analysis with error handling
      const coverageAnalysis = this.performCoverageAnalysisSafely(equipmentState, entityId);
      this.#tracer.addStep('Coverage analysis completed');

      // Calculate accessible items
      const accessibleItems = this.calculateAccessibleItems(
        equipmentState, 
        coverageAnalysis, 
        options
      );
      this.#tracer.addStep('Accessible items calculated', { 
        count: accessibleItems.length 
      });

      // Log successful operation
      this.#logger.logAccessibilityQuery(entityId, options, startTime, accessibleItems);
      this.#tracer.endTrace(accessibleItems);

      return accessibleItems;

    } catch (error) {
      this.#tracer.addStep('Error occurred', { error: error.message });
      this.#tracer.endTrace(null);

      // Handle error with recovery
      const recovery = this.#errorHandler.handleError(error, {
        operation: 'getAccessibleItems',
        entityId,
        options
      });

      if (recovery.recovered) {
        this.#logger.logAccessibilityQuery(entityId, options, startTime, recovery.fallbackData);
        return recovery.fallbackData;
      }

      // Re-throw if recovery failed
      throw new ClothingServiceError(
        `Failed to get accessible items for entity ${entityId}`,
        'ClothingAccessibilityService',
        'getAccessibleItems',
        { entityId, options, originalError: error.message }
      );
    }
  }

  private validateInputs(entityId, options) {
    if (!entityId || typeof entityId !== 'string') {
      throw new ClothingValidationError(
        'Invalid entity ID provided',
        'entityId',
        entityId,
        'non-empty string'
      );
    }

    if (options.mode && !['topmost', 'all', 'by-layer'].includes(options.mode)) {
      throw new ClothingValidationError(
        'Invalid mode provided',
        'options.mode',
        options.mode,
        'topmost|all|by-layer'
      );
    }
  }

  private getEquipmentStateSafely(entityId) {
    try {
      const equipment = this.#entityManager.getComponent(entityId, 'core:equipment');
      return equipment?.equipped || {};
    } catch (error) {
      throw new ClothingServiceError(
        `Failed to retrieve equipment for entity ${entityId}`,
        'EntityManager',
        'getComponent',
        { entityId, component: 'core:equipment', originalError: error.message }
      );
    }
  }

  private performCoverageAnalysisSafely(equipmentState, entityId) {
    try {
      return this.#coverageAnalyzer.analyzeCoverageBlocking(equipmentState, entityId);
    } catch (error) {
      throw new CoverageAnalysisError(
        'Failed to analyze coverage blocking',
        equipmentState,
        { entityId, originalError: error.message }
      );
    }
  }

  private countItems(equipmentState) {
    return Object.values(equipmentState).reduce((count, slot) => {
      return count + Object.keys(slot || {}).length;
    }, 0);
  }
}
```

### Health Monitoring and Circuit Breaker

#### Service Health Monitor
```javascript
// src/clothing/monitoring/clothingHealthMonitor.js
export class ClothingHealthMonitor {
  #services;
  #healthChecks;
  #lastChecks;
  #logger;

  constructor(services, logger) {
    this.#services = services;
    this.#healthChecks = new Map();
    this.#lastChecks = new Map();
    this.#logger = logger;
    
    this.initializeHealthChecks();
  }

  /**
   * Perform health check for all clothing services
   */
  async performHealthCheck() {
    const results = new Map();
    
    for (const [serviceName, healthCheck] of this.#healthChecks) {
      try {
        const result = await this.performSingleHealthCheck(serviceName, healthCheck);
        results.set(serviceName, result);
        this.#lastChecks.set(serviceName, result);
      } catch (error) {
        const failureResult = {
          healthy: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
        results.set(serviceName, failureResult);
        this.#lastChecks.set(serviceName, failureResult);
      }
    }

    return results;
  }

  /**
   * Get health status for specific service
   */
  getServiceHealth(serviceName) {
    return this.#lastChecks.get(serviceName) || { healthy: false, error: 'No health check performed' };
  }

  /**
   * Get overall system health
   */
  getOverallHealth() {
    const allChecks = Array.from(this.#lastChecks.values());
    const healthyServices = allChecks.filter(check => check.healthy);
    
    return {
      healthy: healthyServices.length === allChecks.length,
      totalServices: allChecks.length,
      healthyServices: healthyServices.length,
      lastCheck: new Date().toISOString()
    };
  }

  private initializeHealthChecks() {
    // Health check for clothing accessibility service
    this.#healthChecks.set('ClothingAccessibilityService', async () => {
      const testEntityId = 'health_check_entity';
      const result = await this.#services.clothingAccessibilityService.getAccessibleItems(testEntityId, { mode: 'topmost' });
      return { healthy: true, response: 'OK', itemCount: result.length };
    });

    // Health check for priority manager
    this.#healthChecks.set('ClothingPriorityManager', async () => {
      const priority = this.#services.priorityManager.calculatePriority('base', 'removal');
      return { healthy: true, response: 'OK', samplePriority: priority };
    });

    // Health check for coverage analyzer
    this.#healthChecks.set('CoverageAnalyzer', async () => {
      const analysis = this.#services.coverageAnalyzer.analyzeCoverageBlocking({}, 'health_check_entity');
      return { healthy: true, response: 'OK', analysis: 'completed' };
    });
  }

  private async performSingleHealthCheck(serviceName, healthCheck) {
    const startTime = performance.now();
    const result = await healthCheck();
    const duration = performance.now() - startTime;

    return {
      ...result,
      duration: `${duration.toFixed(2)}ms`,
      timestamp: new Date().toISOString()
    };
  }
}
```

#### Circuit Breaker Implementation
```javascript
// src/clothing/monitoring/circuitBreaker.js
export class CircuitBreaker {
  #serviceName;
  #failureThreshold;
  #resetTimeout;
  #state;
  #failureCount;
  #lastFailureTime;
  #logger;

  constructor(serviceName, failureThreshold = 5, resetTimeout = 60000, logger) {
    this.#serviceName = serviceName;
    this.#failureThreshold = failureThreshold;
    this.#resetTimeout = resetTimeout;
    this.#state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.#failureCount = 0;
    this.#lastFailureTime = null;
    this.#logger = logger;
  }

  async execute(operation, fallback = null) {
    if (this.#state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.#state = 'HALF_OPEN';
        this.#logger.info(`Circuit breaker transitioning to HALF_OPEN for ${this.#serviceName}`);
      } else {
        this.#logger.warn(`Circuit breaker OPEN for ${this.#serviceName}, using fallback`);
        if (fallback) {
          return fallback();
        }
        throw new ClothingServiceError(
          `Service ${this.#serviceName} is unavailable (circuit breaker open)`,
          this.#serviceName,
          'circuit_breaker',
          { state: this.#state, failureCount: this.#failureCount }
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.#failureCount = 0;
    if (this.#state === 'HALF_OPEN') {
      this.#state = 'CLOSED';
      this.#logger.info(`Circuit breaker CLOSED for ${this.#serviceName}`);
    }
  }

  private onFailure() {
    this.#failureCount++;
    this.#lastFailureTime = Date.now();

    if (this.#failureCount >= this.#failureThreshold) {
      this.#state = 'OPEN';
      this.#logger.warn(`Circuit breaker OPEN for ${this.#serviceName} after ${this.#failureCount} failures`);
    }
  }

  private shouldAttemptReset() {
    return this.#lastFailureTime && 
           (Date.now() - this.#lastFailureTime) > this.#resetTimeout;
  }

  getState() {
    return {
      state: this.#state,
      failureCount: this.#failureCount,
      lastFailureTime: this.#lastFailureTime
    };
  }
}
```

## Testing Requirements

### Error Handling Tests
```javascript
// tests/unit/clothing/errors/clothingErrorHandler.test.js
describe('ClothingErrorHandler', () => {
  describe('Error Recovery', () => {
    it('should recover from accessibility service failures', () => {
      const serviceError = new ClothingServiceError(
        'Service unavailable',
        'ClothingAccessibilityService',
        'getAccessibleItems'
      );

      const recovery = errorHandler.handleError(serviceError, {
        entityId: 'test_entity',
        options: { mode: 'topmost' }
      });

      expect(recovery.recovered).toBe(true);
      expect(recovery.fallbackData).toBeDefined();
    });

    it('should handle coverage analysis failures gracefully', () => {
      const coverageError = new CoverageAnalysisError(
        'Coverage calculation failed',
        { torso_lower: { base: 'item1' } }
      );

      const recovery = errorHandler.handleError(coverageError);
      expect(recovery.recovered).toBe(true);
    });
  });

  describe('Error Metrics', () => {
    it('should track error occurrence metrics', () => {
      const error1 = new ClothingServiceError('Test error 1', 'Service1', 'op1');
      const error2 = new ClothingServiceError('Test error 2', 'Service1', 'op2');

      errorHandler.handleError(error1);
      errorHandler.handleError(error2);

      const metrics = errorHandler.getErrorMetrics();
      expect(metrics.ClothingServiceError.count).toBe(2);
    });
  });
});
```

### Logging Tests
```javascript
// tests/unit/clothing/logging/clothingLogger.test.js
describe('ClothingLogger', () => {
  describe('Structured Logging', () => {
    it('should log accessibility queries with proper structure', () => {
      const mockLogger = createMockLogger();
      const clothingLogger = new ClothingLogger(mockLogger);

      clothingLogger.logAccessibilityQuery(
        'test_entity',
        { mode: 'topmost' },
        performance.now() - 10,
        [{ itemId: 'item1' }]
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Clothing accessibility query',
        expect.objectContaining({
          operation: 'getAccessibleItems',
          entityId: 'test_entity',
          queryOptions: { mode: 'topmost' },
          resultCount: 1,
          duration: expect.stringMatching(/\d+\.\d+ms/)
        })
      );
    });
  });

  describe('Context Preservation', () => {
    it('should preserve context through child loggers', () => {
      const mockLogger = createMockLogger();
      const parentLogger = new ClothingLogger(mockLogger, { module: 'clothing' });
      const childLogger = parentLogger.withContext({ submodule: 'accessibility' });

      childLogger.logAccessibilityQuery('test', {}, performance.now(), []);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          module: 'clothing',
          submodule: 'accessibility'
        })
      );
    });
  });
});
```

### Circuit Breaker Tests
```javascript
// tests/unit/clothing/monitoring/circuitBreaker.test.js
describe('CircuitBreaker', () => {
  describe('State Transitions', () => {
    it('should open circuit after failure threshold', async () => {
      const circuitBreaker = new CircuitBreaker('TestService', 3, 60000, mockLogger);
      
      const failingOperation = () => Promise.reject(new Error('Service failure'));

      // Trigger failures to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected failures
        }
      }

      const state = circuitBreaker.getState();
      expect(state.state).toBe('OPEN');
      expect(state.failureCount).toBe(3);
    });

    it('should use fallback when circuit is open', async () => {
      const circuitBreaker = new CircuitBreaker('TestService', 1, 60000, mockLogger);
      
      // Trigger circuit open
      try {
        await circuitBreaker.execute(() => Promise.reject(new Error('Fail')));
      } catch (error) {
        // Expected
      }

      // Should use fallback
      const fallback = () => 'fallback_result';
      const result = await circuitBreaker.execute(
        () => Promise.reject(new Error('Still failing')),
        fallback
      );

      expect(result).toBe('fallback_result');
    });
  });
});
```

## Risk Assessment

### Implementation Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|---------|-------------|
| Over-logging performance impact | Medium | Low | Configurable log levels and async logging |
| Error recovery logic bugs | Medium | Medium | Comprehensive error scenario testing |
| Circuit breaker false positives | Low | Medium | Conservative failure thresholds |
| Logging data privacy concerns | Low | Low | Sanitize sensitive data in logs |

### Operational Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|---------|-------------|
| Log storage growth | Medium | Low | Log rotation and retention policies |
| Error handling complexity | Low | Medium | Keep recovery strategies simple and testable |
| Monitoring overhead | Low | Low | Lightweight health checks |

## Definition of Done
- [ ] Comprehensive error hierarchy with specific error types
- [ ] Error handler service with recovery strategies
- [ ] Structured logging across all clothing components
- [ ] Circuit breaker protection for service calls
- [ ] Health monitoring for all clothing services
- [ ] Debug tracing system for complex scenarios
- [ ] Error handling tests with >90% coverage
- [ ] Documentation for troubleshooting common issues

## Dependencies and Integration

### Upstream Dependencies
- **CLOREMLOG-008**: Test suite provides error scenarios for testing
- **Phase 2 services**: All clothing services need error handling integration

### Downstream Impact
- **Production reliability**: Improved system stability and error recovery
- **Development experience**: Better debugging and error diagnosis
- **Operations**: Enhanced monitoring and system visibility

## Success Metrics
- **Error recovery**: >95% of errors handled gracefully with fallbacks
- **Mean time to diagnosis**: <5 minutes for common clothing system issues
- **System uptime**: >99.9% availability for clothing functionality
- **Developer experience**: Clear error messages and debugging information

## Notes
- Focus on practical error scenarios that could occur in production
- Keep error recovery strategies simple and reliable
- Ensure logging doesn't impact performance significantly
- Document error codes and recovery procedures for operations team
- Consider adding error dashboards and alerting for production monitoring