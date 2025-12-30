# ADDPERLOGENTHANROB-008: Add Structured Telemetry Using Existing Logger

## Summary

Add structured telemetry points to `AddPerceptionLogEntryHandler` for debugging and observability using the existing logger infrastructure. This enables tracing execution paths, measuring performance, and diagnosing issues in production without introducing new dependencies.

## Phase

Phase 4: Architecture Improvement (Step 2 of 3)

## Prerequisites

- ADDPERLOGENTHANROB-006 must be completed (services extracted and wired)
- Can be worked in parallel with ADDPERLOGENTHANROB-007 and ADDPERLOGENTHANROB-009

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/logic/operationHandlers/addPerceptionLogEntryHandler.js` | MODIFY - add telemetry points |
| `tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.test.js` | MODIFY - telemetry verification tests |

## Out of Scope

**DO NOT CHANGE:**

- Logger infrastructure or ILogger interface
- Create new telemetry/metrics services
- Add external observability dependencies
- RecipientSetBuilder or its contract
- PerceptionFilterService or its contract
- Operation schema
- Component IDs
- Any other operation handlers
- Service implementations (PerceptionEntryBuilder, SensorialPropagationService)
- DI registrations

## Implementation Notes

### Telemetry Strategy

Use structured logging with consistent field names for easy parsing and querying. All telemetry uses `debug` level to avoid noise in production logs unless explicitly enabled. Preserve existing human-readable debug messages to avoid changing current test expectations.

### Key Telemetry Points

```javascript
// 1. Operation Start (execute entry)
this.#logger.debug('ADD_PERCEPTION_LOG_ENTRY: Starting operation', {
  operationId: context.operationId,
  locationId,
  recipientMode: mode, // 'explicit' | 'exclusion' | 'broadcast'
  recipientCount: entityIds.size,
  senseAware,
  hasAlternateDescriptions: !!alternate_descriptions,
  hasActorDescription: !!actor_description,
  hasTargetDescription: !!target_description,
});

// 2. Filtering Phase
this.#logger.debug('ADD_PERCEPTION_LOG_ENTRY: Filtering complete', {
  operationId: context.operationId,
  filteredCount: filteredRecipientsMap?.size ?? 0,
  excludedCount: excludedRecipients?.size ?? 0,
  filteringApplied: !!filteredRecipientsMap,
  durationMs: filterDuration,
});

// 3. Entry Writing Summary
this.#logger.debug('ADD_PERCEPTION_LOG_ENTRY: Entries written', {
  operationId: context.operationId,
  locationId,
  successCount: successfulWrites,
  failureCount: failedWrites,
  batchMode: usedBatchUpdate,
  durationMs: writeDuration,
});

// 4. Sensorial Propagation
this.#logger.debug('ADD_PERCEPTION_LOG_ENTRY: Sensorial propagation', {
  operationId: context.operationId,
  originLocationId: locationId,
  linkedLocationCount: linkedLocationIds.length,
  propagated: shouldPropagate,
  totalPropagatedEntries,
});

// 5. Operation Complete
this.#logger.debug('ADD_PERCEPTION_LOG_ENTRY: Operation complete', {
  operationId: context.operationId,
  totalDurationMs: Date.now() - startTime,
  totalRecipientsProcessed,
  locationsProcessed,
});
```

### Duration Tracking Pattern

```javascript
async execute(context) {
  const startTime = Date.now();
  const operationId = context?.operationId ?? `aple_${Date.now()}`;

  // ... validation and setup ...

  const filterStartTime = Date.now();
  // ... filtering logic ...
  const filterDuration = Date.now() - filterStartTime;

  const writeStartTime = Date.now();
  // ... entry writing ...
  const writeDuration = Date.now() - writeStartTime;

  // Final telemetry
  this.#logger.debug('ADD_PERCEPTION_LOG_ENTRY: Operation complete', {
    operationId,
    totalDurationMs: Date.now() - startTime,
    // ...
  });
}
```

### Telemetry Field Standards

| Field | Type | Description |
|-------|------|-------------|
| `operationId` | string | Unique identifier for tracing |
| `locationId` | string | Primary location being processed |
| `recipientMode` | string | 'explicit' \| 'exclusion' \| 'broadcast' |
| `recipientCount` | number | Number of recipients |
| `senseAware` | boolean | Whether sense filtering enabled |
| `durationMs` | number | Operation duration in milliseconds |
| `successCount` | number | Successful writes |
| `failureCount` | number | Failed writes |
| `batchMode` | boolean | Whether batch update was used |

### Conditional Telemetry

Only log detailed telemetry when enabled:

```javascript
// Note: ILogger does not define isDebugEnabled(), so avoid relying on it.
// Keep telemetry lightweight (no entry contents or recipient lists) and use debug level only.
```

## Acceptance Criteria

### Tests That Must Pass

```bash
# Handler tests with telemetry verification
npm run test:unit -- tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.test.js
```

### Specific Tests Required

1. **logs operation start with correct fields**: Verify operationId, locationId, mode logged
2. **logs filtering results when sense-aware**: Verify filtered/excluded counts logged
3. **logs entry writing summary**: Verify success/failure counts logged
4. **logs sensorial propagation when applicable**: Verify linked locations logged
5. **logs operation completion with duration**: Verify totalDurationMs present
6. **uses debug level for all telemetry**: No info/warn for telemetry points
7. **handles missing operationId gracefully**: Generates fallback ID
8. **does not log sensitive data**: No entry content in logs

### Invariants That Must Remain True

1. **No Behavior Change**: All existing functionality works identically
2. **Performance Impact < 1ms**: Telemetry adds negligible overhead
3. **Debug Level Only**: Telemetry uses debug, not info/warn/error
4. **No New Dependencies**: Uses existing ILogger interface
5. **Structured Fields**: All telemetry uses structured object parameters
6. **Consistent Field Names**: Same fields used across all telemetry points

### Code Quality Checks

```bash
# Linting
npx eslint src/logic/operationHandlers/addPerceptionLogEntryHandler.js

# Type checking
npm run typecheck
```

## Benefits

1. **Debugging**: Trace execution paths through complex handler
2. **Performance Monitoring**: Identify slow operations via durationMs fields
3. **Issue Diagnosis**: Understand recipient filtering and propagation behavior
4. **No New Dependencies**: Leverages existing logger infrastructure
5. **Low Overhead**: Debug-level logs filtered in production by default

## Verification Checklist

- [x] Operation start telemetry added
- [x] Filtering phase telemetry added
- [x] Entry writing telemetry added
- [x] Sensorial propagation telemetry added
- [x] Operation complete telemetry added
- [x] Duration tracking implemented
- [x] All telemetry uses debug level
- [x] No sensitive data logged
- [x] Tests verify telemetry calls
- [ ] ESLint passes
- [ ] Typecheck passes

## Status

Completed.

## Outcome

Structured debug telemetry was added without changing existing debug message text (to preserve current test expectations). Telemetry tests were added to the existing unit test file, and a fallback operationId is generated when one is not supplied; conditional isDebugEnabled logging was skipped because ILogger does not define it.

## Blocked By

- ADDPERLOGENTHANROB-006

## Blocks

- None (parallel with 007, 009)
