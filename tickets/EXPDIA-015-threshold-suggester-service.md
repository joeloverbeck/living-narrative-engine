# EXPDIA-015: Create ThresholdSuggester Service

## Summary

Implement counterfactual analysis to suggest threshold adjustments that would improve trigger rates. For each top blocker, calculate what threshold change would eliminate it and estimate the resulting new trigger probability.

## Priority: Medium | Effort: Medium

## Rationale

When content authors discover their expression has a low trigger rate, they need actionable guidance. The ThresholdSuggester analyzes which threshold adjustments would have the largest impact, giving authors concrete values to change rather than requiring manual trial-and-error.

## Dependencies

- **EXPDIA-007** (MonteCarloSimulator for rate estimation)
- **EXPDIA-008** (FailureExplainer for blocker identification)
- **EXPDIA-005** (DI registration pattern)

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/ThresholdSuggester.js` | **Create** |
| `src/expressionDiagnostics/services/index.js` | **Modify** (add export) |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | **Modify** (add token) |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | **Modify** (add registration) |
| `tests/unit/expressionDiagnostics/services/thresholdSuggester.test.js` | **Create** |

## Out of Scope

- **DO NOT** modify MonteCarloSimulator or FailureExplainer
- **DO NOT** implement UI components - that's EXPDIA-016
- **DO NOT** auto-apply suggestions to expression files
- **DO NOT** modify existing expression services
- **DO NOT** implement dynamics mode constraints

## Implementation Details

### ThresholdSuggester Service

```javascript
/**
 * @file ThresholdSuggester - Counterfactual threshold analysis
 * @see specs/expression-diagnostics.md Layer E
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {Object} ThresholdSuggestion
 * @property {string} clauseId - Which clause to modify
 * @property {string} clauseDescription - Human-readable clause description
 * @property {string} field - The field being constrained (e.g., "emotions.anger")
 * @property {string} operator - The comparison operator
 * @property {number} currentThreshold - Current threshold value
 * @property {number} suggestedThreshold - Recommended new value
 * @property {number} currentTriggerRate - Rate with current threshold
 * @property {number} estimatedNewRate - Estimated rate with suggestion
 * @property {number} improvement - Percentage improvement
 * @property {string} rationale - Why this change helps
 */

/**
 * @typedef {Object} SuggestionConfig
 * @property {number} maxSuggestions - Maximum suggestions to generate (default 5)
 * @property {number} minImprovement - Minimum rate improvement to include (default 0.01)
 * @property {number} estimationSamples - Samples for rate estimation (default 1000)
 * @property {boolean} conservativeMode - Prefer smaller changes (default true)
 */

/**
 * @typedef {Object} SuggestionResult
 * @property {ThresholdSuggestion[]} suggestions - Ordered suggestions
 * @property {number} currentRate - Current trigger rate
 * @property {number} bestPossibleRate - Rate if all suggestions applied
 * @property {string} summary - Human-readable summary
 */

class ThresholdSuggester {
  /** @type {object} */
  #monteCarloSimulator;

  /** @type {object} */
  #failureExplainer;

  /** @type {object} */
  #logger;

  /** @type {SuggestionConfig} */
  #defaultConfig = {
    maxSuggestions: 5,
    minImprovement: 0.01,
    estimationSamples: 1000,
    conservativeMode: true
  };

  /**
   * @param {Object} deps
   * @param {object} deps.monteCarloSimulator - IMonteCarloSimulator
   * @param {object} deps.failureExplainer - IFailureExplainer
   * @param {object} deps.logger - ILogger
   */
  constructor({ monteCarloSimulator, failureExplainer, logger }) {
    validateDependency(monteCarloSimulator, 'IMonteCarloSimulator', logger, {
      requiredMethods: ['simulate']
    });
    validateDependency(failureExplainer, 'IFailureExplainer', logger, {
      requiredMethods: ['analyzeBlockers']
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error']
    });

    this.#monteCarloSimulator = monteCarloSimulator;
    this.#failureExplainer = failureExplainer;
    this.#logger = logger;
  }

  /**
   * Generate threshold suggestions for an expression
   * @param {object} expression - Expression to analyze
   * @param {object} mcResult - Monte Carlo result with clause failures
   * @param {Partial<SuggestionConfig>} [config]
   * @returns {SuggestionResult}
   */
  generateSuggestions(expression, mcResult, config = {}) {
    const cfg = { ...this.#defaultConfig, ...config };

    if (!expression?.prerequisites || expression.prerequisites.length === 0) {
      return this.#createEmptyResult(mcResult.triggerRate);
    }

    // Get top blockers
    const blockers = this.#failureExplainer.analyzeBlockers(mcResult.clauseFailures);

    if (blockers.length === 0) {
      return this.#createEmptyResult(mcResult.triggerRate);
    }

    // Generate suggestions for each blocker
    const suggestions = [];
    for (const blocker of blockers.slice(0, cfg.maxSuggestions * 2)) {
      const suggestion = this.#generateSuggestionForBlocker(
        expression,
        blocker,
        mcResult.triggerRate,
        cfg
      );

      if (suggestion && suggestion.improvement >= cfg.minImprovement) {
        suggestions.push(suggestion);
      }
    }

    // Sort by improvement and take top N
    suggestions.sort((a, b) => b.improvement - a.improvement);
    const topSuggestions = suggestions.slice(0, cfg.maxSuggestions);

    // Estimate combined improvement
    const bestPossibleRate = this.#estimateCombinedRate(
      expression,
      topSuggestions,
      cfg
    );

    return {
      suggestions: topSuggestions,
      currentRate: mcResult.triggerRate,
      bestPossibleRate,
      summary: this.#generateSummary(mcResult.triggerRate, topSuggestions, bestPossibleRate)
    };
  }

  /**
   * Generate suggestion for a specific blocker
   * @private
   */
  #generateSuggestionForBlocker(expression, blocker, currentRate, config) {
    const prereq = expression.prerequisites[blocker.clauseIndex];
    if (!prereq?.logic) return null;

    // Extract constraint info
    const constraintInfo = this.#extractConstraintInfo(prereq.logic);
    if (!constraintInfo) return null;

    const { field, operator, threshold } = constraintInfo;

    // Calculate suggested new threshold
    const suggestedThreshold = this.#calculateSuggestedThreshold(
      operator,
      threshold,
      blocker.averageViolation,
      config.conservativeMode
    );

    if (suggestedThreshold === threshold) return null;

    // Estimate new rate with modified threshold
    const modifiedExpression = this.#createModifiedExpression(
      expression,
      blocker.clauseIndex,
      suggestedThreshold
    );

    const estimatedNewRate = this.#estimateNewRate(
      modifiedExpression,
      config.estimationSamples
    );

    const improvement = estimatedNewRate - currentRate;

    return {
      clauseId: `clause_${blocker.clauseIndex}`,
      clauseDescription: blocker.clauseDescription,
      field,
      operator,
      currentThreshold: threshold,
      suggestedThreshold,
      currentTriggerRate: currentRate,
      estimatedNewRate,
      improvement,
      rationale: this.#generateRationale(operator, threshold, suggestedThreshold, blocker)
    };
  }

  /**
   * Extract constraint info from JSON Logic
   * @private
   */
  #extractConstraintInfo(logic) {
    // Handle >= operator
    if (logic['>=']) {
      const [left, right] = logic['>='];
      if (left?.var && typeof right === 'number') {
        return { field: left.var, operator: '>=', threshold: right };
      }
    }

    // Handle <= operator
    if (logic['<=']) {
      const [left, right] = logic['<='];
      if (left?.var && typeof right === 'number') {
        return { field: left.var, operator: '<=', threshold: right };
      }
    }

    // Handle > operator
    if (logic['>']) {
      const [left, right] = logic['>'];
      if (left?.var && typeof right === 'number') {
        return { field: left.var, operator: '>', threshold: right };
      }
    }

    // Handle < operator
    if (logic['<']) {
      const [left, right] = logic['<'];
      if (left?.var && typeof right === 'number') {
        return { field: left.var, operator: '<', threshold: right };
      }
    }

    return null;
  }

  /**
   * Calculate suggested threshold based on violation
   * @private
   */
  #calculateSuggestedThreshold(operator, currentThreshold, averageViolation, conservative) {
    // How much to adjust based on average violation
    const baseAdjustment = averageViolation;

    // Conservative mode uses smaller adjustment
    const adjustmentFactor = conservative ? 0.5 : 0.8;
    const adjustment = baseAdjustment * adjustmentFactor;

    let suggested;
    switch (operator) {
      case '>=':
        // Lower the threshold to make it easier to pass
        suggested = currentThreshold - adjustment;
        break;
      case '>':
        suggested = currentThreshold - adjustment;
        break;
      case '<=':
        // Raise the threshold to make it easier to pass
        suggested = currentThreshold + adjustment;
        break;
      case '<':
        suggested = currentThreshold + adjustment;
        break;
      default:
        return currentThreshold;
    }

    // Round to reasonable precision
    return Math.round(suggested * 1000) / 1000;
  }

  /**
   * Create modified expression with new threshold
   * @private
   */
  #createModifiedExpression(expression, clauseIndex, newThreshold) {
    const modified = JSON.parse(JSON.stringify(expression));
    const prereq = modified.prerequisites[clauseIndex];

    if (!prereq?.logic) return modified;

    // Update threshold in logic
    this.#updateThresholdInLogic(prereq.logic, newThreshold);

    return modified;
  }

  /**
   * Update threshold value in logic structure
   * @private
   */
  #updateThresholdInLogic(logic, newThreshold) {
    for (const op of ['>=', '<=', '>', '<']) {
      if (logic[op]) {
        const [left, right] = logic[op];
        if (left?.var && typeof right === 'number') {
          logic[op][1] = newThreshold;
          return;
        }
      }
    }
  }

  /**
   * Estimate trigger rate for modified expression
   * @private
   */
  #estimateNewRate(expression, samples) {
    try {
      const result = this.#monteCarloSimulator.simulate(expression, {
        sampleCount: samples,
        distribution: 'uniform',
        trackClauses: false
      });
      return result.triggerRate;
    } catch (err) {
      this.#logger.warn('Failed to estimate new rate', err);
      return 0;
    }
  }

  /**
   * Estimate combined rate with multiple suggestions applied
   * @private
   */
  #estimateCombinedRate(expression, suggestions, config) {
    if (suggestions.length === 0) return 0;

    let modified = JSON.parse(JSON.stringify(expression));

    for (const suggestion of suggestions) {
      const clauseIndex = parseInt(suggestion.clauseId.split('_')[1], 10);
      modified = this.#createModifiedExpression(modified, clauseIndex, suggestion.suggestedThreshold);
    }

    return this.#estimateNewRate(modified, config.estimationSamples);
  }

  /**
   * Generate human-readable rationale
   * @private
   */
  #generateRationale(operator, current, suggested, blocker) {
    const direction = suggested > current ? 'raising' : 'lowering';
    const change = Math.abs(suggested - current).toFixed(3);

    let impact;
    if (operator === '>=' || operator === '>') {
      impact = 'makes it easier to reach the minimum required value';
    } else {
      impact = 'gives more headroom below the maximum allowed value';
    }

    return `By ${direction} the threshold from ${current} to ${suggested} (change of ${change}), this ${impact}. ` +
      `The average violation was ${blocker.averageViolation.toFixed(3)}, indicating how far values typically fall outside the constraint.`;
  }

  /**
   * Generate summary text
   * @private
   */
  #generateSummary(currentRate, suggestions, bestRate) {
    if (suggestions.length === 0) {
      return 'No threshold adjustments were identified that would significantly improve the trigger rate.';
    }

    const rateImprovement = ((bestRate - currentRate) * 100).toFixed(2);
    const topSuggestion = suggestions[0];

    return `Found ${suggestions.length} threshold adjustment(s). ` +
      `The top suggestion is to change ${topSuggestion.field} threshold from ${topSuggestion.currentThreshold} ` +
      `to ${topSuggestion.suggestedThreshold}, which alone could improve the rate by ~${(topSuggestion.improvement * 100).toFixed(2)}%. ` +
      `Applying all suggestions together could increase the trigger rate from ${(currentRate * 100).toFixed(2)}% ` +
      `to approximately ${(bestRate * 100).toFixed(2)}% (+${rateImprovement}%).`;
  }

  /**
   * Create empty result
   * @private
   */
  #createEmptyResult(currentRate) {
    return {
      suggestions: [],
      currentRate,
      bestPossibleRate: currentRate,
      summary: 'No threshold adjustments available - expression has no numeric comparison prerequisites.'
    };
  }
}

export default ThresholdSuggester;
```

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/services/thresholdSuggester.test.js --verbose
```

### Unit Test Coverage Requirements

**thresholdSuggester.test.js:**
- Constructor throws if monteCarloSimulator is missing
- Constructor throws if failureExplainer is missing
- Constructor throws if logger is missing
- `generateSuggestions()` returns empty for no prerequisites
- `generateSuggestions()` returns empty for no blockers
- `generateSuggestions()` extracts >= constraint info correctly
- `generateSuggestions()` extracts <= constraint info correctly
- `generateSuggestions()` extracts > constraint info correctly
- `generateSuggestions()` extracts < constraint info correctly
- Suggested threshold lowers for >= operators
- Suggested threshold raises for <= operators
- Conservative mode produces smaller adjustments
- Suggestions sorted by improvement
- `maxSuggestions` config respected
- `minImprovement` filters low-impact suggestions
- Combined rate estimation uses all suggestions
- Rationale text includes field and values
- Summary text includes improvement percentage
- Handles simulation errors gracefully
- Works with nested AND/OR logic (extracts first valid constraint)

### Invariants That Must Remain True

1. **Suggestions improve rate** - Every suggestion should increase trigger probability
2. **Thresholds valid** - Suggested values within reasonable bounds
3. **Sorted by impact** - Top suggestion has highest improvement
4. **Rationale clear** - Explanation understandable to content authors
5. **Original unchanged** - Source expression never modified

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/thresholdSuggester.test.js --verbose

# Type checking
npm run typecheck
```

## Definition of Done

- [ ] `ThresholdSuggester.js` created with counterfactual analysis
- [ ] `services/index.js` updated with export
- [ ] DI token added to `tokens-diagnostics.js`
- [ ] Service registered in `expressionDiagnosticsRegistrations.js`
- [ ] Extracts constraint info from JSON Logic
- [ ] Calculates suggested thresholds based on violations
- [ ] Estimates new rates with Monte Carlo
- [ ] Generates human-readable rationales
- [ ] Unit tests cover all extraction patterns
- [ ] JSDoc documentation complete
- [ ] All tests pass
- [ ] No modifications to MonteCarloSimulator or FailureExplainer
