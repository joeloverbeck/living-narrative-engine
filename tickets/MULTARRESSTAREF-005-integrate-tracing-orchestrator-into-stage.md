# MULTARRESSTAREF-005: Integrate Tracing Orchestrator into Stage

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 2 days
**Phase:** 1 - Tracing Extraction
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Replace all inline tracing logic in `MultiTargetResolutionStage` with calls to `TargetResolutionTracingOrchestrator`, reducing the stage by ~200 lines while preserving exact tracing behavior.

## Background

The stage currently has 27 trace method calls, 10 trace conditionals, and 5 helper methods (139 lines) scattered throughout the orchestration logic. This integration consolidates all tracing into the orchestrator service.

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
  #tracingOrchestrator; // ADD THIS

  constructor({
    targetDependencyResolver,
    legacyTargetCompatibilityLayer,
    scopeContextBuilder,
    targetDisplayNameResolver,
    unifiedScopeResolver,
    entityManager,
    targetResolver,
    targetContextBuilder,
    logger,
    tracingOrchestrator, // ADD THIS
  }) {
    super('MultiTargetResolution');
    // ... existing validations ...

    validateDependency(
      tracingOrchestrator,
      'ITargetResolutionTracingOrchestrator',
      logger,
      {
        requiredMethods: [
          'isActionAwareTrace',
          'captureLegacyDetection',
          'captureLegacyConversion',
          'captureScopeEvaluation',
          'captureMultiTargetResolution',
          'captureResolutionData',
          'captureResolutionError',
          'capturePostResolutionSummary',
          'capturePerformanceData',
          'analyzeLegacyFormat',
        ],
      }
    );
    this.#tracingOrchestrator = tracingOrchestrator;
  }
}
```

#### 2. Remove Helper Methods

**Delete these private methods:**
- `#isActionAwareTrace` (~3 lines)
- `#captureTargetResolutionData` (~39 lines)
- `#captureTargetResolutionError` (~25 lines)
- `#capturePostResolutionSummary` (~36 lines)
- `#capturePerformanceData` (~24 lines)
- `#analyzeLegacyFormat` (~6 lines)

**Total removal:** ~133 lines

#### 3. Replace Inline Trace Calls

**Replace trace capability detection** (lines ~139-141):
```javascript
// OLD:
const isActionAwareTrace = this.#isActionAwareTrace(trace);

// NEW:
const isActionAwareTrace = this.#tracingOrchestrator.isActionAwareTrace(trace);
```

**Replace legacy detection captures** (lines ~179-218):
```javascript
// OLD:
if (isActionAwareTrace && trace.captureLegacyDetection) {
  trace.captureLegacyDetection(actionDef.id, {
    isLegacy,
    hasStringTarget,
    // ... more data
  });
}

// NEW:
if (isActionAwareTrace) {
  this.#tracingOrchestrator.captureLegacyDetection(trace, actionDef.id, {
    isLegacy,
    hasStringTargets: typeof actionDef.targets === 'string',
    hasScopeOnly: !!(actionDef.scope && !actionDef.targets),
    hasLegacyFields: !!(actionDef.targetType || actionDef.targetCount),
    detectedFormat: this.#tracingOrchestrator.analyzeLegacyFormat(actionDef),
    requiresConversion: isLegacy,
  });
}
```

**Replace legacy conversion captures:**
```javascript
// OLD:
if (isActionAwareTrace && trace.captureLegacyConversion) {
  trace.captureLegacyConversion(actionDef.id, conversionData);
}

// NEW:
if (isActionAwareTrace) {
  this.#tracingOrchestrator.captureLegacyConversion(
    trace,
    actionDef.id,
    conversionData
  );
}
```

**Replace scope evaluation captures:**
```javascript
// OLD:
if (isActionAwareTrace && trace.captureScopeEvaluation) {
  trace.captureScopeEvaluation(actionDef.id, targetKey, evaluationData);
}

// NEW:
if (isActionAwareTrace) {
  this.#tracingOrchestrator.captureScopeEvaluation(
    trace,
    actionDef.id,
    targetKey,
    evaluationData
  );
}
```

**Replace multi-target resolution captures:**
```javascript
// OLD:
if (isActionAwareTrace && trace.captureMultiTargetResolution) {
  trace.captureMultiTargetResolution(actionDef.id, resolutionData);
}

// NEW:
if (isActionAwareTrace) {
  this.#tracingOrchestrator.captureMultiTargetResolution(
    trace,
    actionDef.id,
    resolutionData
  );
}
```

**Replace legacy and multi-target resolution data captures** (lines ~220-320):
```javascript
// OLD:
if (isActionAwareTrace && trace.captureActionData) {
  this.#captureTargetResolutionData(
    trace,
    actionDef,
    actor,
    resolutionData,
    detailedResults
  );
  tracedActionCount++;
}

// NEW:
if (isActionAwareTrace) {
  this.#tracingOrchestrator.captureResolutionData(
    trace,
    actionDef,
    actor,
    resolutionData,
    detailedResults
  );
  tracedActionCount++;
}
```

**Replace error captures:**
```javascript
// OLD:
if (isActionAwareTrace && trace.captureActionData) {
  this.#captureTargetResolutionError(trace, actionDef, actor, error);
}

// NEW:
if (isActionAwareTrace) {
  this.#tracingOrchestrator.captureResolutionError(
    trace,
    actionDef,
    actor,
    error
  );
}
```

**Replace post-resolution summary:**
```javascript
// OLD:
if (isActionAwareTrace && tracedActionCount > 0) {
  this.#capturePostResolutionSummary(trace, actor, summaryData);
}

// NEW:
if (isActionAwareTrace && tracedActionCount > 0) {
  this.#tracingOrchestrator.capturePostResolutionSummary(
    trace,
    actor,
    candidateActions.length,
    allActionsWithTargets.length,
    hasLegacyActions,
    hasMultiTargetActions,
    Date.now() - stageStartTime
  );
}
```

**Replace performance data captures:**
```javascript
// OLD:
await this.#capturePerformanceData(trace, actionDef, performanceMetrics);

// NEW:
await this.#tracingOrchestrator.capturePerformanceData(
  trace,
  actionDef,
  startPerformanceTime,
  endPerformanceTime,
  candidateActions.length,
  allActionsWithTargets.length
);
```

**Replace legacy format analysis:**
```javascript
// OLD:
const format = this.#analyzeLegacyFormat(actionDef);

// NEW:
const format = this.#tracingOrchestrator.analyzeLegacyFormat(actionDef);
```

### Expected Line Reduction
- **Helper methods removed:** ~133 lines
- **Inline calls simplified:** ~70 lines
- **Total reduction:** ~203 lines
- **New size:** ~1,017 lines (from 1,220)

## Acceptance Criteria

- [ ] `#tracingOrchestrator` field added to constructor
- [ ] Dependency validation added for tracing orchestrator
- [ ] All 6 helper methods removed
- [ ] All inline trace calls replaced with orchestrator calls
- [ ] No direct trace method calls remain (all go through orchestrator)
- [ ] All existing unit tests pass
- [ ] All existing integration tests pass
- [ ] Tracing behavior unchanged (verify with ActionAwareStructuredTrace tests)
- [ ] Code size reduced by ~200 lines

## Dependencies

- **MULTARRESSTAREF-001** - Interface created
- **MULTARRESSTAREF-002** - Implementation created
- **MULTARRESSTAREF-003** - Tests passing
- **MULTARRESSTAREF-004** - DI registration complete

## Testing Strategy

### Regression Testing
```bash
# Run all existing tests for MultiTargetResolutionStage
npm run test:unit -- MultiTargetResolutionStage

# Run integration tests for action discovery pipeline
npm run test:integration -- --testPathPattern="actions/pipeline"

# Run tracing integration tests
npm run test:integration -- --testPathPattern="tracing"
```

### Validation Checklist
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] ActionAwareStructuredTrace tests pass
- [ ] No behavior changes detected
- [ ] Tracing captures all expected data
- [ ] Performance tests show no regression

## Rollback Plan

If integration causes issues:
1. Revert `MultiTargetResolutionStage.js` changes
2. Keep orchestrator service (doesn't hurt to exist)
3. Investigate and fix issues
4. Re-attempt integration

## Notes

- **Critical:** Preserve exact tracing behavior to avoid breaking production traces
- Test with real ActionAwareStructuredTrace implementation
- Verify ACTTRA-018 performance tracking still works
- All `async` keywords should be preserved or removed as appropriate
- Simplify conditionals where possible (orchestrator handles capability checks)
- Consider removing redundant `isActionAwareTrace` checks if orchestrator handles them
