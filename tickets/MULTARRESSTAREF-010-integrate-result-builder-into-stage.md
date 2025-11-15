# MULTARRESSTAREF-010: Integrate Result Builder into Stage

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 1.5 days
**Phase:** 2 - Result Assembly Extraction
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Replace the inline result assembly logic that still exists inside `MultiTargetResolutionStage` with
`TargetResolutionResultBuilder` calls. The stage currently sits at **1,085 lines** (`wc -l`), and the
remaining result-assembly blocks live in `executeInternal` (~lines 402-439), `#resolveLegacyTarget`
(~lines 520-575), and `#resolveMultiTargets` (~lines 930-990). Delegating those blocks to the builder
should remove ~70-80 lines while keeping the exact output contract that downstream stages expect.

## Background

Result assembly is still duplicated directly inside the stage:

1. **Final aggregation (`executeInternal`)** – builds `resultData` and returns `PipelineResult.success` inline.
2. **Legacy path (`#resolveLegacyTarget`)** – manually constructs `resolvedTargets`, hydrates metadata, and builds the
   pipeline result even though `TargetResolutionResultBuilder.buildLegacyResult` already performs the same work.
3. **Multi-target path (`#resolveMultiTargets`)** – assembles `actionsWithTargets` and attaches metadata that mirrors
   `TargetResolutionResultBuilder.buildMultiTargetResult`.

This ticket integrates the builder so the stage only orchestrates resolution, not payload construction.

## Technical Requirements

### Files to Modify
- **Primary:** `src/actions/pipeline/stages/MultiTargetResolutionStage.js`
- **Test utilities & call sites:** Every helper/test that instantiates the stage must now provide the builder dependency.
  At minimum this includes `tests/common/actions/multiTargetStageTestUtilities.js` and each test surfaced by
  `rg "new MultiTargetResolutionStage" tests`. The DI registration already resolves
  `targetResolutionResultBuilder`, but the constructor currently ignores it.

### Supporting References
- Builder interface: `src/actions/pipeline/services/interfaces/ITargetResolutionResultBuilder.js`
- Builder implementation: `src/actions/pipeline/services/implementations/TargetResolutionResultBuilder.js`

### Changes Required

#### 1. Constructor Update
```javascript
export class MultiTargetResolutionStage extends PipelineStage {
  #dependencyResolver;
  #legacyLayer;
  #contextBuilder;
  #nameResolver;
  #unifiedScopeResolver;
  #entityManager;
  #targetResolver;
  #logger;
  #tracingOrchestrator;
  #resultBuilder; // ADD THIS

  constructor({
    dependencyResolver,
    legacyLayer,
    contextBuilder,
    nameResolver,
    unifiedScopeResolver,
    entityManager,
    targetResolver,
    logger,
    tracingOrchestrator,
    targetResolutionResultBuilder, // ADD THIS (already provided via DI)
  }) {
    super('MultiTargetResolution');
    // ... existing validations ...

    validateDependency(
      targetResolutionResultBuilder,
      'ITargetResolutionResultBuilder',
      logger,
      {
        requiredMethods: [
          'buildFinalResult',
          'buildLegacyResult',
          'buildMultiTargetResult',
          'attachMetadata',
        ],
      }
    );
    this.#resultBuilder = targetResolutionResultBuilder;
  }
}
```

#### 2. Replace Legacy Result Assembly

**Location:** ~lines 520-575 in `#resolveLegacyTarget`

**OLD:**
```javascript
const resolvedTargets = {
  primary: targetContexts.map((tc) => ({
    id: tc.entityId,
    displayName:
      tc.displayName ||
      this.#nameResolver.getEntityDisplayName(tc.entityId) ||
      tc.entityId,
    entity: tc.entityId
      ? this.#entityManager.getEntityInstance(tc.entityId)
      : null,
  })),
};

return PipelineResult.success({
  data: {
    ...context.data,
    resolvedTargets,
    targetContexts, // Keep for backward compatibility
    actionsWithTargets: [
      {
        actionDef,
        targetContexts,
        // Attach metadata for consistency with multi-target actions
        resolvedTargets,
        targetDefinitions: conversionResult.targetDefinitions || {
          primary: { scope, placeholder },
        },
        isMultiTarget: false,
      },
    ],
  },
});
```

**NEW:**
```javascript
return this.#resultBuilder.buildLegacyResult(
  context,
  resolvedTargets,
  targetContexts,
  conversionResult,
  actionDef
);
```

#### 3. Replace Multi-Target Result Assembly

**Location:** ~lines 930-990 in `#resolveMultiTargets`

**OLD:**
```javascript
const actionsWithTargets = [
  {
    actionDef,
    targetContexts: allTargetContexts,
    resolvedTargets,
    targetDefinitions: targetDefs,
    isMultiTarget: true,
  },
];

return PipelineResult.success({
  data: {
    ...context.data,
    resolvedTargets,
    targetContexts: allTargetContexts, // Backward compatibility
    targetDefinitions: targetDefs,
    detailedResolutionResults,
    actionsWithTargets,
  },
});
```

**NEW:**
```javascript
return this.#resultBuilder.buildMultiTargetResult(
  context,
  resolvedTargets,
  allTargetContexts,
  targetDefs,
  actionDef,
  detailedResolutionResults
);
```

#### 4. Replace Final Result Assembly

**Location:** ~lines 402-439 in `executeInternal`

**OLD:**
```javascript
const resultData = {
  ...context.data,
  actionsWithTargets: allActionsWithTargets,
};

if (allTargetContexts.length > 0) {
  resultData.targetContexts = allTargetContexts;
}

if (lastResolvedTargets && lastTargetDefinitions) {
  resultData.resolvedTargets = lastResolvedTargets;
  resultData.targetDefinitions = lastTargetDefinitions;
}

return PipelineResult.success({
  data: resultData,
  errors,
});
```

**NEW:**
```javascript
this.#logger.debug('\n=== MULTITARGETRESOLUTIONSTAGE EXIT ===');
this.#logger.debug('Actions with resolved targets:', allActionsWithTargets.length);

return this.#resultBuilder.buildFinalResult(
  context,
  allActionsWithTargets,
  allTargetContexts,
  lastResolvedTargets,
  lastTargetDefinitions,
  errors
);
```

#### 5. Update stage factories and tests

- `src/dependencyInjection/registrations/commandAndActionRegistrations.js` already resolves
  `targetResolutionResultBuilder`; ensure the constructor update above consumes the same name so DI wiring keeps working.
- Update `tests/common/actions/multiTargetStageTestUtilities.js` so the factory injects a real `TargetResolutionResultBuilder`
  (or a mock when provided). This helper fans out to most unit/integration suites.
- Update every test that directly calls `new MultiTargetResolutionStage` (see `rg "new MultiTargetResolutionStage" tests`) to
  pass a mock builder exposing `buildLegacyResult`, `buildMultiTargetResult`, `buildFinalResult`, and `attachMetadata`.

### Expected Line Reduction
- **Legacy result assembly:** ~30 lines removed (current block spans ~lines 540-575)
- **Multi-target result assembly:** ~20 lines removed (current block spans ~lines 950-990)
- **Final result assembly:** ~20 lines removed (current block spans ~lines 402-439)
- **Total reduction:** ~70 lines
- **New size (after Phase 2):** ~1,010 lines (current 1,085)

## Acceptance Criteria

- [ ] `#resultBuilder` field added to constructor
- [ ] Dependency validation added for result builder (all builder methods covered)
- [ ] Legacy result assembly replaced with builder call
- [ ] Multi-target result assembly replaced with builder call
- [ ] Final result assembly replaced with builder call
- [ ] No inline result assembly remains
- [ ] All stage factories/tests updated to supply the builder dependency
- [ ] All existing unit tests pass
- [ ] All existing integration tests pass
- [ ] Result format unchanged (verify with downstream stage tests)
- [ ] Backward compatibility fields preserved
- [ ] Code size reduced by ~70 lines (1,085 → ~1,010)

## Dependencies

- **MULTARRESSTAREF-006** - Interface created
- **MULTARRESSTAREF-007** - Implementation created
- **MULTARRESSTAREF-008** - Tests passing
- **MULTARRESSTAREF-009** - DI registration complete
- **MULTARRESSTAREF-005** - Tracing orchestrator integrated (recommended)

## Testing Strategy

### Regression Testing
```bash
# Run all existing tests for MultiTargetResolutionStage
npm run test:unit -- MultiTargetResolutionStage

# Run integration tests for downstream stages
npm run test:integration -- TargetComponentValidationStage
npm run test:integration -- ActionFormattingStage
npm run test:integration -- PrerequisiteEvaluationStage

# Run full pipeline integration tests
npm run test:integration -- --testPathPattern="actions/pipeline"
```

### Validation Checklist
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] TargetComponentValidationStage works correctly
- [ ] ActionFormattingStage works correctly
- [ ] PrerequisiteEvaluationStage works correctly
- [ ] Result format matches previous implementation exactly
- [ ] Backward compatibility fields present
- [ ] No behavior changes detected

## Rollback Plan

If integration causes issues:
1. Revert `MultiTargetResolutionStage.js` changes
2. Keep result builder service (doesn't hurt to exist)
3. Investigate and fix issues
4. Re-attempt integration

## Notes

- **Critical:** Result format must match existing implementation exactly
- Test with all downstream stages to ensure compatibility
- Verify backward compatibility fields are present
- Consider adding integration tests for complete pipeline flow
- Watch for any changes in result structure that break downstream stages
- May need to adjust builder implementation if format mismatches detected
