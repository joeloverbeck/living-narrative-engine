# Unified Scope Resolver Consolidation Specification

## Overview

This specification outlines the implementation of a UnifiedScopeResolver service to consolidate scope resolution logic currently embedded in the TargetResolutionService. This refactoring addresses the need for consistent error handling, improved caching, and a single source of truth for scope resolution across the Living Narrative Engine.

## Current State Analysis

### Existing Implementation

Scope resolution is currently handled by `TargetResolutionService` which:
- Resolves scope names to entity IDs using the ScopeEngine
- Handles special scopes ("none", "self") 
- Builds runtime contexts for scope evaluation
- Uses ActionResult pattern for error handling (already implemented)
- Integrates with ActionErrorContextBuilder for enhanced error contexts

### Identified Issues

1. **Complex Error Handling**: Mix of ActionResult pattern and legacy error handling
2. **No Caching**: Each scope resolution performs full evaluation
3. **Tight Coupling**: Scope resolution logic is embedded within target resolution
4. **Limited Reusability**: Other services cannot easily leverage scope resolution

## Proposed Solution

### UnifiedScopeResolver Service

Create a dedicated service that encapsulates all scope resolution logic with the following responsibilities:

```javascript
// src/actions/scopes/unifiedScopeResolver.js
export class UnifiedScopeResolver {
  constructor({
    scopeRegistry,
    scopeEngine,
    entityManager,
    jsonLogicEvaluationService,
    dslParser,
    logger,
    actionErrorContextBuilder,
    cacheStrategy, // New: pluggable caching
  }) {
    // Dependencies
  }

  /**
   * Resolves a scope to entity IDs with consistent error handling
   * @param {string} scopeName - The scope to resolve
   * @param {ScopeResolutionContext} context - Resolution context
   * @param {ScopeResolutionOptions} options - Resolution options
   * @returns {ActionResult<Set<string>>} Resolved entity IDs or errors
   */
  async resolve(scopeName, context, options = {}) {
    // Implementation
  }

  /**
   * Batch resolves multiple scopes efficiently
   * @param {Array<{scopeName: string, context: ScopeResolutionContext}>} requests
   * @returns {ActionResult<Map<string, Set<string>>>} Map of scope names to entity IDs
   */
  async resolveBatch(requests) {
    // Implementation with optimized batch processing
  }
}
```

### Key Design Decisions

#### 1. Unified Resolution Context

```javascript
/**
 * @typedef {Object} ScopeResolutionContext
 * @property {Entity} actor - The entity performing the action
 * @property {string} actorLocation - Current location of the actor
 * @property {ActionContext} actionContext - Full action context for evaluation
 * @property {TraceContext} [trace] - Optional trace for debugging
 * @property {string} [actionId] - Optional action ID for error context
 */
```

#### 2. Resolution Options

```javascript
/**
 * @typedef {Object} ScopeResolutionOptions
 * @property {boolean} [useCache=true] - Whether to use cached results
 * @property {number} [cacheTTL=5000] - Cache time-to-live in milliseconds
 * @property {boolean} [includeMetadata=false] - Include resolution metadata
 * @property {boolean} [validateEntities=true] - Validate resolved entities exist
 */
```

#### 3. Enhanced Error Context

All errors will include:
- Scope name that failed
- Actor information
- Resolution phase (parsing, evaluation, validation)
- Suggested fixes when applicable
- Full trace information

### Implementation Details

#### Special Scope Handling

```javascript
#handleSpecialScopes(scopeName, context) {
  switch (scopeName) {
    case TARGET_DOMAIN_NONE:
      return ActionResult.success(new Set());
    
    case TARGET_DOMAIN_SELF:
      return ActionResult.success(new Set([context.actor.id]));
    
    default:
      return null; // Not a special scope
  }
}
```

#### Caching Strategy

```javascript
export class ScopeCacheStrategy {
  constructor(cache) {
    this.#cache = cache;
  }

  generateKey(scopeName, context) {
    // Generate cache key based on scope name, actor ID, and location
    return `${scopeName}:${context.actor.id}:${context.actorLocation}`;
  }

  async get(key, factory) {
    if (this.#cache.has(key)) {
      const cached = this.#cache.get(key);
      if (!this.isExpired(cached)) {
        return ActionResult.success(cached.value);
      }
    }
    
    const result = await factory();
    if (result.success) {
      this.#cache.set(key, {
        value: result.value,
        timestamp: Date.now()
      });
    }
    return result;
  }
}
```

#### Error Recovery

```javascript
#buildEnhancedError(error, scopeName, context) {
  const errorContext = this.#actionErrorContextBuilder.buildErrorContext({
    error: error,
    actionDef: context.actionId ? { id: context.actionId } : null,
    actorId: context.actor.id,
    phase: ERROR_PHASES.SCOPE_RESOLUTION,
    trace: context.trace,
    additionalContext: {
      scopeName: scopeName,
      actorLocation: context.actorLocation,
      scopeExpression: this.#getScopeExpression(scopeName),
      suggestions: this.#generateFixSuggestions(error, scopeName)
    }
  });
  
  return ActionResult.failure(errorContext);
}
```

## Migration Strategy

### Phase 1: Create UnifiedScopeResolver (Week 1)

1. **Implement Core Service**
   - Create UnifiedScopeResolver with basic resolution
   - Implement special scope handling
   - Add comprehensive unit tests
   - Ensure 100% backward compatibility

2. **Add Caching Layer**
   - Implement pluggable cache strategies
   - Add cache invalidation logic
   - Create cache performance tests

### Phase 2: Integration (Week 2)

1. **Update TargetResolutionService**
   ```javascript
   // Delegate to UnifiedScopeResolver
   resolveTargets(scopeName, actorEntity, discoveryContext, trace, actionId) {
     const context = {
       actor: actorEntity,
       actorLocation: discoveryContext.currentLocation,
       actionContext: discoveryContext,
       trace: trace,
       actionId: actionId
     };
     
     return this.#unifiedScopeResolver
       .resolve(scopeName, context)
       .map(entityIds => 
         Array.from(entityIds, id => ActionTargetContext.forEntity(id))
       );
   }
   ```

2. **Dependency Injection Updates**
   - Register UnifiedScopeResolver in IoC container
   - Update TargetResolutionService dependencies
   - Ensure proper initialization order

### Phase 3: Testing & Validation (Week 3)

1. **Comprehensive Testing**
   - All existing e2e tests must pass
   - Add new integration tests for UnifiedScopeResolver
   - Performance benchmarks for caching
   - Error scenario coverage

2. **Gradual Rollout**
   - Feature flag for enabling new resolver
   - A/B testing in development
   - Monitor error rates and performance

## Testing Strategy

### Unit Tests

```javascript
describe('UnifiedScopeResolver', () => {
  describe('resolve', () => {
    it('should resolve basic scopes to entity IDs');
    it('should handle special scopes (none, self)');
    it('should use cache when enabled');
    it('should provide consistent error contexts');
    it('should handle missing scope definitions');
    it('should detect circular references');
  });
  
  describe('resolveBatch', () => {
    it('should efficiently resolve multiple scopes');
    it('should share cache across batch requests');
    it('should isolate errors to individual requests');
  });
});
```

### Integration Tests

```javascript
describe('UnifiedScopeResolver Integration', () => {
  it('should work with TargetResolutionService');
  it('should integrate with action pipeline');
  it('should maintain backward compatibility');
  it('should improve performance with caching');
});
```

### Performance Tests

```javascript
describe('UnifiedScopeResolver Performance', () => {
  it('should resolve scopes faster with caching');
  it('should handle concurrent requests efficiently');
  it('should invalidate cache appropriately');
  it('should not exceed memory limits with cache');
});
```

## Expected Benefits

### Quantitative
- **30-50% faster** scope resolution with caching
- **40% reduction** in duplicate scope evaluations
- **25% less code** in TargetResolutionService
- **Consistent error handling** across all scope operations

### Qualitative
- **Single source of truth** for scope resolution
- **Easier to test** scope resolution in isolation
- **Better debugging** with enhanced error contexts
- **Improved maintainability** through separation of concerns
- **Extensibility** for future scope resolution needs

## Risk Mitigation

### Risk: Breaking Existing Functionality
**Mitigation**: 
- Comprehensive test coverage before refactoring
- Feature flag for gradual rollout
- Maintain backward compatibility in API

### Risk: Cache Invalidation Issues
**Mitigation**:
- Conservative cache TTL initially (5 seconds)
- Clear cache invalidation rules
- Monitoring for stale data issues

### Risk: Performance Regression
**Mitigation**:
- Performance benchmarks before/after
- Profiling of critical paths
- Ability to disable caching if needed

## Success Criteria

1. All existing e2e tests pass without modification
2. Scope resolution performance improves by at least 30%
3. Error messages are consistent and actionable
4. No increase in memory usage beyond 10%
5. Code coverage remains above 90%

## Future Enhancements

1. **Scope Compilation**: Pre-compile frequently used scopes
2. **Scope Validation**: Validate scope definitions at load time
3. **Scope Composition**: Allow combining scopes with operators
4. **Scope Debugging**: Visual scope resolution debugger
5. **Distributed Caching**: Redis-based caching for multi-instance deployments

## Implementation Checklist

- [ ] Create UnifiedScopeResolver service
- [ ] Implement core resolution logic
- [ ] Add special scope handling
- [ ] Implement caching strategy
- [ ] Create comprehensive unit tests
- [ ] Update TargetResolutionService to delegate
- [ ] Update dependency injection configuration
- [ ] Run all existing tests
- [ ] Add integration tests
- [ ] Performance benchmarking
- [ ] Update documentation
- [ ] Code review
- [ ] Gradual rollout with feature flag

## Conclusion

The UnifiedScopeResolver consolidation will provide a cleaner, more maintainable, and more performant approach to scope resolution in the Living Narrative Engine. By following this specification and migration strategy, we can achieve these improvements with minimal risk to existing functionality.