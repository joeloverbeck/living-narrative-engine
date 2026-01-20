# PROOVEANA-001: CandidatePairFilter Service - COMPLETED

## Description

Implement Stage A of the Prototype Overlap Analyzer: the candidate filtering service. This service identifies potentially overlapping prototype pairs based on structural similarity metrics (active axis overlap, sign agreement, cosine similarity) before expensive behavioral sampling.

## Files Created

- `src/expressionDiagnostics/services/prototypeOverlap/CandidatePairFilter.js`
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/candidatePairFilter.test.js`

## Files Modified

None

## Out of Scope

- Stage B behavioral evaluation (PROOVEANA-002)
- Classification logic (PROOVEANA-003)
- DI registration (PROOVEANA-006)
- Integration tests (PROOVEANA-010)
- Any modification to existing services

## Implementation Details

### CandidatePairFilter.js

```javascript
/**
 * @file CandidatePairFilter - Stage A candidate filtering for prototype overlap analysis
 * @see specs/prototype-overlap-analyzer.md
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * @typedef {object} CandidateMetrics
 * @property {number} activeAxisOverlap - Jaccard similarity of active axis sets [0, 1]
 * @property {number} signAgreement - Ratio of shared axes with matching weight signs [0, 1]
 * @property {number} weightCosineSimilarity - Cosine similarity of weight vectors [-1, 1]
 */

/**
 * @typedef {object} CandidatePair
 * @property {object} prototypeA - First prototype
 * @property {object} prototypeB - Second prototype
 * @property {CandidateMetrics} candidateMetrics - Computed similarity metrics
 */

class CandidatePairFilter {
  #config;
  #logger;

  /**
   * @param {object} deps
   * @param {object} deps.config - PROTOTYPE_OVERLAP_CONFIG
   * @param {object} deps.logger - ILogger instance
   */
  constructor({ config, logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });
    this.#config = config;
    this.#logger = logger;
  }

  filterCandidates(prototypes) { /* implemented */ }
  #computePairMetrics(prototypeA, prototypeB) { /* implemented */ }
  #getActiveAxes(weights) { /* implemented */ }
  #computeJaccard(setA, setB) { /* implemented */ }
  #computeSignAgreement(weightsA, weightsB, sharedAxes) { /* implemented */ }
  #computeCosineSimilarity(weightsA, weightsB) { /* implemented */ }
  #hasValidWeights(prototype) { /* implemented */ }
  #validateConfigThresholds(config, logger) { /* implemented */ }
}

export default CandidatePairFilter;
```

## Acceptance Criteria

### Tests That Must Pass ✅

```javascript
// Active axis extraction
it('excludes axes below epsilon from active set') ✅
it('includes axes at or above epsilon boundary') ✅

// Sign agreement
it('computes sign agreement only for shared active axes') ✅
it('returns 0 sign agreement when no shared axes (not candidate)') ✅

// Cosine similarity
it('returns ~1 for identical weight vectors') ✅
it('returns ~0 for orthogonal weight vectors') ✅
it('returns ~-1 for opposite weight vectors') ✅

// Candidate gating
it('filters out pairs below activeAxisOverlap threshold') ✅
it('filters out pairs below signAgreement threshold') ✅
it('filters out pairs below cosineSimilarity threshold') ✅
it('passes pairs meeting all thresholds') ✅

// Symmetry & deduplication
it('produces symmetric metrics for (A,B) and (B,A)') ✅
it('returns only one of (A,B) or (B,A), not both') ✅
it('excludes self-pairs (A,A)') ✅
```

### Invariants ✅

- All metrics in [0, 1] range (except cosine which is [-1, 1]) ✅
- Symmetric: metrics(A,B) === metrics(B,A) ✅
- No self-pairs (A,A) ✅
- No duplicate pairs ((A,B) and (B,A)) ✅
- `npm run test:unit -- --testPathPatterns="candidatePairFilter"` passes ✅
- `npx eslint <created-files>` passes ✅

## Verification Commands

```bash
npm run test:unit -- --testPathPatterns="candidatePairFilter"
npx eslint src/expressionDiagnostics/services/prototypeOverlap/CandidatePairFilter.js
```

## Dependencies

- PROOVEANA-000 (config) ✅

## Estimated vs Actual Diff Size

| Category | Estimated | Actual |
|----------|-----------|--------|
| Source   | ~250 lines | 322 lines |
| Tests    | ~350 lines | 837 lines |
| **Total**| ~600 lines | **1,159 lines** |

---

## Outcome

### Completion Date
2025-01-19

### Summary
Successfully implemented the CandidatePairFilter service as Stage A of the Prototype Overlap Analyzer pipeline. The service computes structural similarity metrics (Jaccard overlap, sign agreement, cosine similarity) to efficiently prune the O(n²) prototype pair space before expensive behavioral sampling in Stage B.

### Implementation Highlights

1. **Constructor Validation**: Added comprehensive config threshold validation beyond the basic pattern, ensuring all required numeric thresholds are present
2. **Defensive Input Handling**: Returns empty array for invalid/empty prototype arrays with appropriate logging
3. **Prototype Validation**: Filters out prototypes without valid weights (non-empty object with at least one numeric value)
4. **Edge Case Handling**:
   - Empty weight sets return Jaccard = 0
   - Zero-norm vectors return cosine similarity = 0 (avoids division by zero)
   - No shared axes returns sign agreement = 0

### Test Coverage
All 41 tests pass with comprehensive coverage:
- Constructor validation (5 tests)
- Active axis extraction (4 tests)
- Sign agreement (5 tests)
- Cosine similarity (4 tests)
- Candidate gating (4 tests)
- Symmetry & deduplication (3 tests)
- Edge cases (6 tests)
- Integration scenarios (5 tests)
- Metric range invariants (5 tests)

### Deviations from Plan
- Source code ~28% larger due to additional validation and JSDoc documentation
- Tests ~139% larger due to comprehensive edge case coverage and metric range invariant tests
- Added `#computePairMetrics` as internal orchestration method (not in original spec)
- Added `#hasValidWeights` validation helper
- Added `#validateConfigThresholds` for constructor validation

### Next Steps
- PROOVEANA-002: BehavioralOverlapEvaluator (Stage B)
- PROOVEANA-006: DI registration for CandidatePairFilter
