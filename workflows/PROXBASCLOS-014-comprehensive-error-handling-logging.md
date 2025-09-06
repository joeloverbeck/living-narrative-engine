# PROXBASCLOS-014: Add Comprehensive Error Handling and Logging

**Phase**: Polish & Edge Cases  
**Priority**: Medium  
**Complexity**: Medium  
**Dependencies**: PROXBASCLOS-013 (edge case handling)  
**Estimated Time**: 5-7 hours

## Summary

Implement comprehensive error handling, structured logging, and monitoring capabilities for the proximity-based closeness system. This ticket ensures proper observability, debugging support, and operational monitoring for production deployments.

## Technical Requirements

### Areas of Focus

#### 1. Structured Logging Framework
- Consistent log message formats across all proximity operations
- Contextual information for debugging and troubleshooting
- Performance metrics and timing information
- Operation correlation tracking

#### 2. Error Classification and Reporting
- Hierarchical error categorization system
- Error severity levels and escalation paths
- Error aggregation and pattern detection
- Recovery recommendations and actionable guidance

#### 3. Monitoring and Observability
- Key performance indicators (KPIs) for proximity operations
- System health metrics and alerting thresholds
- Operational dashboards and reporting
- Capacity planning and resource utilization tracking

#### 4. Debugging and Troubleshooting Support
- Debug mode with detailed trace logging
- State inspection utilities
- Component relationship visualization
- Historical operation tracking

## Implementation Areas

### Structured Logging Framework

#### Enhanced Logging Utility
**New File**: `src/utils/proximityLogger.js`

```javascript
/**
 * Specialized logger for proximity-based closeness operations
 * Provides structured logging with contextual information
 */
export class ProximityLogger {
  #baseLogger;
  #context;

  constructor(baseLogger, context = {}) {
    this.#baseLogger = baseLogger;
    this.#context = {
      subsystem: 'proximity-closeness',
      version: '1.0.0',
      ...context
    };
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext) {
    return new ProximityLogger(this.#baseLogger, {
      ...this.#context,
      ...additionalContext
    });
  }

  /**
   * Log operation start with performance tracking
   */
  operationStart(operationType, parameters, operationId) {
    this.#baseLogger.info('Proximity operation started', {
      ...this.#context,
      operationType,
      operationId,
      parameters: this.#sanitizeParameters(parameters),
      timestamp: new Date().toISOString(),
      level: 'OPERATION_START'
    });

    return {
      operationType,
      operationId,
      startTime: performance.now(),
      startTimestamp: new Date().toISOString()
    };
  }

  /**
   * Log operation completion with performance metrics
   */
  operationComplete(operationInfo, result, additionalMetrics = {}) {
    const duration = performance.now() - operationInfo.startTime;
    
    this.#baseLogger.info('Proximity operation completed', {
      ...this.#context,
      operationType: operationInfo.operationType,
      operationId: operationInfo.operationId,
      duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
      result: this.#sanitizeResult(result),
      metrics: additionalMetrics,
      timestamp: new Date().toISOString(),
      level: 'OPERATION_COMPLETE'
    });
  }

  /**
   * Log operation failure with error details
   */
  operationFailed(operationInfo, error, context = {}) {
    const duration = performance.now() - operationInfo.startTime;
    
    this.#baseLogger.error('Proximity operation failed', {
      ...this.#context,
      operationType: operationInfo.operationType,
      operationId: operationInfo.operationId,
      duration: Math.round(duration * 100) / 100,
      error: {
        name: error.name,
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
        stack: error.stack
      },
      context,
      timestamp: new Date().toISOString(),
      level: 'OPERATION_FAILED'
    });
  }

  /**
   * Log component state changes
   */
  componentStateChange(entityId, componentType, oldState, newState, reason) {
    this.#baseLogger.debug('Component state changed', {
      ...this.#context,
      entityId,
      componentType,
      oldState: this.#sanitizeComponentState(oldState),
      newState: this.#sanitizeComponentState(newState),
      reason,
      timestamp: new Date().toISOString(),
      level: 'COMPONENT_CHANGE'
    });
  }

  /**
   * Log relationship changes
   */
  relationshipChange(actorId, partnerId, action, metadata = {}) {
    this.#baseLogger.info('Closeness relationship changed', {
      ...this.#context,
      actorId,
      partnerId,
      action, // 'ESTABLISHED', 'REMOVED', 'MODIFIED'
      metadata,
      timestamp: new Date().toISOString(),
      level: 'RELATIONSHIP_CHANGE'
    });
  }

  /**
   * Log performance warnings
   */
  performanceWarning(operation, duration, threshold, context = {}) {
    this.#baseLogger.warn('Performance threshold exceeded', {
      ...this.#context,
      operation,
      duration: Math.round(duration * 100) / 100,
      threshold,
      exceedBy: Math.round((duration - threshold) * 100) / 100,
      context,
      timestamp: new Date().toISOString(),
      level: 'PERFORMANCE_WARNING'
    });
  }

  /**
   * Log validation issues
   */
  validationIssue(entityId, issueType, details, severity = 'WARN') {
    const logMethod = severity === 'ERROR' ? 'error' : 'warn';
    
    this.#baseLogger[logMethod]('Validation issue detected', {
      ...this.#context,
      entityId,
      issueType,
      details,
      severity,
      timestamp: new Date().toISOString(),
      level: 'VALIDATION_ISSUE'
    });
  }

  /**
   * Log debug information (only in debug mode)
   */
  debugTrace(operation, step, data = {}) {
    this.#baseLogger.debug('Debug trace', {
      ...this.#context,
      operation,
      step,
      data: this.#sanitizeDebugData(data),
      timestamp: new Date().toISOString(),
      level: 'DEBUG_TRACE'
    });
  }

  // Standard logging methods with proximity context
  info(message, additionalContext = {}) {
    this.#baseLogger.info(message, {
      ...this.#context,
      ...additionalContext,
      timestamp: new Date().toISOString(),
      level: 'INFO'
    });
  }

  warn(message, additionalContext = {}) {
    this.#baseLogger.warn(message, {
      ...this.#context,
      ...additionalContext,
      timestamp: new Date().toISOString(),
      level: 'WARN'
    });
  }

  error(message, error = null, additionalContext = {}) {
    this.#baseLogger.error(message, {
      ...this.#context,
      error: error ? {
        name: error.name,
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
        stack: error.stack
      } : null,
      ...additionalContext,
      timestamp: new Date().toISOString(),
      level: 'ERROR'
    });
  }

  debug(message, additionalContext = {}) {
    this.#baseLogger.debug(message, {
      ...this.#context,
      ...additionalContext,
      timestamp: new Date().toISOString(),
      level: 'DEBUG'
    });
  }

  /**
   * Sanitize parameters to remove sensitive information
   */
  #sanitizeParameters(parameters) {
    const sanitized = { ...parameters };
    
    // Remove or mask sensitive fields if any are added in the future
    // Currently no sensitive fields in proximity parameters
    
    return sanitized;
  }

  /**
   * Sanitize operation results for logging
   */
  #sanitizeResult(result) {
    if (!result || typeof result !== 'object') {
      return result;
    }

    const sanitized = { ...result };
    
    // Remove potentially large or sensitive data
    if (sanitized.adjacentActors && Array.isArray(sanitized.adjacentActors)) {
      sanitized.adjacentActorCount = sanitized.adjacentActors.length;
      if (sanitized.adjacentActors.length > 5) {
        sanitized.adjacentActors = [
          ...sanitized.adjacentActors.slice(0, 3),
          `... and ${sanitized.adjacentActors.length - 3} more`
        ];
      }
    }

    return sanitized;
  }

  /**
   * Sanitize component state for logging
   */
  #sanitizeComponentState(state) {
    if (!state || typeof state !== 'object') {
      return state;
    }

    const sanitized = { ...state };
    
    // Limit partner arrays to prevent log spam
    if (sanitized.partners && Array.isArray(sanitized.partners)) {
      sanitized.partnerCount = sanitized.partners.length;
      if (sanitized.partners.length > 10) {
        sanitized.partners = [
          ...sanitized.partners.slice(0, 5),
          `... and ${sanitized.partners.length - 5} more`
        ];
      }
    }

    return sanitized;
  }

  /**
   * Sanitize debug data to prevent log overflow
   */
  #sanitizeDebugData(data) {
    const sanitized = { ...data };
    
    // Limit array sizes in debug data
    Object.keys(sanitized).forEach(key => {
      if (Array.isArray(sanitized[key]) && sanitized[key].length > 20) {
        sanitized[`${key}Count`] = sanitized[key].length;
        sanitized[key] = [
          ...sanitized[key].slice(0, 10),
          `... and ${sanitized[key].length - 10} more items`
        ];
      }
    });

    return sanitized;
  }
}

/**
 * Factory function to create proximity loggers
 */
export function createProximityLogger(baseLogger, context = {}) {
  return new ProximityLogger(baseLogger, context);
}
```

### Error Classification System

#### Error Category Definitions
**New File**: `src/errors/proximityErrorCategories.js`

```javascript
/**
 * Error category definitions for proximity closeness system
 */
export const ERROR_CATEGORIES = {
  VALIDATION: {
    code: 'VALIDATION',
    severity: 'HIGH',
    recoverable: false,
    description: 'Input validation or parameter errors',
    examples: ['Invalid entity ID', 'Out of bounds spot index', 'Missing required parameter']
  },
  
  COMPONENT_STATE: {
    code: 'COMPONENT_STATE',
    severity: 'HIGH', 
    recoverable: false,
    description: 'Component data corruption or inconsistency',
    examples: ['Malformed furniture component', 'Invalid closeness partners', 'Missing component']
  },
  
  CONCURRENCY: {
    code: 'CONCURRENCY',
    severity: 'MEDIUM',
    recoverable: true,
    description: 'Race conditions or concurrent operation conflicts',
    examples: ['Entity locked by another operation', 'Concurrent modification detected']
  },
  
  SERVICE_DEPENDENCY: {
    code: 'SERVICE_DEPENDENCY',
    severity: 'HIGH',
    recoverable: false,
    description: 'Required service unavailable or malfunctioning',
    examples: ['ClosenessCircleService failure', 'EntityManager error', 'EventBus dispatch failure']
  },
  
  BUSINESS_LOGIC: {
    code: 'BUSINESS_LOGIC',
    severity: 'MEDIUM',
    recoverable: true,
    description: 'Business rule violations or constraint failures',
    examples: ['Actor already sitting', 'Furniture at capacity', 'Invalid adjacency']
  },
  
  PERFORMANCE: {
    code: 'PERFORMANCE',
    severity: 'LOW',
    recoverable: true,
    description: 'Performance degradation or timeout issues',
    examples: ['Operation timeout', 'Memory pressure', 'CPU utilization high']
  },
  
  SYSTEM: {
    code: 'SYSTEM',
    severity: 'CRITICAL',
    recoverable: false,
    description: 'System-level failures or resource exhaustion',
    examples: ['Out of memory', 'Disk full', 'Network failure']
  }
};

export const ERROR_SEVERITY_LEVELS = {
  CRITICAL: { level: 4, requiresImmediate: true, alerting: true },
  HIGH: { level: 3, requiresImmediate: false, alerting: true },
  MEDIUM: { level: 2, requiresImmediate: false, alerting: false },
  LOW: { level: 1, requiresImmediate: false, alerting: false }
};

/**
 * Classify error and provide handling recommendations
 */
export function classifyError(error) {
  let category = ERROR_CATEGORIES.SYSTEM; // Default fallback
  let recoveryAction = 'LOG_AND_CONTINUE';
  
  // Error type-based classification
  if (error.name === 'InvalidArgumentError' || error.code?.startsWith('PROXIMITY_VALIDATION')) {
    category = ERROR_CATEGORIES.VALIDATION;
    recoveryAction = 'LOG_AND_FAIL';
  } else if (error.name === 'InvalidComponentStateError' || error.name === 'ComponentNotFoundError') {
    category = ERROR_CATEGORIES.COMPONENT_STATE;
    recoveryAction = 'LOG_AND_FAIL';
  } else if (error.name === 'ConcurrencyError') {
    category = ERROR_CATEGORIES.CONCURRENCY;
    recoveryAction = 'LOG_AND_RETRY';
  } else if (error.message?.includes('service') || error.message?.includes('dependency')) {
    category = ERROR_CATEGORIES.SERVICE_DEPENDENCY;
    recoveryAction = 'LOG_AND_FAIL';
  } else if (error.name === 'BusinessLogicError') {
    category = ERROR_CATEGORIES.BUSINESS_LOGIC;
    recoveryAction = 'LOG_AND_CONTINUE';
  } else if (error.message?.includes('timeout') || error.message?.includes('performance')) {
    category = ERROR_CATEGORIES.PERFORMANCE;
    recoveryAction = 'LOG_AND_CONTINUE';
  }

  return {
    category: category.code,
    severity: category.severity,
    recoverable: category.recoverable,
    description: category.description,
    recoveryAction,
    requiresImmediate: ERROR_SEVERITY_LEVELS[category.severity].requiresImmediate,
    requiresAlerting: ERROR_SEVERITY_LEVELS[category.severity].alerting,
    timestamp: new Date().toISOString()
  };
}

/**
 * Generate recovery recommendations based on error classification
 */
export function getRecoveryRecommendations(errorClassification, context = {}) {
  const recommendations = [];

  switch (errorClassification.category) {
    case 'VALIDATION':
      recommendations.push('Verify input parameters meet schema requirements');
      recommendations.push('Check entity ID formatting (modId:identifier)');
      recommendations.push('Validate spot index is within furniture capacity');
      break;

    case 'COMPONENT_STATE':
      recommendations.push('Check entity existence before operation');
      recommendations.push('Validate component schema compliance');
      recommendations.push('Consider component state repair utilities');
      break;

    case 'CONCURRENCY':
      recommendations.push('Retry operation after brief delay');
      recommendations.push('Consider implementing operation queuing');
      recommendations.push('Monitor for deadlock conditions');
      break;

    case 'SERVICE_DEPENDENCY':
      recommendations.push('Verify service dependencies are available');
      recommendations.push('Check service health endpoints');
      recommendations.push('Consider circuit breaker pattern implementation');
      break;

    case 'BUSINESS_LOGIC':
      recommendations.push('Review business rule implementation');
      recommendations.push('Validate preconditions before operation');
      recommendations.push('Consider graceful degradation options');
      break;

    case 'PERFORMANCE':
      recommendations.push('Monitor system resource utilization');
      recommendations.push('Consider operation batching or throttling');
      recommendations.push('Review performance benchmarks');
      break;

    case 'SYSTEM':
      recommendations.push('Check system resource availability');
      recommendations.push('Review system logs for related issues');
      recommendations.push('Consider immediate operator intervention');
      break;
  }

  return recommendations;
}
```

### Monitoring and Metrics Collection

#### Proximity Metrics Collector
**New File**: `src/monitoring/proximityMetrics.js`

```javascript
/**
 * Metrics collection for proximity-based closeness system
 */
export class ProximityMetrics {
  #metrics = new Map();
  #logger;

  constructor(logger) {
    this.#logger = logger;
    this.#initializeMetrics();
  }

  #initializeMetrics() {
    // Operation counters
    this.#metrics.set('establish_operations_total', 0);
    this.#metrics.set('establish_operations_success', 0);
    this.#metrics.set('establish_operations_failed', 0);
    this.#metrics.set('remove_operations_total', 0);
    this.#metrics.set('remove_operations_success', 0);
    this.#metrics.set('remove_operations_failed', 0);

    // Performance metrics
    this.#metrics.set('operation_duration_ms', []);
    this.#metrics.set('adjacent_actors_found', []);
    this.#metrics.set('relationships_established', []);
    this.#metrics.set('relationships_removed', []);

    // Error metrics
    this.#metrics.set('validation_errors', 0);
    this.#metrics.set('component_state_errors', 0);
    this.#metrics.set('concurrency_errors', 0);
    this.#metrics.set('service_dependency_errors', 0);
    this.#metrics.set('business_logic_errors', 0);
    this.#metrics.set('performance_warnings', 0);

    // System health metrics
    this.#metrics.set('active_operations', 0);
    this.#metrics.set('peak_concurrent_operations', 0);
    this.#metrics.set('memory_usage_mb', []);
    this.#metrics.set('cpu_utilization_percent', []);
  }

  /**
   * Record operation start
   */
  recordOperationStart(operationType, operationId) {
    this.#incrementMetric(`${operationType}_operations_total`);
    this.#incrementMetric('active_operations');
    
    const currentActive = this.#getMetric('active_operations');
    const peak = this.#getMetric('peak_concurrent_operations');
    if (currentActive > peak) {
      this.#setMetric('peak_concurrent_operations', currentActive);
    }

    return {
      operationType,
      operationId,
      startTime: performance.now()
    };
  }

  /**
   * Record operation completion
   */
  recordOperationComplete(operationInfo, result) {
    const duration = performance.now() - operationInfo.startTime;
    
    this.#incrementMetric(`${operationInfo.operationType}_operations_success`);
    this.#decrementMetric('active_operations');
    this.#addToArray('operation_duration_ms', duration);
    
    // Record result-specific metrics
    if (result.adjacentActors) {
      this.#addToArray('adjacent_actors_found', result.adjacentActors.length);
    }
    
    if (result.relationshipsEstablished) {
      this.#addToArray('relationships_established', result.relationshipsEstablished);
    }
    
    if (result.relationshipsRemoved) {
      this.#addToArray('relationships_removed', result.relationshipsRemoved);
    }

    // Performance monitoring
    if (duration > 100) { // >100ms threshold
      this.#incrementMetric('performance_warnings');
      this.#logger.warn('Operation exceeded performance threshold', {
        operationType: operationInfo.operationType,
        operationId: operationInfo.operationId,
        duration,
        threshold: 100
      });
    }
  }

  /**
   * Record operation failure
   */
  recordOperationFailure(operationInfo, error) {
    const duration = performance.now() - operationInfo.startTime;
    
    this.#incrementMetric(`${operationInfo.operationType}_operations_failed`);
    this.#decrementMetric('active_operations');
    this.#addToArray('operation_duration_ms', duration);
    
    // Classify and record error
    const classification = classifyError(error);
    const errorMetricKey = `${classification.category.toLowerCase()}_errors`;
    this.#incrementMetric(errorMetricKey);
  }

  /**
   * Record system resource utilization
   */
  recordResourceUtilization() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memoryUsage = process.memoryUsage();
      const memoryMB = memoryUsage.heapUsed / 1024 / 1024;
      this.#addToArray('memory_usage_mb', memoryMB);
    }

    // CPU utilization would require additional system monitoring
    // This is a placeholder for integration with system monitoring tools
  }

  /**
   * Get current metrics snapshot
   */
  getMetricsSnapshot() {
    const snapshot = {};
    
    for (const [key, value] of this.#metrics) {
      if (Array.isArray(value)) {
        snapshot[key] = {
          count: value.length,
          average: value.length > 0 ? value.reduce((a, b) => a + b, 0) / value.length : 0,
          min: value.length > 0 ? Math.min(...value) : 0,
          max: value.length > 0 ? Math.max(...value) : 0,
          p95: this.#calculatePercentile(value, 0.95),
          p99: this.#calculatePercentile(value, 0.99)
        };
      } else {
        snapshot[key] = value;
      }
    }

    snapshot.timestamp = new Date().toISOString();
    return snapshot;
  }

  /**
   * Get operational health status
   */
  getHealthStatus() {
    const snapshot = this.getMetricsSnapshot();
    const health = { status: 'HEALTHY', warnings: [], errors: [] };

    // Check error rates
    const totalOps = snapshot.establish_operations_total + snapshot.remove_operations_total;
    const totalErrors = snapshot.establish_operations_failed + snapshot.remove_operations_failed;
    const errorRate = totalOps > 0 ? totalErrors / totalOps : 0;

    if (errorRate > 0.1) { // >10% error rate
      health.status = 'DEGRADED';
      health.warnings.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
    }

    // Check performance
    if (snapshot.operation_duration_ms.p95 > 100) {
      health.warnings.push(`Slow operations: P95 ${snapshot.operation_duration_ms.p95.toFixed(1)}ms`);
    }

    // Check memory usage
    if (snapshot.memory_usage_mb.max > 500) { // >500MB
      health.warnings.push(`High memory usage: ${snapshot.memory_usage_mb.max.toFixed(1)}MB`);
    }

    // Check concurrent operations
    if (snapshot.active_operations > 50) {
      health.warnings.push(`High concurrent operations: ${snapshot.active_operations}`);
    }

    if (health.warnings.length > 3) {
      health.status = 'DEGRADED';
    }

    if (errorRate > 0.5 || snapshot.operation_duration_ms.p95 > 1000) {
      health.status = 'UNHEALTHY';
      health.errors.push('Critical performance or reliability issues detected');
    }

    return health;
  }

  /**
   * Reset metrics (for testing or periodic reset)
   */
  resetMetrics() {
    this.#initializeMetrics();
    this.#logger.info('Proximity metrics reset');
  }

  // Helper methods
  #getMetric(key) {
    return this.#metrics.get(key) || 0;
  }

  #setMetric(key, value) {
    this.#metrics.set(key, value);
  }

  #incrementMetric(key) {
    const current = this.#getMetric(key);
    this.#setMetric(key, current + 1);
  }

  #decrementMetric(key) {
    const current = this.#getMetric(key);
    this.#setMetric(key, Math.max(0, current - 1));
  }

  #addToArray(key, value) {
    const array = this.#metrics.get(key) || [];
    array.push(value);
    
    // Keep only recent values to prevent memory growth
    if (array.length > 1000) {
      array.splice(0, array.length - 1000);
    }
    
    this.#metrics.set(key, array);
  }

  #calculatePercentile(values, percentile) {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }
}

/**
 * Singleton metrics instance
 */
let metricsInstance = null;

export function getProximityMetrics(logger) {
  if (!metricsInstance) {
    metricsInstance = new ProximityMetrics(logger);
  }
  return metricsInstance;
}
```

### Enhanced Operation Handlers with Logging

#### Updated EstablishSittingClosenessHandler
**File**: `src/logic/operationHandlers/establishSittingClosenessHandler.js` (enhance existing)

```javascript
// Add to existing imports
import { createProximityLogger } from '../../utils/proximityLogger.js';
import { getProximityMetrics } from '../../monitoring/proximityMetrics.js';
import { classifyError, getRecoveryRecommendations } from '../../errors/proximityErrorCategories.js';

export default class EstablishSittingClosenessHandler {
  #logger;
  #proximityLogger;
  #metrics;
  // ... other existing fields

  constructor({ logger, entityManager, eventBus, closenessCircleService, operationContext }) {
    // ... existing validation

    this.#logger = logger;
    this.#proximityLogger = createProximityLogger(logger, { 
      handler: 'EstablishSittingClosenessHandler' 
    });
    this.#metrics = getProximityMetrics(logger);
    // ... existing assignments
  }

  async execute(parameters) {
    const operationId = `establish_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Start operation tracking
    const operationInfo = this.#proximityLogger.operationStart('establish', parameters, operationId);
    const metricsInfo = this.#metrics.recordOperationStart('establish', operationId);
    
    try {
      this.#proximityLogger.debugTrace('establish', 'parameter_validation', { parameters });
      
      // ... existing parameter validation
      
      this.#proximityLogger.debugTrace('establish', 'component_state_validation', { 
        furnitureId: parameters.furniture_id,
        actorId: parameters.actor_id
      });
      
      // ... existing component validation
      
      const adjacentActors = await this.#findValidatedAdjacentActors(parameters, furnitureComponent);
      
      this.#proximityLogger.debugTrace('establish', 'adjacent_actors_found', { 
        count: adjacentActors.length,
        actors: adjacentActors
      });
      
      if (adjacentActors.length === 0) {
        const result = this.#handleNoAdjacentActors(parameters, operationId);
        this.#proximityLogger.operationComplete(operationInfo, result, { adjacentActors: 0 });
        this.#metrics.recordOperationComplete(metricsInfo, result);
        return result;
      }

      // ... existing closeness establishment logic
      
      const result = this.#handleSuccess(parameters, adjacentActors, operationId);
      
      // Log relationship changes
      adjacentActors.forEach(partnerId => {
        this.#proximityLogger.relationshipChange(
          parameters.actor_id,
          partnerId,
          'ESTABLISHED',
          { operationId, furnitureId: parameters.furniture_id }
        );
      });
      
      this.#proximityLogger.operationComplete(operationInfo, result, {
        relationshipsEstablished: adjacentActors.length,
        adjacentActors: adjacentActors.length
      });
      
      this.#metrics.recordOperationComplete(metricsInfo, {
        ...result,
        relationshipsEstablished: adjacentActors.length,
        adjacentActors
      });
      
      return result;
      
    } catch (error) {
      return this.#handleEnhancedError(error, parameters, operationInfo, metricsInfo, operationId);
    }
  }

  #handleEnhancedError(error, parameters, operationInfo, metricsInfo, operationId) {
    // Classify error for proper handling
    const errorClassification = classifyError(error);
    const recoveryRecommendations = getRecoveryRecommendations(errorClassification, {
      operationId,
      parameters
    });

    // Enhanced error logging
    this.#proximityLogger.operationFailed(operationInfo, error, {
      classification: errorClassification,
      recoveryRecommendations
    });

    // Record metrics
    this.#metrics.recordOperationFailure(metricsInfo, error);

    // Enhanced error event
    this.#eventBus.dispatch({
      type: 'ESTABLISH_SITTING_CLOSENESS_FAILED',
      payload: {
        operationId,
        actorId: parameters.actor_id,
        furnitureId: parameters.furniture_id,
        spotIndex: parameters.spot_index,
        error: {
          message: error.message,
          code: error.code || 'UNKNOWN_ERROR',
          classification: errorClassification,
          recoveryRecommendations
        },
        timestamp: new Date().toISOString()
      }
    });

    if (parameters.result_variable) {
      this.#operationContext.setVariable(parameters.result_variable, false);
    }

    // Return detailed error information for debugging
    return {
      success: false,
      error: {
        message: error.message,
        code: error.code,
        classification: errorClassification,
        recoveryRecommendations
      },
      operationId
    };
  }
}
```

## Health Check and Status Endpoints

### System Health Monitor
**New File**: `src/monitoring/proximityHealthMonitor.js`

```javascript
/**
 * Health monitoring for proximity-based closeness system
 */
export class ProximityHealthMonitor {
  #metrics;
  #logger;
  #healthCheckInterval;
  #listeners = [];

  constructor(metrics, logger, checkIntervalMs = 60000) {
    this.#metrics = metrics;
    this.#logger = logger;
    this.#healthCheckInterval = setInterval(() => {
      this.#performHealthCheck();
    }, checkIntervalMs);
  }

  /**
   * Perform comprehensive health check
   */
  #performHealthCheck() {
    try {
      const healthStatus = this.#metrics.getHealthStatus();
      const timestamp = new Date().toISOString();
      
      this.#logger.debug('Proximity health check completed', {
        status: healthStatus.status,
        warnings: healthStatus.warnings,
        errors: healthStatus.errors,
        timestamp
      });

      // Notify listeners of status changes
      this.#notifyListeners(healthStatus);

      // Record resource utilization
      this.#metrics.recordResourceUtilization();

    } catch (error) {
      this.#logger.error('Health check failed', error);
    }
  }

  /**
   * Get current system status
   */
  getSystemStatus() {
    const healthStatus = this.#metrics.getHealthStatus();
    const metricsSnapshot = this.#metrics.getMetricsSnapshot();
    
    return {
      health: healthStatus,
      metrics: metricsSnapshot,
      uptime: process.uptime ? process.uptime() : null,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Add health status listener
   */
  addStatusListener(listener) {
    this.#listeners.push(listener);
  }

  /**
   * Remove health status listener
   */
  removeStatusListener(listener) {
    const index = this.#listeners.indexOf(listener);
    if (index > -1) {
      this.#listeners.splice(index, 1);
    }
  }

  /**
   * Notify listeners of status changes
   */
  #notifyListeners(healthStatus) {
    this.#listeners.forEach(listener => {
      try {
        listener(healthStatus);
      } catch (error) {
        this.#logger.error('Health status listener failed', error);
      }
    });
  }

  /**
   * Shutdown health monitoring
   */
  shutdown() {
    if (this.#healthCheckInterval) {
      clearInterval(this.#healthCheckInterval);
      this.#healthCheckInterval = null;
    }
  }
}
```

## Implementation Checklist

### Phase 1: Structured Logging Infrastructure  
- [ ] Implement ProximityLogger with structured logging format
- [ ] Create error classification system with recovery recommendations
- [ ] Add debug tracing capabilities with data sanitization
- [ ] Integrate logging with existing operation handlers

### Phase 2: Metrics and Monitoring
- [ ] Implement ProximityMetrics collector with comprehensive KPIs
- [ ] Add performance monitoring and threshold alerting
- [ ] Create health status monitoring and reporting
- [ ] Implement resource utilization tracking

### Phase 3: Enhanced Error Handling
- [ ] Enhance operation handlers with comprehensive error handling
- [ ] Add error classification and recovery recommendation generation
- [ ] Implement detailed error event dispatching
- [ ] Add error correlation tracking across operations

### Phase 4: Monitoring Integration
- [ ] Create health check endpoints and status reporting
- [ ] Add operational dashboards and alerting thresholds
- [ ] Implement debugging utilities and state inspection
- [ ] Create documentation for monitoring and troubleshooting

## Acceptance Criteria

### Logging Requirements
- [ ] **Structured Format**: All log messages use consistent structured format
- [ ] **Contextual Information**: Logs include operation ID, entity IDs, and relevant context
- [ ] **Performance Tracking**: Operation duration and performance metrics logged
- [ ] **Debug Capabilities**: Debug mode provides detailed trace logging

### Error Handling Requirements
- [ ] **Error Classification**: All errors classified by category, severity, and recoverability
- [ ] **Recovery Guidance**: Error responses include actionable recovery recommendations
- [ ] **Error Correlation**: Related errors can be correlated using operation IDs
- [ ] **Graceful Degradation**: System continues operating despite individual operation failures

### Monitoring Requirements
- [ ] **Key Metrics**: Success rates, performance percentiles, error rates tracked
- [ ] **Health Status**: System health status available via programmatic interface
- [ ] **Resource Tracking**: Memory and CPU utilization monitored over time
- [ ] **Alerting Thresholds**: Configurable thresholds for performance and reliability alerts

### Observability Requirements
- [ ] **End-to-End Tracing**: Operations can be traced from start to completion
- [ ] **State Inspection**: Component states can be inspected for debugging
- [ ] **Historical Analysis**: Metrics retained for trend analysis and capacity planning
- [ ] **Debugging Support**: Sufficient information for troubleshooting issues in production

## Definition of Done
- [ ] ProximityLogger implemented with structured logging and sanitization
- [ ] Error classification system implemented with recovery recommendations
- [ ] ProximityMetrics collector implemented with comprehensive KPIs
- [ ] Health monitoring system implemented with status reporting
- [ ] Operation handlers enhanced with comprehensive logging and error handling
- [ ] Debug utilities implemented for troubleshooting and state inspection
- [ ] All logging and monitoring integrated with existing codebase
- [ ] Performance impact of logging measured and acceptable (<5ms overhead)
- [ ] Documentation created for monitoring, alerting, and troubleshooting
- [ ] Integration tested with existing logging infrastructure