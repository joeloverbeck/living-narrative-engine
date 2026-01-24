# Prototype Analysis Unit Normalization Fix

## Overview

This specification addresses a confirmed bug in the prototype analysis system where divergence examples display raw axis values while gate suggestions use normalized values, creating a misleading 100x scale mismatch in reports.

## Problem Statement

### Confirmed Bug: Unit Scale Mismatch

**Symptoms observed in `reports/prototype-analysis-results.md`:**
- Gate suggestions: `Add gate "engagement <= 0.30"` (normalized [0, 1] scale)
- Divergence examples: `engagement: 97.00, engagement: 95.00` (raw [-100, 100] scale)

**Root cause analysis:**

1. `RandomStateGenerator.generate()` produces mood axes in raw scale [-100, 100]
2. `ContextBuilder.buildContext()` passes raw values through as `moodAxes: currentState.mood`
3. `BehavioralOverlapEvaluator.#formatContextSummary()` reads and displays raw values directly
4. `GateBandingSuggestionBuilder` generates suggestions in normalized [0, 1] scale with `bandMargin = 0.05`

**Impact:** Users cannot meaningfully interpret gate suggestions against the divergence examples shown in the same report.

## Affected Files

| File | Role | Issue |
|------|------|-------|
| `src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js` | Formats context summaries | Outputs raw values without normalization |
| `src/expressionDiagnostics/services/prototypeOverlap/GateBandingSuggestionBuilder.js` | Generates gate suggestions | Outputs normalized values (correct) |
| `src/expressionDiagnostics/services/RandomStateGenerator.js` | Generates test states | Produces raw values (correct) |
| `src/expressionDiagnostics/services/simulatorCore/ContextBuilder.js` | Builds context objects | Passes raw values through (correct) |

## Solution Design

### Fix 1: Normalize Divergence Example Values

**Location:** `BehavioralOverlapEvaluator.js`

**Approach:** Add a normalization helper method and apply it in `#formatContextSummary()` before display.

#### New Method: `#normalizeAxisValue(axis, rawValue)`

```javascript
/**
 * Normalizes a raw axis value to [0, 1] scale for consistent display.
 * @param {string} axis - The axis name
 * @param {number} rawValue - The raw value (mood: [-100, 100], sexual/trait: [0, 100])
 * @returns {number} Normalized value in [0, 1] range
 */
#normalizeAxisValue(axis, rawValue) {
  // Mood axes use [-100, 100] range
  const MOOD_AXES = ['valence', 'arousal', 'dominance', 'engagement', 'confidence', 'affiliation'];

  if (MOOD_AXES.includes(axis)) {
    // Map [-100, 100] to [0, 1]
    return (rawValue + 100) / 200;
  }

  // Sexual and trait axes use [0, 100] range
  // Map [0, 100] to [0, 1]
  return rawValue / 100;
}
```

#### Modified Method: `#formatContextSummary()`

Update to normalize values before formatting:

```javascript
#formatContextSummary(context, weightsA, weightsB, gatesA, gatesB) {
  // ... existing extraction logic ...

  // Normalize values before display
  return top3.map(([key, value]) => {
    const normalizedValue = this.#normalizeAxisValue(key, value);
    return `${key}: ${normalizedValue.toFixed(2)}`;
  }).join(', ');
}
```

### Fix 2: Gate Suggestion Validation Service (Enhancement)

**Location:** New file `src/expressionDiagnostics/services/prototypeOverlap/GateSuggestionValidator.js`

**Purpose:** Provide before/after metrics to validate that suggested gates actually improve prototype separation.

#### Service Interface

```javascript
/**
 * Validates gate suggestions by computing before/after separation metrics.
 */
class GateSuggestionValidator {
  /**
   * @param {Object} dependencies
   * @param {Object} dependencies.logger - ILogger instance
   * @param {Object} dependencies.monteCarloSampler - MonteCarloSampler instance
   */
  constructor({ logger, monteCarloSampler }) {
    // ...
  }

  /**
   * Validates a gate suggestion by comparing overlap before and after.
   * @param {Object} prototypeA - First prototype definition
   * @param {Object} prototypeB - Second prototype definition
   * @param {Object} suggestion - Gate suggestion from GateBandingSuggestionBuilder
   * @returns {Object} Validation result with before/after metrics
   */
  validate(prototypeA, prototypeB, suggestion) {
    return {
      suggestion,
      metrics: {
        before: {
          overlapCount: number,
          overlapPercentage: number,
          sampleSize: number
        },
        after: {
          overlapCount: number,
          overlapPercentage: number,
          sampleSize: number
        },
        improvement: {
          absoluteReduction: number,
          percentageReduction: number,
          isEffective: boolean
        }
      }
    };
  }
}
```

#### Integration Point

Modify `GateBandingSuggestionBuilder.buildSuggestions()` to optionally validate suggestions:

```javascript
buildSuggestions(analysisResult, options = {}) {
  const suggestions = this.#generateSuggestions(analysisResult);

  if (options.validate && this.#validator) {
    return suggestions.map(suggestion =>
      this.#validator.validate(
        analysisResult.prototypeA,
        analysisResult.prototypeB,
        suggestion
      )
    );
  }

  return suggestions;
}
```

## Test Requirements

### Unit Tests

#### File: `tests/unit/expressionDiagnostics/services/prototypeOverlap/behavioralOverlapEvaluator.normalization.test.js`

```javascript
describe('BehavioralOverlapEvaluator - Value Normalization', () => {
  describe('#normalizeAxisValue', () => {
    it('should normalize mood axis from [-100, 100] to [0, 1]', () => {
      // -100 -> 0, 0 -> 0.5, 100 -> 1
      expect(evaluator.normalizeAxisValue('valence', -100)).toBe(0);
      expect(evaluator.normalizeAxisValue('valence', 0)).toBe(0.5);
      expect(evaluator.normalizeAxisValue('valence', 100)).toBe(1);
    });

    it('should normalize sexual axis from [0, 100] to [0, 1]', () => {
      // 0 -> 0, 50 -> 0.5, 100 -> 1
      expect(evaluator.normalizeAxisValue('arousalLevel', 0)).toBe(0);
      expect(evaluator.normalizeAxisValue('arousalLevel', 50)).toBe(0.5);
      expect(evaluator.normalizeAxisValue('arousalLevel', 100)).toBe(1);
    });

    it('should handle all six mood axes', () => {
      const moodAxes = ['valence', 'arousal', 'dominance', 'engagement', 'confidence', 'affiliation'];
      moodAxes.forEach(axis => {
        expect(evaluator.normalizeAxisValue(axis, 0)).toBe(0.5);
      });
    });
  });

  describe('#formatContextSummary', () => {
    it('should output normalized values matching gate suggestion scale', () => {
      const context = { moodAxes: { engagement: 97 } };
      const summary = evaluator.formatContextSummary(context, {}, {}, {}, {});
      // Should show 0.99 (normalized) not 97.00 (raw)
      expect(summary).toContain('engagement: 0.99');
    });
  });
});
```

#### File: `tests/unit/expressionDiagnostics/services/prototypeOverlap/gateSuggestionValidator.test.js`

```javascript
describe('GateSuggestionValidator', () => {
  describe('validate', () => {
    it('should compute before/after overlap metrics', () => {
      const result = validator.validate(prototypeA, prototypeB, suggestion);

      expect(result.metrics.before).toHaveProperty('overlapCount');
      expect(result.metrics.before).toHaveProperty('overlapPercentage');
      expect(result.metrics.after).toHaveProperty('overlapCount');
      expect(result.metrics.after).toHaveProperty('overlapPercentage');
    });

    it('should calculate improvement correctly', () => {
      const result = validator.validate(prototypeA, prototypeB, suggestion);

      expect(result.metrics.improvement.absoluteReduction).toBe(
        result.metrics.before.overlapCount - result.metrics.after.overlapCount
      );
    });

    it('should mark suggestion as effective when overlap reduces', () => {
      // Setup: suggestion that reduces overlap
      const result = validator.validate(prototypeA, prototypeB, effectiveSuggestion);
      expect(result.metrics.improvement.isEffective).toBe(true);
    });

    it('should mark suggestion as ineffective when overlap increases', () => {
      // Setup: suggestion that increases overlap
      const result = validator.validate(prototypeA, prototypeB, ineffectiveSuggestion);
      expect(result.metrics.improvement.isEffective).toBe(false);
    });
  });
});
```

### Integration Tests

#### File: `tests/integration/expressionDiagnostics/prototypeOverlap/unitConsistency.integration.test.js`

```javascript
describe('Prototype Analysis - Unit Consistency', () => {
  it('should use consistent scale between divergence examples and gate suggestions', async () => {
    const result = await analyzer.analyze(prototypes);

    result.pairs.forEach(pair => {
      if (pair.suggestions?.length > 0 && pair.divergenceExamples?.length > 0) {
        // Extract numeric values from divergence examples
        const exampleValues = extractNumericValues(pair.divergenceExamples);

        // All values should be in [0, 1] range (normalized)
        exampleValues.forEach(value => {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        });

        // Gate suggestion thresholds should also be in [0, 1]
        pair.suggestions.forEach(suggestion => {
          const threshold = extractThreshold(suggestion.suggestedGate);
          expect(threshold).toBeGreaterThanOrEqual(0);
          expect(threshold).toBeLessThanOrEqual(1);
        });
      }
    });
  });

  it('should produce actionable gate suggestions that match displayed context', async () => {
    const result = await analyzer.analyze(prototypes);

    // Find a pair with suggestions
    const pairWithSuggestion = result.pairs.find(p => p.suggestions?.length > 0);
    if (pairWithSuggestion) {
      const suggestion = pairWithSuggestion.suggestions[0];
      const example = pairWithSuggestion.divergenceExamples[0];

      // The axis value in the example should be comparable to the threshold
      // (both in normalized scale)
      const axisName = suggestion.axis;
      const exampleValue = extractAxisValue(example, axisName);
      const threshold = extractThreshold(suggestion.suggestedGate);

      // Values should be in same order of magnitude (both 0-1)
      expect(Math.abs(exampleValue - threshold)).toBeLessThan(1);
    }
  });
});
```

### Existing Tests to Update

#### File: `tests/unit/expressionDiagnostics/services/prototypeOverlapAnalyzer.test.js`

Update any tests that assert on divergence example format to expect normalized values.

#### File: `tests/integration/expressionDiagnostics/prototypeOverlap/prototypeOverlapAnalyzer.integration.test.js`

Update assertions that check context summary formatting.

## Implementation Checklist

### Phase 1: Core Bug Fix (Required)

- [ ] Add `#normalizeAxisValue()` method to `BehavioralOverlapEvaluator.js`
- [ ] Update `#formatContextSummary()` to use normalization
- [ ] Add unit tests for normalization logic
- [ ] Add integration tests for unit consistency
- [ ] Update existing tests that assert on output format
- [ ] Regenerate reports to verify fix

### Phase 2: Gate Validation Enhancement (Optional)

- [ ] Create `GateSuggestionValidator.js` service
- [ ] Add DI token and registration
- [ ] Integrate with `GateBandingSuggestionBuilder`
- [ ] Add unit tests for validator
- [ ] Add integration tests for before/after metrics
- [ ] Update report format to include validation metrics

## Acceptance Criteria

1. **Unit Consistency**: All numeric values in reports use the same [0, 1] normalized scale
2. **Actionable Suggestions**: Gate suggestions can be directly compared to divergence examples
3. **Test Coverage**: All new code has >80% branch coverage
4. **Backward Compatibility**: Report structure remains compatible with existing consumers
5. **Documentation**: Code comments explain the normalization logic

## Non-Goals

- Changing the internal storage format (raw values are correct internally)
- Modifying the Monte Carlo sampling logic
- Changing threshold direction logic (analysis showed current <= logic is correct for lower bounds)

## References

- `src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js`
- `src/expressionDiagnostics/services/prototypeOverlap/GateBandingSuggestionBuilder.js`
- `reports/prototype-analysis-results.md`
- `reports/prototype-analysis-system.md`
