# PROREDANAV2-009: Add Classification Type Enum and Priority Infrastructure

## Description

Update OverlapClassifier with new classification types and priority-ordered checking infrastructure. This establishes the foundation for v2 classification without implementing the actual classification logic changes.

## Files to Touch

### Modify
- `src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js`

### Create
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/overlapClassifier.types.test.js`

## Out of Scope

- Implementing individual new classification checks (PROREDANAV2-010, 011, 012)
- Gate implication integration
- Using new behavioral metrics
- Modifying existing merge/subsumed logic (yet)
- Evidence payload changes

## Changes Required

### 1. Add ClassificationTypeV2 JSDoc Typedef

```javascript
/**
 * @typedef {'merge_recommended' | 'subsumed_recommended' | 'nested_siblings' |
 *           'needs_separation' | 'keep_distinct' | 'convert_to_expression'} ClassificationTypeV2
 */
```

### 2. Define Priority Order Constant

```javascript
/**
 * Classification check priority order (first match wins).
 * @type {ClassificationTypeV2[]}
 */
const CLASSIFICATION_PRIORITY = [
  'merge_recommended',
  'subsumed_recommended',
  'convert_to_expression',  // Feature-flagged, checked before nested_siblings
  'nested_siblings',
  'needs_separation',
  'keep_distinct'           // Default fallback
];
```

### 3. Add Classification Check Method Stubs

```javascript
#checkMergeRecommended(metrics) {
  // TODO: Implement in PROREDANAV2-010
  // For now, delegate to existing merge logic
  return this.#checkMergeLegacy(metrics);
}

#checkSubsumedRecommended(metrics) {
  // TODO: Implement in PROREDANAV2-010
  return this.#checkSubsumedLegacy(metrics);
}

#checkConvertToExpression(metrics) {
  // TODO: Implement in PROREDANAV2-012
  return false; // Not implemented yet
}

#checkNestedSiblings(metrics) {
  // TODO: Implement in PROREDANAV2-011
  return false;
}

#checkNeedsSeparation(metrics) {
  // TODO: Implement in PROREDANAV2-011
  return false;
}

#isKeepDistinct(metrics) {
  // Default fallback
  return true;
}
```

### 4. Refactor classify() to Use Priority Checking

```javascript
classify(candidateMetrics, behaviorMetrics) {
  const metrics = this.#combineMetrics(candidateMetrics, behaviorMetrics);

  // Priority-ordered classification
  for (const classificationType of CLASSIFICATION_PRIORITY) {
    if (this.#checkClassification(classificationType, metrics)) {
      return this.#buildClassificationResult(classificationType, metrics);
    }
  }

  // Should never reach here due to keep_distinct fallback
  return this.#buildClassificationResult('keep_distinct', metrics);
}

#checkClassification(type, metrics) {
  switch (type) {
    case 'merge_recommended': return this.#checkMergeRecommended(metrics);
    case 'subsumed_recommended': return this.#checkSubsumedRecommended(metrics);
    case 'convert_to_expression': return this.#checkConvertToExpression(metrics);
    case 'nested_siblings': return this.#checkNestedSiblings(metrics);
    case 'needs_separation': return this.#checkNeedsSeparation(metrics);
    case 'keep_distinct': return this.#isKeepDistinct(metrics);
    default: return false;
  }
}
```

### 5. Maintain Backward Compatibility

Map v2 types to v1 types for existing consumers:
```javascript
#mapToLegacyType(v2Type) {
  const mapping = {
    'merge_recommended': 'merge',
    'subsumed_recommended': 'subsumed',
    'nested_siblings': 'not_redundant',
    'needs_separation': 'not_redundant',
    'keep_distinct': 'not_redundant',
    'convert_to_expression': 'not_redundant'
  };
  return mapping[v2Type] || 'not_redundant';
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **Type enum defined**: ClassificationTypeV2 includes all 6 types
2. **Priority order constant**: CLASSIFICATION_PRIORITY has correct order
3. **Backward compatibility**: Existing classifications still return same results
4. **Legacy type mapping**: v2 types correctly map to v1 types
5. **Priority checking works**: First matching classification wins
6. **Default fallback**: When nothing matches, keep_distinct returned
7. **Existing tests pass**: All tests in overlapClassifier.test.js unchanged

### Invariants That Must Remain True

- Existing merge/subsumed/not_redundant classifications continue to work identically
- classify() always returns a valid classification (never undefined/null)
- Priority order is respected
- No breaking changes to return value structure
- Existing tests pass without modification

## Estimated Size

~80 lines of code changes + ~100 lines of tests

## Dependencies

- PROREDANAV2-001 (config may be needed for feature flags)

## Verification Commands

```bash
# Run new type tests
npm run test:unit -- --testPathPattern=overlapClassifier.types

# Run ALL classifier tests to ensure backward compatibility
npm run test:unit -- --testPathPattern=overlapClassifier

# Lint
npx eslint src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js
```
