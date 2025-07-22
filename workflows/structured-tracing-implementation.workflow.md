# Structured Tracing Implementation Workflow

## Overview

This workflow guides the implementation of structured tracing for the Living Narrative Engine's action pipeline system. The implementation enhances the existing `TraceContext` with hierarchical span-based tracing while maintaining full backward compatibility.

## Prerequisites

- Understanding of the current `TraceContext` implementation
- Familiarity with the action pipeline architecture
- Knowledge of the ECS system and event bus
- Review of the structured tracing specification (`/specs/structured-tracing-implementation.spec.md`)

## Phase 1: Core Infrastructure (Days 1-3)

### 1.1 Create Span Class

**File**: `src/actions/tracing/span.js`

**Tasks**:

1. Create the `Span` class with the following properties:
   - `id` (number)
   - `operation` (string)
   - `parentId` (number | null)
   - `startTime` (number from performance.now())
   - `endTime` (number | null)
   - `duration` (number | null)
   - `status` ('active' | 'success' | 'failure' | 'error')
   - `attributes` (object)
   - `children` (array)
   - `error` (Error | null)

2. Implement core methods:
   - `end()` - Sets endTime and calculates duration
   - `setStatus(status)` - Updates span status
   - `setAttribute(key, value)` - Adds attributes
   - `setError(error)` - Captures error information
   - `addChild(childSpan)` - Manages hierarchy

**Acceptance Criteria**:

- Span accurately tracks timing using `performance.now()`
- Span maintains parent-child relationships
- Span captures error states appropriately
- All properties are properly encapsulated

**Testing**:

```javascript
// tests/unit/actions/tracing/span.test.js
- Test span creation with all properties
- Test timing calculations
- Test status transitions
- Test error capture
- Test parent-child relationships
```

### 1.2 Create StructuredTrace Class

**File**: `src/actions/tracing/structuredTrace.js`

**Tasks**:

1. Create `StructuredTrace` class that wraps `TraceContext`
2. Implement delegation pattern for backward compatibility:

   ```javascript
   get logs() { return this.#traceContext.logs; }
   addLog(...args) { return this.#traceContext.addLog(...args); }
   info(...args) { return this.#traceContext.info(...args); }
   // ... other delegated methods
   ```

3. Implement span management:
   - `startSpan(operation, attributes)` - Creates and tracks new span
   - `endSpan(span)` - Ends span and updates hierarchy
   - `withSpan(operation, fn, attributes)` - Synchronous span wrapper
   - `withSpanAsync(operation, asyncFn, attributes)` - Async span wrapper

4. Implement analysis methods:
   - `getHierarchicalView()` - Returns nested span structure
   - `getPerformanceSummary()` - Returns performance metrics
   - `getCriticalPath()` - Identifies longest execution path

**Acceptance Criteria**:

- Full backward compatibility with `TraceContext` API
- Automatic span lifecycle management
- Accurate hierarchy tracking
- Performance metrics calculation

**Testing**:

```javascript
// tests/unit/actions/tracing/structuredTrace.test.js
- Test backward compatibility (all TraceContext methods work)
- Test span creation and management
- Test automatic timing
- Test hierarchy building
- Test error handling in spans
- Test performance summary generation
```

### 1.3 Update Type Definitions

**Tasks**:

1. Add JSDoc type definitions for new classes
2. Update existing type imports where needed
3. Document all public APIs

**Files to update**:

- `src/actions/tracing/span.js` (add comprehensive JSDoc)
- `src/actions/tracing/structuredTrace.js` (add comprehensive JSDoc)
- Create `src/actions/tracing/types.js` for shared types

### Phase 1 Validation Checkpoint

Before proceeding to Phase 2:

- [ ] All unit tests pass with 100% coverage
- [ ] Backward compatibility verified
- [ ] Performance benchmarks established
- [ ] Code review completed
- [ ] Documentation updated

## Phase 2: Pipeline Integration (Days 4-6)

### 2.1 Enhance PipelineStage Base Class

**File**: `src/actions/pipeline/PipelineStage.js`

**Tasks**:

1. Add `executeInternal` abstract method
2. Modify `execute` to wrap with span if available:

   ```javascript
   async execute(context) {
     const { trace } = context;

     if (trace?.withSpanAsync) {
       return trace.withSpanAsync(
         `${this.name}Stage`,
         async () => {
           return this.executeInternal(context);
         },
         { stage: this.name }
       );
     }

     return this.executeInternal(context);
   }
   ```

3. Update all existing stages to use `executeInternal` instead of `execute`

**Files to update**:

- `src/actions/pipeline/stages/ActionFormattingStage.js`
- `src/actions/pipeline/stages/ComponentFilteringStage.js`
- `src/actions/pipeline/stages/PrerequisiteEvaluationStage.js`
- `src/actions/pipeline/stages/TargetResolutionStage.js`

**Acceptance Criteria**:

- No breaking changes to existing pipeline behavior
- Automatic span creation when StructuredTrace is used
- Graceful fallback when regular TraceContext is used

### 2.2 Update Pipeline Class

**File**: `src/actions/pipeline/Pipeline.js`

**Tasks**:

1. Add span tracking for overall pipeline execution
2. Enhance error handling to capture spans
3. Add performance metrics collection

**Code changes**:

```javascript
async execute(initialContext) {
  const { trace } = initialContext;

  // If structured trace, wrap entire pipeline
  if (trace?.withSpanAsync) {
    return trace.withSpanAsync(
      'Pipeline',
      async () => {
        return this.#executePipeline(initialContext);
      },
      { stageCount: this.#stages.length }
    );
  }

  return this.#executePipeline(initialContext);
}
```

### 2.3 Integration Tests

**File**: `tests/integration/actions/pipeline/structuredTracePipeline.test.js`

**Test scenarios**:

1. Full pipeline execution with structured tracing
2. Pipeline with stage failures
3. Performance metrics accuracy
4. Backward compatibility with regular TraceContext
5. Memory usage under load

### Phase 2 Validation Checkpoint

- [ ] All pipeline stages updated
- [ ] Integration tests passing
- [ ] No performance regression
- [ ] Backward compatibility maintained
- [ ] Error scenarios handled correctly

## Phase 3: Service Migration (Days 7-12)

### 3.1 Identify Services for Migration

**Analysis Tasks**:

1. Audit all services that use TraceContext
2. Prioritize by:
   - Frequency of use
   - Performance impact
   - Complexity of operations

**Priority Services**:

1. `PrerequisiteEvaluationService`
2. `TargetResolutionService`
3. `ActionDiscoveryService`
4. `UnifiedScopeResolver`
5. `ActionCandidateProcessor`

### 3.2 Migration Pattern

For each service, follow this pattern:

**Before**:

```javascript
async processAction(action, context, trace) {
  trace?.info(`Processing ${action.id}`, 'ActionProcessor');

  try {
    // ... processing logic
    trace?.success('Processing complete', 'ActionProcessor');
  } catch (error) {
    trace?.error('Processing failed', 'ActionProcessor', { error });
    throw error;
  }
}
```

**After**:

```javascript
async processAction(action, context, trace) {
  // Support both old and new trace APIs
  if (trace?.withSpanAsync) {
    return trace.withSpanAsync(
      'ProcessAction',
      async () => {
        // ... processing logic
        return result;
      },
      { actionId: action.id }
    );
  }

  // Fallback to original implementation
  trace?.info(`Processing ${action.id}`, 'ActionProcessor');
  try {
    // ... processing logic
    trace?.success('Processing complete', 'ActionProcessor');
  } catch (error) {
    trace?.error('Processing failed', 'ActionProcessor', { error });
    throw error;
  }
}
```

### 3.3 Service Migration Schedule

**Day 7-8**: Prerequisite and Target Resolution Services

- Update `PrerequisiteEvaluationService`
- Update `TargetResolutionService`
- Add unit tests for both trace modes

**Day 9-10**: Discovery Services

- Update `ActionDiscoveryService`
- Update `ActionCandidateProcessor`
- Integration tests for discovery flow

**Day 11-12**: Scope and Utility Services

- Update `UnifiedScopeResolver`
- Update error handling services
- Complete integration testing

### Phase 3 Validation Checkpoint

- [ ] All priority services migrated
- [ ] Dual-mode support verified
- [ ] No breaking changes
- [ ] Performance benchmarks positive
- [ ] Test coverage maintained

## Phase 4: Analysis Tools (Days 13-15)

### 4.1 Create Trace Analysis Utilities

**File**: `src/actions/tracing/traceAnalyzer.js`

**Features**:

1. Critical path analysis
2. Bottleneck detection
3. Operation frequency analysis
4. Error rate calculation
5. Concurrency visualization

**API**:

```javascript
class TraceAnalyzer {
  constructor(structuredTrace) {}

  getCriticalPath() {}
  getBottlenecks(threshold = 100) {}
  getOperationStats() {}
  getErrorAnalysis() {}
  getConcurrencyProfile() {}
}
```

### 4.2 Create Development Tools

**File**: `src/actions/tracing/traceVisualizer.js`

**Features**:

1. Console-based hierarchy display
2. Timing waterfall visualization
3. Error highlighting
4. Performance warnings

### 4.3 Create Performance Monitoring Hook

**File**: `src/actions/tracing/performanceMonitor.js`

**Features**:

1. Real-time performance alerts
2. Threshold-based warnings
3. Automatic trace sampling
4. Memory usage tracking

### Phase 4 Validation Checkpoint

- [ ] Analysis tools tested
- [ ] Visualization accurate
- [ ] Performance monitoring working
- [ ] Documentation complete
- [ ] Examples provided

## Phase 5: Documentation & Training (Days 16-17)

### 5.1 Update Documentation

**Files to update**:

1. `README.md` - Add structured tracing section
2. `docs/tracing/structured-tracing-guide.md` - Complete guide
3. `docs/tracing/migration-guide.md` - Service migration guide
4. `docs/tracing/performance-analysis.md` - Using analysis tools

### 5.2 Create Examples

**Location**: `examples/tracing/`

1. Basic span usage
2. Pipeline integration
3. Service migration
4. Performance analysis
5. Custom span attributes

### 5.3 Performance Benchmarks

**File**: `benchmarks/tracing-performance.js`

Benchmark scenarios:

1. Overhead with tracing disabled
2. Overhead with tracing enabled
3. Memory usage patterns
4. Large operation trees
5. Concurrent operations

## Rollback Procedures

### Phase 1 Rollback

- Remove new files
- No impact on existing code

### Phase 2 Rollback

- Revert PipelineStage changes
- Revert Pipeline changes
- Tests will ensure compatibility

### Phase 3 Rollback

- Services have dual-mode support
- Can disable structured trace usage via configuration
- No code changes needed

### Phase 4 Rollback

- Analysis tools are additive
- No impact on core functionality

## Risk Mitigation

### Performance Risks

- **Mitigation**: Lazy evaluation, configurable limits
- **Monitoring**: Benchmark before/after each phase
- **Fallback**: Feature flags for gradual rollout

### Memory Risks

- **Mitigation**: Span retention limits, cleanup strategies
- **Monitoring**: Memory profiling in tests
- **Fallback**: Configurable span limits

### Adoption Risks

- **Mitigation**: Backward compatibility, gradual migration
- **Monitoring**: Usage metrics, developer feedback
- **Fallback**: Dual-mode support indefinitely

## Success Metrics

### Technical Metrics

- [ ] <2% performance overhead
- [ ] 100% backward compatibility
- [ ] > 90% test coverage
- [ ] Zero breaking changes

### Adoption Metrics

- [ ] 80% of pipeline stages using structured spans (1 month)
- [ ] 50% reduction in debugging time
- [ ] Positive developer feedback

### Quality Metrics

- [ ] All critical paths identified
- [ ] Performance bottlenecks visible
- [ ] Error context improved

## Post-Implementation Tasks

1. Monitor production usage
2. Gather developer feedback
3. Plan future enhancements:
   - Distributed tracing support
   - OpenTelemetry export
   - Real-time monitoring dashboard
   - AI-powered analysis

## Conclusion

This workflow provides a systematic approach to implementing structured tracing while maintaining system stability and backward compatibility. Each phase builds on the previous one, with clear validation checkpoints and rollback procedures.

The implementation will significantly improve debugging capabilities, performance visibility, and system observability without disrupting existing functionality.
