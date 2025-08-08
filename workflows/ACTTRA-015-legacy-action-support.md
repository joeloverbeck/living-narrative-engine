# ACTTRA-015: Enhanced Legacy Action Trace Capture

## Executive Summary

Enhance the action tracing system to provide detailed visibility into the existing legacy action support system. The Living Narrative Engine already includes robust legacy action compatibility through `LegacyTargetCompatibilityLayer`, but the current tracing system lacks comprehensive capture of legacy conversion processes. This ticket focuses on improving trace data collection for legacy action processing to aid in debugging, monitoring, and migration planning.

## Technical Requirements

### Core Objectives

- Enhance trace capture for existing `LegacyTargetCompatibilityLayer` operations
- Provide detailed legacy conversion visibility in `ActionAwareStructuredTrace`
- Capture performance metrics for legacy action processing
- Enable debugging and monitoring of legacy action workflows
- Support migration planning with detailed legacy usage analytics
- Maintain zero performance impact on legacy action processing

### Performance Requirements

- Zero performance degradation for existing legacy action processing
- Minimal overhead trace data collection (<1ms per legacy conversion)
- Efficient memory usage for legacy trace data
- Non-blocking trace operations to preserve pipeline performance

### Compatibility Requirements

- Work with existing `LegacyTargetCompatibilityLayer` without modification
- Support all legacy formats already handled by the compatibility layer
- Maintain existing legacy action behavior unchanged
- Integrate seamlessly with current `ActionAwareStructuredTrace` architecture

## Architecture Design

### Legacy Trace Enhancement Strategy

The trace enhancement will integrate with the existing `LegacyTargetCompatibilityLayer` to capture detailed conversion data:

```javascript
// Enhanced ActionAwareStructuredTrace with legacy tracing
class ActionAwareStructuredTrace extends StructuredTrace {
  captureLegacyConversion(conversionData) {
    // Capture legacy conversion details from LegacyTargetCompatibilityLayer
    this.captureActionData('legacy_conversion', 'target_format_conversion', {
      originalFormat: conversionData.legacyFormat,
      modernFormat: conversionData.modernFormat,
      scope: conversionData.scope,
      placeholder: conversionData.placeholder,
      conversionTime: conversionData.processingTime,
      success: conversionData.success
    });
  }
}
```

### Existing Legacy Action Support

The system currently supports these legacy formats through `LegacyTargetCompatibilityLayer`:

```javascript
const SUPPORTED_LEGACY_FORMATS = {
  // String targets format
  STRING_TARGETS: {
    pattern: { targets: 'string' },
    example: { targets: "actor.partners" },
    handler: 'LegacyTargetCompatibilityLayer.convertLegacyFormat',
  },

  // Scope property format
  SCOPE_PROPERTY: {
    pattern: { scope: 'string', targets: undefined },
    example: { scope: "actor.items" },
    handler: 'LegacyTargetCompatibilityLayer.convertLegacyFormat',
  },

  // Legacy targetType format
  TARGET_TYPE: {
    pattern: { targetType: 'string', targetCount: 'number' },
    example: { targetType: "partner", targetCount: 1 },
    handler: 'LegacyTargetCompatibilityLayer.convertLegacyFormat',
  },
};
```

## Implementation Steps

### Step 1: Enhance ActionAwareStructuredTrace for Legacy Capture

**File**: `src/actions/tracing/actionAwareStructuredTrace.js` (Enhancement)

```javascript
/**
 * Enhanced ActionAwareStructuredTrace with legacy conversion tracing
 */

// Add new methods to existing ActionAwareStructuredTrace class

/**
 * Capture detailed legacy conversion data from LegacyTargetCompatibilityLayer
 * @param {string} actionId - Action being processed
 * @param {object} conversionData - Data from legacy compatibility layer
 */
captureLegacyConversion(actionId, conversionData) {
  if (!this.#actionTraceFilter.shouldTrace(actionId)) {
    return;
  }

  this.captureActionData('legacy_processing', actionId, {
    isLegacy: conversionData.isLegacy,
    originalFormat: this.#analyzeLegacyFormat(conversionData.originalAction),
    conversionResult: conversionData.targetDefinitions,
    conversionTime: conversionData.processingTime,
    success: !conversionData.error,
    error: conversionData.error,
    migrationSuggestion: conversionData.migrationSuggestion,
    timestamp: Date.now()
  });
}

/**
 * Capture legacy action detection and format analysis
 * @param {string} actionId - Action ID
 * @param {object} detectionData - Legacy detection results
 */
captureLegacyDetection(actionId, detectionData) {
  if (!this.#actionTraceFilter.shouldTrace(actionId)) {
    return;
  }

  this.captureActionData('legacy_detection', actionId, {
    hasStringTargets: detectionData.hasStringTargets,
    hasScopeOnly: detectionData.hasScopeOnly,
    hasLegacyFields: detectionData.hasLegacyFields,
    legacyFormat: detectionData.detectedFormat,
    requiresConversion: detectionData.requiresConversion,
    timestamp: Date.now()
  });
}

/**
 * Get summary of legacy action processing for this trace session
 * @returns {object} Legacy processing summary
 */
getLegacyProcessingSummary() {
  const summary = {
    totalLegacyActions: 0,
    conversionsByFormat: {},
    successfulConversions: 0,
    failedConversions: 0,
    averageConversionTime: 0,
    totalConversionTime: 0
  };

  for (const [actionId, traceData] of this.#tracedActionData) {
    const legacyData = traceData.stages.legacy_processing;
    if (legacyData && legacyData.data.isLegacy) {
      summary.totalLegacyActions++;
      
      const format = legacyData.data.originalFormat;
      summary.conversionsByFormat[format] = (summary.conversionsByFormat[format] || 0) + 1;
      
      if (legacyData.data.success) {
        summary.successfulConversions++;
      } else {
        summary.failedConversions++;
      }
      
      if (legacyData.data.conversionTime) {
        summary.totalConversionTime += legacyData.data.conversionTime;
      }
    }
  }

  summary.averageConversionTime = summary.totalLegacyActions > 0 
    ? summary.totalConversionTime / summary.totalLegacyActions 
    : 0;

  return summary;
}

/**
 * Analyze legacy action format for tracing purposes
 * @private
 * @param {object} action - Action definition to analyze
 * @returns {string} Detected legacy format type
 */
#analyzeLegacyFormat(action) {
  if (typeof action.targets === 'string') {
    return 'string_targets';
  }
  if (action.scope && !action.targets) {
    return 'scope_property';
  }
  if (action.targetType || action.targetCount) {
    return 'legacy_target_type';
  }
  return 'unknown';
}
```

### Step 2: Integrate with MultiTargetResolutionStage

**File**: `src/actions/pipeline/stages/MultiTargetResolutionStage.js` (Integration Point)

```javascript
/**
 * Integration point: Enhance MultiTargetResolutionStage to capture legacy conversion traces
 */

// Add trace capture to existing legacy conversion logic
process(entity, action, context) {
  const startTime = performance.now();
  
  // Existing legacy detection logic
  const isLegacy = this.#legacyCompatibilityLayer.isLegacyAction(action);
  
  // Capture legacy detection for tracing
  if (context.trace && context.trace.captureLegacyDetection) {
    context.trace.captureLegacyDetection(action.id, {
      hasStringTargets: typeof action.targets === 'string',
      hasScopeOnly: !!(action.scope && !action.targets),
      hasLegacyFields: !!(action.targetType || action.targetCount),
      detectedFormat: this.#analyzeLegacyFormat(action),
      requiresConversion: isLegacy
    });
  }
  
  if (isLegacy) {
    // Existing conversion logic
    const conversionResult = this.#legacyCompatibilityLayer.convertLegacyFormat(action, entity);
    const processingTime = performance.now() - startTime;
    
    // Capture legacy conversion for tracing
    if (context.trace && context.trace.captureLegacyConversion) {
      context.trace.captureLegacyConversion(action.id, {
        ...conversionResult,
        originalAction: action,
        processingTime,
        migrationSuggestion: this.#legacyCompatibilityLayer.getMigrationSuggestion(action)
      });
    }
    
    // Continue with existing conversion logic...
  }
  
  // Rest of existing method unchanged...
}

/**
 * Helper method to analyze legacy format for tracing
 * @private
 */
#analyzeLegacyFormat(action) {
  if (typeof action.targets === 'string') return 'string_targets';
  if (action.scope && !action.targets) return 'scope_property';
  if (action.targetType || action.targetCount) return 'legacy_target_type';
  return 'modern';
}
```

### Step 3: Create Legacy Analytics Utilities

**File**: `src/actions/tracing/legacyAnalytics.js` (New)

```javascript
/**
 * @file Legacy action analytics and reporting utilities
 * @see actionAwareStructuredTrace.js
 * @see LegacyTargetCompatibilityLayer.js
 */

import { validateDependency, assertNonBlankString } from '../../utils/validationUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * Utilities for analyzing and reporting on legacy action usage
 */
class LegacyAnalytics {
  #logger;

  constructor({ logger }) {
    this.#logger = ensureValidLogger(logger, 'LegacyAnalytics');
  }

  /**
   * Analyze trace data to generate legacy usage report
   * @param {ActionAwareStructuredTrace} trace - Trace containing legacy data
   * @returns {object} Comprehensive legacy usage analysis
   */
  generateLegacyReport(trace) {
    validateDependency(trace, 'ActionAwareStructuredTrace');

    const summary = trace.getLegacyProcessingSummary();
    const tracedActions = trace.getTracedActions();
    
    return {
      overview: summary,
      formatBreakdown: this.#analyzeFormatDistribution(tracedActions),
      performanceImpact: this.#analyzePerformanceImpact(tracedActions),
      migrationPriority: this.#assessMigrationPriority(tracedActions),
      recommendations: this.#generateRecommendations(summary, tracedActions)
    };
  }

  /**
   * Generate migration recommendations based on trace analysis
   * @param {Map} tracedActions - Action trace data
   * @returns {Array} Migration recommendations
   */
  #generateRecommendations(summary, tracedActions) {
    const recommendations = [];

    if (summary.totalLegacyActions > 0) {
      recommendations.push({
        type: 'migration_opportunity',
        priority: 'medium',
        description: `Found ${summary.totalLegacyActions} legacy actions that could be modernized`,
        actions: ['Review migration suggestions in trace data', 'Plan gradual modernization']
      });
    }

    if (summary.averageConversionTime > 5) {
      recommendations.push({
        type: 'performance_concern',
        priority: 'high',
        description: `Legacy conversion taking ${summary.averageConversionTime}ms on average`,
        actions: ['Profile legacy conversion bottlenecks', 'Consider caching conversion results']
      });
    }

    if (summary.failedConversions > 0) {
      recommendations.push({
        type: 'reliability_issue',
        priority: 'high',
        description: `${summary.failedConversions} legacy conversions failed`,
        actions: ['Review failed conversion logs', 'Improve error handling in legacy layer']
      });
    }

    return recommendations;
  }

  /**
   * Analyze format distribution in legacy actions
   * @private
   */
  #analyzeFormatDistribution(tracedActions) {
    const distribution = {};
    
    for (const [, traceData] of tracedActions) {
      const legacyData = traceData.stages.legacy_processing;
      if (legacyData && legacyData.data.isLegacy) {
        const format = legacyData.data.originalFormat;
        distribution[format] = (distribution[format] || 0) + 1;
      }
    }
    
    return distribution;
  }

  /**
   * Analyze performance impact of legacy conversions
   * @private
   */
  #analyzePerformanceImpact(tracedActions) {
    const metrics = {
      totalConversions: 0,
      totalTime: 0,
      maxTime: 0,
      minTime: Infinity
    };

    for (const [, traceData] of tracedActions) {
      const legacyData = traceData.stages.legacy_processing;
      if (legacyData && legacyData.data.isLegacy && legacyData.data.conversionTime) {
        metrics.totalConversions++;
        metrics.totalTime += legacyData.data.conversionTime;
        metrics.maxTime = Math.max(metrics.maxTime, legacyData.data.conversionTime);
        metrics.minTime = Math.min(metrics.minTime, legacyData.data.conversionTime);
      }
    }

    return {
      ...metrics,
      averageTime: metrics.totalConversions > 0 ? metrics.totalTime / metrics.totalConversions : 0,
      minTime: metrics.minTime === Infinity ? 0 : metrics.minTime
    };
  }

  /**
   * Assess migration priority for legacy actions
   * @private
   */
  #assessMigrationPriority(tracedActions) {
    const priorities = { high: [], medium: [], low: [] };

    for (const [actionId, traceData] of tracedActions) {
      const legacyData = traceData.stages.legacy_processing;
      if (legacyData && legacyData.data.isLegacy) {
        const conversionTime = legacyData.data.conversionTime || 0;
        const hasErrors = !legacyData.data.success;
        
        if (hasErrors || conversionTime > 10) {
          priorities.high.push({ actionId, reason: hasErrors ? 'conversion_errors' : 'slow_conversion' });
        } else if (conversionTime > 3) {
          priorities.medium.push({ actionId, reason: 'moderate_conversion_time' });
        } else {
          priorities.low.push({ actionId, reason: 'fast_conversion' });
        }
      }
    }

    return priorities;
  }
}

export default LegacyAnalytics;
```

### Step 4: Enhanced Legacy Trace Tests

**File**: `tests/unit/actions/tracing/actionAwareStructuredTrace.legacy.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../../common/testBed.js';

describe('ActionAwareStructuredTrace - Legacy Support', () => {
  let testBed;
  let trace;

  beforeEach(() => {
    testBed = createTestBed();
    trace = testBed.createActionAwareStructuredTrace({
      actorId: 'test-actor',
      verbosity: 'detailed'
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Legacy Conversion Capture', () => {
    it('should capture string targets legacy conversion', () => {
      const actionId = 'core:test-action';
      const conversionData = {
        isLegacy: true,
        originalAction: { id: actionId, targets: 'actor.partners' },
        targetDefinitions: {
          primary: {
            scope: 'actor.partners',
            placeholder: 'partner'
          }
        },
        processingTime: 2.5,
        migrationSuggestion: JSON.stringify({ modern: 'format' }, null, 2)
      };

      trace.captureLegacyConversion(actionId, conversionData);

      const actionTrace = trace.getActionTrace(actionId);
      expect(actionTrace).toBeDefined();
      expect(actionTrace.stages.legacy_processing).toBeDefined();
      expect(actionTrace.stages.legacy_processing.data.originalFormat).toBe('string_targets');
      expect(actionTrace.stages.legacy_processing.data.success).toBe(true);
    });

    it('should capture scope property legacy conversion', () => {
      const actionId = 'core:legacy-scope';
      const conversionData = {
        isLegacy: true,
        originalAction: { id: actionId, scope: 'actor.items' },
        targetDefinitions: {
          primary: {
            scope: 'actor.items',
            placeholder: 'item'
          }
        },
        processingTime: 1.8
      };

      trace.captureLegacyConversion(actionId, conversionData);

      const actionTrace = trace.getActionTrace(actionId);
      expect(actionTrace.stages.legacy_processing.data.originalFormat).toBe('scope_property');
    });

    it('should capture legacy targetType conversion', () => {
      const actionId = 'core:old-target-type';
      const conversionData = {
        isLegacy: true,
        originalAction: { id: actionId, targetType: 'partner', targetCount: 1 },
        targetDefinitions: {
          primary: {
            scope: 'actor.partners',
            placeholder: 'partner'
          }
        },
        processingTime: 3.2
      };

      trace.captureLegacyConversion(actionId, conversionData);

      const actionTrace = trace.getActionTrace(actionId);
      expect(actionTrace.stages.legacy_processing.data.originalFormat).toBe('legacy_target_type');
    });

    it('should capture failed conversions', () => {
      const actionId = 'core:failed-conversion';
      const conversionData = {
        isLegacy: true,
        originalAction: { id: actionId, invalidProperty: 'test' },
        error: 'Unable to convert invalid legacy format',
        processingTime: 0.5
      };

      trace.captureLegacyConversion(actionId, conversionData);

      const actionTrace = trace.getActionTrace(actionId);
      expect(actionTrace.stages.legacy_processing.data.success).toBe(false);
      expect(actionTrace.stages.legacy_processing.data.error).toBeDefined();
    });
  });

  describe('Legacy Detection Capture', () => {
    it('should capture legacy detection data', () => {
      const actionId = 'core:detect-legacy';
      const detectionData = {
        hasStringTargets: true,
        hasScopeOnly: false,
        hasLegacyFields: false,
        detectedFormat: 'string_targets',
        requiresConversion: true
      };

      trace.captureLegacyDetection(actionId, detectionData);

      const actionTrace = trace.getActionTrace(actionId);
      expect(actionTrace.stages.legacy_detection).toBeDefined();
      expect(actionTrace.stages.legacy_detection.data.hasStringTargets).toBe(true);
      expect(actionTrace.stages.legacy_detection.data.legacyFormat).toBe('string_targets');
    });

    it('should capture modern action detection', () => {
      const actionId = 'core:modern-action';
      const detectionData = {
        hasStringTargets: false,
        hasScopeOnly: false,
        hasLegacyFields: false,
        detectedFormat: 'modern',
        requiresConversion: false
      };

      trace.captureLegacyDetection(actionId, detectionData);

      const actionTrace = trace.getActionTrace(actionId);
      expect(actionTrace.stages.legacy_detection.data.requiresConversion).toBe(false);
    });
  });

  describe('Legacy Processing Summary', () => {
    beforeEach(() => {
      // Set up test data with multiple legacy conversions
      trace.captureLegacyConversion('action1', {
        isLegacy: true,
        originalAction: { targets: 'actor.partners' },
        processingTime: 2.0
      });
      
      trace.captureLegacyConversion('action2', {
        isLegacy: true,
        originalAction: { scope: 'actor.items' },
        processingTime: 1.5
      });
      
      trace.captureLegacyConversion('action3', {
        isLegacy: true,
        originalAction: { targetType: 'partner' },
        error: 'Conversion failed',
        processingTime: 0.8
      });
    });

    it('should generate accurate legacy processing summary', () => {
      const summary = trace.getLegacyProcessingSummary();

      expect(summary.totalLegacyActions).toBe(3);
      expect(summary.successfulConversions).toBe(2);
      expect(summary.failedConversions).toBe(1);
      expect(summary.conversionsByFormat.string_targets).toBe(1);
      expect(summary.conversionsByFormat.scope_property).toBe(1);
      expect(summary.conversionsByFormat.legacy_target_type).toBe(1);
      expect(summary.averageConversionTime).toBeCloseTo(1.43, 2);
    });

    it('should handle empty trace data', () => {
      const emptyTrace = testBed.createActionAwareStructuredTrace({
        actorId: 'empty-actor'
      });

      const summary = emptyTrace.getLegacyProcessingSummary();

      expect(summary.totalLegacyActions).toBe(0);
      expect(summary.averageConversionTime).toBe(0);
    });
  });
});
```

**File**: `tests/unit/actions/tracing/legacyAnalytics.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../../common/testBed.js';
import LegacyAnalytics from '../../../../../src/actions/tracing/legacyAnalytics.js';

describe('LegacyAnalytics', () => {
  let testBed;
  let analytics;
  let trace;

  beforeEach(() => {
    testBed = createTestBed();
    analytics = new LegacyAnalytics({ logger: testBed.logger });
    trace = testBed.createActionAwareStructuredTrace({
      actorId: 'test-actor',
      verbosity: 'detailed'
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Legacy Report Generation', () => {
    beforeEach(() => {
      // Set up comprehensive test data
      trace.captureLegacyConversion('fast-action', {
        isLegacy: true,
        originalAction: { targets: 'actor.partners' },
        processingTime: 1.2
      });
      
      trace.captureLegacyConversion('slow-action', {
        isLegacy: true,
        originalAction: { scope: 'actor.items' },
        processingTime: 8.5
      });
      
      trace.captureLegacyConversion('failed-action', {
        isLegacy: true,
        originalAction: { targetType: 'invalid' },
        error: 'Unknown target type',
        processingTime: 0.3
      });
    });

    it('should generate comprehensive legacy report', () => {
      const report = analytics.generateLegacyReport(trace);

      expect(report).toHaveProperty('overview');
      expect(report).toHaveProperty('formatBreakdown');
      expect(report).toHaveProperty('performanceImpact');
      expect(report).toHaveProperty('migrationPriority');
      expect(report).toHaveProperty('recommendations');

      expect(report.overview.totalLegacyActions).toBe(3);
      expect(report.overview.successfulConversions).toBe(2);
      expect(report.overview.failedConversions).toBe(1);
    });

    it('should analyze format distribution correctly', () => {
      const report = analytics.generateLegacyReport(trace);

      expect(report.formatBreakdown.string_targets).toBe(1);
      expect(report.formatBreakdown.scope_property).toBe(1);
      expect(report.formatBreakdown.legacy_target_type).toBe(1);
    });

    it('should analyze performance impact', () => {
      const report = analytics.generateLegacyReport(trace);
      const perf = report.performanceImpact;

      expect(perf.totalConversions).toBe(3);
      expect(perf.maxTime).toBe(8.5);
      expect(perf.minTime).toBe(0.3);
      expect(perf.averageTime).toBeCloseTo(3.33, 2);
    });

    it('should prioritize actions for migration', () => {
      const report = analytics.generateLegacyReport(trace);
      const priorities = report.migrationPriority;

      expect(priorities.high).toHaveLength(2); // failed action + slow action
      expect(priorities.medium).toHaveLength(0);
      expect(priorities.low).toHaveLength(1); // fast action

      expect(priorities.high[0].reason).toBe('conversion_errors');
      expect(priorities.high[1].reason).toBe('slow_conversion');
    });

    it('should generate appropriate recommendations', () => {
      const report = analytics.generateLegacyReport(trace);
      const recommendations = report.recommendations;

      expect(recommendations).toHaveLength(3);
      
      const migrationRec = recommendations.find(r => r.type === 'migration_opportunity');
      expect(migrationRec).toBeDefined();
      expect(migrationRec.priority).toBe('medium');
      
      const performanceRec = recommendations.find(r => r.type === 'performance_concern');
      expect(performanceRec).toBeDefined();
      expect(performanceRec.priority).toBe('high');
      
      const reliabilityRec = recommendations.find(r => r.type === 'reliability_issue');
      expect(reliabilityRec).toBeDefined();
      expect(reliabilityRec.priority).toBe('high');
    });
  });

  describe('Edge Cases', () => {
    it('should handle trace with no legacy actions', () => {
      const emptyTrace = testBed.createActionAwareStructuredTrace({
        actorId: 'empty-actor'
      });

      const report = analytics.generateLegacyReport(emptyTrace);

      expect(report.overview.totalLegacyActions).toBe(0);
      expect(report.recommendations).toHaveLength(0);
    });

    it('should handle trace with only fast conversions', () => {
      trace.captureLegacyConversion('fast1', {
        isLegacy: true,
        originalAction: { targets: 'actor.items' },
        processingTime: 0.8
      });
      
      trace.captureLegacyConversion('fast2', {
        isLegacy: true,
        originalAction: { scope: 'actor.partners' },
        processingTime: 1.2
      });

      const report = analytics.generateLegacyReport(trace);

      expect(report.migrationPriority.high).toHaveLength(0);
      expect(report.migrationPriority.low).toHaveLength(2);
      
      const perfRecommendation = report.recommendations.find(r => r.type === 'performance_concern');
      expect(perfRecommendation).toBeUndefined();
    });
  });
});
```

## Testing Requirements

### Unit Tests Required

- [ ] ActionAwareStructuredTrace legacy trace capture methods
- [ ] Legacy analytics report generation
- [ ] Legacy processing summary calculation
- [ ] Legacy format detection and analysis
- [ ] Performance metrics capture for legacy conversions
- [ ] Error handling for failed legacy conversions

### Integration Tests Required

- [ ] MultiTargetResolutionStage with enhanced legacy tracing
- [ ] End-to-end legacy action processing with trace capture
- [ ] Mixed legacy and modern action workflows with comprehensive tracing
- [ ] Legacy trace data integration with existing pipeline stages

### Performance Tests Required

- [ ] Trace capture overhead measurement for legacy conversions
- [ ] Memory usage impact of enhanced legacy tracing
- [ ] Legacy analytics report generation performance
- [ ] Trace data filtering and verbosity level performance

## Acceptance Criteria

### Functional Requirements

- [ ] Enhanced ActionAwareStructuredTrace captures detailed legacy conversion data
- [ ] Legacy analytics utilities generate comprehensive reports
- [ ] MultiTargetResolutionStage integration captures legacy processing traces
- [ ] Existing LegacyTargetCompatibilityLayer functionality remains unchanged
- [ ] Legacy trace data provides migration planning insights
- [ ] Performance metrics captured for all legacy conversions

### Performance Requirements

- [ ] Zero performance degradation for existing legacy action processing
- [ ] Legacy trace capture overhead <1ms per conversion
- [ ] Efficient memory usage for legacy trace data storage
- [ ] Analytics report generation completes within acceptable time limits

### Quality Requirements

- [ ] 85% test coverage for new legacy tracing functionality
- [ ] All existing legacy action behavior preserved
- [ ] Comprehensive error handling in trace capture
- [ ] Legacy analytics provide actionable migration insights

## Dependencies

### Prerequisite Tickets

- ACTTRA-009: ActionAwareStructuredTrace class (Foundation)
- ACTTRA-010: ActionDiscoveryService enhancement (Service Integration)

### Related Systems

- Existing LegacyTargetCompatibilityLayer (no modifications required)
- MultiTargetResolutionStage for legacy conversion integration
- ActionAwareStructuredTrace for enhanced trace capture
- Action pipeline framework for trace integration

### External Dependencies

- No new external dependencies required
- Uses existing ActionAwareStructuredTrace infrastructure
- Leverages current LegacyTargetCompatibilityLayer implementation

## Effort Estimation

**Total Effort: 12 hours**

- ActionAwareStructuredTrace enhancements: 4 hours
- MultiTargetResolutionStage integration: 2 hours
- Legacy analytics utilities implementation: 3 hours
- Unit tests: 2 hours
- Integration tests: 1 hour

## Implementation Notes

### Integration Approach

- Work exclusively with existing LegacyTargetCompatibilityLayer
- No changes to legacy action processing behavior
- Trace capture adds visibility without modification
- Performance monitoring through enhanced tracing

### Analytics Strategy

- Generate actionable migration reports from trace data
- Identify performance bottlenecks in legacy conversions
- Provide migration priority recommendations
- Support data-driven legacy modernization decisions

### Backward Compatibility

- Zero impact on existing legacy action functionality
- Optional trace capture can be disabled via verbosity levels
- All enhancements are additive to existing systems
- Full compatibility with current ActionAwareStructuredTrace usage

This ticket enhances visibility into the existing robust legacy action support system, providing detailed tracing and analytics for migration planning without modifying any legacy processing behavior.
