# EXPDIA-010: Create WitnessState Model - COMPLETED

## Summary

Create the data model for representing satisfying states (witnesses) that cause an expression to trigger. A witness state contains concrete mood axis values and sexual state values that, when applied, would make the expression fire.

## Priority: Medium | Effort: Small

## Rationale

When content authors need to debug an expression, they need to see concrete examples of states that would trigger it. The WitnessState model provides a structured, validated representation that can be displayed in the UI and copied for testing.

## Dependencies

- **EXPDIA-001** (AxisInterval model for understanding value ranges)
- No service dependencies - this is a pure data model

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/models/WitnessState.js` | **Create** |
| `src/expressionDiagnostics/models/index.js` | **Modify** (add export) |
| `tests/unit/expressionDiagnostics/models/WitnessState.test.js` | **Create** |

## Out of Scope

- **DO NOT** implement WitnessStateFinder service - that's EXPDIA-011
- **DO NOT** create UI components - that's EXPDIA-012
- **DO NOT** implement any search algorithms
- **DO NOT** create DI registration for this model

## Implementation Details

> **CORRECTED ASSUMPTIONS** (validated against MonteCarloSimulator.js:197-215):
> - **Mood axes**: 7 axes (not 5) matching `expressionContextBuilder.js`
> - **baseline_libido range**: [-50, 50] (not [0, 100]) per `core:sexual_state` component schema

### WitnessState Model

```javascript
/**
 * @file WitnessState - Represents a satisfying state for expression triggering
 * @see specs/expression-diagnostics.md Layer D
 */

/**
 * @typedef {Object} MoodState
 * @property {number} valence - [-100, 100]
 * @property {number} arousal - [-100, 100]
 * @property {number} agency_control - [-100, 100]
 * @property {number} threat - [-100, 100]
 * @property {number} engagement - [-100, 100]
 * @property {number} future_expectancy - [-100, 100]
 * @property {number} self_evaluation - [-100, 100]
 */

/**
 * @typedef {Object} SexualState
 * @property {number} sex_excitation - [0, 100]
 * @property {number} sex_inhibition - [0, 100]
 * @property {number} baseline_libido - [-50, 50]
 */

const MOOD_AXES = Object.freeze([
  'valence', 'arousal', 'agency_control', 'threat',
  'engagement', 'future_expectancy', 'self_evaluation'
]);
const SEXUAL_AXES = Object.freeze(['sex_excitation', 'sex_inhibition', 'baseline_libido']);

const MOOD_RANGE = Object.freeze({ min: -100, max: 100 });
const SEXUAL_RANGES = Object.freeze({
  sex_excitation: { min: 0, max: 100 },
  sex_inhibition: { min: 0, max: 100 },
  baseline_libido: { min: -50, max: 50 }
});
```

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/models/WitnessState.test.js --verbose
```

### Unit Test Coverage Requirements

**WitnessState.test.js:**
- Constructor throws if mood is missing
- Constructor throws if sexual is missing
- Constructor throws if mood axis is out of range
- Constructor throws if sexual axis is out of range
- Constructor throws if mood axis is NaN
- Constructor accepts valid mood and sexual state
- `mood` getter returns copy, not reference
- `sexual` getter returns copy, not reference
- `isWitness` returns true when isExact and fitness=1
- `isWitness` returns false when isExact=false
- `isWitness` returns false when fitness<1
- `getMoodAxis()` returns correct value
- `getSexualAxis()` returns correct value
- `withChanges()` creates new instance with modifications
- `withChanges()` preserves unchanged values
- `toDisplayString()` formats correctly
- `toJSON()` includes all fields
- `toClipboardJSON()` returns valid JSON string
- `fromJSON()` reconstructs state correctly
- `createRandom()` returns valid state
- `createNeutral()` returns state with expected values
- Static constants are frozen
- Mood axes in correct range [-100, 100]
- Sexual axes in correct range (per-axis: sex_excitation/sex_inhibition [0, 100], baseline_libido [-50, 50])

### Invariants That Must Remain True

1. **Mood axes in [-100, 100]** - Always validated on construction
2. **Sexual axes per-axis ranges** - sex_excitation/sex_inhibition [0, 100], baseline_libido [-50, 50]
3. **Immutable getters** - Return copies, not references
4. **Valid JSON output** - toJSON() and toClipboardJSON() produce parseable JSON
5. **fromJSON roundtrip** - fromJSON(toJSON()) equals original
6. **Constants are frozen** - Cannot be modified at runtime

## Definition of Done

- [x] `WitnessState.js` created with all methods implemented
- [x] `models/index.js` updated with export
- [x] Unit tests cover all public methods
- [x] Tests cover validation edge cases
- [x] Tests verify JSON roundtrip
- [x] Static factory methods work correctly
- [x] JSDoc documentation complete
- [x] All tests pass
- [x] Constants exported and frozen

---

## Outcome

**Completion Date**: 2026-01-09

### What Was Changed vs Originally Planned

#### Assumption Corrections (Before Implementation)
The original ticket had incorrect assumptions that were validated and corrected before implementation:

1. **Mood Axes**: The ticket originally assumed 5 mood axes (`valence`, `energy`, `dominance`, `novelty`, `threat`). After validation against `MonteCarloSimulator.js:197-215` and `expressionContextBuilder.js`, this was corrected to 7 axes:
   - `valence`, `arousal`, `agency_control`, `threat`, `engagement`, `future_expectancy`, `self_evaluation`

2. **baseline_libido Range**: The ticket originally assumed a range of [0, 100]. After validation against the `core:sexual_state` component schema, this was corrected to [-50, 50].

#### Files Created/Modified
- **Created**: `src/expressionDiagnostics/models/WitnessState.js` - Full implementation with corrected constants and per-axis validation
- **Modified**: `src/expressionDiagnostics/models/index.js` - Added WitnessState export
- **Created**: `tests/unit/expressionDiagnostics/models/WitnessState.test.js` - 59 comprehensive unit tests

### Test Results
- **59 tests passing** with 100% coverage on WitnessState.js
- Coverage breakdown:
  - Statements: 100%
  - Branches: 100%
  - Functions: 100%
  - Lines: 100%

### New Tests with Rationale

| Test Category | Count | Rationale |
|---------------|-------|-----------|
| Constructor validation - mood | 8 | Validates all 7 mood axes required with correct range |
| Constructor validation - sexual | 6 | Validates per-axis ranges (baseline_libido [-50,50]) |
| Getter immutability | 4 | Ensures getters return copies, not references |
| isWitness property | 3 | Tests combined isExact/fitness logic |
| getMoodAxis/getSexualAxis | 4 | Tests axis value retrieval and undefined handling |
| withChanges | 8 | Tests immutable modification pattern |
| Serialization (toJSON, toClipboardJSON) | 6 | Tests JSON roundtrip and formatting |
| fromJSON deserialization | 4 | Tests reconstruction with defaults |
| Factory methods | 8 | Tests createRandom and createNeutral |
| Static constants | 8 | Tests constants are frozen and correct |

### Notes
- No DI registration created (per ticket scope - pure data model)
- No service implementation (deferred to EXPDIA-011)
- Implementation follows existing codebase patterns (AxisInterval.js, DiagnosticResult.js)
