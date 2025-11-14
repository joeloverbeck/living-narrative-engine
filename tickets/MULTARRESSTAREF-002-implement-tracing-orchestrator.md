# MULTARRESSTAREF-002: Implement Tracing Orchestrator

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 1.5 days
**Phase:** 1 - Tracing Extraction
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Implement `TargetResolutionTracingOrchestrator` class that extracts all tracing logic from `MultiTargetResolutionStage`, removing ~200 lines of tracing code from the orchestrator.

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

1. **`#isActionAwareTrace`** (lines ~139-141)
   - Move to `isActionAwareTrace(trace)`
   - Check for action-aware capabilities

2. **`#captureTargetResolutionData`** (lines ~1031-1069)
   - Move to `captureResolutionData(trace, actionDef, actor, resolutionData, detailedResults)`
   - Capture target resolution data

3. **`#captureTargetResolutionError`** (lines ~1071-1095)
   - Move to `captureResolutionError(trace, actionDef, actor, error)`
   - Capture resolution errors

4. **`#capturePostResolutionSummary`** (lines ~1097-1132)
   - Move to `capturePostResolutionSummary(trace, actor, summaryData)`
   - Capture post-resolution summary

5. **`#capturePerformanceData`** (lines ~1134-1157)
   - Move to `capturePerformanceData(trace, actionDef, performanceMetrics)`
   - Capture performance metrics

6. **`#analyzeLegacyFormat`** (lines ~1159-1164)
   - Move to `analyzeLegacyFormat(action)`
   - Analyze legacy action format

Additionally, consolidate inline tracing calls:
- Legacy detection captures (lines 179-218)
- Legacy conversion captures
- Scope evaluation captures
- Multi-target resolution captures

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
- `#captureTargetResolutionData`: ~39 lines
- `#captureTargetResolutionError`: ~25 lines
- `#capturePostResolutionSummary`: ~36 lines
- `#capturePerformanceData`: ~24 lines
- `#analyzeLegacyFormat`: ~6 lines
- **Total:** ~133 lines from helper methods
- **Additional:** ~70 lines from inline tracing calls
- **Grand Total:** ~203 lines extracted

## Notes

- This is the highest-impact extraction, removing ~17% of the stage's code
- Must preserve exact tracing behavior to avoid breaking action-aware traces
- All trace calls should be defensive (check for method existence)
- Consider adding debug logging for tracing operations
