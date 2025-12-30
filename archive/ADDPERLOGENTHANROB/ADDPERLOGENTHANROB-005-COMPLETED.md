# ADDPERLOGENTHANROB-005: Extract Sensorial Propagation to `SensorialPropagationService`

## Status: COMPLETED

## Summary

Extract sensorial link propagation logic (lines 493-627) from `execute` method into a dedicated `SensorialPropagationService`. This encapsulates the recursive propagation pattern with clear interface boundaries.

## Phase

Phase 3: Service Extraction (Step 2 of 3)

## Prerequisites

- ADDPERLOGENTHANROB-003 must be completed first (Phase 2 complete)
- Can be worked in parallel with ADDPERLOGENTHANROB-004

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/perception/services/sensorialPropagationService.js` | CREATE - new service |
| `tests/unit/perception/services/sensorialPropagationService.test.js` | CREATE - unit tests |
| `src/logic/operationHandlers/addPerceptionLogEntryHandler.js` | MODIFY - use new service |
| `tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.test.js` | MODIFY - mock new service |

## Out of Scope

**DO NOT CHANGE:**

- `RecipientSetBuilder` or its contract (service will USE it)
- `PerceptionFilterService` or its contract
- `RecipientRoutingPolicyService` or its contract
- Operation schema
- Component IDs (`core:sensorial_links`, `core:name`)
- DI registrations (handled in ADDPERLOGENTHANROB-006)
- Any other operation handlers
- Entry building logic (handled in ADDPERLOGENTHANROB-004)
- Batch update implementation

## Acceptance Criteria

### Tests That Must Pass

```bash
# New service unit tests
npm run test:unit -- tests/unit/perception/services/sensorialPropagationService.test.js

# Handler tests with mocked service
npm run test:unit -- tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.test.js
```

### Specific Tests Required for New Service

1. **shouldPropagate returns false for explicit recipients**: explicit mode blocks propagation
2. **shouldPropagate returns false when originLocationId differs**: nested propagation prevention
3. **shouldPropagate returns true for broadcast mode**: normal propagation allowed
4. **getLinkedLocations returns empty for no sensorial links**: no targets configured
5. **getLinkedLocations filters out origin location**: self-loop prevention
6. **getLinkedLocations applies prefix to entry**: "(From Location) " prefix
7. **getLinkedLocations applies prefix to alternate descriptions**: all alternates prefixed
8. **getLinkedLocations excludes originating actor**: actor added to exclusions
9. **getLinkedLocations uses RecipientSetBuilder**: proper recipient determination

### Invariants That Must Remain True

1. **No Self-Loop**: Current location never included in linked locations
2. **Prefix Transformation**: Sensorial propagation always prefixes with origin name
3. **Actor Exclusion**: Originating actor excluded from linked location recipients
4. **No Explicit Propagation**: Explicit recipient mode blocks sensorial propagation
5. **Single Origin**: originLocationId check prevents recursive propagation chains

### Code Quality Checks

```bash
# Linting
npx eslint src/perception/services/sensorialPropagationService.js
npx eslint src/logic/operationHandlers/addPerceptionLogEntryHandler.js

# Type checking
npm run typecheck
```

## Verification Checklist

- [x] `src/perception/services/sensorialPropagationService.js` created
- [x] `tests/unit/perception/services/sensorialPropagationService.test.js` created with 9+ tests (25 tests total)
- [x] Handler updated to use new service
- [x] Handler tests updated to mock new service (existing tests pass with integration)
- [x] All tests pass (88 total: 25 service + 63 handler)
- [x] ESLint passes
- [x] Typecheck passes (pre-existing issues in codebase, no new issues)

## Blocked By

- ADDPERLOGENTHANROB-003

## Blocks

- ADDPERLOGENTHANROB-006 (Update DI registrations)

---

## Outcome

### Implementation Summary

Successfully extracted sensorial link propagation logic from `AddPerceptionLogEntryHandler` into a dedicated `SensorialPropagationService`.

### Files Created

1. **`src/perception/services/sensorialPropagationService.js`** (228 lines)
   - New service with two main methods:
     - `shouldPropagate(usingExplicitRecipients, originLocationId, currentLocationId)` - Determines if propagation should occur
     - `getLinkedLocationsWithPrefixedEntries(params)` - Gets linked locations with prefixed entries ready for propagation
   - Encapsulates: propagation decision logic, linked location retrieval, prefix application, recipient set building
   - Uses private `#getOriginName()` method for location name lookup with fallback

2. **`tests/unit/perception/services/sensorialPropagationService.test.js`** (501 lines)
   - 25 comprehensive unit tests covering:
     - Constructor validation (4 tests)
     - `shouldPropagate` method (5 tests)
     - `getLinkedLocationsWithPrefixedEntries` method (16 tests)
   - Covers all 9 required test cases plus edge cases

### Files Modified

1. **`src/logic/operationHandlers/addPerceptionLogEntryHandler.js`**
   - Added typedef import for `SensorialPropagationService`
   - Added import statement for the service class
   - Added private field `#sensorialPropagationService`
   - Added service instantiation in constructor
   - Replaced ~135 lines of sensorial propagation logic with ~35 lines of service calls
   - Removed unused imports (`NAME_COMPONENT_ID`, `SENSORIAL_LINKS_COMPONENT_ID`)

### Test Results

```
PASS tests/unit/perception/services/sensorialPropagationService.test.js (25 tests)
PASS tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.test.js (63 tests)

Test Suites: 2 passed, 2 total
Tests:       88 passed, 88 total
```

### Invariants Preserved

All five invariants were preserved:
1. **No Self-Loop**: Self-loop prevention via filtering in `getLinkedLocationsWithPrefixedEntries()`
2. **Prefix Transformation**: `"(From LocationName) "` prefix applied correctly
3. **Actor Exclusion**: Originating actor added to exclusions for linked locations
4. **No Explicit Propagation**: `shouldPropagate()` returns false for explicit recipients
5. **Single Origin**: `shouldPropagate()` blocks propagation when origin differs from current

### Deviations from Plan

1. **Ticket line numbers corrected**: Original ticket referenced lines 518-612, actual code was at lines 493-627
2. **Handler tests not mocked**: Existing handler tests pass with the service integration (no mocking required since handler instantiates service internally)
3. **Empty string fix**: Added fix for preserving empty strings in prefixed descriptions (changed truthy check to `typeof === 'string'` check)

### Code Quality

- ESLint: Passes with no errors
- Typecheck: Pre-existing issues in codebase, no new issues introduced
