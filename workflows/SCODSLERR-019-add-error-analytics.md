# SCODSLERR-019: Add Error Analytics Endpoints

## Overview

Create analytics endpoints and utilities to analyze error patterns, generate insights, and support debugging from the error buffer data.

## Objectives

- Create error analytics service
- Implement analysis endpoints
- Generate error insights
- Support debugging workflows
- Enable error pattern detection

## Implementation Details

### Location

`src/scopeDsl/analytics/errorAnalyticsService.js`

### Core Analytics Service

```javascript
class ErrorAnalyticsService {
  constructor({ errorHandler, logger }) {
    this.#errorHandler = errorHandler;
    this.#logger = logger;
  }

  /**
   * Get error statistics
   * @returns {Object} Error statistics
   */
  getStatistics() {
    const buffer = this.#errorHandler.getErrorBuffer();
    return {
      total: buffer.length,
      byCategory: this.#groupByCategory(buffer),
      byResolver: this.#groupByResolver(buffer),
      byCode: this.#groupByCode(buffer),
      timeRange: this.#getTimeRange(buffer),
      errorRate: this.#calculateErrorRate(buffer),
    };
  }

  /**
   * Get most common errors
   * @param {number} limit - Number of errors to return
   * @returns {Array} Most common errors
   */
  getMostCommon(limit = 10) {
    const buffer = this.#errorHandler.getErrorBuffer();
    const frequency = {};

    buffer.forEach((error) => {
      const key = `${error.code}:${error.resolver}`;
      frequency[key] = (frequency[key] || 0) + 1;
    });

    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([key, count]) => {
        const [code, resolver] = key.split(':');
        return { code, resolver, count };
      });
  }

  /**
   * Get error patterns
   * @returns {Object} Detected patterns
   */
  detectPatterns() {
    const buffer = this.#errorHandler.getErrorBuffer();
    return {
      sequences: this.#detectSequences(buffer),
      spikes: this.#detectSpikes(buffer),
      correlations: this.#detectCorrelations(buffer),
    };
  }
}
```

### Analytics Endpoints

#### 1. REST API Endpoints

```javascript
// GET /api/errors/statistics
router.get('/errors/statistics', (req, res) => {
  const stats = analyticsService.getStatistics();
  res.json(stats);
});

// GET /api/errors/common
router.get('/errors/common', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const common = analyticsService.getMostCommon(limit);
  res.json(common);
});

// GET /api/errors/patterns
router.get('/errors/patterns', (req, res) => {
  const patterns = analyticsService.detectPatterns();
  res.json(patterns);
});

// GET /api/errors/timeline
router.get('/errors/timeline', (req, res) => {
  const timeline = analyticsService.getTimeline();
  res.json(timeline);
});

// POST /api/errors/clear
router.post('/errors/clear', (req, res) => {
  errorHandler.clearErrorBuffer();
  res.json({ success: true });
});
```

#### 2. Debug Dashboard Data

```javascript
class ErrorDashboardService {
  /**
   * Get dashboard data
   * @returns {Object} Dashboard data
   */
  getDashboardData() {
    return {
      summary: this.#getSummary(),
      recentErrors: this.#getRecentErrors(10),
      errorTrend: this.#getErrorTrend(),
      resolverHealth: this.#getResolverHealth(),
      recommendations: this.#getRecommendations(),
    };
  }

  #getSummary() {
    const stats = analyticsService.getStatistics();
    return {
      totalErrors: stats.total,
      errorRate: stats.errorRate,
      topCategory: this.#getTopItem(stats.byCategory),
      topResolver: this.#getTopItem(stats.byResolver),
      healthScore: this.#calculateHealthScore(stats),
    };
  }

  #getRecommendations() {
    const patterns = analyticsService.detectPatterns();
    const recommendations = [];

    if (patterns.spikes.length > 0) {
      recommendations.push({
        type: 'warning',
        message: 'Error spikes detected',
        action: 'Investigate recent changes',
      });
    }

    return recommendations;
  }
}
```

### Pattern Detection

```javascript
class PatternDetector {
  /**
   * Detect error sequences
   * @param {Array} buffer - Error buffer
   * @returns {Array} Detected sequences
   */
  detectSequences(buffer) {
    const sequences = [];
    const window = 3; // Look for patterns of 3

    for (let i = 0; i <= buffer.length - window; i++) {
      const sequence = buffer.slice(i, i + window).map((e) => e.code);

      // Check if this sequence repeats
      const count = this.#countSequence(buffer, sequence);
      if (count > 1) {
        sequences.push({
          pattern: sequence,
          count,
          firstOccurrence: buffer[i].timestamp,
        });
      }
    }

    return sequences;
  }

  /**
   * Detect error spikes
   * @param {Array} buffer - Error buffer
   * @returns {Array} Spike periods
   */
  detectSpikes(buffer) {
    const timeWindow = 60000; // 1 minute windows
    const threshold = 10; // errors per minute
    const spikes = [];

    const windows = this.#groupByTimeWindow(buffer, timeWindow);

    Object.entries(windows).forEach(([time, errors]) => {
      if (errors.length > threshold) {
        spikes.push({
          timestamp: parseInt(time),
          count: errors.length,
          errors: errors.map((e) => e.code),
        });
      }
    });

    return spikes;
  }
}
```

### Export Functionality

```javascript
class ErrorExporter {
  /**
   * Export errors to JSON
   * @returns {string} JSON export
   */
  exportJSON() {
    const buffer = errorHandler.getErrorBuffer();
    const analytics = analyticsService.getStatistics();

    return JSON.stringify(
      {
        timestamp: Date.now(),
        errors: buffer,
        analytics,
        version: '1.0.0',
      },
      null,
      2
    );
  }

  /**
   * Export errors to CSV
   * @returns {string} CSV export
   */
  exportCSV() {
    const buffer = errorHandler.getErrorBuffer();
    const headers = 'Timestamp,Code,Category,Resolver,Message\n';

    const rows = buffer
      .map(
        (error) =>
          `${error.timestamp},${error.code},${error.category},${error.resolver},"${error.message}"`
      )
      .join('\n');

    return headers + rows;
  }
}
```

## Acceptance Criteria

- [ ] Analytics service implemented
- [ ] Statistics endpoint working
- [ ] Pattern detection functional
- [ ] Dashboard data available
- [ ] Export functionality works
- [ ] Recommendations generated
- [ ] Performance acceptable
- [ ] Documentation complete

## Testing Requirements

- Unit tests for analytics service
- Integration tests for endpoints
- Pattern detection accuracy tests
- Performance tests for large buffers
- Export format validation

## Dependencies

- SCODSLERR-001: Error handler with buffer
- SCODSLERR-018: Integration testing complete

## Estimated Effort

- Analytics service: 4 hours
- Endpoints implementation: 2 hours
- Pattern detection: 3 hours
- Testing: 2 hours
- Total: 11 hours

## Risk Assessment

- **Medium Risk**: Complex pattern detection
- **Mitigation**: Start with simple patterns

## Related Spec Sections

- Section 9: Future Enhancements
- Section 7.1: Success Metrics
- Error buffering design

## API Documentation

```yaml
openapi: 3.0.0
paths:
  /api/errors/statistics:
    get:
      summary: Get error statistics
      responses:
        200:
          description: Error statistics
          content:
            application/json:
              schema:
                type: object
                properties:
                  total:
                    type: integer
                  byCategory:
                    type: object
```
