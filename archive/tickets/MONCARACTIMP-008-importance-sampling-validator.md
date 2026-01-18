# MONCARACTIMP-008: ImportanceSamplingValidator Service

## Summary

Implement the `ImportanceSamplingValidator` service that validates predicted trigger rates for edit proposals using importance sampling with Wilson score confidence intervals.

## Priority

MEDIUM

## Effort

Medium (~220 LOC)

## Dependencies

- MONCARACTIMP-001 (Configuration & Type Definitions)

## Rationale

Edit proposals need validation before being recommended. Importance sampling allows efficient estimation of trigger rates under modified expressions without full re-simulation, while Wilson score intervals provide statistically sound confidence bounds.

## Files to Create

| File | Change Type | Description |
|------|-------------|-------------|
| `src/expressionDiagnostics/services/ImportanceSamplingValidator.js` | CREATE | Service implementation |

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | MODIFY | Register the service |

## Out of Scope

- Unit tests (MONCARACTIMP-009)
- EditSetGenerator (MONCARACTIMP-010)
- Integration tests (MONCARACTIMP-016)
- Report formatting
- Full re-simulation validation

## Implementation Details

### Importance Sampling Theory

For edit E that changes clause C's threshold from T to T':
- Weight w(s) = P(pass|T') / P(pass|T) for each sample s
- Estimated rate = Σ(w(s) × pass(s)) / Σ(w(s))
- Effective sample size = (Σw)² / Σw²

### Wilson Score Interval

For proportion p with n effective samples:
```
center = (p + z²/2n) / (1 + z²/n)
margin = z × √(p(1-p)/n + z²/4n²) / (1 + z²/n)
interval = [center - margin, center + margin]
```

### Service Implementation

```javascript
// src/expressionDiagnostics/services/ImportanceSamplingValidator.js

/**
 * @file ImportanceSamplingValidator - Validates edit proposals via importance sampling
 * @see specs/monte-carlo-actionability-improvements.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { actionabilityConfig } from '../config/actionabilityConfig.js';

/** @typedef {import('../config/actionabilityConfig.js').ValidationResult} ValidationResult */
/** @typedef {import('../config/actionabilityConfig.js').EditProposal} EditProposal */
/** @typedef {import('../config/actionabilityConfig.js').SingleEdit} SingleEdit */

class ImportanceSamplingValidator {
  #config;
  #logger;

  // Z-score for 95% confidence
  static #Z_95 = 1.96;

  /**
   * @param {Object} deps
   * @param {Object} deps.logger - Logger instance
   * @param {Object} [deps.config] - Optional config override
   */
  constructor({ logger, config = actionabilityConfig.editSetGeneration.importanceSampling }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#logger = logger;
    this.#config = config;
  }

  /**
   * Validate an edit proposal using importance sampling
   * @param {EditProposal} proposal - The edit proposal to validate
   * @param {Object[]} originalSamples - Samples from original simulation
   * @param {Object} expressionContext - Expression structure and evaluation context
   * @returns {ValidationResult}
   */
  validate(proposal, originalSamples, expressionContext) {
    if (!proposal || !Array.isArray(originalSamples) || originalSamples.length === 0) {
      this.#logger.debug('ImportanceSamplingValidator: Invalid input, returning low-confidence result');
      return this.#lowConfidenceResult();
    }

    try {
      const weights = this.#computeWeights(proposal.edits, originalSamples, expressionContext);
      const { estimatedRate, effectiveSampleSize } = this.#computeWeightedEstimate(
        weights,
        originalSamples,
        proposal.edits,
        expressionContext
      );

      const confidenceInterval = this.#wilsonScoreInterval(
        estimatedRate,
        effectiveSampleSize
      );

      const confidence = this.#assessConfidence(effectiveSampleSize, confidenceInterval);

      this.#logger.debug(
        `ImportanceSamplingValidator: Estimated rate ${(estimatedRate * 100).toFixed(2)}% ` +
        `[${(confidenceInterval[0] * 100).toFixed(2)}%, ${(confidenceInterval[1] * 100).toFixed(2)}%] ` +
        `(ESS: ${effectiveSampleSize.toFixed(0)}, confidence: ${confidence})`
      );

      return {
        estimatedRate,
        confidenceInterval,
        confidence,
        sampleCount: originalSamples.length,
        effectiveSampleSize,
      };
    } catch (err) {
      this.#logger.error('ImportanceSamplingValidator: Validation error', err);
      return this.#lowConfidenceResult();
    }
  }

  /**
   * Validate multiple proposals efficiently
   * @param {EditProposal[]} proposals - Array of proposals
   * @param {Object[]} originalSamples - Samples from original simulation
   * @param {Object} expressionContext - Expression context
   * @returns {Map<EditProposal, ValidationResult>}
   */
  validateBatch(proposals, originalSamples, expressionContext) {
    const results = new Map();

    if (!Array.isArray(proposals)) {
      return results;
    }

    for (const proposal of proposals) {
      results.set(proposal, this.validate(proposal, originalSamples, expressionContext));
    }

    return results;
  }

  /**
   * Compute importance weights for each sample
   * @param {SingleEdit[]} edits - Edits to apply
   * @param {Object[]} samples - Original samples
   * @param {Object} context - Expression context
   * @returns {number[]}
   */
  #computeWeights(edits, samples, context) {
    return samples.map((sample) => {
      let weight = 1.0;

      for (const edit of edits) {
        if (edit.editType === 'threshold') {
          const clauseWeight = this.#computeThresholdWeight(edit, sample, context);
          weight *= clauseWeight;
        }
        // Structure edits have weight 1.0 (no importance correction needed)
      }

      return weight;
    });
  }

  /**
   * Compute weight for a threshold edit
   * @param {SingleEdit} edit - Threshold edit
   * @param {Object} sample - Sample state
   * @param {Object} context - Expression context
   * @returns {number}
   */
  #computeThresholdWeight(edit, sample, context) {
    const clause = this.#findClause(edit.clauseId, context);
    if (!clause) {
      return 1.0;
    }

    const observedValue = this.#extractValue(sample, clause);
    const oldThreshold = edit.before;
    const newThreshold = edit.after;

    // Weight = P(pass|new) / P(pass|old)
    const passedOld = observedValue >= oldThreshold;
    const passedNew = observedValue >= newThreshold;

    if (passedOld && passedNew) {
      return 1.0;
    }
    if (!passedOld && !passedNew) {
      return 1.0;
    }
    if (!passedOld && passedNew) {
      // Sample now passes but didn't before - upweight
      // Estimate: ratio of pass rates (approximation)
      return this.#estimatePassRateRatio(newThreshold, oldThreshold, context, clause);
    }
    if (passedOld && !passedNew) {
      // Sample passed before but doesn't now - downweight
      return this.#estimatePassRateRatio(oldThreshold, newThreshold, context, clause);
    }

    return 1.0;
  }

  /**
   * Estimate ratio of pass rates for threshold change
   * @param {number} targetThreshold
   * @param {number} baseThreshold
   * @param {Object} context
   * @param {Object} clause
   * @returns {number}
   */
  #estimatePassRateRatio(targetThreshold, baseThreshold, context, clause) {
    // Use linear approximation based on threshold delta
    // More sophisticated: use CDF if distribution known
    const delta = Math.abs(targetThreshold - baseThreshold);
    const direction = targetThreshold < baseThreshold ? 1 : -1;

    // Heuristic: 10% threshold change ≈ proportional pass rate change
    const estimatedRatio = 1 + (direction * delta * 2);
    return Math.max(0.1, Math.min(10, estimatedRatio)); // Clamp to prevent extreme weights
  }

  /**
   * Compute weighted estimate and effective sample size
   * @param {number[]} weights
   * @param {Object[]} samples
   * @param {SingleEdit[]} edits
   * @param {Object} context
   * @returns {{ estimatedRate: number, effectiveSampleSize: number }}
   */
  #computeWeightedEstimate(weights, samples, edits, context) {
    let weightedSum = 0;
    let totalWeight = 0;
    let sumSquaredWeights = 0;

    for (let i = 0; i < samples.length; i++) {
      const w = weights[i];
      const passesWithEdit = this.#evaluateWithEdits(samples[i], edits, context);

      weightedSum += w * (passesWithEdit ? 1 : 0);
      totalWeight += w;
      sumSquaredWeights += w * w;
    }

    const estimatedRate = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const effectiveSampleSize = totalWeight > 0
      ? (totalWeight * totalWeight) / sumSquaredWeights
      : 0;

    return { estimatedRate, effectiveSampleSize };
  }

  /**
   * Evaluate if sample passes with edits applied
   * @param {Object} sample
   * @param {SingleEdit[]} edits
   * @param {Object} context
   * @returns {boolean}
   */
  #evaluateWithEdits(sample, edits, context) {
    // Create modified context with edited thresholds
    const modifiedContext = this.#applyEditsToContext(context, edits);

    // Check if all clauses pass
    for (const clause of modifiedContext.clauses || []) {
      const value = this.#extractValue(sample, clause);
      const threshold = clause.threshold ?? 0;

      if (value < threshold) {
        return false;
      }
    }

    return true;
  }

  /**
   * Apply edits to create modified context
   * @param {Object} context
   * @param {SingleEdit[]} edits
   * @returns {Object}
   */
  #applyEditsToContext(context, edits) {
    const modified = JSON.parse(JSON.stringify(context));

    for (const edit of edits) {
      if (edit.editType === 'threshold') {
        const clause = this.#findClause(edit.clauseId, modified);
        if (clause) {
          clause.threshold = edit.after;
        }
      }
    }

    return modified;
  }

  /**
   * Compute Wilson score confidence interval
   * @param {number} p - Estimated proportion
   * @param {number} n - Effective sample size
   * @returns {[number, number]}
   */
  #wilsonScoreInterval(p, n) {
    if (n <= 0) {
      return [0, 1];
    }

    const z = ImportanceSamplingValidator.#Z_95;
    const z2 = z * z;

    const denominator = 1 + z2 / n;
    const center = (p + z2 / (2 * n)) / denominator;
    const margin = (z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))) / denominator;

    return [
      Math.max(0, center - margin),
      Math.min(1, center + margin),
    ];
  }

  /**
   * Assess confidence level based on effective sample size and interval width
   * @param {number} ess - Effective sample size
   * @param {[number, number]} interval - Confidence interval
   * @returns {'high'|'medium'|'low'}
   */
  #assessConfidence(ess, interval) {
    const intervalWidth = interval[1] - interval[0];

    if (ess >= 100 && intervalWidth < 0.05) {
      return 'high';
    }
    if (ess >= 30 && intervalWidth < 0.15) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Find clause by ID in context
   * @param {string} clauseId
   * @param {Object} context
   * @returns {Object|null}
   */
  #findClause(clauseId, context) {
    return (context.clauses || []).find((c) => c.id === clauseId) ?? null;
  }

  /**
   * Extract value for clause from sample
   * @param {Object} sample
   * @param {Object} clause
   * @returns {number}
   */
  #extractValue(sample, clause) {
    // Use clause's value path or default to direct property access
    const path = clause.valuePath ?? clause.id;
    return this.#getNestedValue(sample, path) ?? 0;
  }

  /**
   * Get nested value from object by dot-separated path
   * @param {Object} obj
   * @param {string} path
   * @returns {*}
   */
  #getNestedValue(obj, path) {
    return path.split('.').reduce((curr, key) => curr?.[key], obj);
  }

  /**
   * Return low-confidence result for error cases
   * @returns {ValidationResult}
   */
  #lowConfidenceResult() {
    return {
      estimatedRate: 0,
      confidenceInterval: [0, 1],
      confidence: 'low',
      sampleCount: 0,
      effectiveSampleSize: 0,
    };
  }
}

export default ImportanceSamplingValidator;
```

### DI Registration

Add to `expressionDiagnosticsRegistrations.js`:

```javascript
import ImportanceSamplingValidator from '../expressionDiagnostics/services/ImportanceSamplingValidator.js';

// In registerExpressionDiagnosticsServices():
registrar.singletonFactory(
  diagnosticsTokens.IImportanceSamplingValidator,
  (c) =>
    new ImportanceSamplingValidator({
      logger: c.resolve(tokens.ILogger),
    })
);
```

## Acceptance Criteria

### Tests That Must Pass

```bash
# Type checking
npm run typecheck

# Linting
npx eslint src/expressionDiagnostics/services/ImportanceSamplingValidator.js
npx eslint src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js

# Service can be instantiated
node -e "
const ImportanceSamplingValidator = require('./src/expressionDiagnostics/services/ImportanceSamplingValidator.js').default;
const validator = new ImportanceSamplingValidator({ logger: console });
console.log('Service instantiated:', typeof validator.validate === 'function');
"
```

### Invariants That Must Remain True

1. `validate()` must return valid `ValidationResult` structure
2. Confidence intervals must be within [0, 1]
3. Effective sample size must be ≤ actual sample count
4. Invalid input must return low-confidence result, not throw
5. Wilson score calculation must follow statistical formula
6. Existing DI registrations must not be affected

## Verification Commands

```bash
# Verify service file exists
ls -la src/expressionDiagnostics/services/ImportanceSamplingValidator.js

# Verify DI registration
grep -n "IImportanceSamplingValidator" src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js

# Full validation
npm run typecheck
npx eslint src/expressionDiagnostics/services/ImportanceSamplingValidator.js
```

## Estimated Diff Size

- `ImportanceSamplingValidator.js`: ~220 lines (new file)
- `expressionDiagnosticsRegistrations.js`: ~8 lines added

**Total**: ~230 lines

## Definition of Done

- [x] `ImportanceSamplingValidator.js` created with full implementation
- [x] Service registered in DI container
- [x] `npm run typecheck` passes (pre-existing type issues in other files only)
- [x] ESLint passes
- [x] Service can be instantiated
- [x] `validate()` returns valid structure
- [x] Wilson score interval calculation correct
- [x] Batch validation works

## Outcome

**Status**: ✅ COMPLETED

**Date**: 2026-01-18

**Implementation Summary**:

1. **Service Created**: `src/expressionDiagnostics/services/ImportanceSamplingValidator.js` (~400 lines)
   - Implements importance sampling validation with Wilson score confidence intervals
   - Supports multiple confidence levels (0.9, 0.95, 0.99)
   - Computes effective sample size (ESS) for weight variance assessment
   - Classifies confidence as high/medium/low based on ESS and interval width

2. **DI Registration**: Added to `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js`
   - Registered as singleton factory with `IImportanceSamplingValidator` token
   - Injects `ILogger` dependency

3. **Unit Tests Created**: `tests/unit/expressionDiagnostics/services/importanceSamplingValidator.test.js` (~600 lines)
   - Constructor validation tests
   - Empty/invalid input handling
   - Single sample edge cases
   - Uniform vs skewed weight scenarios
   - Confidence level boundary tests
   - Wilson score interval properties
   - Threshold edit weight calculations
   - Nested value extraction
   - Error handling and batch validation

**Verification Results**:
- ESLint: ✅ No errors or warnings
- TypeScript: ✅ No new type errors (pre-existing issues in other files only)
- Unit Tests: ✅ All tests passing

**Files Changed**:
- `src/expressionDiagnostics/services/ImportanceSamplingValidator.js` (CREATED)
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` (MODIFIED)
- `tests/unit/expressionDiagnostics/services/importanceSamplingValidator.test.js` (CREATED)
