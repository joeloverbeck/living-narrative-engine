# EXPDIA-008: Create FailureExplainer Service

## Status: ✅ COMPLETED (2026-01-08)

## Summary

Analyze Monte Carlo clause failure data and generate human-readable explanations. This service transforms raw statistical data into actionable insights that help content authors understand why expressions are rare or failing.

## Priority: Medium | Effort: Small

## Rationale

Raw failure rates aren't immediately actionable. Content authors need to understand *why* clauses fail and *what* they can do about it. This service bridges the gap between statistical data and practical guidance.

## Dependencies

- **EXPDIA-007** (MonteCarloSimulator provides clause failure data)
- **EXPDIA-004** (DiagnosticResult model)

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/FailureExplainer.js` | **Create** |
| `src/expressionDiagnostics/services/index.js` | **Modify** (add export) |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | **Modify** (add token) |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | **Modify** (add registration) |
| `tests/unit/expressionDiagnostics/services/failureExplainer.test.js` | **Create** |

## Out of Scope

- **DO NOT** modify MonteCarloSimulator - that's EXPDIA-007
- **DO NOT** implement ThresholdSuggester - that's EXPDIA-015
- **DO NOT** create UI components - that's EXPDIA-009
- **DO NOT** implement any simulation logic

## Implementation Details

### FailureExplainer Service

```javascript
/**
 * @file FailureExplainer - Generates human-readable failure explanations
 * @see specs/expression-diagnostics.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {Object} FailureExplanation
 * @property {string} summary - One-line summary
 * @property {string} detail - Detailed explanation
 * @property {string} severity - 'critical' | 'high' | 'medium' | 'low'
 * @property {string[]} suggestions - Actionable suggestions
 */

/**
 * @typedef {Object} BlockerAnalysis
 * @property {string} clauseDescription
 * @property {number} failureRate
 * @property {number} averageViolation
 * @property {FailureExplanation} explanation
 * @property {number} rank - 1 = worst blocker
 */

class FailureExplainer {
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
      requiredMethods: ['debug', 'warn', 'error']
    });

    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
  }

  /**
   * Analyze clause failures and generate explanations
   * @param {import('./MonteCarloSimulator.js').ClauseResult[]} clauseFailures
   * @param {object} [context] - Additional context (expression, etc.)
   * @returns {BlockerAnalysis[]}
   */
  analyzeBlockers(clauseFailures, context = {}) {
    if (!clauseFailures || clauseFailures.length === 0) {
      return [];
    }

    // Sort by failure rate descending
    const sorted = [...clauseFailures].sort((a, b) => b.failureRate - a.failureRate);

    return sorted.map((clause, index) => ({
      clauseDescription: clause.clauseDescription,
      failureRate: clause.failureRate,
      averageViolation: clause.averageViolation,
      explanation: this.#generateExplanation(clause, context),
      rank: index + 1
    }));
  }

  /**
   * Get top N blockers
   * @param {import('./MonteCarloSimulator.js').ClauseResult[]} clauseFailures
   * @param {number} [n=3] - Number of top blockers
   * @returns {BlockerAnalysis[]}
   */
  getTopBlockers(clauseFailures, n = 3) {
    const analyzed = this.analyzeBlockers(clauseFailures);
    return analyzed.slice(0, n);
  }

  /**
   * Generate overall summary for an expression
   * @param {number} triggerRate
   * @param {BlockerAnalysis[]} blockers
   * @returns {string}
   */
  generateSummary(triggerRate, blockers) {
    const ratePercent = (triggerRate * 100).toFixed(3);

    if (triggerRate === 0) {
      return `Expression never triggers. ${blockers.length > 0 ? `Primary blocker: ${blockers[0].clauseDescription}` : 'No specific blocker identified.'}`;
    }

    if (triggerRate < 0.0001) {
      return `Expression is extremely rare (${ratePercent}%). Top blocker: ${blockers[0]?.clauseDescription || 'Unknown'}`;
    }

    if (triggerRate < 0.01) {
      return `Expression triggers rarely (${ratePercent}%). ${blockers.length} clause(s) frequently fail.`;
    }

    if (triggerRate < 0.05) {
      return `Expression triggers occasionally (${ratePercent}%). Consider adjusting thresholds.`;
    }

    return `Expression triggers at healthy rate (${ratePercent}%).`;
  }

  /**
   * Generate explanation for a single clause failure
   * @private
   */
  #generateExplanation(clause, context) {
    const severity = this.#categorizeSeverity(clause.failureRate);
    const parsed = this.#parseClauseDescription(clause.clauseDescription);

    let summary = '';
    let detail = '';
    const suggestions = [];

    if (parsed.type === 'threshold') {
      summary = `${parsed.variable} rarely reaches ${parsed.threshold}`;
      detail = this.#generateThresholdDetail(parsed, clause);
      suggestions.push(...this.#generateThresholdSuggestions(parsed, clause));
    } else if (parsed.type === 'compound') {
      summary = `Compound condition fails ${(clause.failureRate * 100).toFixed(1)}% of the time`;
      detail = `This ${parsed.operator} clause with ${parsed.count} conditions is too restrictive.`;
      suggestions.push('Consider simplifying or splitting into separate expressions');
    } else {
      summary = `Clause fails ${(clause.failureRate * 100).toFixed(1)}% of the time`;
      detail = clause.clauseDescription;
      suggestions.push('Review the clause logic for overly strict conditions');
    }

    return { summary, detail, severity, suggestions };
  }

  /**
   * Parse clause description into structured data
   * @private
   */
  #parseClauseDescription(description) {
    // Match "variable >= threshold" pattern
    const thresholdMatch = description.match(/^([\w.]+)\s*(>=|<=|>|<|==)\s*([\d.]+)$/);
    if (thresholdMatch) {
      return {
        type: 'threshold',
        variable: thresholdMatch[1],
        operator: thresholdMatch[2],
        threshold: parseFloat(thresholdMatch[3])
      };
    }

    // Match "AND/OR of N conditions"
    const compoundMatch = description.match(/^(AND|OR)\s+of\s+(\d+)\s+conditions$/);
    if (compoundMatch) {
      return {
        type: 'compound',
        operator: compoundMatch[1],
        count: parseInt(compoundMatch[2], 10)
      };
    }

    return { type: 'unknown', raw: description };
  }

  /**
   * Generate detailed explanation for threshold failures
   * @private
   */
  #generateThresholdDetail(parsed, clause) {
    const violationInfo = clause.averageViolation > 0
      ? ` Average shortfall: ${clause.averageViolation.toFixed(3)}`
      : '';

    if (parsed.variable.startsWith('emotions.')) {
      const emotionId = parsed.variable.replace('emotions.', '');
      const prototype = this.#getEmotionPrototype(emotionId);
      if (prototype) {
        return `Emotion "${emotionId}" requires ${parsed.operator} ${parsed.threshold}.${violationInfo} This emotion is weighted toward: ${this.#describeWeights(prototype.weights)}`;
      }
    }

    if (parsed.variable.startsWith('sexualStates.')) {
      const stateId = parsed.variable.replace('sexualStates.', '');
      return `Sexual state "${stateId}" requires ${parsed.operator} ${parsed.threshold}.${violationInfo}`;
    }

    return `Value ${parsed.variable} must be ${parsed.operator} ${parsed.threshold}.${violationInfo}`;
  }

  /**
   * Generate suggestions for threshold failures
   * @private
   */
  #generateThresholdSuggestions(parsed, clause) {
    const suggestions = [];

    if (parsed.threshold > 0.8) {
      suggestions.push(`Consider lowering threshold from ${parsed.threshold} to ~${(parsed.threshold * 0.8).toFixed(2)}`);
    }

    if (clause.averageViolation > 0.2) {
      const suggestedThreshold = Math.max(0, parsed.threshold - clause.averageViolation);
      suggestions.push(`Based on violations, try threshold ~${suggestedThreshold.toFixed(2)}`);
    }

    if (suggestions.length === 0) {
      suggestions.push('This threshold may be appropriate - consider if rarity is intentional');
    }

    return suggestions;
  }

  /**
   * Categorize severity based on failure rate
   * @private
   */
  #categorizeSeverity(failureRate) {
    if (failureRate >= 0.99) return 'critical';
    if (failureRate >= 0.90) return 'high';
    if (failureRate >= 0.70) return 'medium';
    return 'low';
  }

  /**
   * Get emotion prototype from registry
   * @private
   */
  #getEmotionPrototype(emotionId) {
    const lookup = this.#dataRegistry.get('lookups', 'core:emotion_prototypes');
    return lookup?.entries?.[emotionId] || null;
  }

  /**
   * Describe prototype weights in human-readable form
   * @private
   */
  #describeWeights(weights) {
    if (!weights) return 'unknown';

    return Object.entries(weights)
      .filter(([, w]) => Math.abs(w) > 0.1)
      .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
      .slice(0, 3)
      .map(([axis, weight]) => `${axis} (${weight > 0 ? '+' : ''}${weight.toFixed(2)})`)
      .join(', ');
  }
}

export default FailureExplainer;
```

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/services/failureExplainer.test.js --verbose
```

### Unit Test Coverage Requirements

**failureExplainer.test.js:**
- Constructor throws if dataRegistry is missing
- Constructor throws if logger is missing
- `analyzeBlockers()` returns empty array for empty input
- `analyzeBlockers()` sorts by failure rate descending
- `analyzeBlockers()` assigns correct ranks
- `analyzeBlockers()` generates explanations for each clause
- `getTopBlockers()` returns specified number of blockers
- `getTopBlockers()` defaults to 3
- `generateSummary()` handles zero trigger rate
- `generateSummary()` handles extremely rare (<0.01%)
- `generateSummary()` handles rare (<1%)
- `generateSummary()` handles occasional (<5%)
- `generateSummary()` handles healthy rates (>5%)
- Explanation includes correct severity levels
- Threshold clause parsing works correctly
- Compound clause parsing works correctly
- Suggestions generated for high thresholds
- Emotion prototype weights described correctly

### Invariants That Must Remain True

1. **Blockers always sorted by failure rate** - Worst first
2. **Ranks are sequential** - 1, 2, 3, ... without gaps
3. **Severity categories consistent** - Same rate = same severity
4. **Suggestions are actionable** - Not vague recommendations
5. **Never throws on malformed input** - Graceful fallback explanations

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/failureExplainer.test.js --verbose

# Type checking
npm run typecheck
```

## Definition of Done

- [x] `FailureExplainer.js` created with all methods implemented
- [x] `services/index.js` updated with export
- [x] DI token added to `tokens-diagnostics.js`
- [x] Service registered in `expressionDiagnosticsRegistrations.js`
- [x] Unit tests cover all public methods
- [x] Tests cover edge cases (empty input, malformed clauses)
- [x] JSDoc documentation complete
- [x] All tests pass
- [x] No modifications to MonteCarloSimulator

## Outcome

### Ticket Discrepancy Corrected
- **Issue Found**: Ticket code sample used `this.#dataRegistry.getLookupData('core:emotion_prototypes')` but codebase uses `this.#dataRegistry.get('lookups', 'core:emotion_prototypes')`
- **Resolution**: Updated ticket code sample to use correct API before implementation

### Files Changed (as planned)
| File | Status | Notes |
|------|--------|-------|
| `src/expressionDiagnostics/services/FailureExplainer.js` | ✅ Created | Full implementation with debug logging |
| `src/expressionDiagnostics/services/index.js` | ✅ Modified | Added barrel export |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | ✅ Modified | Added IFailureExplainer token |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | ✅ Modified | Added singleton factory registration |
| `tests/unit/expressionDiagnostics/services/failureExplainer.test.js` | ✅ Created | 43 tests, 98.78% statement coverage |

### Implementation Notes
- Added debug logging to `analyzeBlockers()` to utilize the `#logger` field
- Renamed unused `context` parameter to `_context` following project convention
- All 43 tests pass with comprehensive coverage of:
  - Constructor validation
  - `analyzeBlockers()` sorting, ranking, and explanation generation
  - `getTopBlockers()` with default and custom limits
  - `generateSummary()` for all rarity categories
  - Severity categorization thresholds
  - Clause parsing (threshold, compound, unknown types)
  - Threshold suggestions
  - Emotion prototype weight description
  - Edge cases (empty input, malformed clauses, null values)

### Verification
- Unit tests: ✅ All 43 passing
- Coverage: 98.78% statements on FailureExplainer.js
- Lint: ✅ No errors (48 warnings unrelated to this implementation)
- MonteCarloSimulator: ✅ Not modified
