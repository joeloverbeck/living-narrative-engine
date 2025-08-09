# ACTTRA-018: Pipeline Stage Performance Metrics

## Executive Summary

Enhance the existing action tracing framework with lightweight performance metrics collection for pipeline stages. This ticket leverages the existing `PerformanceMonitor` class and `ActionAwareStructuredTrace` capture system to add timing data to pipeline stage execution, enabling performance analysis without introducing complex new infrastructure.

## Technical Requirements

### Core Objectives

- Capture timing data for pipeline stage execution using existing trace infrastructure
- Leverage existing `PerformanceMonitor` for performance tracking and alerts
- Enhance `ActionAwareStructuredTrace` capture methods with timing data
- Provide performance analysis through trace data aggregation
- Maintain minimal overhead by using existing systems
- Enable performance trend analysis using captured trace data

### Performance Requirements

- Use browser's native `performance.now()` for timing
- Leverage existing performance monitoring thresholds
- Minimal additional memory overhead (reuse existing structures)
- No new dependencies or complex infrastructure

### Compatibility Requirements

- Work within existing ECS and event-driven architecture
- Use existing dependency injection patterns
- Maintain compatibility with current pipeline stages
- Integrate with existing trace capture system

## Architecture Design

### Leveraging Existing Infrastructure

The implementation builds on existing systems:

1. **PerformanceMonitor** (`src/actions/tracing/performanceMonitor.js`)
   - Already provides performance tracking
   - Has threshold management and alerting
   - Monitors memory usage and execution time

2. **ActionAwareStructuredTrace** (`src/actions/tracing/actionAwareStructuredTrace.js`)
   - Already captures stage execution data
   - Has enhanced capture methods from ACTTRA-017
   - Provides trace context to pipeline stages

3. **PipelineStage** (`src/actions/pipeline/PipelineStage.js`)
   - Base class for all pipeline stages
   - Receives trace context in execute method
   - Can capture performance data through trace

## Implementation Steps

### Step 1: Enhance ActionAwareStructuredTrace with Performance Timing

**File**: `src/actions/tracing/actionAwareStructuredTrace.js` (Enhancement)

```javascript
// Add to existing captureActionData method
captureActionData(stage, actionId, data) {
  // Existing capture logic...
  
  // Add performance timing if not already present
  const enhancedData = {
    ...data,
    _performance: {
      captureTime: performance.now(),
      stage: stage,
      actionId: actionId
    }
  };
  
  // Use existing capture mechanism
  if (!this.tracedActions[actionId]) {
    this.tracedActions[actionId] = {};
  }
  
  if (!this.tracedActions[actionId][stage]) {
    this.tracedActions[actionId][stage] = [];
  }
  
  this.tracedActions[actionId][stage].push(enhancedData);
  
  // If performance monitor is available, track the operation
  if (this.performanceMonitor) {
    this.performanceMonitor.trackOperation(
      `stage_${stage}`,
      enhancedData._performance.captureTime
    );
  }
}

// Add method to calculate stage performance from captured data
calculateStagePerformance(actionId) {
  const action = this.tracedActions[actionId];
  if (!action) return null;
  
  const stageTimings = {};
  let previousTime = null;
  
  // Calculate duration between stages
  Object.keys(action).forEach(stage => {
    const captures = action[stage];
    if (captures.length > 0 && captures[0]._performance) {
      const stageTime = captures[0]._performance.captureTime;
      
      if (previousTime !== null) {
        stageTimings[stage] = {
          startTime: previousTime,
          endTime: stageTime,
          duration: stageTime - previousTime
        };
      }
      
      previousTime = stageTime;
    }
  });
  
  return stageTimings;
}
```

### Step 2: Add Performance Timing to Pipeline Stages

**File**: Update existing pipeline stages to capture timing

Each pipeline stage already extends `PipelineStage` and implements `executeInternal`. We'll add timing capture:

```javascript
// Example for ComponentFilteringStage.js
async executeInternal(context) {
  const startTime = performance.now();
  const { trace, actionDef } = context;
  
  try {
    // Existing stage logic...
    const result = await this.performFiltering(context);
    
    const endTime = performance.now();
    
    // Capture performance data if trace supports it
    if (trace && trace.captureActionData) {
      trace.captureActionData('stage_performance', actionDef.id, {
        stage: 'component_filtering',
        duration: endTime - startTime,
        timestamp: Date.now(),
        itemsProcessed: result.components ? result.components.length : 0
      });
    }
    
    return result;
  } catch (error) {
    const endTime = performance.now();
    
    // Capture error performance data
    if (trace && trace.captureActionData) {
      trace.captureActionData('stage_error', actionDef.id, {
        stage: 'component_filtering',
        duration: endTime - startTime,
        error: error.message,
        timestamp: Date.now()
      });
    }
    
    throw error;
  }
}
```

### Step 3: Create Lightweight Performance Analyzer

**File**: `src/actions/tracing/pipelinePerformanceAnalyzer.js`

```javascript
/**
 * @file Lightweight performance analyzer for pipeline traces
 */

import { validateDependency } from '../../dependencyInjection/dependencyUtils.js';

class PipelinePerformanceAnalyzer {
  constructor({ performanceMonitor, logger }) {
    validateDependency(performanceMonitor, 'performanceMonitor', null, {
      requiredMethods: ['checkThreshold', 'recordMetric']
    });
    validateDependency(logger, 'logger', null, {
      requiredMethods: ['debug', 'warn', 'error']
    });
    
    this.performanceMonitor = performanceMonitor;
    this.logger = logger;
    
    // Performance thresholds per stage (in milliseconds)
    this.stageThresholds = {
      component_filtering: 100,
      prerequisite_evaluation: 200,
      multi_target_resolution: 500,
      action_formatting: 150,
      pipeline_total: 1000
    };
  }
  
  analyzeTracePerformance(trace) {
    if (!trace || !trace.getTracedActions) {
      return { error: 'Invalid trace provided' };
    }
    
    const tracedActions = trace.getTracedActions();
    const analysis = {
      actions: {},
      stages: {},
      totalDuration: 0,
      bottlenecks: [],
      recommendations: []
    };
    
    // Analyze each action's performance
    Object.keys(tracedActions).forEach(actionId => {
      const stagePerformance = trace.calculateStagePerformance(actionId);
      
      if (stagePerformance) {
        analysis.actions[actionId] = stagePerformance;
        
        // Aggregate stage statistics
        Object.keys(stagePerformance).forEach(stage => {
          if (!analysis.stages[stage]) {
            analysis.stages[stage] = {
              count: 0,
              totalDuration: 0,
              avgDuration: 0,
              maxDuration: 0,
              violations: 0
            };
          }
          
          const stageStat = analysis.stages[stage];
          const duration = stagePerformance[stage].duration;
          
          stageStat.count++;
          stageStat.totalDuration += duration;
          stageStat.avgDuration = stageStat.totalDuration / stageStat.count;
          stageStat.maxDuration = Math.max(stageStat.maxDuration, duration);
          
          // Check threshold violations
          const threshold = this.stageThresholds[stage];
          if (threshold && duration > threshold) {
            stageStat.violations++;
            
            // Use existing performance monitor for alerts
            this.performanceMonitor.checkThreshold(
              `stage_${stage}`,
              duration,
              threshold
            );
          }
        });
      }
    });
    
    // Identify bottlenecks
    Object.keys(analysis.stages).forEach(stage => {
      const stageStat = analysis.stages[stage];
      analysis.totalDuration += stageStat.totalDuration;
      
      if (stageStat.violations > 0) {
        analysis.bottlenecks.push({
          stage: stage,
          avgDuration: stageStat.avgDuration,
          violations: stageStat.violations,
          threshold: this.stageThresholds[stage]
        });
      }
    });
    
    // Sort bottlenecks by impact
    analysis.bottlenecks.sort((a, b) => b.avgDuration - a.avgDuration);
    
    // Generate recommendations
    if (analysis.bottlenecks.length > 0) {
      const topBottleneck = analysis.bottlenecks[0];
      analysis.recommendations.push({
        priority: 'high',
        stage: topBottleneck.stage,
        message: `Optimize ${topBottleneck.stage} - averaging ${topBottleneck.avgDuration.toFixed(2)}ms (threshold: ${topBottleneck.threshold}ms)`
      });
    }
    
    // Check total pipeline duration
    if (analysis.totalDuration > this.stageThresholds.pipeline_total) {
      analysis.recommendations.push({
        priority: 'medium',
        message: `Total pipeline duration (${analysis.totalDuration.toFixed(2)}ms) exceeds threshold (${this.stageThresholds.pipeline_total}ms)`
      });
    }
    
    return analysis;
  }
  
  generatePerformanceReport(trace) {
    const analysis = this.analyzeTracePerformance(trace);
    
    const report = {
      summary: {
        totalActions: Object.keys(analysis.actions).length,
        totalDuration: analysis.totalDuration,
        stageCount: Object.keys(analysis.stages).length,
        bottleneckCount: analysis.bottlenecks.length
      },
      stages: analysis.stages,
      bottlenecks: analysis.bottlenecks,
      recommendations: analysis.recommendations,
      timestamp: new Date().toISOString()
    };
    
    // Log performance summary
    this.logger.debug('Pipeline performance report:', report);
    
    // Record metrics using existing performance monitor
    Object.keys(analysis.stages).forEach(stage => {
      const stageStat = analysis.stages[stage];
      this.performanceMonitor.recordMetric(
        `pipeline.stage.${stage}.avg_duration`,
        stageStat.avgDuration
      );
    });
    
    return report;
  }
}

export default PipelinePerformanceAnalyzer;
```

### Step 4: Integration with Existing PerformanceMonitor

The existing `PerformanceMonitor` class already provides:
- Real-time performance tracking
- Memory usage monitoring
- Alert generation for slow operations
- Sampling and throttling capabilities

We'll use it directly rather than creating new infrastructure:

```javascript
// In ActionAwareStructuredTrace constructor
constructor({ actionTraceFilter, actorId, context, logger, traceContext, traceConfig }) {
  // Existing constructor logic...
  
  // Optional performance monitor integration
  if (traceConfig?.enablePerformanceTracking) {
    this.performanceMonitor = new PerformanceMonitor({
      logger: logger,
      alertThreshold: traceConfig.performanceAlertThreshold || 1000,
      samplingRate: traceConfig.performanceSamplingRate || 1.0
    });
  }
}
```

## Testing Requirements

### Unit Tests Required

- [ ] Performance timing capture in ActionAwareStructuredTrace
- [ ] Stage performance calculation from trace data
- [ ] PipelinePerformanceAnalyzer analysis methods
- [ ] Bottleneck identification logic
- [ ] Integration with existing PerformanceMonitor

### Integration Tests Required

- [ ] End-to-end pipeline execution with performance tracking
- [ ] Performance data capture across all pipeline stages
- [ ] Alert generation for threshold violations
- [ ] Performance report generation from real traces

## Acceptance Criteria

### Functional Requirements

- [ ] Performance timing captured for all pipeline stages
- [ ] Timing data integrated into existing trace captures
- [ ] Performance analysis available from trace data
- [ ] Bottleneck identification working correctly
- [ ] Integration with existing PerformanceMonitor functional

### Performance Requirements

- [ ] Minimal overhead using native browser APIs
- [ ] No significant memory increase (reusing existing structures)
- [ ] No new dependencies or complex infrastructure

### Quality Requirements

- [ ] Tests passing for all modifications
- [ ] No regression in existing functionality
- [ ] Clear performance reports from trace data

## Dependencies

### Existing Systems to Leverage

- `src/actions/tracing/performanceMonitor.js` - Existing performance monitoring
- `src/actions/tracing/actionAwareStructuredTrace.js` - Trace capture system
- `src/actions/pipeline/PipelineStage.js` - Base pipeline stage class
- All pipeline stage implementations (ComponentFilteringStage, etc.)

### No New Dependencies Required

This implementation uses only existing infrastructure and browser-native APIs.

## Effort Estimation

**Total Effort: 8 hours**

- Enhance ActionAwareStructuredTrace: 2 hours
- Update pipeline stages with timing: 2 hours
- Create PipelinePerformanceAnalyzer: 2 hours
- Unit and integration tests: 2 hours

## Implementation Notes

### Key Advantages of This Approach

1. **Minimal Complexity**: Uses existing infrastructure rather than creating new systems
2. **Browser-Compatible**: Uses `performance.now()` instead of Node.js-specific APIs
3. **Low Overhead**: Piggybacks on existing trace capture mechanism
4. **Maintainable**: Follows existing patterns in the codebase
5. **Testable**: Can use existing test infrastructure

### Integration Points

1. **ActionAwareStructuredTrace**: Enhanced capture with timing data
2. **Pipeline Stages**: Simple timing additions to executeInternal
3. **PerformanceMonitor**: Existing alerts and threshold management
4. **Event Bus**: Can dispatch performance events using existing system

### Future Enhancements

Once this lightweight system is in place, future enhancements could include:
- More detailed memory tracking if needed
- Historical performance trending
- Comparative analysis between trace executions
- Advanced bottleneck prediction

This approach provides the required performance metrics functionality while working within the existing architecture and avoiding unnecessary complexity.