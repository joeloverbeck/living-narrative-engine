# DEABRADET-005: StructuralImpossibilityAnalyzer Service

## Description

Create a service that analyzes individual clauses for CEILING/FLOOR/CLAMP impossibilities. This is the core detection logic that proves structural impossibility.

## Files to Create

- `src/expressionDiagnostics/services/StructuralImpossibilityAnalyzer.js`
- `tests/unit/expressionDiagnostics/services/StructuralImpossibilityAnalyzer.test.js`

## Files to Modify

- `src/dependencyInjection/tokens/tokens-diagnostics.js` - Add `IStructuralImpossibilityAnalyzer` token
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` - Add registration

## Out of Scope

- LimitingConstraintExtractor (DEABRADET-006)
- DeadBranchDetector orchestration (DEABRADET-007)
- Report generation
- Integration with MonteCarloReportGenerator

## Implementation Details

### StructuralImpossibilityAnalyzer.js

```javascript
/**
 * @file StructuralImpossibilityAnalyzer - Analyzes clauses for structural impossibilities
 * @see specs/dead-branch-detection.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { createDeadEvidence } from '../models/DeadEvidence.js';

/** Epsilon for normalized floats [0,1] */
const FLOAT_EPSILON = 1e-6;
/** Epsilon for integer-effective mood axes */
const INTEGER_EPSILON = 0;

class StructuralImpossibilityAnalyzer {
  #logger;

  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    this.#logger = logger;
  }

  /**
   * Analyze a clause for structural impossibility.
   * @param {object} params
   * @param {string} params.clauseRef - Clause reference string
   * @param {string} params.operator - Comparison operator (>=, >, <=, <)
   * @param {number} params.threshold - Threshold value from clause
   * @param {number} params.maxObserved - Maximum observed value in population
   * @param {number} params.minObserved - Minimum observed value in population
   * @param {number} [params.gatePassRate] - Gate pass rate (for emotion clauses)
   * @param {boolean} params.isEmotionClause - Whether this is an emotion clause
   * @param {boolean} [params.isIntegerEffective=false] - Whether values are integers
   * @returns {import('../models/DeadEvidence.js').DeadEvidence|null}
   */
  analyze(params) {
    const {
      clauseRef,
      operator,
      threshold,
      maxObserved,
      minObserved,
      gatePassRate,
      isEmotionClause,
      isIntegerEffective = false,
    } = params;

    const epsilon = isIntegerEffective ? INTEGER_EPSILON : FLOAT_EPSILON;

    // CLAMP_IMPOSSIBLE: emotion with gate never passing
    if (isEmotionClause && gatePassRate === 0 && threshold > 0) {
      return createDeadEvidence({
        type: 'CLAMP_IMPOSSIBLE',
        clauseRef,
        threshold,
        observedBound: 0,
        gap: threshold,
        gatePassRate: 0,
      });
    }

    // CEILING: for >= or > operators
    if (operator === '>=' || operator === '>') {
      if (maxObserved < threshold - epsilon) {
        return createDeadEvidence({
          type: 'CEILING',
          clauseRef,
          threshold,
          observedBound: maxObserved,
          gap: threshold - maxObserved,
        });
      }
    }

    // FLOOR: for <= or < operators
    if (operator === '<=' || operator === '<') {
      if (minObserved > threshold + epsilon) {
        return createDeadEvidence({
          type: 'FLOOR',
          clauseRef,
          threshold,
          observedBound: minObserved,
          gap: minObserved - threshold,
        });
      }
    }

    return null; // No structural impossibility
  }
}

export default StructuralImpossibilityAnalyzer;
```

### DI Token

Add to `tokens-diagnostics.js`:
```javascript
IStructuralImpossibilityAnalyzer: 'IStructuralImpossibilityAnalyzer',
```

### DI Registration

```javascript
registrar.singletonFactory(
  diagnosticsTokens.IStructuralImpossibilityAnalyzer,
  (c) => new StructuralImpossibilityAnalyzer({
    logger: c.resolve(tokens.ILogger),
  })
);
```

## Acceptance Criteria

### Tests That Must Pass

1. **Constructor validation**:
   - Throws if `logger` is missing
   - Throws if `logger` is invalid

2. **Spec test 3.1 - CEILING detection**:
   ```javascript
   analyze({
     clauseRef: 'emotions.rage >= 0.45',
     operator: '>=',
     threshold: 0.45,
     maxObserved: 0.26,
     minObserved: 0,
     isEmotionClause: true,
   })
   // Returns: CEILING evidence with gap ≈ 0.19
   ```

3. **Spec test 3.3 - No impossibility when maxObserved >= threshold**:
   ```javascript
   analyze({
     clauseRef: 'emotions.joy >= 0.85',
     operator: '>=',
     threshold: 0.85,
     maxObserved: 0.90,
     minObserved: 0.10,
     isEmotionClause: true,
   })
   // Returns: null (no impossibility)
   ```

4. **Spec test 3.4 - CLAMP_IMPOSSIBLE**:
   ```javascript
   analyze({
     clauseRef: 'emotions.X >= 0.3',
     operator: '>=',
     threshold: 0.3,
     maxObserved: 0,
     minObserved: 0,
     gatePassRate: 0,
     isEmotionClause: true,
   })
   // Returns: CLAMP_IMPOSSIBLE evidence with gatePassRate=0
   ```

5. **Spec test 3.5 - FLOOR detection**:
   ```javascript
   analyze({
     clauseRef: 'moodAxes.threat <= 10',
     operator: '<=',
     threshold: 10,
     maxObserved: 80,
     minObserved: 30,
     isEmotionClause: false,
     isIntegerEffective: true,
   })
   // Returns: FLOOR evidence with gap = 20
   ```

6. **Edge cases**:
   - `operator: '>'` also triggers CEILING check
   - `operator: '<'` also triggers FLOOR check
   - `maxObserved === threshold` returns null (no impossibility)
   - `minObserved === threshold` returns null (no impossibility)
   - Integer-effective uses epsilon = 0
   - Float values use epsilon = 1e-6

### Invariants That Must Remain True

1. **Spec invariant 3**: Returns null if no structural impossibility proven
2. Gap calculation is always positive (absolute difference)
3. CLAMP_IMPOSSIBLE only returned for emotion clauses with gatePassRate === 0
4. CEILING only returned for >= or > operators
5. FLOOR only returned for <= or < operators
6. Service is stateless
7. Existing tests continue to pass
8. `npm run typecheck` passes
9. `npx eslint src/expressionDiagnostics/services/StructuralImpossibilityAnalyzer.js` passes

## Dependencies

- DEABRADET-001 (DeadEvidence model for return type)

## Estimated Diff Size

~100 lines of source code + ~250 lines of tests + ~10 lines DI = ~360 lines total
