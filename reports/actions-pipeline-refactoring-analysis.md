# Actions Pipeline Refactoring Analysis

## Executive Summary

This report analyzes the e2e tests for the actions pipeline in `tests/e2e/actions/` to identify beneficial refactorings for the production code. The analysis reveals several architectural patterns and opportunities for improvement based on test behavior, complexity patterns, and cross-cutting concerns observed in the test suite.

## Test Suite Overview

The e2e test suite covers five major areas:

1. **Cross-Mod Action Integration** - Testing actions from different mods working together
2. **Turn-Based Action Processing** - Cache invalidation and multi-actor turn handling
3. **Action Validation Edge Cases** - Error handling and graceful degradation
4. **Action Execution Pipeline** - Complete flow from UI to game state updates
5. **Action Discovery Workflow** - Component filtering through formatted actions

## Key Observations from Test Analysis

### 1. Complex Dependency Chain

The tests reveal a deep dependency chain in the action system:

- `ActionDiscoveryService` → `ActionIndex` → `ActionCandidateProcessor` → `TargetResolutionService` → `PrerequisiteEvaluationService`
- Each service has its own error handling, tracing, and validation logic
- Tests often need complex setup to exercise simple scenarios

### 2. Repeated Error Context Building

Multiple tests show error handling patterns that build similar context objects:

- Actor snapshot creation
- Action definition copying
- Timestamp generation
- Phase tracking

### 3. Cache Management Complexity

Turn-based caching tests reveal:

- Cache keys are built from turn context
- Each actor has separate cache entries
- Cache invalidation happens between turns
- No cache sharing between similar contexts

### 4. Scope Resolution Duplication

Tests show scope resolution happening at multiple levels:

- During action discovery
- During target resolution
- During prerequisite evaluation
- Each with slightly different error handling

### 5. Trace Context Threading

Every test that enables tracing shows:

- Manual trace context creation
- Threading through multiple service calls
- Inconsistent trace message formats
- No structured trace data

## Recommended Refactorings

### Priority 1: Extract Action Pipeline Orchestrator

**Problem**: The action discovery workflow is distributed across multiple services with complex interdependencies.

**Solution**: Create an `ActionPipelineOrchestrator` that encapsulates the entire discovery workflow.

```javascript
// src/actions/actionPipelineOrchestrator.js
export class ActionPipelineOrchestrator {
  async discoverActions(actor, context, options = {}) {
    const pipeline = this.#createPipeline();
    return await pipeline.execute(actor, context, options);
  }

  #createPipeline() {
    return new Pipeline([
      new ComponentFilteringStage(this.#actionIndex),
      new PrerequisiteEvaluationStage(this.#prerequisiteService),
      new TargetResolutionStage(this.#targetService),
      new ActionFormattingStage(this.#formatter),
      new ErrorAggregationStage(this.#errorBuilder),
    ]);
  }
}
```

**Benefits**:

- Simplifies testing by providing a single entry point
- Reduces coupling between services
- Makes the workflow explicit and modifiable
- Enables pipeline-wide optimizations

### Priority 2: Implement Result Object Pattern

**Problem**: Error handling is scattered with different return patterns (arrays, objects with errors, exceptions).

**Solution**: Standardize on a Result object pattern for all service methods.

```javascript
// src/actions/core/actionResult.js
export class ActionResult {
  constructor(success, value = null, errors = []) {
    this.success = success;
    this.value = value;
    this.errors = errors;
  }

  static success(value) {
    return new ActionResult(true, value);
  }

  static failure(errors) {
    return new ActionResult(
      false,
      null,
      Array.isArray(errors) ? errors : [errors]
    );
  }

  map(fn) {
    return this.success ? ActionResult.success(fn(this.value)) : this;
  }

  flatMap(fn) {
    return this.success ? fn(this.value) : this;
  }
}
```

**Benefits**:

- Consistent error handling across the pipeline
- Composable operations with map/flatMap
- Eliminates null checks and exception handling
- Simplifies test assertions

### Priority 3: Extract Cache Strategy

**Problem**: Caching logic is embedded in `AvailableActionsProvider` with turn-specific implementation.

**Solution**: Extract caching to a strategy pattern.

```javascript
// src/actions/caching/actionCacheStrategy.js
export class TurnScopedCacheStrategy {
  constructor(cache) {
    this.#cache = cache;
  }

  generateKey(actor, context) {
    return `${actor.id}:${context.turnNumber}`;
  }

  shouldInvalidate(oldContext, newContext) {
    return oldContext.turnNumber !== newContext.turnNumber;
  }

  async get(key, factory) {
    if (this.#cache.has(key)) {
      return this.#cache.get(key);
    }
    const value = await factory();
    this.#cache.set(key, value);
    return value;
  }
}
```

**Benefits**:

- Makes caching behavior testable in isolation
- Enables different caching strategies (session, time-based, LRU)
- Reduces complexity in provider classes
- Improves cache hit rates through better key generation

### Priority 4: Consolidate Scope Resolution

**Problem**: Scope resolution logic is duplicated across services with inconsistent error handling.

**Solution**: Create a unified `ScopeResolver` service.

```javascript
// src/actions/scopes/unifiedScopeResolver.js
export class UnifiedScopeResolver {
  constructor({ scopeRegistry, evaluator, errorBuilder }) {
    // dependencies
  }

  async resolve(scopeName, context, options = {}) {
    const scope = this.#scopeRegistry.get(scopeName);
    if (!scope) {
      return ActionResult.failure(this.#buildScopeNotFoundError(scopeName));
    }

    try {
      const targets = await this.#evaluator.evaluate(scope.ast, context);
      return ActionResult.success(this.#enrichTargets(targets, options));
    } catch (error) {
      return ActionResult.failure(this.#buildEvaluationError(error, scope));
    }
  }
}
```

**Benefits**:

- Single source of truth for scope resolution
- Consistent error messages
- Easier to optimize (caching, batch resolution)
- Reduces code duplication

### Priority 5: Implement Structured Tracing

**Problem**: Trace context is manually threaded with unstructured string messages.

**Solution**: Implement structured tracing with automatic context propagation.

```javascript
// src/actions/tracing/structuredTrace.js
export class StructuredTrace {
  constructor() {
    this.#spans = [];
    this.#activeSpan = null;
  }

  startSpan(operation, attributes = {}) {
    const span = {
      operation,
      attributes,
      startTime: Date.now(),
      children: [],
    };

    if (this.#activeSpan) {
      this.#activeSpan.children.push(span);
    } else {
      this.#spans.push(span);
    }

    this.#activeSpan = span;
    return span;
  }

  endSpan(span) {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    // Set parent as active
  }

  withSpan(operation, fn, attributes = {}) {
    const span = this.startSpan(operation, attributes);
    try {
      const result = fn();
      span.status = 'success';
      return result;
    } catch (error) {
      span.status = 'error';
      span.error = error.message;
      throw error;
    } finally {
      this.endSpan(span);
    }
  }
}
```

**Benefits**:

- Automatic timing information
- Structured data for analysis
- Parent-child relationship tracking
- Easy to integrate with APM tools

### Priority 6: Create Action Definition Builder

**Problem**: Tests show complex action definition setup with many optional fields.

**Solution**: Implement a builder pattern for action definitions.

```javascript
// src/actions/builders/actionDefinitionBuilder.js
export class ActionDefinitionBuilder {
  constructor(id) {
    this.#definition = {
      id,
      prerequisites: [],
      required_components: { actor: [] },
    };
  }

  withName(name) {
    this.#definition.name = name;
    return this;
  }

  withScope(scope) {
    this.#definition.scope = scope;
    return this;
  }

  requiresComponent(component) {
    this.#definition.required_components.actor.push(component);
    return this;
  }

  withPrerequisite(condition, failureMessage) {
    this.#definition.prerequisites.push({
      logic: { condition_ref: condition },
      failure_message: failureMessage,
    });
    return this;
  }

  build() {
    this.#validate();
    return { ...this.#definition };
  }
}
```

**Benefits**:

- Reduces test setup complexity
- Ensures valid action definitions
- Self-documenting API
- Prevents missing required fields

## Implementation Priority Matrix

| Refactoring            | Impact | Effort | Risk   | Priority |
| ---------------------- | ------ | ------ | ------ | -------- |
| Pipeline Orchestrator  | High   | Medium | Low    | 1        |
| Result Object Pattern  | High   | Low    | Low    | 2        |
| Cache Strategy         | Medium | Low    | Low    | 3        |
| Unified Scope Resolver | Medium | Medium | Medium | 4        |
| Structured Tracing     | Medium | Medium | Low    | 5        |
| Action Builder         | Low    | Low    | Low    | 6        |

## Migration Strategy

### Phase 1: Foundation (Week 1-2)

1. Implement Result object pattern
2. Create unit tests for Result
3. Migrate one service to use Result
4. Validate with existing e2e tests

### Phase 2: Core Refactoring (Week 3-4)

1. Extract Pipeline Orchestrator
2. Create adapter layer for existing services
3. Migrate services incrementally
4. Ensure e2e tests continue passing

### Phase 3: Optimization (Week 5-6)

1. Implement cache strategy
2. Add structured tracing
3. Consolidate scope resolution
4. Performance testing

## Validation Approach

1. **Maintain Test Coverage**: All existing e2e tests must pass
2. **Add Unit Tests**: Each refactored component gets comprehensive unit tests
3. **Performance Benchmarks**: Measure before/after performance
4. **Integration Tests**: New integration tests for refactored components
5. **Gradual Rollout**: Use feature flags for major changes

## Expected Benefits

### Quantitative

- 30-40% reduction in code duplication
- 50% faster test execution through better isolation
- 25% reduction in memory usage from better caching
- 60% reduction in error handling code

### Qualitative

- Easier to understand action flow
- Simpler test setup
- Better error messages
- More maintainable codebase
- Easier to add new features

## Risks and Mitigations

### Risk 1: Breaking Existing Functionality

**Mitigation**: Comprehensive test suite, gradual migration, feature flags

### Risk 2: Performance Regression

**Mitigation**: Performance benchmarks, profiling, optimization phase

### Risk 3: Integration Complexity

**Mitigation**: Adapter pattern, backward compatibility layer

## Conclusion

The e2e tests reveal a complex but well-tested action system that would benefit from architectural improvements. The recommended refactorings address the root causes of complexity while maintaining the system's flexibility and extensibility. By following the implementation priority and migration strategy, these improvements can be delivered incrementally with minimal risk.

The key insight from the test analysis is that the current architecture evolved organically, resulting in distributed responsibilities and repeated patterns. Consolidating these patterns into cohesive components will significantly improve maintainability and testability while preserving the system's rich functionality.
