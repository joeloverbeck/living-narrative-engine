# MONCARACTIMP-012: Threshold Suggestions Extension

## Summary

Extend the existing `SensitivitySectionGenerator` to include threshold suggestions for achieving target pass rates. This adds "If you lowered threshold to X, estimated pass rate would be Y%" recommendations.

## Priority

MEDIUM

## Effort

Small (~80 LOC)

## Dependencies

- MONCARACTIMP-001 (Configuration & Type Definitions)

## Rationale

The existing sensitivity section already shows how clauses respond to threshold changes. Adding explicit threshold suggestions transforms this from analytical data into actionable guidance.

## Files to Create

None - this extends an existing service.

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `src/expressionDiagnostics/services/sectionGenerators/SensitivitySectionGenerator.js` | MODIFY | Add threshold suggestion generation |

## Out of Scope

- New service creation
- Unit tests for existing service (modify existing tests)
- Integration with other actionability services
- Report generator changes (MONCARACTIMP-015)
- Full section redesign

## Implementation Details

### Changes to SensitivitySectionGenerator

Add a new method to generate threshold suggestions based on quantile data:

```javascript
// Add to existing SensitivitySectionGenerator.js

/**
 * Generate threshold suggestions for a clause
 * @param {Object} clause - Clause with threshold and quantile data
 * @param {Object} sensitivityData - Sensitivity analysis data
 * @returns {Object[]} Array of threshold suggestions
 */
#generateThresholdSuggestions(clause, sensitivityData) {
  const suggestions = [];
  const config = actionabilityConfig.thresholdSuggestions;

  if (!config.enabled) {
    return suggestions;
  }

  const currentThreshold = clause.threshold;
  const quantiles = sensitivityData.quantiles || clause.quantiles;

  if (!quantiles || typeof currentThreshold !== 'number') {
    return suggestions;
  }

  // Generate suggestions for each target pass rate
  for (const targetRate of config.targetPassRates) {
    const suggestion = this.#calculateSuggestionForRate(
      currentThreshold,
      targetRate,
      quantiles
    );

    if (suggestion) {
      suggestions.push(suggestion);
    }
  }

  // Add absolute ceiling if configured
  if (config.showAbsoluteCeiling && quantiles.max !== undefined) {
    suggestions.push({
      type: 'ceiling',
      threshold: quantiles.max,
      estimatedPassRate: 1.0,
      description: `Absolute ceiling (all samples would pass)`,
    });
  }

  return suggestions;
}

/**
 * Calculate threshold suggestion for target pass rate
 * @param {number} currentThreshold
 * @param {number} targetRate
 * @param {Object} quantiles
 * @returns {Object|null}
 */
#calculateSuggestionForRate(currentThreshold, targetRate, quantiles) {
  // Map target rate to percentile
  // Pass rate X% means threshold at (100-X)th percentile
  const percentile = Math.round((1 - targetRate) * 100);
  const percentileKey = `p${percentile}`;

  const suggestedThreshold = quantiles[percentileKey];

  if (suggestedThreshold === undefined || suggestedThreshold === currentThreshold) {
    return null;
  }

  const delta = suggestedThreshold - currentThreshold;
  const direction = delta < 0 ? 'lower' : 'raise';

  return {
    type: 'target',
    targetPassRate: targetRate,
    currentThreshold,
    suggestedThreshold,
    delta,
    direction,
    description: `${direction === 'lower' ? 'Lower' : 'Raise'} threshold from ${currentThreshold.toFixed(2)} to ${suggestedThreshold.toFixed(2)} for ~${(targetRate * 100).toFixed(0)}% pass rate`,
    confidence: this.#assessSuggestionConfidence(percentile, quantiles),
  };
}

/**
 * Assess confidence in suggestion based on sample distribution
 * @param {number} percentile
 * @param {Object} quantiles
 * @returns {'high'|'medium'|'low'}
 */
#assessSuggestionConfidence(percentile, quantiles) {
  // Higher confidence for mid-range percentiles (more samples)
  if (percentile >= 25 && percentile <= 75) {
    return 'high';
  }
  if (percentile >= 10 && percentile <= 90) {
    return 'medium';
  }
  return 'low';
}

// Modify the existing generate() method to include suggestions
generate(simulationResult) {
  // ... existing code ...

  const sensitivityData = this.#computeSensitivity(simulationResult);

  // Add threshold suggestions to each clause analysis
  for (const clauseAnalysis of sensitivityData.clauses || []) {
    const clause = this.#findClause(clauseAnalysis.clauseId, simulationResult);
    if (clause) {
      clauseAnalysis.thresholdSuggestions = this.#generateThresholdSuggestions(
        clause,
        clauseAnalysis
      );
    }
  }

  return {
    ...sensitivityData,
    // Add formatted suggestions section
    formattedSuggestions: this.#formatSuggestions(sensitivityData),
  };
}

/**
 * Format suggestions for report output
 * @param {Object} sensitivityData
 * @returns {string[]}
 */
#formatSuggestions(sensitivityData) {
  const lines = [];

  for (const clauseAnalysis of sensitivityData.clauses || []) {
    const suggestions = clauseAnalysis.thresholdSuggestions || [];

    if (suggestions.length === 0) {
      continue;
    }

    lines.push(`### ${clauseAnalysis.clauseDescription || clauseAnalysis.clauseId}`);
    lines.push('');

    for (const suggestion of suggestions) {
      if (suggestion.type === 'target') {
        const confidenceEmoji = suggestion.confidence === 'high' ? '✅' :
                                suggestion.confidence === 'medium' ? '⚠️' : '❓';
        lines.push(`- ${confidenceEmoji} ${suggestion.description}`);
      } else if (suggestion.type === 'ceiling') {
        lines.push(`- 📊 ${suggestion.description}: ${suggestion.threshold.toFixed(2)}`);
      }
    }

    lines.push('');
  }

  return lines;
}
```

### Import Addition

Add at the top of the file:

```javascript
import { actionabilityConfig } from '../../config/actionabilityConfig.js';
```

## Acceptance Criteria

### Tests That Must Pass

```bash
# Type checking
npm run typecheck

# Linting
npx eslint src/expressionDiagnostics/services/sectionGenerators/SensitivitySectionGenerator.js

# Existing tests still pass
npm run test:unit -- --testPathPattern="SensitivitySectionGenerator"
```

### Invariants That Must Remain True

1. Existing `generate()` output structure must be preserved
2. Suggestions are only added when `thresholdSuggestions.enabled` is true
3. Suggestions require valid quantile data
4. Confidence assessment follows defined rules
5. Existing unit tests must continue to pass

## Verification Commands

```bash
# Verify changes compile
npm run typecheck

# Lint modified file
npx eslint src/expressionDiagnostics/services/sectionGenerators/SensitivitySectionGenerator.js

# Run existing tests
npm run test:unit -- --testPathPattern="SensitivitySectionGenerator"

# Verify new methods exist
grep -n "generateThresholdSuggestions\|calculateSuggestionForRate" src/expressionDiagnostics/services/sectionGenerators/SensitivitySectionGenerator.js
```

## Estimated Diff Size

- `SensitivitySectionGenerator.js`: ~80 lines added

**Total**: ~80 lines

## Definition of Done

- [ ] `#generateThresholdSuggestions()` method added
- [ ] `#calculateSuggestionForRate()` method added
- [ ] `#assessSuggestionConfidence()` method added
- [ ] `#formatSuggestions()` method added
- [ ] `generate()` modified to include suggestions
- [ ] Import for `actionabilityConfig` added
- [ ] `npm run typecheck` passes
- [ ] ESLint passes
- [ ] Existing tests still pass
- [ ] Suggestions appear in output when quantiles available
