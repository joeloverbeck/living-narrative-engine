# EXPDIA-003: Create IntensityBoundsCalculator Service

## Summary

Calculate the maximum and minimum achievable intensity for emotion/sexual prototypes given gate constraints. This service identifies expressions that require intensity thresholds that are mathematically impossible to reach even when all gates are satisfied.

## Priority: High | Effort: Medium

## Rationale

Even when gates don't directly conflict, the weighted sum of axis values may not reach the required threshold. For example, if an expression requires `emotions.curiosity >= 0.95` but the maximum possible intensity given all axis bounds is only 0.70, the expression is impossible. This service provides these reachability bounds.

## Dependencies

- **EXPDIA-001** (AxisInterval, GateConstraint models) must be completed first

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/IntensityBoundsCalculator.js` | **Create** |
| `src/expressionDiagnostics/services/index.js` | **Modify** (add export) |
| `tests/unit/expressionDiagnostics/services/intensityBoundsCalculator.test.js` | **Create** |
| `tests/fixtures/expressionDiagnostics/impossibleThreshold.expression.json` | **Create** |

## Out of Scope

- **DO NOT** modify GateConstraintAnalyzer - that's EXPDIA-002
- **DO NOT** implement MonteCarloSimulator - that's EXPDIA-007
- **DO NOT** create DI registration - that's EXPDIA-005
- **DO NOT** create UI components - that's EXPDIA-006
- **DO NOT** modify EmotionCalculatorService

## Implementation Details

### IntensityBoundsCalculator Service

```javascript
/**
 * @file IntensityBoundsCalculator - Calculates max/min intensity for prototypes
 * @see specs/expression-diagnostics.md Layer A.2
 */

import { AxisInterval } from '../models/index.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {Object} IntensityBounds
 * @property {number} min - Minimum achievable intensity [0, 1]
 * @property {number} max - Maximum achievable intensity [0, 1]
 * @property {boolean} isUnbounded - True if no constraints applied
 */

/**
 * @typedef {Object} ThresholdReachability
 * @property {boolean} isReachable - True if threshold can be achieved
 * @property {number} threshold - Required threshold
 * @property {number} maxPossible - Maximum achievable intensity
 * @property {number} gap - How far from reachable (threshold - maxPossible)
 */

class IntensityBoundsCalculator {
  /** @type {object} */
  #dataRegistry;

  /** @type {object} */
  #logger;

  /**
   * @param {Object} deps
   * @param {object} deps.dataRegistry - IDataRegistry for prototype lookups
   * @param {object} deps.logger - ILogger
   */
  constructor({ dataRegistry, logger }) {
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get']
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });

    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
  }

  /**
   * Calculate intensity bounds for a prototype given axis constraints
   * @param {string} prototypeId - Emotion or sexual state prototype ID
   * @param {string} type - 'emotion' or 'sexual'
   * @param {Map<string, AxisInterval>} [axisConstraints] - Optional pre-computed constraints
   * @returns {IntensityBounds}
   */
  calculateBounds(prototypeId, type, axisConstraints = new Map()) {
    const prototype = this.#getPrototype(prototypeId, type);

    if (!prototype) {
      this.#logger.warn(`Prototype not found: ${prototypeId} (${type})`);
      return { min: 0, max: 0, isUnbounded: false };
    }

    const weights = prototype.weights;
    if (!weights || Object.keys(weights).length === 0) {
      return { min: 0, max: 0, isUnbounded: false };
    }

    // Calculate sum of absolute weights for normalization
    const sumAbsWeights = Object.values(weights).reduce(
      (sum, w) => sum + Math.abs(w),
      0
    );

    if (sumAbsWeights === 0) {
      return { min: 0, max: 0, isUnbounded: false };
    }

    let maxRawSum = 0;
    let minRawSum = 0;

    for (const [axis, weight] of Object.entries(weights)) {
      const bounds = axisConstraints.get(axis) || this.#getDefaultInterval(axis);

      if (weight > 0) {
        // Positive weight: max uses bounds.max, min uses bounds.min
        maxRawSum += weight * bounds.max;
        minRawSum += weight * bounds.min;
      } else {
        // Negative weight: max uses bounds.min, min uses bounds.max
        maxRawSum += weight * bounds.min;
        minRawSum += weight * bounds.max;
      }
    }

    return {
      min: this.#clamp01(minRawSum / sumAbsWeights),
      max: this.#clamp01(maxRawSum / sumAbsWeights),
      isUnbounded: axisConstraints.size === 0
    };
  }

  /**
   * Check if a threshold is reachable for a prototype
   * @param {string} prototypeId
   * @param {string} type - 'emotion' or 'sexual'
   * @param {number} threshold - Required intensity threshold
   * @param {Map<string, AxisInterval>} [axisConstraints]
   * @returns {ThresholdReachability}
   */
  checkThresholdReachability(prototypeId, type, threshold, axisConstraints = new Map()) {
    const bounds = this.calculateBounds(prototypeId, type, axisConstraints);

    return {
      isReachable: bounds.max >= threshold,
      threshold,
      maxPossible: bounds.max,
      gap: Math.max(0, threshold - bounds.max)
    };
  }

  /**
   * Analyze all intensity requirements in an expression
   * @param {object} expression
   * @param {Map<string, AxisInterval>} [axisConstraints] - From GateConstraintAnalyzer
   * @returns {ThresholdReachability[]}
   */
  analyzeExpression(expression, axisConstraints = new Map()) {
    if (!expression?.prerequisites) {
      return [];
    }

    const results = [];
    const requirements = this.#extractThresholdRequirements(expression.prerequisites);

    for (const { prototypeId, type, threshold } of requirements) {
      const reachability = this.checkThresholdReachability(
        prototypeId,
        type,
        threshold,
        axisConstraints
      );

      if (!reachability.isReachable) {
        results.push({
          prototypeId,
          type,
          ...reachability
        });
      }
    }

    return results;
  }

  /**
   * Extract threshold requirements from prerequisites
   * @private
   */
  #extractThresholdRequirements(prerequisites) {
    const requirements = [];

    for (const prereq of prerequisites) {
      this.#extractFromLogic(prereq.logic, requirements);
    }

    return requirements;
  }

  /**
   * Recursively extract threshold requirements from JSON Logic
   * @private
   */
  #extractFromLogic(logic, results) {
    if (!logic || typeof logic !== 'object') return;

    // Check for >= comparisons
    if (logic['>=']) {
      const [left, right] = logic['>='];
      if (typeof left === 'object' && left.var && typeof right === 'number') {
        const varPath = left.var;
        if (varPath.startsWith('emotions.')) {
          results.push({
            prototypeId: varPath.replace('emotions.', ''),
            type: 'emotion',
            threshold: right
          });
        } else if (varPath.startsWith('sexualStates.')) {
          results.push({
            prototypeId: varPath.replace('sexualStates.', ''),
            type: 'sexual',
            threshold: right
          });
        }
      }
    }

    // Recurse into nested logic
    if (logic.and || logic.or) {
      const clauses = logic.and || logic.or;
      for (const clause of clauses) {
        this.#extractFromLogic(clause, results);
      }
    }
  }

  /**
   * Get prototype definition from dataRegistry
   * @private
   */
  #getPrototype(prototypeId, type) {
    const lookupId = type === 'emotion'
      ? 'core:emotion_prototypes'
      : 'core:sexual_prototypes';

    const lookup = this.#dataRegistry.get('lookups', lookupId);
    return lookup?.entries?.[prototypeId] || null;
  }

  /**
   * Get default interval bounds for an axis
   * @private
   */
  #getDefaultInterval(axis) {
    const sexualAxes = ['sex_excitation', 'sex_inhibition', 'baseline_libido', 'sexual_arousal'];
    if (sexualAxes.includes(axis)) {
      return AxisInterval.forSexualAxis();
    }
    return AxisInterval.forMoodAxis();
  }

  /**
   * Clamp value to [0, 1] range
   * @private
   */
  #clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }
}

export default IntensityBoundsCalculator;
```

### Test Fixture

```json
// tests/fixtures/expressionDiagnostics/impossibleThreshold.expression.json
{
  "id": "test:impossible_threshold",
  "description": "Expression requiring unreachable intensity",
  "priority": 100,
  "prerequisites": [
    {
      "logic": {
        ">=": [{ "var": "emotions.ecstasy" }, 0.95]
      }
    }
  ],
  "_comment": "ecstasy has weight structure that caps max intensity around 0.70"
}
```

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/services/intensityBoundsCalculator.test.js --verbose
```

### Unit Test Coverage Requirements

**intensityBoundsCalculator.test.js:**
- Constructor throws if dataRegistry is missing
- Constructor throws if logger is missing
- `calculateBounds()` returns {min: 0, max: 0} for prototype with no weights
- `calculateBounds()` correctly computes max for positive weights
- `calculateBounds()` correctly computes min for positive weights
- `calculateBounds()` correctly handles negative weights
- `calculateBounds()` respects axis constraints
- `calculateBounds()` clamps results to [0, 1]
- `checkThresholdReachability()` returns isReachable=true when max >= threshold
- `checkThresholdReachability()` returns isReachable=false when max < threshold
- `checkThresholdReachability()` calculates correct gap
- `analyzeExpression()` returns empty array for reachable expressions
- `analyzeExpression()` identifies all unreachable thresholds
- Missing prototype returns {min: 0, max: 0}

### Invariants That Must Remain True

1. **Bounds are always in [0, 1] range** - clamping applied correctly
2. **Negative weights handled correctly** - max uses min value, min uses max value
3. **Zero weights return {0, 0}** - degenerate case handled
4. **Missing prototypes don't throw** - log warning and return {0, 0}
5. **Does not modify inputs** - Axis constraints map remains unchanged

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/intensityBoundsCalculator.test.js --verbose

# Type checking
npm run typecheck
```

## Definition of Done

- [x] `IntensityBoundsCalculator.js` created with all methods implemented
- [x] `services/index.js` updated with export
- [x] Test fixture `impossibleThreshold.expression.json` created
- [x] Unit tests cover all public methods
- [x] Tests cover edge cases (zero weights, negative weights, missing prototypes)
- [x] JSDoc documentation complete
- [x] All tests pass (27 tests)
- [x] No modifications to existing emotion/expression services

## Status: COMPLETED

## Outcome

### What was actually changed vs originally planned

**Ticket Corrections (Before Implementation):**
1. **DataRegistry API**: The ticket originally assumed `dataRegistry.getLookupData(lookupId)` but the actual codebase uses `dataRegistry.get('lookups', lookupId)`. The ticket was corrected to match the existing GateConstraintAnalyzer pattern.
2. **Dependency Validation**: Changed `requiredMethods: ['getLookupData']` to `requiredMethods: ['get']` to match actual IDataRegistry interface.
3. **Logger Validation**: Added `'info'` to required logger methods to match GateConstraintAnalyzer pattern.

**Implementation Details:**
- All methods implemented as specified in the corrected ticket
- 27 unit tests created covering all acceptance criteria plus additional edge cases
- Test fixture created as specified
- Service follows the exact same patterns as GateConstraintAnalyzer (sibling service from EXPDIA-002)

**Files Created/Modified:**
- `src/expressionDiagnostics/services/IntensityBoundsCalculator.js` (created)
- `src/expressionDiagnostics/services/index.js` (modified - added export)
- `tests/unit/expressionDiagnostics/services/intensityBoundsCalculator.test.js` (created)
- `tests/fixtures/expressionDiagnostics/impossibleThreshold.expression.json` (created)

**No modifications to existing emotion/expression services** as required by scope constraints.
