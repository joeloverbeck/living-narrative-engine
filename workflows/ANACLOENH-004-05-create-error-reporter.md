# ANACLOENH-004-05: Create Error Reporter

## Overview
Implement an error reporting service that batches errors, provides analytics, and sends alerts for critical issues.

## Parent Ticket
- ANACLOENH-004: Establish Error Handling Framework

## Depends On
- ANACLOENH-004-01: Create BaseError Class
- ANACLOENH-004-03: Create Central Error Handler

## Current State
- Errors are logged locally
- No centralized error reporting
- No error analytics or trends

## Objectives
1. Create ErrorReporter class
2. Implement batch reporting
3. Add error analytics
4. Create alerting system
5. Generate error reports

## Technical Requirements

### ErrorReporter Implementation
```javascript
// Location: src/errors/ErrorReporter.js
import { validateDependency } from '../utils/dependencyUtils.js';

class ErrorReporter {
  #logger;
  #eventBus;
  #buffer;
  #batchSize;
  #flushInterval;
  #endpoint;
  #intervalHandle;
  #analytics;
  #alertThresholds;
  #enabled;

  constructor({
    logger,
    eventBus,
    endpoint = null,
    batchSize = 50,
    flushInterval = 30000,
    enabled = true
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'error', 'warn', 'debug']
    });
    validateDependency(eventBus, 'IEventBus', logger, {
      requiredMethods: ['dispatch', 'on']
    });

    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#endpoint = endpoint;
    this.#batchSize = batchSize;
    this.#flushInterval = flushInterval;
    this.#enabled = enabled && endpoint !== null;
    this.#buffer = [];
    this.#intervalHandle = null;

    this.#analytics = {
      totalReported: 0,
      errorsByType: new Map(),
      errorsBySeverity: new Map(),
      errorsByHour: new Map(),
      trends: []
    };

    this.#alertThresholds = {
      criticalErrors: 5,        // Alert after 5 critical errors
      errorRate: 10,            // Alert if >10 errors per minute
      specificError: 20,        // Alert if same error occurs 20 times
      failureRate: 0.1         // Alert if 10% of operations fail
    };

    if (this.#enabled) {
      this.#startBatchReporting();
      this.#registerEventListeners();
    }
  }

  // Report an error
  report(error, context = {}) {
    if (!this.#enabled) {
      return;
    }

    const errorReport = this.#createErrorReport(error, context);

    // Add to buffer
    this.#buffer.push(errorReport);

    // Update analytics
    this.#updateAnalytics(errorReport);

    // Check thresholds
    this.#checkThresholds(errorReport);

    // Flush if buffer is full
    if (this.#buffer.length >= this.#batchSize) {
      this.flush();
    }
  }

  // Flush buffered errors
  async flush() {
    if (!this.#enabled || this.#buffer.length === 0) {
      return;
    }

    const errors = [...this.#buffer];
    this.#buffer = [];

    try {
      await this.#sendBatch(errors);
      this.#logger.debug(`Flushed ${errors.length} error reports`);
    } catch (error) {
      this.#logger.error('Failed to send error batch', {
        error: error.message,
        batchSize: errors.length
      });

      // Re-add to buffer if send failed (with limit)
      if (this.#buffer.length < this.#batchSize * 2) {
        this.#buffer.unshift(...errors.slice(0, this.#batchSize));
      }
    }
  }

  // Generate error report for time range
  generateErrorReport(startTime = null, endTime = null) {
    const now = Date.now();
    startTime = startTime || now - 24 * 60 * 60 * 1000; // Default: last 24 hours
    endTime = endTime || now;

    const report = {
      period: {
        start: new Date(startTime).toISOString(),
        end: new Date(endTime).toISOString()
      },
      summary: {
        totalErrors: this.#analytics.totalReported,
        uniqueErrorTypes: this.#analytics.errorsByType.size,
        topErrors: this.#getTopErrors(5),
        severityBreakdown: Object.fromEntries(this.#analytics.errorsBySeverity),
        hourlyDistribution: this.#getHourlyDistribution(startTime, endTime)
      },
      trends: this.#analyzeTrends(),
      recommendations: this.#generateRecommendations()
    };

    return report;
  }

  // Get error trends
  getErrorTrends(hours = 24) {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.#analytics.trends.filter(t => t.timestamp > cutoff);
  }

  // Get top errors
  getTopErrors(limit = 10) {
    return this.#getTopErrors(limit);
  }

  // Send alert
  sendAlert(severity, message, details = {}) {
    this.#eventBus.dispatch({
      type: 'ERROR_ALERT',
      payload: {
        severity,
        message,
        details,
        timestamp: Date.now()
      }
    });

    this.#logger.warn(`Error alert: ${message}`, {
      severity,
      details
    });
  }

  // Private methods
  #createErrorReport(error, context) {
    const isBaseError = error && error.toJSON;

    return {
      id: error?.correlationId || this.#generateReportId(),
      timestamp: Date.now(),
      error: isBaseError ? error.toJSON() : {
        name: error?.constructor?.name || 'UnknownError',
        message: error?.message || 'Unknown error',
        stack: error?.stack,
        code: error?.code
      },
      context: {
        ...context,
        environment: process.env.NODE_ENV || 'development',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
        url: typeof window !== 'undefined' ? window.location.href : 'server'
      },
      severity: error?.severity || 'error',
      recoverable: error?.recoverable || false
    };
  }

  async #sendBatch(errors) {
    if (!this.#endpoint) {
      // If no endpoint, just log
      this.#logger.info(`Would send ${errors.length} errors to reporting service`);
      return;
    }

    const payload = {
      batch: errors,
      metadata: {
        batchId: this.#generateReportId(),
        timestamp: Date.now(),
        environment: process.env.NODE_ENV || 'development'
      }
    };

    // In real implementation, this would be an HTTP request
    // For now, we'll simulate it
    this.#logger.info('Sending error batch', {
      endpoint: this.#endpoint,
      batchSize: errors.length
    });

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Simulate occasional failure for testing
    if (Math.random() < 0.05) { // 5% failure rate
      throw new Error('Network error');
    }
  }

  #updateAnalytics(errorReport) {
    this.#analytics.totalReported++;

    // Update by type
    const errorType = errorReport.error.name;
    const typeCount = this.#analytics.errorsByType.get(errorType) || 0;
    this.#analytics.errorsByType.set(errorType, typeCount + 1);

    // Update by severity
    const severity = errorReport.severity;
    const severityCount = this.#analytics.errorsBySeverity.get(severity) || 0;
    this.#analytics.errorsBySeverity.set(severity, severityCount + 1);

    // Update hourly
    const hour = new Date(errorReport.timestamp).getHours();
    const hourCount = this.#analytics.errorsByHour.get(hour) || 0;
    this.#analytics.errorsByHour.set(hour, hourCount + 1);

    // Update trends (keep last 100)
    this.#analytics.trends.push({
      timestamp: errorReport.timestamp,
      type: errorType,
      severity: severity
    });

    if (this.#analytics.trends.length > 100) {
      this.#analytics.trends.shift();
    }
  }

  #checkThresholds(errorReport) {
    // Check critical error threshold
    const criticalCount = this.#analytics.errorsBySeverity.get('critical') || 0;
    if (criticalCount >= this.#alertThresholds.criticalErrors) {
      this.sendAlert('critical', `Critical error threshold exceeded: ${criticalCount} errors`);
    }

    // Check error rate (errors in last minute)
    const recentErrors = this.#analytics.trends.filter(
      t => Date.now() - t.timestamp < 60000
    ).length;

    if (recentErrors >= this.#alertThresholds.errorRate) {
      this.sendAlert('warning', `High error rate: ${recentErrors} errors in last minute`);
    }

    // Check specific error threshold
    const errorCount = this.#analytics.errorsByType.get(errorReport.error.name) || 0;
    if (errorCount >= this.#alertThresholds.specificError) {
      this.sendAlert('warning', `Repeated error: ${errorReport.error.name} occurred ${errorCount} times`);
    }
  }

  #getTopErrors(limit) {
    const sorted = Array.from(this.#analytics.errorsByType.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    return sorted.map(([type, count]) => ({
      type,
      count,
      percentage: (count / this.#analytics.totalReported * 100).toFixed(2)
    }));
  }

  #getHourlyDistribution(startTime, endTime) {
    const distribution = {};
    for (let i = 0; i < 24; i++) {
      distribution[i] = this.#analytics.errorsByHour.get(i) || 0;
    }
    return distribution;
  }

  #analyzeTrends() {
    if (this.#analytics.trends.length < 10) {
      return { status: 'insufficient_data' };
    }

    const recent = this.#analytics.trends.slice(-10);
    const older = this.#analytics.trends.slice(-20, -10);

    const recentRate = recent.length;
    const olderRate = older.length;

    if (recentRate > olderRate * 1.5) {
      return { status: 'increasing', change: '+' + Math.round((recentRate / olderRate - 1) * 100) + '%' };
    } else if (recentRate < olderRate * 0.5) {
      return { status: 'decreasing', change: '-' + Math.round((1 - recentRate / olderRate) * 100) + '%' };
    }

    return { status: 'stable' };
  }

  #generateRecommendations() {
    const recommendations = [];

    // Check for high critical error rate
    const criticalCount = this.#analytics.errorsBySeverity.get('critical') || 0;
    if (criticalCount > 0) {
      recommendations.push({
        priority: 'high',
        message: `Address ${criticalCount} critical errors immediately`
      });
    }

    // Check for repeated errors
    const topErrors = this.#getTopErrors(1);
    if (topErrors.length > 0 && topErrors[0].count > 50) {
      recommendations.push({
        priority: 'medium',
        message: `Investigate root cause of ${topErrors[0].type} (${topErrors[0].count} occurrences)`
      });
    }

    // Check trends
    const trends = this.#analyzeTrends();
    if (trends.status === 'increasing') {
      recommendations.push({
        priority: 'medium',
        message: `Error rate increasing by ${trends.change}, investigate cause`
      });
    }

    return recommendations;
  }

  #startBatchReporting() {
    this.#intervalHandle = setInterval(() => {
      this.flush();
    }, this.#flushInterval);

    this.#logger.debug('Error batch reporting started', {
      interval: this.#flushInterval,
      batchSize: this.#batchSize
    });
  }

  #registerEventListeners() {
    this.#eventBus.on('ERROR_OCCURRED', (event) => {
      this.report(event.payload.error, event.payload.context);
    });
  }

  #generateReportId() {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Lifecycle methods
  destroy() {
    if (this.#intervalHandle) {
      clearInterval(this.#intervalHandle);
      this.#intervalHandle = null;
    }

    this.flush(); // Final flush
    this.#enabled = false;
    this.#logger.info('ErrorReporter destroyed');
  }
}

export default ErrorReporter;
```

## Implementation Steps

1. **Create ErrorReporter.js**
   - Implement batch reporting logic
   - Add analytics tracking
   - Create alerting system

2. **Add configuration**
   ```javascript
   // src/config/errorReporting.config.js
   export const errorReportingConfig = {
     enabled: process.env.ERROR_REPORTING_ENABLED === 'true',
     endpoint: process.env.ERROR_REPORTING_ENDPOINT,
     batchSize: 50,
     flushInterval: 30000
   };
   ```

3. **Register in DI container**
   - Add token to tokens-monitoring.js
   - Create registration

## File Changes

### New Files
- `src/errors/ErrorReporter.js`
- `src/config/errorReporting.config.js`

### Modified Files
- `src/dependencyInjection/tokens/tokens-monitoring.js` - Add IErrorReporter token

## Dependencies
- **Prerequisites**:
  - ANACLOENH-004-01 (BaseError class)
  - ANACLOENH-004-03 (CentralErrorHandler)
- **External**: EventBus, Logger

## Acceptance Criteria
1. ✅ Errors are batched correctly
2. ✅ Analytics track error patterns
3. ✅ Alerts fire at thresholds
4. ✅ Reports generate accurately
5. ✅ Buffer doesn't exceed limits
6. ✅ Failed sends are retried
7. ✅ Cleanup works on destroy

## Testing Requirements

### Unit Tests
Create `tests/unit/errors/ErrorReporter.test.js`:
- Test batch collection
- Test flush mechanism
- Test analytics tracking
- Test alert thresholds
- Test report generation
- Test error trends

## Estimated Effort
- **Development**: 3 hours
- **Testing**: 2 hours
- **Total**: 5 hours

## Risk Assessment
- **Low Risk**: Reporting is auxiliary functionality
- **Consideration**: Ensure reporting doesn't impact performance
- **Mitigation**: Add circuit breaker for reporting endpoint

## Success Metrics
- 100% of errors captured
- <1% reporting failures
- Alerts fire within 1 minute of threshold
- Reports generate in <100ms

## Notes
- Keep reporting async and non-blocking
- Implement sampling for high-volume scenarios
- Consider privacy implications of error data
- Add configuration for sensitive data filtering