# MULTARRESSTAREF-012: Implement Resolution Coordinator

**Status:** Not Started
**Priority:** Medium
**Estimated Effort:** 2 days
**Phase:** 3 - Resolution Coordination Extraction
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Implement `TargetResolutionCoordinator` class that extracts coordination logic from `#resolveMultiTargets`, reducing method complexity by ~150 lines and improving testability.

## Background

The `#resolveMultiTargets` method (358 lines) mixes coordination concerns (dependency order, contextFrom handling) with resolution logic. This implementation separates coordination into a dedicated, testable service.

## Technical Requirements

### File to Create
- **Path:** `src/actions/pipeline/services/implementations/TargetResolutionCoordinator.js`

### Implementation Details

**Class Structure:**
```javascript
import { validateDependency } from '../../../../utils/dependencyUtils.js';

export default class TargetResolutionCoordinator {
  #dependencyResolver;
  #contextBuilder;
  #unifiedScopeResolver;
  #entityManager;
  #logger;

  constructor({
    dependencyResolver,
    contextBuilder,
    unifiedScopeResolver,
    entityManager,
    logger,
  }) {
    validateDependency(dependencyResolver, 'ITargetDependencyResolver', logger, {
      requiredMethods: ['resolveOrder'],
    });
    validateDependency(contextBuilder, 'IScopeContextBuilder', logger, {
      requiredMethods: ['buildContext'],
    });
    validateDependency(unifiedScopeResolver, 'UnifiedScopeResolver', logger, {
      requiredMethods: ['resolveScope'],
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntity'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#dependencyResolver = dependencyResolver;
    this.#contextBuilder = contextBuilder;
    this.#unifiedScopeResolver = unifiedScopeResolver;
    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  // Implement all 3 interface methods here
}
```

### Methods to Extract and Implement

#### 1. `coordinateResolution`
**Extract from:** Lines ~600-800 in `#resolveMultiTargets` (coordination orchestration)

**Responsibilities:**
- Orchestrate overall resolution for an action
- Determine resolution order using ITargetDependencyResolver
- Coordinate primary and dependent target resolution
- Build detailed results for tracing

**Key Logic:**
```javascript
async coordinateResolution(actionDef, actor, actionContext, trace) {
  const targetDefs = actionDef.targets || {};

  // Use dependency resolver to determine order
  const resolutionOrder = await this.#dependencyResolver.resolveOrder(targetDefs);

  // Resolve with dependencies
  const resolutionResult = await this.resolveWithDependencies(
    targetDefs,
    actor,
    actionContext,
    trace
  );

  return {
    success: true,
    resolvedTargets: resolutionResult.resolvedTargets,
    targetContexts: resolutionResult.targetContexts,
    detailedResults: resolutionResult.detailedResults,
  };
}
```

#### 2. `resolveWithDependencies`
**Extract from:** Lines ~650-750 in `#resolveMultiTargets` (dependency-aware resolution loop)

**Responsibilities:**
- Iterate through targets in dependency order
- Handle primary (independent) targets
- Handle dependent (contextFrom) targets
- Track detailed resolution results

**Key Logic:**
```javascript
async resolveWithDependencies(targetDefs, actor, actionContext, trace) {
  const resolvedTargets = {};
  const targetContexts = [];
  const detailedResults = {};

  const resolutionOrder = await this.#dependencyResolver.resolveOrder(targetDefs);

  for (const targetKey of resolutionOrder) {
    const targetDef = targetDefs[targetKey];

    if (targetDef.contextFrom) {
      // Dependent target - needs primary targets as context
      const primaryKey = targetDef.contextFrom;
      const primaryTargets = resolvedTargets[primaryKey] || [];

      const dependentResults = await this.resolveDependentTargets(
        targetKey,
        targetDef,
        primaryTargets,
        actor,
        actionContext,
        trace
      );

      resolvedTargets[targetKey] = dependentResults;
      detailedResults[targetKey] = { contextFrom: primaryKey, count: dependentResults.length };
    } else {
      // Primary target - independent resolution
      const scopeContext = await this.#contextBuilder.buildContext(actor, actionContext);
      const candidates = await this.#unifiedScopeResolver.resolveScope(
        targetDef.scope,
        scopeContext
      );

      resolvedTargets[targetKey] = candidates;
      targetContexts.push({ targetKey, candidates });
      detailedResults[targetKey] = { count: candidates.length, isPrimary: true };
    }
  }

  return { resolvedTargets, targetContexts, detailedResults };
}
```

#### 3. `resolveDependentTargets`
**Extract from:** Lines ~700-750 in `#resolveMultiTargets` (contextFrom handling)

**Responsibilities:**
- Resolve targets that depend on other targets (contextFrom)
- Use primary targets as context for scope evaluation
- Handle per-primary-target resolution
- Flatten results from multiple contexts

**Key Logic:**
```javascript
async resolveDependentTargets(
  targetKey,
  targetDef,
  primaryTargets,
  actor,
  actionContext,
  trace
) {
  const allDependentTargets = [];

  for (const primaryTarget of primaryTargets) {
    // Build context with primary target
    const dependentContext = await this.#contextBuilder.buildContext(
      actor,
      actionContext,
      { primaryTarget }
    );

    // Resolve dependent targets using this context
    const candidates = await this.#unifiedScopeResolver.resolveScope(
      targetDef.scope,
      dependentContext
    );

    allDependentTargets.push(...candidates);
  }

  // Deduplicate if necessary
  return [...new Set(allDependentTargets)];
}
```

### Error Handling

- Wrap all resolution in try-catch
- Return error in CoordinationResult on failure
- Log errors with context (action ID, target key)
- Never throw - always return result with error field

## Acceptance Criteria

- [ ] Class created at specified path
- [ ] All 3 interface methods implemented
- [ ] Private dependency fields with validation
- [ ] Constructor uses dependency injection
- [ ] Dependency order handling works correctly
- [ ] ContextFrom handling works correctly
- [ ] Detailed results tracking implemented
- [ ] Error handling prevents throws
- [ ] JSDoc comments for all public methods
- [ ] Follows project coding standards

## Dependencies

- **MULTARRESSTAREF-011** - Interface must exist before implementation

## Testing Strategy

Tests will be created in MULTARRESSTAREF-013. Implementation should be testable with:
- Mock dependency resolver, context builder, scope resolver
- Verification of resolution order
- ContextFrom dependency handling
- Detailed results structure

## Migration Notes

**Lines to Extract:**
- Coordination orchestration: ~50 lines
- Dependency-aware resolution loop: ~70 lines
- ContextFrom handling: ~30 lines
- **Total:** ~150 lines extracted from `#resolveMultiTargets`

## Notes

- This addresses the **Mixed Concerns** in `#resolveMultiTargets`
- Enables testing coordination logic separately from tracing/result building
- Simplifies understanding of dependency-based resolution
- Makes it easier to add new resolution strategies
- Prepares for potential parallel resolution in future
