# MULTARRESSTAREF-015: Integrate Resolution Coordinator and Simplify Stage

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 2.5 days
**Phase:** 4 - Final Stage Simplification
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Integrate `TargetResolutionCoordinator` into `MultiTargetResolutionStage` and perform final simplification, reducing the stage to <300 lines (from original 1,220) while preserving all functionality.

## Background

After extracting tracing (~200 lines), result assembly (~80 lines), and coordination (~150 lines), the stage should be reduced to pure orchestration logic. This final integration completes the refactoring.

## Technical Requirements

### File to Modify
- **Path:** `src/actions/pipeline/stages/MultiTargetResolutionStage.js`

### Changes Required

#### 1. Constructor Update
```javascript
export class MultiTargetResolutionStage extends PipelineStage {
  #legacyLayer;
  #logger;
  #tracingOrchestrator;
  #resultBuilder;
  #resolutionCoordinator; // ADD THIS

  // REMOVE (now in coordinator):
  // #dependencyResolver
  // #contextBuilder
  // #unifiedScopeResolver
  // #entityManager
  // #nameResolver (if unused)
  // #targetResolver (if unused)

  constructor({
    legacyLayer,
    logger,
    tracingOrchestrator,
    resultBuilder,
    resolutionCoordinator, // ADD THIS
  }) {
    super('MultiTargetResolution');

    validateDependency(legacyLayer, 'ILegacyTargetCompatibilityLayer', logger, {
      requiredMethods: ['isLegacyAction', 'convertToMultiTarget'],
    });
    validateDependency(tracingOrchestrator, 'ITargetResolutionTracingOrchestrator', logger, {
      requiredMethods: ['isActionAwareTrace', 'captureResolutionData'],
    });
    validateDependency(resultBuilder, 'ITargetResolutionResultBuilder', logger, {
      requiredMethods: ['buildFinalResult'],
    });
    validateDependency(resolutionCoordinator, 'ITargetResolutionCoordinator', logger, {
      requiredMethods: ['coordinateResolution'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#legacyLayer = legacyLayer;
    this.#tracingOrchestrator = tracingOrchestrator;
    this.#resultBuilder = resultBuilder;
    this.#resolutionCoordinator = resolutionCoordinator;
    this.#logger = logger;
  }
}
```

#### 2. Simplify `executeInternal` Method

**Target: ~50-80 lines (from 288)**

**NEW IMPLEMENTATION:**
```javascript
async executeInternal(context) {
  const { candidateActions, actor, trace } = context;
  const isActionAware = this.#tracingOrchestrator.isActionAwareTrace(trace);

  this.#logger.debug('\n=== MULTITARGETRESOLUTIONSTAGE ENTRY ===');
  this.#logger.debug('Candidate actions count:', candidateActions.length);

  const allActionsWithTargets = [];
  const allTargetContexts = [];
  let lastResolvedTargets = null;
  let lastTargetDefinitions = null;

  for (const actionDef of candidateActions) {
    try {
      const result = await this.#resolveAction(actionDef, context, isActionAware);
      if (result) {
        allActionsWithTargets.push(result.actionWithTargets);
        allTargetContexts.push(...(result.targetContexts || []));
        lastResolvedTargets = result.resolvedTargets;
        lastTargetDefinitions = result.targetDefinitions;
      }
    } catch (error) {
      this.#logger.error(`Failed to resolve targets for action ${actionDef.id}:`, error);
      if (isActionAware) {
        this.#tracingOrchestrator.captureResolutionError(trace, actionDef, actor, error);
      }
    }
  }

  if (isActionAware && allActionsWithTargets.length > 0) {
    this.#tracingOrchestrator.capturePostResolutionSummary(trace, actor, {
      originalCount: candidateActions.length,
      resolvedCount: allActionsWithTargets.length,
    });
  }

  this.#logger.debug('\n=== MULTITARGETRESOLUTIONSTAGE EXIT ===');
  this.#logger.debug('Actions with resolved targets:', allActionsWithTargets.length);

  return this.#resultBuilder.buildFinalResult(
    context,
    allActionsWithTargets,
    allTargetContexts,
    lastResolvedTargets,
    lastTargetDefinitions
  );
}
```

#### 3. Simplify `#resolveAction` Helper

**NEW METHOD (replaces complex routing logic):**
```javascript
async #resolveAction(actionDef, context, isActionAware) {
  const isLegacy = this.#legacyLayer.isLegacyAction(actionDef);

  // Capture legacy detection
  if (isActionAware) {
    this.#tracingOrchestrator.captureLegacyDetection(
      context.trace,
      actionDef.id,
      { isLegacy }
    );
  }

  // Convert legacy to multi-target if needed
  let normalizedAction = actionDef;
  if (isLegacy) {
    const conversion = await this.#legacyLayer.convertToMultiTarget(actionDef);
    normalizedAction = conversion.action;

    if (isActionAware) {
      this.#tracingOrchestrator.captureLegacyConversion(
        context.trace,
        actionDef.id,
        conversion
      );
    }
  }

  // Coordinate resolution
  const coordinationResult = await this.#resolutionCoordinator.coordinateResolution(
    normalizedAction,
    context.actor,
    context.actionContext,
    context.trace
  );

  if (!coordinationResult.success) {
    return null;
  }

  // Capture resolution data
  if (isActionAware) {
    this.#tracingOrchestrator.captureResolutionData(
      context.trace,
      actionDef,
      context.actor,
      coordinationResult
    );
  }

  // Build result
  const actionWithTargets = isLegacy
    ? this.#resultBuilder.buildLegacyResult(
        context,
        coordinationResult.resolvedTargets,
        coordinationResult.targetContexts,
        { /* legacy conversion metadata */ },
        actionDef
      )
    : this.#resultBuilder.buildMultiTargetResult(
        context,
        coordinationResult.resolvedTargets,
        coordinationResult.targetContexts,
        normalizedAction.targets,
        actionDef,
        coordinationResult.detailedResults
      );

  return {
    actionWithTargets,
    targetContexts: coordinationResult.targetContexts,
    resolvedTargets: coordinationResult.resolvedTargets,
    targetDefinitions: normalizedAction.targets || {},
  };
}
```

#### 4. Remove Complex Methods

**DELETE these methods (logic moved to services):**
- `#resolveMultiTargets` (358 lines) → replaced by `#resolutionCoordinator.coordinateResolution`
- `#resolveLegacyTarget` (149 lines) → logic absorbed into simplified `#resolveAction`
- `#resolveScope` (87 lines) → moved to coordinator
- All tracing helper methods (already removed in Phase 1)

**KEEP (still needed for orchestration):**
- `executeInternal` (now simplified to ~50-80 lines)
- `#resolveAction` (new simplified helper ~40-50 lines)

### Expected Final Size
- **executeInternal:** ~60 lines (from 288)
- **#resolveAction:** ~45 lines (new simplified method)
- **Total stage:** ~150-200 lines (from 1,220)
- **Reduction:** ~84% size reduction

## Acceptance Criteria

- [ ] `#resolutionCoordinator` field added to constructor
- [ ] Unused dependencies removed from constructor
- [ ] `executeInternal` simplified to pure orchestration (~60 lines)
- [ ] `#resolveAction` helper created/simplified (~45 lines)
- [ ] `#resolveMultiTargets` method removed (358 lines)
- [ ] `#resolveLegacyTarget` method removed (149 lines)
- [ ] `#resolveScope` method removed (87 lines)
- [ ] All existing unit tests pass
- [ ] All existing integration tests pass
- [ ] Final stage size <300 lines (target: 150-200)
- [ ] No behavior changes
- [ ] Clear separation of concerns

## Dependencies

- **MULTARRESSTAREF-011** - Coordinator interface created
- **MULTARRESSTAREF-012** - Coordinator implemented
- **MULTARRESSTAREF-013** - Coordinator tests passing
- **MULTARRESSTAREF-014** - Coordinator DI registration complete
- **MULTARRESSTAREF-005** - Tracing orchestrator integrated
- **MULTARRESSTAREF-010** - Result builder integrated

## Testing Strategy

### Comprehensive Regression Testing
```bash
# Run all stage tests
npm run test:unit -- MultiTargetResolutionStage

# Run all integration tests
npm run test:integration -- --testPathPattern="actions/pipeline"

# Run tracing integration tests
npm run test:integration -- --testPathPattern="tracing"

# Run full test suite
npm run test:ci
```

### Validation Checklist
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All e2e tests pass
- [ ] ActionAwareStructuredTrace tests pass
- [ ] Legacy action handling works
- [ ] Multi-target action handling works
- [ ] ContextFrom dependencies work
- [ ] Backward compatibility maintained
- [ ] No performance regression

## Performance Validation

**Before/After Benchmarks:**
```bash
npm run test:performance -- MultiTargetResolutionStage
```

**Metrics to track:**
- Resolution time per action
- Memory usage
- Tracing overhead

**Acceptance:** No more than 5% performance regression

## Rollback Plan

If integration causes critical issues:
1. Revert all `MultiTargetResolutionStage.js` changes
2. All services remain (independently functional)
3. Investigate issues thoroughly
4. Fix services or integration approach
5. Re-attempt integration

## Documentation Updates

After successful integration:
- [ ] Update JSDoc for simplified methods
- [ ] Document service delegation pattern
- [ ] Update architecture diagrams
- [ ] Add migration notes to CLAUDE.md

## Notes

- **Critical:** This is the final and most impactful refactoring step
- Test exhaustively before considering complete
- Verify all downstream stages work correctly
- Ensure backward compatibility is maintained
- Performance must not degrade significantly
- Clear orchestration flow should be evident in code
- Each concern (tracing, result building, coordination) cleanly delegated
