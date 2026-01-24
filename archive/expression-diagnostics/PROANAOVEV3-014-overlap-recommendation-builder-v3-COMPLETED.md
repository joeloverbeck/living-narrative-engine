# PROANAOVEV3-014: OverlapRecommendationBuilder V3 Integration

## Summary

Replace `OverlapRecommendationBuilder` rule-based suggestions with data-driven decision stumps from `ActionableSuggestionEngine`, removing the v2 rule-based suggestion path entirely.

## Motivation

Current rule-based suggestions have unit/direction issues making them unsafe to apply. Data-driven suggestions from `ActionableSuggestionEngine`:
- Find optimal split points from actual data
- Validate thresholds against legal axis ranges
- Estimate impact before suggesting

The v2 rule-based approach is being completely removed.

## Files to Modify

### Service
- `src/expressionDiagnostics/services/prototypeOverlap/OverlapRecommendationBuilder.js`

### Unit Tests
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/overlapRecommendationBuilder.test.js` (update existing)

## Implementation Details

### Constructor Changes

```javascript
class OverlapRecommendationBuilder {
  /**
   * @param {object} options
   * @param {object} options.actionableSuggestionEngine - V3 suggestion engine
   * @param {object} options.config
   * @param {object} options.logger
   */
  constructor(options)
}
```

### Interface Changes

```javascript
/**
 * Build recommendations for a classified pair.
 * @param {object} options
 * @param {ClassificationResult} options.classification
 * @param {PrototypeOutputVector} options.vectorA - Output vector (required)
 * @param {PrototypeOutputVector} options.vectorB - Output vector (required)
 * @param {Array<object>} options.contextPool - Context pool (required)
 * @returns {RecommendationResult}
 */
build(options)

/**
 * @typedef {object} RecommendationResult
 * @property {string} summary - Human-readable summary
 * @property {Array<string>} actions - Recommended actions
 * @property {Array<ActionableSuggestion>} suggestions - Data-driven suggestions
 */
```

### V3 Suggestion Logic

```javascript
build(options) {
  const { classification, vectorA, vectorB, contextPool } = options;

  // Vectors and context pool are required
  if (!vectorA || !vectorB || !contextPool) {
    throw new Error('Vectors and context pool are required for recommendations');
  }

  // Generate base recommendations
  const baseRecommendations = this.#generateBaseRecommendations(classification);

  // Generate data-driven suggestions
  let suggestions = this.#actionableSuggestionEngine.generateSuggestions(
    vectorA,
    vectorB,
    contextPool,
    classification.type
  );

  // Filter to valid suggestions only
  suggestions = suggestions.filter(s => s.isValid);

  // Log validation status
  if (suggestions.length > 0) {
    this.#logger.info(`Generated ${suggestions.length} valid data-driven suggestions`);
  }

  return {
    summary: baseRecommendations.summary,
    actions: baseRecommendations.actions,
    suggestions,
  };
}
```

### Validation Logging

```javascript
if (suggestions.some(s => !s.isValid)) {
  const invalidCount = suggestions.filter(s => !s.isValid).length;
  this.#logger.warn(`Filtered ${invalidCount} invalid suggestions:
    ${suggestions.filter(s => !s.isValid).map(s => s.validationMessage).join('\n')}
  `);
}
```

### V2 Code Removal

The following v2 code paths will be removed:
- `#generateRuleSuggestions()` method
- `ruleSuggestions` field in result
- Conditional suggestion generation
- V2 fallback logic

## Out of Scope

- Creating `ActionableSuggestionEngine` (ticket 007)
- Integration with `PrototypeOverlapAnalyzer` (handled in ticket 013)

## Acceptance Criteria

- [ ] Data-driven suggestions generated exclusively
- [ ] Invalid suggestions filtered out
- [ ] Validation messages logged for filtered suggestions
- [ ] Valid suggestions include confidence and impact estimates
- [ ] Rule-based suggestion code removed
- [ ] Throws error when required data missing
- [ ] Unit tests cover:
  - Data-driven suggestion generation
  - Invalid suggestion filtering
  - Validation message logging
  - Confidence and impact estimates
  - Error when data missing
- [ ] 80%+ branch coverage on new code
- [ ] `npm run typecheck` passes
- [ ] `npx eslint src/expressionDiagnostics/services/prototypeOverlap/OverlapRecommendationBuilder.js` passes

## Dependencies

- PROANAOVEV3-007 (ActionableSuggestionEngine) - provides suggestions
- PROANAOVEV3-008 (V3 Config) - provides flag

## Estimated Complexity

Medium - replacing suggestion logic and removing rule-based code.
