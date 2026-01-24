# PROANAOVEV3-003: WilsonInterval Utility

## Summary

Status: Completed.

Create a prototype-overlap-scoped utility for computing Wilson score confidence intervals for binomial proportions, aligned with the v3 spec and existing Wilson interval usage elsewhere in expression diagnostics.

## Motivation

The current system uses point estimates for conditional probabilities (P(A|B)), which can be unreliable with small sample sizes. Wilson intervals provide statistically valid bounds that account for sample size uncertainty.

## Files to Create

### Utility
- `src/expressionDiagnostics/services/prototypeOverlap/WilsonInterval.js`

### Unit Tests
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/wilsonInterval.test.js`

## Implementation Details

### Interface

```javascript
/**
 * Wilson score interval for binomial proportion.
 * @param {number} successes - Number of successes
 * @param {number} trials - Number of trials
 * @param {number} z - Z-score (default: 1.96 for 95% CI)
 * @returns {{lower: number, upper: number}}
 */
export function wilsonInterval(successes, trials, z = 1.96)
```

### Formula

```javascript
function wilsonInterval(successes, trials, z = 1.96) {
  if (trials === 0) return { lower: 0, upper: 1 };

  const p = successes / trials;
  const denom = 1 + z * z / trials;
  const center = (p + z * z / (2 * trials)) / denom;
  const margin = (z / denom) * Math.sqrt(p * (1 - p) / trials + z * z / (4 * trials * trials));

  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
  };
}
```

### Z-Score Reference (tests only)
- 90% CI: z = 1.645
- 95% CI: z = 1.96
- 99% CI: z = 2.576

## Out of Scope

- Using Wilson intervals in classification (ticket 010)
- Agreement metrics integration (ticket 004)

## Acceptance Criteria

- [x] Wilson interval correctly computes bounds for various inputs
- [x] Edge cases handled: 0 trials, 0 successes, all successes
- [x] Multiple confidence levels supported via z-score inputs (90%, 95%, 99%)
- [x] Unit tests cover:
  - Standard cases with known expected values
  - Edge case: 0 trials (returns [0, 1])
  - Edge case: 0 successes (lower = 0)
  - Edge case: all successes (upper = 1)
  - Different confidence levels (z-score variants)
- [ ] 100% branch coverage (small utility)
- [x] `npx eslint src/expressionDiagnostics/services/prototypeOverlap/WilsonInterval.js` passes

## Dependencies

None - standalone utility, but align formula and bounds with existing Wilson interval implementations in `src/expressionDiagnostics/services/StatisticalComputationService.js`.

## Estimated Complexity

Low - pure mathematical function with no dependencies.

## Outcome

- Implemented a Wilson interval utility that accepts a z-score parameter and returns `{lower, upper}` bounds, matching v3 spec usage.
- Added unit tests covering standard values, edge cases, and z-score variants; ran the targeted unit suite.
- Did not measure branch coverage.
