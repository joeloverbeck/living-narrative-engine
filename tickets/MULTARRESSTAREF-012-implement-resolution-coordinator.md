# MULTARRESSTAREF-012: Implement Resolution Coordinator

**Status:** Not Started
**Priority:** Medium
**Estimated Effort:** 2 days
**Phase:** 3 - Resolution Coordination Extraction
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Implement `TargetResolutionCoordinator` class that extracts the dependency-aware portions of `MultiTargetResolutionStage.#resolveMultiTargets` (~613-940) plus its helper `#resolveScope` (~948-1038). The goal is to relocate ~300 lines of orchestration, dependency resolution, context building, and tracing capture logic into a dedicated service that can later be injected into the stage.

## Background

`#resolveMultiTargets` currently combines validation, dependency ordering (`ITargetDependencyResolver#getResolutionOrder`), scope evaluation (`UnifiedScopeResolver.resolve`), context-building (`ScopeContextBuilder.buildScopeContext`/`buildScopeContextForSpecificPrimary`), tracing (`ITargetResolutionTracingOrchestrator`), and result assembly (`TargetResolutionResultBuilder`). Extracting this coordination layer keeps the stage as a thin orchestrator that delegates work to focused services while preserving the existing `PipelineResult` contract.

## Technical Requirements

### File to Create
- **Path:** `src/actions/pipeline/services/implementations/TargetResolutionCoordinator.js`

### Implementation Details

**Class Structure:**
```javascript
import { PipelineResult } from '../../../PipelineResult.js';
import { validateDependency } from '../../../../utils/dependencyUtils.js';

export default class TargetResolutionCoordinator {
  #dependencyResolver;
  #contextBuilder;
  #nameResolver;
  #unifiedScopeResolver;
  #entityManager;
  #logger;
  #tracingOrchestrator;
  #resultBuilder;

  constructor({
    dependencyResolver,
    contextBuilder,
    nameResolver,
    unifiedScopeResolver,
    entityManager,
    logger,
    tracingOrchestrator,
    resultBuilder,
  }) {
    validateDependency(dependencyResolver, 'ITargetDependencyResolver', logger, {
      requiredMethods: ['getResolutionOrder'],
    });
    validateDependency(contextBuilder, 'IScopeContextBuilder', logger, {
      requiredMethods: [
        'buildScopeContext',
        'buildScopeContextForSpecificPrimary',
      ],
    });
    validateDependency(nameResolver, 'ITargetDisplayNameResolver', logger, {
      requiredMethods: ['getEntityDisplayName'],
    });
    validateDependency(unifiedScopeResolver, 'IUnifiedScopeResolver', logger, {
      requiredMethods: ['resolve'],
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntityInstance'],
    });
    validateDependency(logger, 'ILogger', logger);
    validateDependency(tracingOrchestrator, 'ITargetResolutionTracingOrchestrator', logger, {
      requiredMethods: [
        'isActionAwareTrace',
        'captureScopeEvaluation',
        'captureMultiTargetResolution',
      ],
    });
    validateDependency(resultBuilder, 'ITargetResolutionResultBuilder', logger, {
      requiredMethods: ['buildMultiTargetResult'],
    });

    this.#dependencyResolver = dependencyResolver;
    this.#contextBuilder = contextBuilder;
    this.#nameResolver = nameResolver;
    this.#unifiedScopeResolver = unifiedScopeResolver;
    this.#entityManager = entityManager;
    this.#logger = logger;
    this.#tracingOrchestrator = tracingOrchestrator;
    this.#resultBuilder = resultBuilder;
  }

  // Implement all interface methods plus private helpers (e.g., #resolveScope)
}
```

### Methods to Extract and Implement

#### 1. `coordinateResolution`
**Extract from:** `MultiTargetResolutionStage.#resolveMultiTargets` lines ~613-790 and ~900-930.

**Responsibilities:**
- Validate `actionDef.targets` and short-circuit with `PipelineResult.failure` when invalid.
- Invoke `ITargetDependencyResolver#getResolutionOrder` (synchronous) inside a try/catch and surface failures via `PipelineResult.failure`.
- Determine whether tracing is action-aware (`this.#tracingOrchestrator.isActionAwareTrace(trace)`).
- Delegate resolution to `resolveWithDependencies` once, passing the computed order to avoid duplicate resolver calls.
- When no targets resolve (`hasTargets === false`), return `PipelineResult.success({ continueProcessing: false })` mirroring current behavior.
- When primary scopes return zero candidates, stop processing early and include `detailedResolutionResults` plus `continueProcessing: false`.
- On success, use `TargetResolutionResultBuilder.buildMultiTargetResult` to create the canonical payload so downstream code receives `actionsWithTargets`, `resolvedTargets`, `targetDefinitions`, `targetContexts`, and `detailedResolutionResults` exactly as today.
- Capture multi-target summary tracing via `ITargetResolutionTracingOrchestrator.captureMultiTargetResolution` with the same `resolvedCounts`, `resolutionOrder`, and `resolutionTimeMs` fields currently emitted.
- Maintain `allTargetContexts` and `resolvedCounts` for compatibility.

#### 2. `resolveWithDependencies`
**Extract from:** `#resolveMultiTargets` lines ~645-870.

**Responsibilities:**
- Accept the `resolutionOrder` computed in `coordinateResolution` to avoid repeated dependency analysis.
- Iterate through target keys, differentiating between primary scopes and those with `contextFrom`.
- For each primary target:
  - Use `ScopeContextBuilder.buildScopeContext(actor, actionContext, resolvedTargets, targetDef, trace)`.
  - Call a private helper (ported from `#resolveScope`) that invokes `UnifiedScopeResolver.resolve(scope, context, { useCache: true })`, normalizes identifiers, and logs trace info/failures.
  - Convert entity IDs into `ResolvedTarget` structures using `IEntityManager.getEntityInstance` and `ITargetDisplayNameResolver.getEntityDisplayName`, filtering missing entities.
  - Populate `detailedResolutionResults[targetKey]` fields (`scopeId`, `contextFrom`, `candidatesFound`, `candidatesResolved`, `failureReason`, `evaluationTimeMs`).
  - Push flattened `ActionTargetContext` entries onto `targetContexts` for backward compatibility.
  - Early-return a success `PipelineResult` with `continueProcessing: false` when candidates length === 0 (exact current behavior).
- For dependent targets:
  - Retrieve their primary targets from `resolvedTargets[targetDef.contextFrom]`.
  - Initialize `detailedResolutionResults[targetKey]` with `contextFrom` metadata and `contextEntityIds`.
  - Delegate to `resolveDependentTargets` for per-primary evaluation and append results to `resolvedTargets` / `targetContexts`.
- Track `resolvedCounts[targetKey]` for tracing summary data.
- Surface failures from scope evaluation by returning the same success structure used today but with `continueProcessing: false` and `detailedResolutionResults` describing the issue.
- Return `{ resolvedTargets, resolvedCounts, targetContexts, detailedResults, resolutionOrder }` for the caller to consume.

#### 3. `resolveDependentTargets`
**Extract from:** `#resolveMultiTargets` lines ~690-820.

**Responsibilities:**
- Iterate each `primaryTarget` and build a per-primary context via `ScopeContextBuilder.buildScopeContextForSpecificPrimary` so that scope evaluation keeps `context.actor` pointing at the performer while injecting the dependent `target` reference.
- Invoke the shared `#resolveScope` helper for each context and accumulate normalized entity IDs.
- Map entity IDs to `ResolvedTarget` objects (same helper as primaries) while tagging them with `contextFromId`.
- Push flattened `ActionTargetContext` entries for each resolved dependent target (preserving placeholders and display names).
- Update `detailedResolutionResults[targetKey]` counters (`candidatesFound`, `candidatesResolved`) and append `contextEntityIds` for diagnostics.
- Return the array of resolved dependent targets so the caller can store them under the appropriate key.

### Error Handling

- Mirror the stage's existing `PipelineResult.failure` behavior for invalid target definitions or dependency order failures.
- Never throw errors to callers; translate scope evaluation failures into `PipelineResult.success` objects with `continueProcessing: false` plus descriptive `detailedResolutionResults` (matching the current implementation).
- Use `trace?.failure` and `this.#logger.error`/`debug` messages exactly where `#resolveMultiTargets` currently does so diagnostics remain unchanged.
- Ensure the helper derived from `#resolveScope` swallows exceptions by returning an empty array and logging through the provided logger.

## Acceptance Criteria

- [ ] Class created at the specified path using `PipelineResult` and `validateDependency` imports.
- [ ] Constructor validates and stores all required dependencies (`ITargetDependencyResolver`, `IScopeContextBuilder`, `ITargetDisplayNameResolver`, `IUnifiedScopeResolver`, `IEntityManager`, `ILogger`, `ITargetResolutionTracingOrchestrator`, `ITargetResolutionResultBuilder`).
- [ ] `coordinateResolution` reproduces the behavior of `MultiTargetResolutionStage.#resolveMultiTargets`, including validation, dependency ordering, tracing, early exits, and delegating to the result builder.
- [ ] `resolveWithDependencies` consumes a provided `resolutionOrder`, differentiates primary vs. dependent targets, updates `detailedResolutionResults`, and collects flattened contexts.
- [ ] `resolveDependentTargets` reuses `ScopeContextBuilder.buildScopeContextForSpecificPrimary` and the shared `#resolveScope` helper to resolve per-primary scopes.
- [ ] Private helper extracted from `#resolveScope` normalizes entity IDs, handles errors, and logs tracing data (`trace?.step/info/failure`).
- [ ] Detailed resolution metrics (`scopeId`, `contextFrom`, `candidatesFound`, `candidatesResolved`, `evaluationTimeMs`, `contextEntityIds`) remain identical to the current implementation.
- [ ] Tracing interactions (`captureScopeEvaluation`, `captureMultiTargetResolution`) fire with the same payloads as before.
- [ ] JSDoc comments exist for all public methods per repository standards.

## Dependencies

- **MULTARRESSTAREF-011** - Interface must exist before implementation

## Testing Strategy

Tests will be created in MULTARRESSTAREF-013. Implementation should be testable with:
- Mock `ITargetDependencyResolver#getResolutionOrder` (sync) to verify dependency ordering.
- Mock `IScopeContextBuilder` methods to ensure contexts are requested with the correct arguments for primary and dependent scopes.
- Mock `IUnifiedScopeResolver.resolve` to simulate success/failure paths and confirm normalization.
- Mock `ITargetDisplayNameResolver.getEntityDisplayName` / `IEntityManager.getEntityInstance` to verify resolved target hydration.
- Mock `ITargetResolutionTracingOrchestrator` to assert tracing hooks fire with expected payloads.
- Verification of `PipelineResult` outputs when encountering invalid configs or zero-candidate primaries.

## Migration Notes

**Lines to Extract:**
- Coordination orchestration + validation: ~120 lines (MultiTargetResolutionStage.js lines 613-760 & 900-930)
- Dependency-aware resolution loop & context flattening: ~170 lines (lines 645-870)
- Scope resolution helper (`#resolveScope`): ~90 lines (lines 948-1038)
- **Total:** ~380 lines extracted from `#resolveMultiTargets` (the stage will shrink proportionally once integrated in MULTARRESSTAREF-015).

## Notes

- This addresses the **Mixed Concerns** in `#resolveMultiTargets`
- Enables testing coordination logic separately from tracing/result building
- Simplifies understanding of dependency-based resolution
- Makes it easier to add new resolution strategies
- Prepares for potential parallel resolution in future
