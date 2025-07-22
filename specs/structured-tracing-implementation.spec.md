# Structured Tracing Implementation Specification

## Executive Summary

This specification details the implementation of structured tracing for the Living Narrative Engine's action pipeline system. The proposed solution enhances the existing `TraceContext` implementation to provide hierarchical span-based tracing with automatic performance metrics, while maintaining full backward compatibility.

## Problem Statement

The current tracing implementation has several limitations identified in the actions pipeline refactoring analysis:

1. **Manual Context Threading**: Trace context must be manually passed through every service call
2. **Flat Log Structure**: No parent-child relationships between operations
3. **No Automatic Timing**: Developers must manually calculate durations
4. **Inconsistent Formats**: Different services use different trace message formats
5. **Limited Analysis**: Difficult to identify performance bottlenecks or operation hierarchies

## Design Goals

1. **Backward Compatibility**: Existing `TraceContext` API must continue to work unchanged
2. **Automatic Metrics**: Timing and performance data collected automatically
3. **Hierarchical Structure**: Clear parent-child relationships between operations
4. **Zero Overhead**: Minimal performance impact when tracing is disabled
5. **Integration Friendly**: Easy to adopt in existing pipeline stages
6. **Analysis Ready**: Output suitable for performance analysis tools

## Proposed Solution

### Core Architecture

The solution introduces a new `StructuredTrace` class that wraps and extends the existing `TraceContext`:

```javascript
// src/actions/tracing/structuredTrace.js
export class StructuredTrace {
  constructor(traceContext = null) {
    this.#traceContext = traceContext || new TraceContext();
    this.#spans = [];
    this.#activeSpan = null;
    this.#spanIdCounter = 0;
  }

  // Backward compatible - delegates to wrapped TraceContext
  get logs() {
    return this.#traceContext.logs;
  }
  addLog(...args) {
    return this.#traceContext.addLog(...args);
  }
  info(...args) {
    return this.#traceContext.info(...args);
  }
  // ... other delegated methods
}
```

### Span-Based Tracking

Each operation is tracked as a "span" with automatic timing and hierarchy:

```javascript
export class Span {
  constructor(id, operation, parentId = null) {
    this.id = id;
    this.operation = operation;
    this.parentId = parentId;
    this.startTime = performance.now();
    this.endTime = null;
    this.duration = null;
    this.status = 'active';
    this.attributes = {};
    this.children = [];
    this.error = null;
  }
}
```

### Key APIs

#### 1. Manual Span Management

```javascript
// Start a new span
const span = trace.startSpan('ActionDiscovery', {
  actor: actorId,
  actionCount: candidateActions.length,
});

// End the span
trace.endSpan(span);
```

#### 2. Automatic Span Management

```javascript
// Synchronous operations
const result = trace.withSpan(
  'PrerequisiteEvaluation',
  () => {
    return evaluatePrerequisites(action);
  },
  { actionId: action.id }
);

// Asynchronous operations
const result = await trace.withSpanAsync(
  'TargetResolution',
  async () => {
    return await resolveTargets(action, context);
  },
  { scope: action.scope }
);
```

#### 3. Automatic Context Propagation

```javascript
// Current manual approach
async function serviceA(data, trace) {
  trace?.info('Starting service A', 'ServiceA');
  const result = await serviceB(data, trace);
  return result;
}

// New automatic approach
async function serviceA(data) {
  return trace.withSpanAsync('ServiceA', async () => {
    // trace context automatically available via async local storage
    const result = await serviceB(data);
    return result;
  });
}
```

### Performance Metrics Collection

The structured trace automatically collects:

1. **Duration**: Time taken for each operation
2. **Status**: Success, failure, or error
3. **Hierarchy**: Parent-child relationships
4. **Concurrency**: Parallel operation detection
5. **Critical Path**: Longest execution path identification

### Integration with Existing Pipeline

#### Pipeline Stage Enhancement

```javascript
// Enhanced PipelineStage base class
export class PipelineStage {
  async execute(context) {
    const { trace } = context;

    // Automatically wrap in span if structured trace
    if (trace?.withSpanAsync) {
      return trace.withSpanAsync(
        `${this.name}Stage`,
        async () => {
          return this.executeInternal(context);
        },
        { stage: this.name }
      );
    }

    // Fallback to original behavior
    return this.executeInternal(context);
  }
}
```

#### Migration Path

1. **Phase 1**: Introduce `StructuredTrace` with full backward compatibility
2. **Phase 2**: Update pipeline to use structured spans
3. **Phase 3**: Gradually migrate services to automatic context propagation
4. **Phase 4**: Add performance analysis tools

### Output Format

The structured trace provides multiple output formats:

#### 1. Hierarchical View

```javascript
trace.getHierarchicalView();
// Returns:
{
  operation: 'ActionDiscovery',
  duration: 145.3,
  status: 'success',
  children: [
    {
      operation: 'ComponentFiltering',
      duration: 12.1,
      status: 'success',
      attributes: { candidateCount: 15 }
    },
    {
      operation: 'PrerequisiteEvaluation',
      duration: 89.2,
      status: 'success',
      children: [
        {
          operation: 'JSONLogicEvaluation',
          duration: 45.6,
          status: 'success'
        }
      ]
    }
  ]
}
```

#### 2. Flat Logs (Backward Compatible)

```javascript
trace.logs; // Existing TraceContext logs array
```

#### 3. Performance Summary

```javascript
trace.getPerformanceSummary();
// Returns:
{
  totalDuration: 145.3,
  operationCount: 8,
  criticalPath: ['ActionDiscovery', 'PrerequisiteEvaluation', 'JSONLogicEvaluation'],
  slowestOperations: [
    { operation: 'PrerequisiteEvaluation', duration: 89.2 },
    { operation: 'JSONLogicEvaluation', duration: 45.6 }
  ],
  errorCount: 0
}
```

### Error Handling Integration

Structured traces capture errors with full context:

```javascript
trace.withSpan('RiskyOperation', () => {
  throw new Error('Something went wrong');
});
// Automatically captures:
// - Error message and stack
// - Operation context
// - Timing up to failure point
```

### Performance Considerations

1. **Lazy Evaluation**: Metrics calculated only when requested
2. **Memory Efficiency**: Configurable span retention limits
3. **Conditional Activation**: No overhead when tracing disabled
4. **Batch Processing**: Efficient span storage and retrieval

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)

1. Implement `StructuredTrace` class
2. Implement `Span` class
3. Add delegation to existing `TraceContext`
4. Create comprehensive unit tests

### Phase 2: Pipeline Integration (Week 2)

1. Update `PipelineStage` base class
2. Modify `Pipeline` to support structured traces
3. Update error context builder
4. Maintain backward compatibility

### Phase 3: Service Migration (Week 3-4)

1. Migrate pipeline stages one by one
2. Add performance metrics collection
3. Implement output formatters
4. Create integration tests

### Phase 4: Analysis Tools (Week 5)

1. Implement performance analysis utilities
2. Add trace visualization helpers
3. Create debugging tools
4. Document best practices

## Testing Strategy

### Unit Tests

- Test span creation and lifecycle
- Test automatic timing calculations
- Test hierarchy management
- Test error capture
- Test backward compatibility

### Integration Tests

- Test full pipeline with structured tracing
- Test performance impact
- Test memory usage
- Test concurrent operations

### Performance Tests

- Benchmark with/without tracing
- Memory usage analysis
- Large operation tree handling

## Migration Guide

### For Pipeline Stages

```javascript
// Before
async execute(context) {
  const { trace } = context;
  trace?.step('Starting evaluation', 'MyStage');

  try {
    const result = await this.evaluate(context);
    trace?.success('Evaluation complete', 'MyStage');
    return result;
  } catch (error) {
    trace?.error('Evaluation failed', 'MyStage', { error });
    throw error;
  }
}

// After
async execute(context) {
  const { trace } = context;

  return trace.withSpanAsync('MyStageEvaluation', async () => {
    return await this.evaluate(context);
  }, { stage: this.name });
}
```

### For Services

```javascript
// Before
async processAction(action, context, trace) {
  trace?.info(`Processing ${action.id}`, 'ActionProcessor');
  // ... processing logic
}

// After
async processAction(action, context) {
  return getCurrentTrace().withSpanAsync('ProcessAction', async () => {
    // ... processing logic
  }, { actionId: action.id });
}
```

## Success Metrics

1. **Performance Visibility**: Identify slow operations within 2 clicks
2. **Adoption Rate**: 80% of pipeline stages using structured spans within 1 month
3. **Performance Impact**: <2% overhead with tracing enabled
4. **Developer Satisfaction**: Reduced debugging time by 50%

## Risks and Mitigations

### Risk 1: Breaking Changes

**Mitigation**: Full backward compatibility via delegation pattern

### Risk 2: Performance Overhead

**Mitigation**: Lazy evaluation and configurable retention

### Risk 3: Memory Usage

**Mitigation**: Span limits and cleanup strategies

### Risk 4: Adoption Resistance

**Mitigation**: Gradual migration and clear benefits demonstration

## Future Enhancements

1. **Distributed Tracing**: Support for cross-service traces
2. **Sampling**: Intelligent trace sampling for production
3. **Export Formats**: OpenTelemetry, Jaeger compatibility
4. **Real-time Monitoring**: Live trace streaming
5. **AI-Powered Analysis**: Automatic bottleneck detection

## Conclusion

This structured tracing implementation provides a powerful upgrade to the existing trace system while maintaining full backward compatibility. It addresses all issues identified in the refactoring analysis and provides a foundation for advanced performance analysis and debugging capabilities.
