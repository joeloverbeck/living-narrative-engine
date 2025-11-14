# MULTARRESSTAREF-010: Integrate Result Builder into Stage

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 1.5 days
**Phase:** 2 - Result Assembly Extraction
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Replace all inline result assembly logic in `MultiTargetResolutionStage` with calls to `TargetResolutionResultBuilder`, reducing the stage by ~80 lines while ensuring exact result format compatibility.

## Background

Result assembly is currently duplicated in three locations (lines 379-399, 525-556, 903-922). This integration consolidates all result building into the builder service.

## Technical Requirements

### File to Modify
- **Path:** `src/actions/pipeline/stages/MultiTargetResolutionStage.js`

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
    resultBuilder, // ADD THIS
  }) {
    super('MultiTargetResolution');
    // ... existing validations ...

    validateDependency(
      resultBuilder,
      'ITargetResolutionResultBuilder',
      logger,
      {
        requiredMethods: ['buildFinalResult', 'buildLegacyResult', 'buildMultiTargetResult'],
      }
    );
    this.#resultBuilder = resultBuilder;
  }
}
```

#### 2. Replace Legacy Result Assembly

**Location:** Lines 525-556 in `#resolveLegacyTarget`

**OLD:**
```javascript
const actionWithTargets = {
  ...actionDef,
  resolvedTargets,
  __legacyConversion: {
    originalFormat: legacyFormat,
    convertedTargets: Object.keys(actionDef.targets || {}),
    migrationSuggestion: migrationSuggestion || null,
  },
};

// Backward compatibility: attach targetContexts
if (targetContexts && targetContexts.length > 0) {
  allTargetContexts.push(...targetContexts);
}

allActionsWithTargets.push(actionWithTargets);
lastResolvedTargets = resolvedTargets;
lastTargetDefinitions = actionDef.targets || {};
```

**NEW:**
```javascript
const actionWithTargets = this.#resultBuilder.buildLegacyResult(
  context,
  resolvedTargets,
  targetContexts,
  {
    originalFormat: legacyFormat,
    convertedTargets: Object.keys(actionDef.targets || {}),
    migrationSuggestion: migrationSuggestion || null,
  },
  actionDef
);

if (targetContexts && targetContexts.length > 0) {
  allTargetContexts.push(...targetContexts);
}

allActionsWithTargets.push(actionWithTargets);
lastResolvedTargets = resolvedTargets;
lastTargetDefinitions = actionDef.targets || {};
```

#### 3. Replace Multi-Target Result Assembly

**Location:** Lines 903-922 in `#resolveMultiTargets`

**OLD:**
```javascript
const actionWithTargets = {
  ...actionDef,
  resolvedTargets,
};

// Attach detailed results for debugging/tracing
if (detailedResults && Object.keys(detailedResults).length > 0) {
  actionWithTargets.__detailedResults = detailedResults;
}

allActionsWithTargets.push(actionWithTargets);
if (targetContexts && targetContexts.length > 0) {
  allTargetContexts.push(...targetContexts);
}
lastResolvedTargets = resolvedTargets;
lastTargetDefinitions = targetDefs;
```

**NEW:**
```javascript
const actionWithTargets = this.#resultBuilder.buildMultiTargetResult(
  context,
  resolvedTargets,
  targetContexts,
  targetDefs,
  actionDef,
  detailedResults
);

allActionsWithTargets.push(actionWithTargets);
if (targetContexts && targetContexts.length > 0) {
  allTargetContexts.push(...targetContexts);
}
lastResolvedTargets = resolvedTargets;
lastTargetDefinitions = targetDefs;
```

#### 4. Replace Final Result Assembly

**Location:** Lines 379-399 in `executeInternal`

**OLD:**
```javascript
const resultData = {
  candidateActions: allActionsWithTargets,
};

// Backward compatibility: include targetContexts for downstream stages
if (allTargetContexts.length > 0) {
  resultData.targetContexts = allTargetContexts;
}

// Backward compatibility: include last resolved targets
if (lastResolvedTargets && lastTargetDefinitions) {
  resultData.resolvedTargets = lastResolvedTargets;
  resultData.targetDefinitions = lastTargetDefinitions;
}

this.#logger.debug('\n=== MULTITARGETRESOLUTIONSTAGE EXIT ===');
this.#logger.debug('Actions with resolved targets:', allActionsWithTargets.length);

return PipelineResult.success({ data: resultData, errors });
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
  lastTargetDefinitions
);
```

### Expected Line Reduction
- **Legacy result assembly:** ~32 lines removed
- **Multi-target result assembly:** ~19 lines removed
- **Final result assembly:** ~21 lines removed
- **Total reduction:** ~72 lines
- **New size (cumulative with Phase 1):** ~945 lines (from 1,220)

## Acceptance Criteria

- [ ] `#resultBuilder` field added to constructor
- [ ] Dependency validation added for result builder
- [ ] Legacy result assembly replaced with builder call
- [ ] Multi-target result assembly replaced with builder call
- [ ] Final result assembly replaced with builder call
- [ ] No inline result assembly remains
- [ ] All existing unit tests pass
- [ ] All existing integration tests pass
- [ ] Result format unchanged (verify with downstream stage tests)
- [ ] Backward compatibility fields preserved
- [ ] Code size reduced by ~70-80 lines

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
