# PROREDANAV2-017: Complete Orchestrator Integration with Gate Banding Suggestions

## Description

Complete the orchestrator integration by adding GateBandingSuggestionBuilder and including banding suggestions in recommendations for appropriate classification types.

## Files to Touch

### Modify
- `src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js`
- `src/expressionDiagnostics/services/prototypeOverlap/OverlapRecommendationBuilder.js`

### Create
- `tests/unit/expressionDiagnostics/services/prototypeOverlapAnalyzer.fullV2.test.js`

## Out of Scope

- UI rendering
- Integration tests (Phase 7)
- Further config changes
- Performance optimization

## Changes Required

### 1. Add GateBandingSuggestionBuilder Dependency to Orchestrator

```javascript
constructor({
  // ... existing
  gateBandingSuggestionBuilder,  // NEW
}) {
  validateDependency(gateBandingSuggestionBuilder, 'IGateBandingSuggestionBuilder', logger, {
    requiredMethods: ['buildSuggestions']
  });

  this.#gateBandingSuggestionBuilder = gateBandingSuggestionBuilder;
}
```

### 2. Generate Banding Suggestions for Applicable Classifications

```javascript
// In the evaluation loop, after classification:
let bandingSuggestions = [];

if (['nested_siblings', 'needs_separation'].includes(classification.v2Type)) {
  bandingSuggestions = this.#gateBandingSuggestionBuilder.buildSuggestions(
    gateImplication,
    classification.v2Type
  );
}
```

### 3. Include Suggestions in Recommendation

```javascript
const recommendation = this.#overlapRecommendationBuilder.build(
  prototypeA,
  prototypeB,
  classification,
  candidateMetrics,
  behaviorMetrics,
  divergenceExamples,
  gateImplication,
  bandingSuggestions,  // NEW parameter
  prototypeFamily
);
```

### 4. Update OverlapRecommendationBuilder to Include Suggestions

In `OverlapRecommendationBuilder.js`:

```javascript
build(prototypeA, prototypeB, classification, candidateMetrics,
      behaviorMetrics, divergenceExamples, gateImplication,
      bandingSuggestions, prototypeFamily) {

  const recommendation = {
    // ... existing fields
    evidence: this.#buildEvidence(...),

    // NEW: Include banding suggestions when present
    suggestedGateBands: bandingSuggestions || []
  };

  return recommendation;
}
```

### 5. Update Actions to Reference Banding Suggestions

```javascript
#buildActions(classification, prototypeA, prototypeB, bandingSuggestions) {
  const actions = [];
  const type = classification.v2Type || classification.type;

  if (type === 'nested_siblings' && bandingSuggestions?.length > 0) {
    actions.push('Review gate banding suggestions below to differentiate prototypes');
    for (const suggestion of bandingSuggestions.filter(s => s.type === 'gate_band')) {
      actions.push(`  → ${suggestion.message}`);
    }
  }

  // ... other action building
  return actions;
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **Banding suggestions for nested_siblings**:
   - Classification is nested_siblings
   - gateImplication has narrower relationship
   - → Recommendation includes suggestedGateBands

2. **Banding suggestions for needs_separation**:
   - Classification is needs_separation
   - → Recommendation includes suggestedGateBands

3. **No banding for merge_recommended**:
   - Classification is merge_recommended
   - → suggestedGateBands is empty array

4. **No banding for keep_distinct**:
   - Classification is keep_distinct
   - → suggestedGateBands is empty array

5. **Actions reference suggestions**:
   - When suggestions present, actions list includes reference

6. **Expression suppression suggestion included**:
   - For nested_siblings, includes expression_suppression suggestion

7. **Full v2 output shape**:
   - Recommendation has all v2 fields:
     - evidence with all sections
     - classification with v2Type
     - suggestedGateBands array

8. **Backward compatibility**:
   - Existing tests still pass
   - Output structure compatible with consumers

### Invariants That Must Remain True

- Recommendations always generated (suggestions are optional enhancement)
- suggestedGateBands always an array (never null/undefined)
- Existing recommendation fields unchanged
- Performance acceptable

## Estimated Size

~80 lines of code changes + ~150 lines of tests

## Dependencies

- PROREDANAV2-015 (GateBandingSuggestionBuilder exists and registered)
- PROREDANAV2-016 (gate integration complete)

## Verification Commands

```bash
# Run full v2 tests
npm run test:unit -- --testPathPattern=prototypeOverlapAnalyzer.fullV2

# Run all orchestrator tests
npm run test:unit -- --testPathPattern=prototypeOverlapAnalyzer

# Run all recommendation builder tests
npm run test:unit -- --testPathPattern=overlapRecommendationBuilder

# Lint
npx eslint src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js
npx eslint src/expressionDiagnostics/services/prototypeOverlap/OverlapRecommendationBuilder.js
```
