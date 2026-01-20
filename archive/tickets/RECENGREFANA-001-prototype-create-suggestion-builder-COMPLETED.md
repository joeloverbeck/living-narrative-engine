# RECENGREFANA-001: Extract PrototypeCreateSuggestionBuilder

## Description

Extract the largest responsibility cluster (~625 lines) from `RecommendationEngine.js` into a dedicated builder class. This implements the sophisticated prototype creation decision algorithm with conditions A, B, C, spam brake, and sanity checks.

## Files to Create

- `src/expressionDiagnostics/services/recommendationBuilders/PrototypeCreateSuggestionBuilder.js`
- `tests/unit/expressionDiagnostics/services/recommendationBuilders/PrototypeCreateSuggestionBuilder.test.js`
- `tests/integration/expressionDiagnostics/recommendationBuilders/prototypeCreateSuggestion.integration.test.js`

## Files to Modify

- `src/expressionDiagnostics/services/RecommendationEngine.js` - Delegate to new builder
- `src/dependencyInjection/tokens/tokens-diagnostics.js` - Add `IPrototypeCreateSuggestionBuilder` token
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` - Add registration

## Out of Scope

- GateClampRecommendationBuilder (RECENGREFANA-002)
- AxisConflictAnalyzer (RECENGREFANA-003)
- OverconstrainedConjunctionBuilder (RECENGREFANA-004)
- SoleBlockerRecommendationBuilder (RECENGREFANA-005)
- Changes to PrototypeSynthesisService
- Changes to other recommendation types
- Changes to MonteCarloReportGenerator

## Implementation Details

### PrototypeCreateSuggestionBuilder.js

```javascript
/**
 * @file PrototypeCreateSuggestionBuilder - Generates prototype creation suggestions
 * @see RecommendationEngine.js (original location)
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';
import { getConfidence, getSeverity } from '../utils/recommendationUtils.js';

// === CONSTANTS (moved from RecommendationEngine.js) ===

const DEFAULT_THRESHOLD_T_STAR = 0.55;
const CANDIDATE_SET_SIZE = 10;
const USABLE_GATE_PASS_RATE_MIN = 0.30;
const USABLE_P_AT_LEAST_T_MIN = 0.10;
const USABLE_CONFLICT_RATE_MAX = 0.20;
const IMPROVEMENT_DELTA_MIN = 0.15;
const IMPROVEMENT_BOTH_LOW_THRESHOLD = 0.05;
const GAP_NEAREST_DISTANCE_THRESHOLD = 0.45;
const GAP_PERCENTILE_THRESHOLD = 95;
const SANITY_GATE_PASS_RATE_MIN = 0.20;
const SANITY_MIN_NON_ZERO_WEIGHTS = 3;
const SPAM_BRAKE_DISTANCE_MAX = 0.35;
const SPAM_BRAKE_P_AT_LEAST_T_MIN = 0.15;

class PrototypeCreateSuggestionBuilder {
  #prototypeSynthesisService;

  /**
   * @param {object} deps
   * @param {object} deps.prototypeSynthesisService - Required service for prototype synthesis
   */
  constructor({ prototypeSynthesisService }) {
    validateDependency(prototypeSynthesisService, 'IPrototypeSynthesisService', console, {
      requiredMethods: ['synthesize'],
    });
    this.#prototypeSynthesisService = prototypeSynthesisService;
  }

  /**
   * Builds a prototype create suggestion recommendation.
   *
   * Emission conditions:
   * - (A && B) || C where:
   *   - A: No usable prototype exists
   *   - B: Predicted fit shows significant improvement (≥0.15)
   *   - C: Gap detection signal (nearest distance > 0.45)
   *
   * @param {object} diagnosticFacts - Full diagnostic facts object
   * @returns {object|null} Recommendation or null if conditions not met
   */
  build(diagnosticFacts) {
    // Move all logic from RecommendationEngine#buildPrototypeCreateSuggestion here
    // Including all helper methods:
    // - #selectAnchorClause
    // - #buildCandidateSet
    // - #findBestExistingPrototype
    // - #getPAtLeastT
    // - #interpolatePAtLeastT
    // - #checkNoUsablePrototype
    // - #isUsablePrototype
    // - #checkGapSignal
    // - #checkImprovementCondition
    // - #getPAtLeastTFromPredicted
    // - #synthesizeProposedPrototype
    // - #passesSanityCheck
    // - #determineConfidence
    // - #buildPrototypeCreateEvidence
    // - #buildPrototypeCreateWhy
    // - #buildPredictedFitPayload
    // - #getAnchorPrototypeId
    // - #serializeTargetSignature
    // - #summarizeTargetSignature
  }
}

export default PrototypeCreateSuggestionBuilder;
```

### DI Token

Add to `tokens-diagnostics.js`:
```javascript
IPrototypeCreateSuggestionBuilder: 'IPrototypeCreateSuggestionBuilder',
```

### DI Registration

Add to `expressionDiagnosticsRegistrations.js`:
```javascript
// PrototypeCreateSuggestionBuilder - optional, requires prototypeSynthesisService
registrar.singletonFactory(
  diagnosticsTokens.IPrototypeCreateSuggestionBuilder,
  (c) => {
    const prototypeSynthesisService = c.resolve(diagnosticsTokens.IPrototypeSynthesisService);
    if (!prototypeSynthesisService) return null;
    return new PrototypeCreateSuggestionBuilder({ prototypeSynthesisService });
  }
);
```

### Update RecommendationEngine.js

```javascript
// Add import
import PrototypeCreateSuggestionBuilder from './recommendationBuilders/PrototypeCreateSuggestionBuilder.js';

class RecommendationEngine {
  #prototypeCreateBuilder;

  constructor({
    prototypeSynthesisService = null,
    emotionSimilarityService = null,
  } = {}) {
    // Initialize builder if service available
    this.#prototypeCreateBuilder = prototypeSynthesisService
      ? new PrototypeCreateSuggestionBuilder({ prototypeSynthesisService })
      : null;

    // ... rest of constructor
  }

  generate(diagnosticFacts) {
    // ... existing logic ...

    // Replace inline prototype create logic with:
    if (this.#prototypeCreateBuilder) {
      const protoCreateRec = this.#prototypeCreateBuilder.build(diagnosticFacts);
      if (protoCreateRec) {
        recommendations.push(protoCreateRec);
      }
    }

    // ... rest of generate
  }
}

// REMOVE from RecommendationEngine.js:
// - #buildPrototypeCreateSuggestion(diagnosticFacts)
// - #selectAnchorClause(clauses)
// - #buildCandidateSet(leaderboard, gapDetection)
// - #findBestExistingPrototype(candidates, thresholdTStar)
// - #getPAtLeastT(prototype, threshold)
// - #interpolatePAtLeastT(pAbove, threshold)
// - #checkNoUsablePrototype(candidates, thresholdTStar)
// - #isUsablePrototype(proto, thresholdTStar)
// - #checkGapSignal(gapDetection)
// - #checkImprovementCondition(predictedFit, best, thresholdTStar)
// - #getPAtLeastTFromPredicted(predictedFit, threshold)
// - #synthesizeProposedPrototype(diagnosticFacts, anchorClause, threshold)
// - #passesSanityCheck(synthesized)
// - #determineConfidence(A, B, C, sanityPassed)
// - #buildPrototypeCreateEvidence({...})
// - #buildPrototypeCreateWhy(A, B, C, shouldEmitAB, shouldEmitC)
// - #buildPredictedFitPayload(predictedFit, best, thresholdTStar, diagnosticFacts)
// - #getAnchorPrototypeId(anchorClause, diagnosticFacts)
// - #serializeTargetSignature(targetSignature)
// - #summarizeTargetSignature(targetSignature)
// - All DEFAULT_*, CANDIDATE_*, USABLE_*, IMPROVEMENT_*, GAP_*, SANITY_*, SPAM_* constants
```

## Acceptance Criteria

### Tests That Must Pass

#### New Unit Tests (PrototypeCreateSuggestionBuilder.test.js)

Extract and adapt these test cases from `recommendationEngine.test.js` (lines 925-1523):

1. **Constructor validation**:
   ```javascript
   it('throws if prototypeSynthesisService is missing', () => {
     expect(() => new PrototypeCreateSuggestionBuilder({})).toThrow();
   });
   ```

2. **Condition A: No usable prototype**:
   ```javascript
   it('detects no usable prototype when gatePassRate < 0.30', () => {
     // Setup diagnosticFacts with low gate pass rates
     // Verify condition A is true
   });

   it('detects no usable prototype when pAtLeastT < 0.10', () => {
     // Setup with low P(≥T*)
     // Verify condition A is true
   });
   ```

3. **Condition B: Strong improvement**:
   ```javascript
   it('detects strong improvement with ≥0.15 delta over existing', () => {
     // Setup predictedFit with significant improvement
     // Verify condition B triggers emission
   });
   ```

4. **Condition C: Gap detection signal**:
   ```javascript
   it('detects gap signal when nearestDistance > 0.45', () => {
     // Setup gapDetection.nearestDistance > threshold
     // Verify condition C is true
   });
   ```

5. **Combined emission logic**:
   ```javascript
   it('emits when (A && B) is true', () => {
     // Both A and B conditions
     expect(builder.build(facts)).not.toBeNull();
   });

   it('emits when C is true even without A', () => {
     // Only C condition with some B
     expect(builder.build(facts)).not.toBeNull();
   });

   it('does NOT emit when only A is true', () => {
     // A true but B and C false
     expect(builder.build(facts)).toBeNull();
   });
   ```

6. **Spam brake**:
   ```javascript
   it('applies spam brake when nearestDistance <= 0.35', () => {
     // Setup with low gap distance
     // Verify spam brake activates
   });
   ```

7. **Sanity checks**:
   ```javascript
   it('rejects synthesis with gatePassRate < 0.20', () => {
     // Setup synthesized prototype with low gate pass
     // Verify sanity check fails
   });

   it('rejects synthesis with < 3 non-zero weights', () => {
     // Setup sparse weight vector
     // Verify sanity check fails
   });
   ```

8. **Confidence levels**:
   ```javascript
   it('sets high confidence for (A && B)', () => {
     // Verify confidence: 'high'
   });

   it('sets high confidence for (C && B)', () => {
     // Verify confidence: 'high'
   });

   it('sets medium confidence for C alone', () => {
     // Verify confidence: 'medium'
   });
   ```

9. **Output structure**:
   ```javascript
   it('produces correct recommendation structure', () => {
     const rec = builder.build(facts);
     expect(rec).toMatchObject({
       type: 'prototype_create_suggestion',
       severity: expect.any(String),
       confidence: expect.any(String),
       evidence: expect.any(Array),
       actions: expect.any(Array),
     });
   });
   ```

#### New Integration Tests (prototypeCreateSuggestion.integration.test.js)

1. **Full pipeline with synthesis service**:
   ```javascript
   it('generates prototype create suggestion through MonteCarloReportGenerator', () => {
     // Setup real PrototypeSynthesisService (or realistic mock)
     // Generate report with diagnosticFacts triggering condition A && B
     // Verify recommendation appears in report
   });
   ```

2. **Deterministic ordering**:
   ```javascript
   it('produces deterministic output across multiple runs', () => {
     // Run builder 3 times with same input
     // Compare JSON.stringify of results
     // All must be identical
   });
   ```

3. **Integration with existing recommendations**:
   ```javascript
   it('coexists with other recommendation types', () => {
     // Create facts that trigger multiple recommendation types
     // Verify prototype_create_suggestion appears among them
     // Verify sorting is correct
   });
   ```

#### Existing Tests That Must Still Pass

All tests in:
- `tests/unit/expressionDiagnostics/services/recommendationEngine.test.js` (lines 925-1523 now delegating)
- `tests/integration/expressionDiagnostics/overconstrainedConjunction.integration.test.js`

### Invariants That Must Remain True

1. RecommendationEngine.generate() produces identical output for identical inputs
2. `prototype_create_suggestion` type recommendations have identical structure
3. Confidence levels: high for (A&&B) or (C&&B), medium for C alone
4. Spam brake thresholds unchanged (distance ≤ 0.35, pAtLeastT ≥ 0.15)
5. Sanity check thresholds unchanged (gatePassRate ≥ 0.20, nonZeroWeights ≥ 3)
6. Builder returns null when prototypeSynthesisService is unavailable
7. Anchor clause selection algorithm unchanged
8. Target signature serialization unchanged
9. `npm run test:unit -- --testPathPattern="recommendationEngine"` passes
10. `npm run typecheck` passes
11. `npx eslint <modified-files>` passes

## Verification Commands

```bash
# Run new builder tests
npm run test:unit -- --testPathPattern="PrototypeCreateSuggestionBuilder"

# Run existing RecommendationEngine tests (critical - must all pass)
npm run test:unit -- --testPathPattern="recommendationEngine"

# Run new integration tests
npm run test:integration -- --testPathPattern="prototypeCreateSuggestion"

# Run all expression diagnostics integration tests
npm run test:integration -- --testPathPattern="expressionDiagnostics"

# Type check
npm run typecheck

# Lint modified files
npx eslint src/expressionDiagnostics/services/RecommendationEngine.js \
           src/expressionDiagnostics/services/recommendationBuilders/PrototypeCreateSuggestionBuilder.js
```

## Dependencies

- RECENGREFANA-000 (shared utilities for getConfidence, getSeverity)

## Estimated Diff Size

- New source file: ~600 lines
- New unit test file: ~400 lines
- New integration test file: ~150 lines
- RecommendationEngine.js changes: ~600 lines removed, ~20 lines added
- DI files: ~10 lines
- **Total: ~1,780 lines changed** (net reduction in RecommendationEngine: ~580 lines)

---

## Outcome

**Status: COMPLETED** (2026-01-19)

### Files Created

1. `src/expressionDiagnostics/services/recommendationBuilders/PrototypeCreateSuggestionBuilder.js` (561 lines)
   - Extracted 17 private methods and 13 constants from RecommendationEngine
   - Single public method: `build(diagnosticFacts)`
   - Required dependency: `prototypeSynthesisService`

2. `tests/unit/expressionDiagnostics/services/recommendationBuilders/PrototypeCreateSuggestionBuilder.test.js`
   - 46 tests covering all emission conditions, spam brake, sanity checks, confidence levels

3. `tests/integration/expressionDiagnostics/recommendationBuilders/prototypeCreateSuggestion.integration.test.js`
   - 15 tests covering full pipeline, deterministic ordering, coexistence with other recommendation types

### Files Modified

1. `src/dependencyInjection/tokens/tokens-diagnostics.js`
   - Added `IPrototypeCreateSuggestionBuilder` token

2. `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js`
   - Added factory registration for PrototypeCreateSuggestionBuilder

3. `src/expressionDiagnostics/services/RecommendationEngine.js`
   - Removed ~600 lines of prototype create logic
   - Added delegation to `#prototypeCreateBuilder` (6 lines)
   - Reduced from ~1900 lines to ~1320 lines

### Verification Results

```
# Unit tests
Test Suites: 2 passed
Tests: 84 passed (46 builder + 38 engine)

# Integration tests
Test Suites: 1 passed
Tests: 15 passed

# Total test coverage
Tests: 99 passed
```

### Discrepancies from Plan

1. **Import path**: Ticket showed `../utils/recommendationUtils.js` but builder is in `recommendationBuilders/`, so actual path is `../../utils/recommendationUtils.js`

2. **Recommendation output**: Builder returns `predictedFit` and `proposedPrototype` instead of `actions` and `predictedEffect` fields (prototype_create_suggestion has different structure than other recommendation types)

### Notes

- Constructor throws error if `prototypeSynthesisService` is not provided (differs from original which allowed null)
- RecommendationEngine creates builder internally in constructor when synthesis service is provided
- All existing RecommendationEngine tests continue to pass with delegation approach
