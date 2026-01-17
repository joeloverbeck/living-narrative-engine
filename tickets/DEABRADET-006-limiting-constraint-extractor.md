# DEABRADET-006: LimitingConstraintExtractor Service

## Description

Create a service that maps binding axes to regime constraints for human-readable explanations. This provides the "why" for each dead branch.

## Files to Create

- `src/expressionDiagnostics/services/LimitingConstraintExtractor.js`
- `tests/unit/expressionDiagnostics/services/LimitingConstraintExtractor.test.js`

## Files to Modify

- `src/dependencyInjection/tokens/tokens-diagnostics.js` - Add `ILimitingConstraintExtractor` token
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` - Add registration

## Out of Scope

- DeadBranchDetector (DEABRADET-007)
- Report generation (DEABRADET-008)
- Integration with MonteCarloReportGenerator

## Implementation Details

### LimitingConstraintExtractor.js

```javascript
/**
 * @file LimitingConstraintExtractor - Maps binding axes to regime constraints
 * @see specs/dead-branch-detection.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { createLimitingConstraint } from '../models/LimitingConstraint.js';

class LimitingConstraintExtractor {
  #logger;

  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    this.#logger = logger;
  }

  /**
   * Extract limiting constraints for an emotion-driven dead branch.
   * @param {object} params
   * @param {string} params.emotionId - Emotion identifier (e.g., 'rage')
   * @param {object} params.prototypeMath - Prototype math analysis results
   * @param {object} params.regimeConstraints - Active regime constraints
   * @param {import('../models/DeadEvidence.js').DeadEvidence} params.deadEvidence
   * @returns {import('../models/LimitingConstraint.js').LimitingConstraint[]}
   */
  extractForEmotion({ emotionId, prototypeMath, regimeConstraints, deadEvidence }) {
    const constraints = [];

    if (!prototypeMath?.bindingAxes) {
      this.#logger.debug(`LimitingConstraintExtractor: No bindingAxes for ${emotionId}`);
      return constraints;
    }

    for (const binding of prototypeMath.bindingAxes) {
      const { axis, weight, bindingType } = binding;

      // Find matching regime constraint
      const regimeConstraint = this.#findRegimeConstraint(axis, bindingType, regimeConstraints);

      if (regimeConstraint) {
        const explanation = this.#formatExplanation({
          emotionId,
          axis,
          weight,
          bindingType,
          regimeBound: regimeConstraint.bound,
          deadEvidence,
        });

        constraints.push(createLimitingConstraint({
          constraintClauseRef: `moodAxes.${axis} ${regimeConstraint.operator} ${regimeConstraint.bound}`,
          axis,
          prototypeWeight: weight,
          regimeBound: regimeConstraint.bound,
          bindingType,
          explanation,
        }));
      }
    }

    return constraints;
  }

  /**
   * Extract limiting constraints for a non-emotion dead branch.
   * @param {object} params
   * @param {import('../models/DeadEvidence.js').DeadEvidence} params.deadEvidence
   * @returns {import('../models/LimitingConstraint.js').LimitingConstraint[]}
   */
  extractForNonEmotion({ deadEvidence }) {
    const { type, clauseRef, threshold, observedBound, gap } = deadEvidence;

    const explanation = type === 'CEILING'
      ? `max observed (${observedBound}) < threshold (${threshold}), gap = ${gap.toFixed(2)}`
      : `min observed (${observedBound}) > threshold (${threshold}), gap = ${gap.toFixed(2)}`;

    return [createLimitingConstraint({
      constraintClauseRef: clauseRef,
      axis: this.#extractAxisFromClauseRef(clauseRef),
      prototypeWeight: 0, // Non-emotion has no weight
      regimeBound: observedBound,
      bindingType: type === 'CEILING' ? 'positive_weight_low_max' : 'negative_weight_high_min',
      explanation,
    })];
  }

  #findRegimeConstraint(axis, bindingType, regimeConstraints) {
    // Implementation details...
  }

  #formatExplanation({ emotionId, axis, weight, bindingType, regimeBound, deadEvidence }) {
    // Format: "moodAxes.arousal <= 45 + rage weight +0.95 => capped arousal prevents rage reaching 0.45 (max=0.26)"
  }

  #extractAxisFromClauseRef(clauseRef) {
    // Extract axis name from clause ref like "moodAxes.threat <= 10"
  }
}

export default LimitingConstraintExtractor;
```

### Explanation Format

From spec:
```
moodAxes.arousal <= 45 + rage weight +0.95 ⇒ capped arousal prevents rage reaching 0.45 (max=0.26)
```

### DI Token

Add to `tokens-diagnostics.js`:
```javascript
ILimitingConstraintExtractor: 'ILimitingConstraintExtractor',
```

## Acceptance Criteria

### Tests That Must Pass

1. **Constructor validation**:
   - Throws if `logger` is missing

2. **extractForEmotion tests**:
   - Returns array of LimitingConstraint objects
   - Each constraint has non-empty explanation (spec invariant 6)
   - Handles `positive_weight_low_max` binding type
   - Handles `negative_weight_high_min` binding type
   - Returns empty array if prototypeMath is null
   - Returns empty array if bindingAxes is missing
   - Logs debug message when no bindingAxes found

3. **extractForNonEmotion tests**:
   - Returns single-element array for CEILING evidence
   - Returns single-element array for FLOOR evidence
   - Explanation includes observedBound, threshold, and gap
   - Extracts axis from clauseRef correctly

4. **Explanation format tests**:
   - Emotion explanation matches spec format
   - Non-emotion explanation is human-readable
   - Explanations are deterministic (spec invariant safety/UX 2)

5. **Edge cases**:
   - Multiple binding axes generate multiple constraints
   - No matching regime constraint for axis (graceful skip)
   - Empty regimeConstraints object

### Invariants That Must Remain True

1. **Spec invariant 6**: Every returned constraint has non-empty explanation
2. **Spec invariant safety/UX 2**: Stable wording from evidence fields (deterministic)
3. Explanations include the numeric evidence
4. Service is stateless
5. Existing tests continue to pass
6. `npm run typecheck` passes
7. `npx eslint src/expressionDiagnostics/services/LimitingConstraintExtractor.js` passes

## Dependencies

- DEABRADET-001 (LimitingConstraint model for return type)
- DEABRADET-005 (DeadEvidence model as input)

## Estimated Diff Size

~150 lines of source code + ~200 lines of tests + ~10 lines DI = ~360 lines total
