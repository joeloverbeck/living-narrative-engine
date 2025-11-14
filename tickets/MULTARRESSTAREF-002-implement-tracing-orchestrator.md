# MULTARRESSTAREF-002: Implement Tracing Orchestrator

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 1.5 days
**Phase:** 1 - Tracing Extraction
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Implement `TargetResolutionTracingOrchestrator` class that extracts all tracing logic from `MultiTargetResolutionStage` (currently 1,220 lines per MULTARRESSTAREF-000), removing ~200 lines of tracing code from the stage orchestrator.

## Background

The stage currently has tracing logic scattered throughout (lines 129-147, 179-218, 250-284, etc.) making it difficult to test orchestration independently. This implementation consolidates all tracing into a dedicated service.

## Technical Requirements

### File to Create
- **Path:** `src/actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.js`

### Implementation Details

**Class Structure:**
```javascript
import { validateDependency } from '../../../../utils/dependencyUtils.js';

export default class TargetResolutionTracingOrchestrator {
  #logger;

  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    this.#logger = logger;
  }

  // Implement all 10 interface methods here
}
```

### Methods to Extract

Extract from `MultiTargetResolutionStage.js`:

1. **`#isActionAwareTrace`** (lines ~129-141)
   - Move to `isActionAwareTrace(trace)`
   - Ensure we only call capture methods when `captureActionData` exists

2. **`#captureTargetResolutionData`** (lines ~1043-1088)
   - Move to `captureResolutionData(trace, actionDef, actor, resolutionData, detailedResults)`
   - Preserve the current payload fields (`stage`, `actorId`, `resolutionSuccess`, `targetKeys`, `resolvedTargetCounts`, optional `targetResolutionDetails`, etc.)

3. **`#captureTargetResolutionError`** (lines ~1092-1124)
   - Move to `captureResolutionError(trace, actionDef, actor, error)`
   - Continue capturing `error`, `errorType`, and `scopeName` metadata without interrupting stage flow

4. **`#capturePostResolutionSummary`** (lines ~1130-1170)
   - Move to `capturePostResolutionSummary(trace, actor, originalCount, resolvedCount, hasLegacy, hasMultiTarget, stageDurationMs)`
   - Maintain the `resolutionSuccessRate` calculation and timestamp logging

5. **`#capturePerformanceData`** (lines ~1193-1220)
   - Move to `capturePerformanceData(trace, actionDef, startTime, endTime, totalCandidates, actionsWithTargets)`
   - Preserve the ACTTRA-018 payload structure (duration, `itemsProcessed`, `itemsResolved`, `stageName`)

6. **`#analyzeLegacyFormat`** (lines ~1174-1191)
   - Move to `analyzeLegacyFormat(action)`
   - Keep the existing heuristic outputs (`string_targets`, `scope_property`, `legacy_target_type`, `modern`)

Additionally, consolidate inline tracing calls by delegating to the orchestrator:
- Legacy detection captures (lines ~172-203)
- Legacy conversion captures (lines ~204-233)
- Scope evaluation captures during per-target resolution (lines ~704-792)
- Multi-target resolution captures (lines ~613 and 866-892)

### Error Handling

- All capture methods must handle missing trace methods gracefully (no throw)
- Log warnings if trace methods expected but not found
- Never let tracing failures break orchestration flow

## Acceptance Criteria

- [ ] Class created at specified path
- [ ] All 10 interface methods implemented
- [ ] Private `#logger` field with validation
- [ ] Constructor uses dependency injection
- [ ] All extracted methods preserve exact tracing behavior
- [ ] Error handling prevents tracing failures from breaking flow
- [ ] JSDoc comments for all public methods
- [ ] Follows project coding standards (camelCase, dependency validation)

## Dependencies

- **MULTARRESSTAREF-001** - Interface must exist before implementation

## Testing Strategy

Tests will be created in MULTARRESSTAREF-003. Implementation should be testable with:
- Mock trace objects with various capabilities
- Verification of trace method calls
- Error handling when trace methods missing
- Legacy format analysis with different action structures

## Migration Notes

**Lines to Extract:**
- `#isActionAwareTrace`: ~3 lines
- `#captureTargetResolutionData`: ~46 lines (includes optional details handling)
- `#captureTargetResolutionError`: ~33 lines
- `#capturePostResolutionSummary`: ~41 lines
- `#capturePerformanceData`: ~28 lines
- `#analyzeLegacyFormat`: ~10 lines
- **Total:** ~161 lines from helper methods
- **Additional:** ~70 lines from inline tracing calls (legacy detection/conversion, scope evaluation, multi-target summaries)
- **Grand Total:** ~230 lines extracted

## Notes

- This is the highest-impact extraction, removing ~17% of the stage's code
- Must preserve exact tracing behavior to avoid breaking action-aware traces
- All trace calls should be defensive (check for method existence)
- Consider adding debug logging for tracing operations
