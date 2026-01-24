# PROANAOVEV3-017: V3 Classification Quality Tests

**STATUS: COMPLETED**

## Outcome

Created `tests/integration/expressionDiagnostics/prototypeOverlap/v3ClassificationQuality.integration.test.js` with 21 passing tests.

### API Assumption Corrections

The original ticket had incorrect API assumptions that were corrected during implementation:

| Assumption | Ticket (Incorrect) | Actual |
|-----------|-------------------|--------|
| Classification type strings | `MERGE_RECOMMENDED` | `'merge_recommended'` (lowercase) |
| Result structure | `v3Results.classified` array | `result.recommendations` + `result.metadata.classificationBreakdown` |
| Metrics access | `c.metrics.maeGlobal` | V3 uses `rec.behaviorMetrics` (not `allMatchingClassifications[i].metrics`) |
| V3 populates allMatchingClassifications | Yes | No - V3 returns empty array `[]` |

### Test Coverage (21 tests)

- **Classification Rate Targets** (5 tests): Validates `metadata.classificationBreakdown` counts
- **Merge Classification Quality** (2 tests): Validates behaviorMetrics.onBothRate/onEitherRate ratios
- **Subsume Classification Quality** (2 tests): Validates asymmetric pOnlyRate/qOnlyRate
- **Recommendation Structure Quality** (5 tests): Validates V3 result structure
- **Suggestion Quality** (2 tests): Validates suggestions within axis ranges
- **Classification Consistency** (2 tests): Validates no contradictions
- **V3 Metadata Quality** (3 tests): Validates v3Metrics structure

### Verification

```bash
npm run test:integration -- --testPathPatterns="v3ClassificationQuality" --no-coverage
# Result: 21 tests pass

npx eslint tests/integration/expressionDiagnostics/prototypeOverlap/v3ClassificationQuality.integration.test.js
# Result: No errors
```

---

## Summary (Original)

Create quality tests to verify v3 classification produces expected results:
- Merge/subsume classifications firing at expected rates (target: >5 merges, >10 subsumes)
- Classification metrics are sensible and within expected bounds
- Suggestions are valid and within legal axis ranges

## Motivation

V3 classification uses agreement-based metrics (MAE, Jaccard, conditional probabilities) instead of Pearson correlation. Quality tests ensure:
1. Classifications fire at expected rates for real prototype data
2. Classification logic produces sensible recommendations
3. Suggestions are actionable and valid

## Files to Create

### Quality Tests
- `tests/integration/expressionDiagnostics/prototypeOverlap/v3ClassificationQuality.integration.test.js`

## Implementation Details

### Test Structure

```javascript
describe('V3 Classification Quality Tests', () => {
  let v3Results;

  beforeAll(async () => {
    const prototypes = loadEmotionPrototypes();

    // Run v3 analysis
    v3Results = await analyzer.analyzeOverlaps(prototypes);
  });

  describe('Classification Rate Targets', () => {
    it('should produce >5 MERGE_RECOMMENDED classifications', () => {
      const mergeCount = v3Results.classified.filter(c => c.type === 'MERGE_RECOMMENDED').length;
      console.log(`V3 MERGE_RECOMMENDED count: ${mergeCount}`);
      expect(mergeCount).toBeGreaterThan(5);
    });

    it('should produce >10 SUBSUMED_RECOMMENDED classifications', () => {
      const subsumedCount = v3Results.classified.filter(c => c.type === 'SUBSUMED_RECOMMENDED').length;
      console.log(`V3 SUBSUMED_RECOMMENDED count: ${subsumedCount}`);
      expect(subsumedCount).toBeGreaterThan(10);
    });

    it('should produce actionable classifications', () => {
      const actionableTypes = ['MERGE_RECOMMENDED', 'SUBSUMED_RECOMMENDED', 'CONVERT_TO_EXPRESSION'];
      const actionableCount = v3Results.classified.filter(c => actionableTypes.includes(c.type)).length;
      console.log(`V3 actionable classifications: ${actionableCount}`);
      expect(actionableCount).toBeGreaterThan(15);
    });
  });

  describe('Classification Quality', () => {
    it('should produce sensible merge recommendations', () => {
      const merges = v3Results.classified.filter(c => c.type === 'MERGE_RECOMMENDED');

      for (const merge of merges) {
        // MAE should be low for merge recommendations
        expect(merge.metrics.maeGlobal).toBeLessThan(0.1);
        // Jaccard should be high
        expect(merge.metrics.activationJaccard).toBeGreaterThan(0.8);
      }
    });

    it('should produce sensible subsume recommendations', () => {
      const subsumes = v3Results.classified.filter(c => c.type === 'SUBSUMED_RECOMMENDED');

      for (const subsume of subsumes) {
        // Should have asymmetric conditional probabilities
        const diff = Math.abs(subsume.metrics.pA_given_B - subsume.metrics.pB_given_A);
        expect(diff).toBeGreaterThan(0.05);
      }
    });
  });

  describe('Suggestion Quality', () => {
    it('should produce only valid suggestions', () => {
      for (const result of v3Results.classified) {
        if (result.suggestions) {
          for (const suggestion of result.suggestions) {
            expect(suggestion.isValid).toBe(true);
          }
        }
      }
    });

    it('should produce suggestions within legal axis ranges', () => {
      const axisRanges = config.axisRanges;

      for (const result of v3Results.classified) {
        if (result.suggestions) {
          for (const suggestion of result.suggestions) {
            const range = axisRanges[suggestion.axis];
            expect(suggestion.threshold).toBeGreaterThanOrEqual(range.min);
            expect(suggestion.threshold).toBeLessThanOrEqual(range.max);
          }
        }
      }
    });
  });
});

function countClassifications(results) {
  const counts = {};
  for (const c of results.classified) {
    counts[c.type] = (counts[c.type] || 0) + 1;
  }
  return counts;
}
```

### Golden File Comparison (Optional)

```javascript
describe('Golden File Comparison', () => {
  it('should match or improve upon golden baseline', () => {
    const golden = require('./golden/v3-baseline.json');

    // V3 should have at least as many actionable classifications
    const v3ActionableCount = v3Results.classified.filter(c =>
      ['MERGE_RECOMMENDED', 'SUBSUMED_RECOMMENDED', 'CONVERT_TO_EXPRESSION'].includes(c.type)
    ).length;

    expect(v3ActionableCount).toBeGreaterThanOrEqual(golden.actionableCount);
  });
});
```

## Out of Scope

- Integration testing details (ticket 015)
- Performance testing (ticket 016)

## Acceptance Criteria

- [ ] V3 produces >5 merge classifications
- [ ] V3 produces >10 subsume classifications
- [ ] V3 produces >15 actionable classifications total
- [ ] Merge recommendations have low MAE (< 0.1), high Jaccard (> 0.8)
- [ ] Subsume recommendations have asymmetric conditional probs (diff > 0.05)
- [ ] All suggestions valid and within legal ranges
- [ ] Quality tests pass: `npm run test:integration`
- [ ] `npx eslint tests/integration/expressionDiagnostics/prototypeOverlap/v3ClassificationQuality.integration.test.js` passes

## Dependencies

- PROANAOVEV3-013 (PrototypeOverlapAnalyzer v3 integration)

## Estimated Complexity

Medium - comparison testing with statistical validation.
