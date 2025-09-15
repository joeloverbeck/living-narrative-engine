# ANACLOENH-004-08: Integrate Monitoring System with Error Framework

## Overview
Integrate the MonitoringCoordinator with the new error handling framework, ensuring monitoring errors are handled and that the error handler can use monitoring capabilities.

## Parent Ticket
- ANACLOENH-004: Establish Error Handling Framework

## Depends On
- ANACLOENH-004-03: Create Central Error Handler
- ANACLOENH-004-04: Create Recovery Strategy Manager
- ANACLOENH-004-05: Create Error Reporter

## Current State
- MonitoringCoordinator exists with performance and circuit breaker features
- No integration with central error handling
- Circuit breakers operate independently

## Objectives
1. Wire CentralErrorHandler into MonitoringCoordinator
2. Share circuit breakers between systems
3. Add error metrics to monitoring
4. Create bi-directional integration

## Technical Requirements

### Update MonitoringCoordinator
```javascript
// src/entities/monitoring/MonitoringCoordinator.js
import CentralErrorHandler from '../../errors/CentralErrorHandler.js';
import RecoveryStrategyManager from '../../errors/RecoveryStrategyManager.js';
import ErrorReporter from '../../errors/ErrorReporter.js';

export default class MonitoringCoordinator {
  // ... existing fields ...
  #centralErrorHandler;
  #recoveryStrategyManager;
  #errorReporter;

  constructor({
    logger,
    eventBus,
    memoryMonitor,
    memoryPressureManager,
    memoryReporter,
    centralErrorHandler, // New
    recoveryStrategyManager, // New
    errorReporter, // New
    enabled = true,
    checkInterval = 30000,
    circuitBreakerOptions = {},
  }) {
    // ... existing validation ...

    // Initialize error handling components
    this.#centralErrorHandler = centralErrorHandler;
    this.#recoveryStrategyManager = recoveryStrategyManager;
    this.#errorReporter = errorReporter;

    // If error components provided, set them up
    if (this.#centralErrorHandler && this.#recoveryStrategyManager) {
      this.#setupErrorIntegration();
    }

    // ... rest of existing constructor ...
  }

  // Setup bi-directional error integration
  #setupErrorIntegration() {
    // Register monitoring-specific recovery strategies
    this.#recoveryStrategyManager.registerStrategy('PerformanceError', {
      retry: {
        maxRetries: 2,
        backoff: 'exponential'
      },
      fallback: (error, operation) => {
        this.#logger.warn('Performance monitoring failed, returning default metrics');
        return {
          totalOperations: 0,
          averageTime: 0,
          maxTime: 0
        };
      }
    });

    this.#recoveryStrategyManager.registerStrategy('CircuitBreakerError', {
      retry: {
        maxRetries: 1,
        backoff: 'constant'
      },
      fallback: (error, operation) => {
        this.#logger.warn('Circuit breaker operation failed, allowing request');
        return { allowed: true, fallback: true };
      }
    });

    // Listen for error events to track in monitoring
    if (this.#eventBus) {
      this.#eventBus.on('ERROR_OCCURRED', (event) => {
        this.#trackErrorMetric(event.payload);
      });
    }

    this.#logger.info('Error handling integration established in MonitoringCoordinator');
  }

  // Enhanced executeMonitored with error handling integration
  async executeMonitored(operationName, operation, options = {}) {
    const {
      context = '',
      useCircuitBreaker = true,
      circuitBreakerOptions = {},
      useErrorHandler = true, // New option
    } = options;

    if (!this.#enabled) {
      return await operation();
    }

    const circuitBreaker = useCircuitBreaker
      ? this.getCircuitBreaker(operationName, circuitBreakerOptions)
      : null;

    // Wrap with error handling if available
    const wrappedOperation = async () => {
      try {
        const result = await this.#performanceMonitor.timeOperation(
          operationName,
          operation,
          context
        );
        return result;
      } catch (error) {
        // If we have central error handler and it's enabled, use it
        if (useErrorHandler && this.#centralErrorHandler) {
          return await this.#centralErrorHandler.handle(error, {
            operation: operationName,
            context,
            monitoring: true
          });
        }
        throw error;
      }
    };

    // Execute with circuit breaker if available
    if (circuitBreaker) {
      try {
        return await circuitBreaker.execute(wrappedOperation);
      } catch (error) {
        // Circuit breaker opened or operation failed
        if (this.#recoveryStrategyManager) {
          return await this.#recoveryStrategyManager.executeWithRecovery(
            wrappedOperation,
            {
              operationName,
              errorType: 'CircuitBreakerError',
              maxRetries: 1,
              useCircuitBreaker: false, // Don't use CB in recovery
              useFallback: true
            }
          );
        }
        throw error;
      }
    } else {
      return await wrappedOperation();
    }
  }

  // Track error metrics
  #trackErrorMetric(errorInfo) {
    if (!this.#performanceMonitor) {
      return;
    }

    // Add to performance metrics
    const metricName = `error_${errorInfo.errorType}`;
    this.#performanceMonitor.recordMetric(metricName, 1);

    // Track severity
    if (errorInfo.severity === 'critical') {
      this.#addAlert('error', `Critical error: ${errorInfo.message}`);
    } else if (errorInfo.severity === 'error') {
      this.#addAlert('warning', `Error occurred: ${errorInfo.errorType}`);
    }
  }

  // Get comprehensive stats including error metrics
  getStats() {
    const baseStats = this.#getBaseStats(); // Existing stats logic

    // Add error metrics if available
    let errorStats = null;
    if (this.#centralErrorHandler) {
      errorStats = this.#centralErrorHandler.getMetrics();
    }

    let errorReports = null;
    if (this.#errorReporter) {
      errorReports = this.#errorReporter.getTopErrors(5);
    }

    return {
      ...baseStats,
      errors: errorStats,
      topErrors: errorReports,
      healthStatus: this.#calculateHealthStatus(baseStats, errorStats)
    };
  }

  // Calculate overall system health
  #calculateHealthStatus(monitoringStats, errorStats) {
    let score = 100;

    // Deduct for performance issues
    if (monitoringStats.performance.averageOperationTime > 100) {
      score -= 10;
    }
    if (monitoringStats.performance.slowOperations > monitoringStats.performance.totalOperations * 0.1) {
      score -= 15;
    }

    // Deduct for circuit breaker issues
    const openCircuits = Object.values(monitoringStats.circuitBreakers)
      .filter(cb => cb.state === 'OPEN').length;
    score -= openCircuits * 10;

    // Deduct for memory issues
    if (monitoringStats.memory?.pressureLevel === 'critical') {
      score -= 20;
    } else if (monitoringStats.memory?.pressureLevel === 'warning') {
      score -= 10;
    }

    // Deduct for error rates
    if (errorStats) {
      const errorRate = errorStats.totalErrors > 0
        ? (errorStats.totalErrors - errorStats.recoveredErrors) / errorStats.totalErrors
        : 0;
      score -= Math.round(errorRate * 30);
    }

    return {
      score: Math.max(0, score),
      status: score >= 80 ? 'healthy' : score >= 60 ? 'degraded' : 'unhealthy',
      factors: {
        performance: monitoringStats.performance.averageOperationTime,
        circuitBreakers: openCircuits,
        memory: monitoringStats.memory?.pressureLevel || 'normal',
        errorRate: errorStats ? errorStats.totalErrors : 0
      }
    };
  }

  // Get error handler for external use
  getErrorHandler() {
    return this.#centralErrorHandler;
  }

  // Get recovery manager for external use
  getRecoveryManager() {
    return this.#recoveryStrategyManager;
  }

  // Get error reporter for external use
  getErrorReporter() {
    return this.#errorReporter;
  }
}
```

### Update Dependency Registration
```javascript
// src/dependencyInjection/registrations/monitoringRegistrations.js
import { tokens } from '../tokens.js';
import MonitoringCoordinator from '../../entities/monitoring/MonitoringCoordinator.js';
import CentralErrorHandler from '../../errors/CentralErrorHandler.js';
import RecoveryStrategyManager from '../../errors/RecoveryStrategyManager.js';
import ErrorReporter from '../../errors/ErrorReporter.js';

export function registerMonitoringServices(container) {
  // Register error handler
  container.register(tokens.ICentralErrorHandler, () => {
    const logger = container.resolve(tokens.ILogger);
    const eventBus = container.resolve(tokens.IEventBus);
    const monitoringCoordinator = container.resolve(tokens.IMonitoringCoordinator);

    return new CentralErrorHandler({
      logger,
      eventBus,
      monitoringCoordinator
    });
  });

  // Register recovery strategy manager
  container.register(tokens.IRecoveryStrategyManager, () => {
    const logger = container.resolve(tokens.ILogger);
    const monitoringCoordinator = container.resolve(tokens.IMonitoringCoordinator);

    return new RecoveryStrategyManager({
      logger,
      monitoringCoordinator
    });
  });

  // Register error reporter
  container.register(tokens.IErrorReporter, () => {
    const logger = container.resolve(tokens.ILogger);
    const eventBus = container.resolve(tokens.IEventBus);
    const config = container.resolve(tokens.IErrorReportingConfig);

    return new ErrorReporter({
      logger,
      eventBus,
      endpoint: config?.endpoint,
      batchSize: config?.batchSize || 50,
      flushInterval: config?.flushInterval || 30000,
      enabled: config?.enabled !== false
    });
  });

  // Update MonitoringCoordinator registration
  container.register(tokens.IMonitoringCoordinator, () => {
    const logger = container.resolve(tokens.ILogger);
    const eventBus = container.resolve(tokens.IEventBus);
    const memoryMonitor = container.resolve(tokens.IMemoryMonitor);
    const memoryPressureManager = container.resolve(tokens.IMemoryPressureManager);
    const memoryReporter = container.resolve(tokens.IMemoryReporter);
    const centralErrorHandler = container.resolve(tokens.ICentralErrorHandler);
    const recoveryStrategyManager = container.resolve(tokens.IRecoveryStrategyManager);
    const errorReporter = container.resolve(tokens.IErrorReporter);

    return new MonitoringCoordinator({
      logger,
      eventBus,
      memoryMonitor,
      memoryPressureManager,
      memoryReporter,
      centralErrorHandler,
      recoveryStrategyManager,
      errorReporter,
      enabled: true,
      checkInterval: 30000
    });
  });
}
```

### Update Tokens
```javascript
// src/dependencyInjection/tokens/tokens-monitoring.js
export const monitoringTokens = freeze({
  // ... existing tokens ...

  // Error handling tokens
  ICentralErrorHandler: 'ICentralErrorHandler',
  IRecoveryStrategyManager: 'IRecoveryStrategyManager',
  IErrorReporter: 'IErrorReporter',
  IErrorReportingConfig: 'IErrorReportingConfig',
});
```

## Implementation Steps

1. **Update MonitoringCoordinator**
   - Add error handling dependencies
   - Create bi-directional integration
   - Add error metrics tracking

2. **Update dependency registrations**
   - Register error services
   - Wire dependencies correctly
   - Handle circular dependencies

3. **Add configuration**
   - Error reporting config
   - Recovery strategy config
   - Circuit breaker sharing config

4. **Update existing code**
   - Use shared circuit breakers
   - Route errors through central system

## File Changes

### Modified Files
- `src/entities/monitoring/MonitoringCoordinator.js` - Add error integration
- `src/dependencyInjection/registrations/monitoringRegistrations.js` - Register services
- `src/dependencyInjection/tokens/tokens-monitoring.js` - Add tokens
- `src/config/errorHandling.config.js` - Add configuration

## Dependencies
- **Prerequisites**:
  - ANACLOENH-004-03 (CentralErrorHandler)
  - ANACLOENH-004-04 (RecoveryStrategyManager)
  - ANACLOENH-004-05 (ErrorReporter)
- **External**: EventBus, Logger

## Acceptance Criteria
1. ✅ MonitoringCoordinator integrates with error handler
2. ✅ Circuit breakers shared between systems
3. ✅ Error metrics tracked in monitoring
4. ✅ Health status includes error rates
5. ✅ Recovery strategies work with monitoring
6. ✅ No circular dependency issues

## Testing Requirements

### Unit Tests
- Test error handler integration
- Test circuit breaker sharing
- Test error metric tracking
- Test health status calculation

### Integration Tests
- Test full monitoring with errors
- Test recovery through monitoring
- Test error reporting flow

## Estimated Effort
- **Development**: 3 hours
- **Testing**: 2 hours
- **Total**: 5 hours

## Risk Assessment
- **Medium Risk**: Circular dependency potential
- **Mitigation**: Lazy loading of dependencies
- **Mitigation**: Clear initialization order

## Success Metrics
- All errors tracked in monitoring
- Circuit breakers prevent cascading failures
- Health score accurately reflects system state
- No performance degradation

## Notes
- Watch for circular dependencies
- Consider lazy loading for error handler
- Monitor memory usage with all systems integrated
- Document initialization order clearly