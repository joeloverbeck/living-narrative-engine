# EXPDIAMONCARREFREP-007: Consolidate Sampling Constants in WitnessState

## Summary
Move sampling sigma constants to `WitnessState` as the single source of truth. Have `RandomStateGenerator` import and use these shared constants instead of defining its own copies. This is a diagnostics-only consolidation (WitnessState is not used by runtime production code today).

## Status
Completed

## Assumptions & Scope Adjustments
- **Reality check:** `WitnessState` is currently referenced only by tests/diagnostics models and is not used by production runtime code.
- **Scope update:** Consolidation applies to expression-diagnostics services only; no runtime behavior is touched.
- **Public API:** Preserve existing `RandomStateGenerator` named exports by re-exporting the imported constants.

## Files to Modify

| File | Action | Changes |
|------|--------|---------|
| `src/expressionDiagnostics/models/WitnessState.js` | Modify | Export sigma constants |
| `src/expressionDiagnostics/services/RandomStateGenerator.js` | Modify | Import constants from WitnessState, remove local definitions |

## Out of Scope

- **DO NOT** change the sigma values themselves
- **DO NOT** merge WitnessState and RandomStateGenerator classes
- **DO NOT** modify Box-Muller transform implementation
- **DO NOT** modify MonteCarloSimulator directly (uses RandomStateGenerator)
- **DO NOT** modify any UI/controller code

## Acceptance Criteria

### Tests That Must Pass
1. All existing tests in `tests/unit/expressionDiagnostics/models/WitnessState.test.js`
2. All existing tests in `tests/unit/expressionDiagnostics/services/randomStateGenerator.test.js`
3. New test: `MOOD_DELTA_SIGMA` named export from `WitnessState` equals 15
4. New test: `SEXUAL_DELTA_SIGMA` named export from `WitnessState` equals 12
5. New test: `LIBIDO_DELTA_SIGMA` named export from `WitnessState` equals 8

### Invariants That Must Remain True
1. Values remain: MOOD_DELTA_SIGMA=15, SEXUAL_DELTA_SIGMA=12, LIBIDO_DELTA_SIGMA=8
2. No duplicate constant definitions across files
3. WitnessState behavior unchanged
4. RandomStateGenerator behavior unchanged

## Implementation Notes

### Current State (Duplication)
```javascript
// In WitnessState.js (approximate lines)
const MOOD_DELTA_SIGMA = 15;
const SEXUAL_DELTA_SIGMA = 12;
const LIBIDO_DELTA_SIGMA = 8;

// In RandomStateGenerator.js (if created from EXPDIAMONCARREFREP-006)
const MOOD_DELTA_SIGMA = 15;
const SEXUAL_DELTA_SIGMA = 12;
const LIBIDO_DELTA_SIGMA = 8;
```

### Target State
```javascript
// In WitnessState.js - Export as named exports
export const MOOD_DELTA_SIGMA = 15;
export const SEXUAL_DELTA_SIGMA = 12;
export const LIBIDO_DELTA_SIGMA = 8;

// OR as static class properties
class WitnessState {
  static MOOD_DELTA_SIGMA = 15;
  static SEXUAL_DELTA_SIGMA = 12;
  static LIBIDO_DELTA_SIGMA = 8;
  // ...
}

// In RandomStateGenerator.js - Import from WitnessState
import {
  MOOD_DELTA_SIGMA,
  SEXUAL_DELTA_SIGMA,
  LIBIDO_DELTA_SIGMA
} from '../models/WitnessState.js';

// Remove local constant definitions
```

### Preferred Approach: Named Exports
Using named exports is cleaner than static properties:

```javascript
// WitnessState.js
/**
 * Sigma values for Gaussian delta sampling.
 * These define the standard deviation of random deltas applied to state axes.
 */
export const MOOD_DELTA_SIGMA = 15;
export const SEXUAL_DELTA_SIGMA = 12;
export const LIBIDO_DELTA_SIGMA = 8;

class WitnessState {
  // ... existing implementation using these constants
}

export default WitnessState;
```

## Verification Commands
```bash
npm run test:unit -- --testPathPattern="WitnessState"
npm run test:unit -- --testPathPattern="randomStateGenerator"
npm run typecheck
npx eslint src/expressionDiagnostics/models/WitnessState.js src/expressionDiagnostics/services/RandomStateGenerator.js
```

## Dependencies
- **Depends on**: EXPDIAMONCARREFREP-006 (RandomStateGenerator must exist first)
- **Blocks**: None

## Outcome
- Consolidated sigma constants into `WitnessState` and reused them from `RandomStateGenerator`, while preserving RandomStateGenerator's named exports.
- Added unit coverage for the WitnessState sigma exports to lock the values.
