# Context

- Health state management spans the anatomy system with state values stored in `anatomy:part_health` components.
- **Operation Handlers** calculate health states from percentage thresholds:
  - `src/logic/operationHandlers/applyDamageHandler.js` (lines 50-57, 109-116)
  - `src/logic/operationHandlers/modifyPartHealthHandler.js` (lines 46-53, 99-106)
  - `src/logic/operationHandlers/updatePartHealthStateHandler.js` (lines 78-85, 96-103)
- **Narrative Formatting** maps states to human-readable descriptions:
  - `src/anatomy/services/injuryNarrativeFormatterService.js` (lines 9-26, 29-42)
- **Aggregation Service** filters parts by state for UI display:
  - `src/anatomy/services/injuryAggregationService.js` (lines 148, 155)
- **Schema Definition** enforces valid state values:
  - `data/mods/anatomy/components/part_health.component.json` (lines 20-27)
- **Existing Registry Pattern** provides the blueprint for centralization:
  - `src/anatomy/registries/bodyDescriptorRegistry.js` (gold standard for domain knowledge)

# Problem

- **Root Cause**: Health state names and thresholds were hardcoded in 6+ separate locations with no single source of truth.
- **Original Bug**: The Physical Condition panel showed ONLY bleeding effects, not damage state text (wounded, injured, etc.). This occurred because the narrative formatter expected state names (`scratched`, `injured`, `critical`) that the handlers didn't produce (`bruised`, `badly_damaged`).
- **How It Failed**:
  - Schema enum: `bruised`, `wounded`, `badly_damaged`, `destroyed`
  - Formatter expected: `scratched`, `wounded`, `injured`, `critical`, `destroyed`
  - Result: 3 of 5 states didn't match, producing no narrative output
- **Immediate Fix Applied**: Aligned all files to use 6 states: `healthy`, `scratched`, `wounded`, `injured`, `critical`, `destroyed` with equal 20% threshold bands.
- **Underlying Fragility**: The fix required manual edits to 6+ files. Any future state name or threshold change requires coordinated updates across all locations, creating regression risk.

**Test files that caught the failures:**
- `tests/unit/logic/operationHandlers/applyDamageHandler.test.js` (lines 425-428, 456-458)
- `tests/unit/logic/operationHandlers/modifyPartHealthHandler.test.js` (lines 660, 1186)
- `tests/integration/anatomy/damage-application.integration.test.js` (lines 377-393)
- `tests/integration/mods/anatomy/partHealthLifecycle.integration.test.js` (lines 309-330)

# Truth Sources

- **Schema Contract**: `data/mods/anatomy/components/part_health.component.json` - defines valid state enum
- **Threshold Documentation**: JSDoc in `updatePartHealthStateHandler.js` (lines 16-22) documents the 6-state system
- **Domain Rules**:
  - States map to health percentage ranges (20% bands)
  - States have severity ordering: `healthy` > `scratched` > `wounded` > `injured` > `critical` > `destroyed`
  - Each state has first-person and third-person narrative descriptions
- **Pattern Reference**: `src/anatomy/registries/bodyDescriptorRegistry.js` - established registry pattern

# Desired Behavior

## Normal Cases

- State calculation from health percentage produces consistent values across all handlers.
- State names used in comparisons, event payloads, and narrative formatting match exactly.
- Adding a new state or changing thresholds requires modification of only one source file.
- Schema enum is derived from or validated against the registry, preventing drift.

## Edge Cases

- Health percentage exactly at boundary (e.g., 81%, 61%, 41%, 21%, 1%) resolves deterministically.
- Health percentage of 0% always yields `destroyed` regardless of calculation method.
- Health percentage above 100% (overhealing) clamps to `healthy`.
- Negative health percentage (invalid) clamps to `destroyed`.
- Unknown state strings in component data fail validation with actionable error.

## Failure Modes (what errors to raise/return)

- If a state string doesn't match registry values, throw `InvalidHealthStateError` with:
  - The invalid state value
  - List of valid states from registry
  - Component ID and entity ID for debugging
- If registry is accessed before initialization, throw `RegistryNotInitializedError`.
- If threshold calculation yields `undefined`, fall back to logging error and returning `healthy` (safe default).

## Invariants

- The set of valid state names is identical across: schema enum, registry, handlers, formatters.
- State ordering for deterioration checks is consistent: `healthy` < `scratched` < `wounded` < `injured` < `critical` < `destroyed`.
- Threshold values are contiguous and cover 0-100% range completely with no gaps or overlaps.
- Registry is immutable after initialization (freeze pattern).
- All state-to-description mappings exist for both first-person and third-person perspectives.

## API Contracts

### What Stays Stable
- State string values: `healthy`, `scratched`, `wounded`, `injured`, `critical`, `destroyed`
- Threshold percentages: 81%, 61%, 41%, 21%, 1%, 0%
- Event payload shape for `anatomy:part_health_changed` and `anatomy:part_state_changed`
- Public methods on `InjuryNarrativeFormatterService`: `formatFirstPerson()`, `formatDamageEvent()`

### What is Allowed to Change
- Internal threshold storage structure (object vs array vs enum)
- Description text for states (narrative wording)
- Additional metadata per state (e.g., CSS classes, severity levels, icon names)
- Utility function names and signatures within registry
- Validation error message formatting

# Testing Plan

## Which Tests Must Be Updated/Added

### New Unit Tests
1. **`tests/unit/anatomy/registries/healthStateRegistry.test.js`** (new file)
   - Verify all 6 states are defined with correct thresholds
   - Verify `calculateStateFromPercentage()` returns correct state at each boundary
   - Verify `getStateOrder()` returns states in deterioration order
   - Verify `getStateDescriptions()` returns first-person and third-person maps
   - Verify `isValidState()` validates known states and rejects unknown
   - Verify registry is frozen after initialization

2. **`tests/unit/anatomy/validators/healthStateValidator.test.js`** (new file)
   - Verify validation catches state name mismatches
   - Verify validation catches threshold gaps/overlaps
   - Verify schema enum matches registry enum

### Updated Unit Tests
3. **`tests/unit/logic/operationHandlers/applyDamageHandler.test.js`**
   - Update to import state names from registry
   - Add test verifying handler uses registry for state calculation

4. **`tests/unit/logic/operationHandlers/modifyPartHealthHandler.test.js`**
   - Update to import state names from registry
   - Add test verifying handler uses registry for state calculation

5. **`tests/unit/logic/operationHandlers/updatePartHealthStateHandler.test.js`**
   - Update to import state names and order from registry
   - Add test verifying deterioration check uses registry order

6. **`tests/unit/anatomy/services/injuryNarrativeFormatterService.test.js`**
   - Update to import descriptions from registry
   - Add test verifying formatter uses registry for all state mappings

### New Integration Tests
7. **`tests/integration/anatomy/healthStateRegistryConsistency.integration.test.js`** (new file)
   - Load actual schema, verify enum matches registry
   - Create parts with each state, verify narrative output exists
   - Damage parts through all transitions, verify events contain valid states

## Regression Tests / Property Tests

8. **Property Test: Threshold Coverage**
   - Property: For any health percentage 0-100, `calculateStateFromPercentage()` returns a valid state
   - Property: No two adjacent states have the same threshold minimum

9. **Property Test: State Ordering Consistency**
   - Property: For states A < B in order, threshold(A) > threshold(B)
   - Property: Deterioration returns true iff newState > previousState in order

10. **Regression Test: Schema-Registry Sync**
    - On startup or test setup, validate `part_health.component.json` enum matches registry
    - Fail fast if mismatch detected, preventing silent drift

11. **Regression Test: Handler Consistency**
    - Verify all three handlers (`applyDamageHandler`, `modifyPartHealthHandler`, `updatePartHealthStateHandler`) import from same registry
    - Grep for hardcoded state strings in handler files, fail if found

## Performance Considerations

- Registry lookup should be O(1) using frozen object
- Threshold calculation should be O(n) where n = number of states (currently 6)
- No performance regression in damage application pipeline
- Add benchmark test: 1000 state calculations < 10ms

# Implementation Notes

## Recommended Registry Structure

Following the `bodyDescriptorRegistry.js` pattern:

```javascript
// src/anatomy/registries/healthStateRegistry.js

export const HEALTH_STATE_REGISTRY = Object.freeze({
  healthy: {
    id: 'healthy',
    thresholdMin: 81,
    order: 0,
    firstPerson: 'feels fine',
    thirdPerson: 'is uninjured',
    cssClass: 'severity-healthy',
  },
  scratched: {
    id: 'scratched',
    thresholdMin: 61,
    order: 1,
    firstPerson: 'stings slightly',
    thirdPerson: 'is scratched',
    cssClass: 'severity-scratched',
  },
  // ... remaining states
});

export function calculateStateFromPercentage(percentage) { ... }
export function getStateOrder() { ... }
export function isValidState(state) { ... }
export function getFirstPersonDescription(state) { ... }
export function getThirdPersonDescription(state) { ... }
```

## Files to Modify (Implementation Phase)

| File | Change Required |
|------|-----------------|
| `src/anatomy/registries/healthStateRegistry.js` | **CREATE** - single source of truth |
| `src/logic/operationHandlers/applyDamageHandler.js` | Import from registry, remove local constant |
| `src/logic/operationHandlers/modifyPartHealthHandler.js` | Import from registry, remove local constant |
| `src/logic/operationHandlers/updatePartHealthStateHandler.js` | Import from registry, remove local arrays |
| `src/anatomy/services/injuryNarrativeFormatterService.js` | Import descriptions from registry |
| `src/anatomy/services/injuryAggregationService.js` | Import state names for comparisons |
| `src/anatomy/validators/healthStateValidator.js` | **CREATE** - validates schema-registry consistency |

## Backward Compatibility

- Keep existing state string values unchanged
- Create a deprecated constants file that re-exports from registry (following `bodyDescriptorConstants.js` pattern)
- Add deprecation warnings for direct constant imports
