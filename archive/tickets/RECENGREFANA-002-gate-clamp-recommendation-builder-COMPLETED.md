# RECENGREFANA-002: Extract GateClampRecommendationBuilder

## Description

Extract the gate clamp regime analysis cluster (~450 lines) from `RecommendationEngine.js` into a dedicated builder class. This handles complex candidate selection for constraint tightening recommendations when mood regime permits gate-clamped states.

## Files to Create

- `src/expressionDiagnostics/services/recommendationBuilders/GateClampRecommendationBuilder.js`
- `tests/unit/expressionDiagnostics/services/recommendationBuilders/GateClampRecommendationBuilder.test.js`
- `tests/integration/expressionDiagnostics/recommendationBuilders/gateClampRecommendation.integration.test.js`

## Files to Modify

- `src/expressionDiagnostics/services/RecommendationEngine.js` - Delegate to new builder
- `src/dependencyInjection/tokens/tokens-diagnostics.js` - Add `IGateClampRecommendationBuilder` token
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` - Add registration

## Out of Scope

- PrototypeCreateSuggestionBuilder (RECENGREFANA-001)
- AxisConflictAnalyzer (RECENGREFANA-003)
- OverconstrainedConjunctionBuilder (RECENGREFANA-004)
- SoleBlockerRecommendationBuilder (RECENGREFANA-005)
- Changes to RecommendationFactsBuilder gate-clamp fact extraction
- Changes to MonteCarloReportGenerator

## Implementation Details

### GateClampRecommendationBuilder.js

```javascript
/**
 * @file GateClampRecommendationBuilder - Generates gate clamp regime recommendations
 * @see RecommendationEngine.js (original location)
 */

import { getConfidence, getSeverity } from '../utils/recommendationUtils.js';

// === CONSTANTS (moved from RecommendationEngine.js) ===

const GATE_CLAMP_MIN_RATE = 0.2;
const GATE_CLAMP_MIN_KEEP = 0.5;
const GATE_CLAMP_MIN_DELTA = 0.1;

class GateClampRecommendationBuilder {
  /**
   * Builds a gate clamp regime permissive recommendation.
   *
   * Identifies when the mood regime permits states where emotion gates are clamped,
   * and suggests constraint tightening to reduce this.
   *
   * @param {object} clause - Clause with gateClampRegimePermissive facts
   * @returns {object|null} Recommendation or null if not applicable
   */
  build(clause) {
    // Move all logic from RecommendationEngine#buildGateClampRecommendation here
    // Including all helper methods:
    // - #selectGateClampCandidate(gateClampFacts)
    // - #candidateMeetsGateClampThresholds(candidate, clampRate, gateClampFacts)
    // - #candidateTightensRegime(candidate, gatePredicates)
    // - #constraintTightensBounds(bounds, operator, threshold)
    // - #buildGateClampEvidence(gateClampFacts, candidate)
    // - #buildGateClampActions(candidate)
  }
}

export default GateClampRecommendationBuilder;
```

### DI Token

Add to `tokens-diagnostics.js`:
```javascript
IGateClampRecommendationBuilder: 'IGateClampRecommendationBuilder',
```

### DI Registration

Add to `expressionDiagnosticsRegistrations.js`:
```javascript
registrar.singletonFactory(
  diagnosticsTokens.IGateClampRecommendationBuilder,
  () => new GateClampRecommendationBuilder()
);
```

### Update RecommendationEngine.js

```javascript
// Add import
import GateClampRecommendationBuilder from './recommendationBuilders/GateClampRecommendationBuilder.js';

class RecommendationEngine {
  #gateClampBuilder;

  constructor({
    prototypeSynthesisService = null,
    emotionSimilarityService = null,
  } = {}) {
    this.#gateClampBuilder = new GateClampRecommendationBuilder();
    // ... rest
  }

  generate(diagnosticFacts) {
    // ... existing logic ...

    // In the clause processing loop, replace:
    // const gateClampRec = this.#buildGateClampRecommendation(clause);
    // with:
    const gateClampRec = this.#gateClampBuilder.build(clause);
    if (gateClampRec) {
      recommendations.push(gateClampRec);
    }

    // ... rest
  }
}

// REMOVE from RecommendationEngine.js:
// - #buildGateClampRecommendation(clause)
// - #selectGateClampCandidate(gateClampFacts)
// - #candidateMeetsGateClampThresholds(candidate, clampRate, gateClampFacts)
// - #candidateTightensRegime(candidate, gatePredicates)
// - #constraintTightensBounds(bounds, operator, threshold)
// - #buildGateClampEvidence(gateClampFacts, candidate)
// - #buildGateClampActions(candidate)
// - GATE_CLAMP_MIN_RATE, GATE_CLAMP_MIN_KEEP, GATE_CLAMP_MIN_DELTA constants
```

## Acceptance Criteria

### Tests That Must Pass

#### New Unit Tests (GateClampRecommendationBuilder.test.js)

Extract and adapt test cases from `recommendationEngine.test.js` (lines 803-923):

1. **Basic recommendation generation**:
   ```javascript
   it('generates gate_clamp_regime_permissive recommendation', () => {
     const clause = {
       id: 'test-clause',
       gateClampRegimePermissive: {
         clampRate: 0.35,
         moodConstraints: [...],
         axisEvidence: [...],
         candidates: [...]
       }
     };
     const rec = builder.build(clause);
     expect(rec.type).toBe('gate_clamp_regime_permissive');
   });
   ```

2. **Candidate selection**:
   ```javascript
   it('selects candidate that meets all thresholds', () => {
     const clause = createClauseWithCandidates([
       { keepRatio: 0.6, delta: 0.15 }, // meets thresholds
       { keepRatio: 0.4, delta: 0.05 }, // below thresholds
     ]);
     const rec = builder.build(clause);
     expect(rec.structuredActions.candidate.keepRatio).toBeGreaterThanOrEqual(0.5);
   });

   it('prefers candidate with highest keepRatio * delta', () => {
     // Multiple valid candidates, select best
   });
   ```

3. **Threshold validation**:
   ```javascript
   it('returns null when clampRate < GATE_CLAMP_MIN_RATE (0.2)', () => {
     const clause = createClauseWithClampRate(0.15);
     expect(builder.build(clause)).toBeNull();
   });

   it('returns null when no candidate has keepRatio >= 0.5', () => {
     const clause = createClauseWithCandidates([
       { keepRatio: 0.4, delta: 0.2 }
     ]);
     expect(builder.build(clause)).toBeNull();
   });

   it('returns null when no candidate has delta >= 0.1', () => {
     const clause = createClauseWithCandidates([
       { keepRatio: 0.7, delta: 0.05 }
     ]);
     expect(builder.build(clause)).toBeNull();
   });
   ```

4. **Constraint tightening logic**:
   ```javascript
   it('correctly identifies tightening for >= operator', () => {
     // Bound is [0.3, 0.7], constraint >= 0.4 tightens lower bound
   });

   it('correctly identifies tightening for <= operator', () => {
     // Bound is [0.3, 0.7], constraint <= 0.5 tightens upper bound
   });

   it('does NOT emit when constraint is redundant', () => {
     // Constraint already satisfied by regime bounds
     expect(builder.build(redundantClause)).toBeNull();
   });
   ```

5. **Evidence building**:
   ```javascript
   it('includes axis evidence in recommendation', () => {
     const rec = builder.build(validClause);
     expect(rec.evidence).toContainEqual(
       expect.objectContaining({ label: expect.stringContaining('axis') })
     );
   });

   it('includes clamp rate in evidence', () => {
     const rec = builder.build(validClause);
     expect(rec.evidence).toContainEqual(
       expect.objectContaining({ label: 'Clamp rate' })
     );
   });
   ```

6. **Actions structure**:
   ```javascript
   it('builds structured actions with candidate details', () => {
     const rec = builder.build(validClause);
     expect(rec.structuredActions).toMatchObject({
       type: 'tighten_regime',
       candidate: expect.objectContaining({
         axis: expect.any(String),
         operator: expect.any(String),
         threshold: expect.any(Number),
       }),
     });
   });
   ```

7. **Edge cases**:
   ```javascript
   it('returns null for clause without gateClampRegimePermissive', () => {
     expect(builder.build({})).toBeNull();
     expect(builder.build({ gateClampRegimePermissive: null })).toBeNull();
   });

   it('handles empty candidates array', () => {
     const clause = { gateClampRegimePermissive: { candidates: [] } };
     expect(builder.build(clause)).toBeNull();
   });
   ```

#### New Integration Tests (gateClampRecommendation.integration.test.js)

1. **Full pipeline with RecommendationFactsBuilder**:
   ```javascript
   it('produces gate clamp recommendation from realistic facts', () => {
     // Create full diagnosticFacts with gateClampRegimePermissive
     // Verify recommendation appears in MonteCarloReportGenerator output
   });
   ```

2. **Interaction with other recommendations**:
   ```javascript
   it('coexists with prototype mismatch recommendations', () => {
     // Facts that trigger both types
     // Verify both appear with correct sorting
   });
   ```

3. **Determinism**:
   ```javascript
   it('produces deterministic output for identical input', () => {
     const results = [1, 2, 3].map(() => builder.build(testClause));
     expect(new Set(results.map(JSON.stringify)).size).toBe(1);
   });
   ```

#### Existing Tests That Must Still Pass

All tests in:
- `tests/unit/expressionDiagnostics/services/recommendationEngine.test.js`
- `tests/unit/expressionDiagnostics/services/recommendationFactsBuilderGateClamp.test.js`
- `tests/integration/expressionDiagnostics/overconstrainedConjunction.integration.test.js`

### Invariants That Must Remain True

1. RecommendationEngine.generate() produces identical output for identical inputs
2. `gate_clamp_regime_permissive` recommendations have identical structure
3. Candidate selection criteria unchanged:
   - clampRate >= 0.2
   - keepRatio >= 0.5
   - delta >= 0.1
4. Sorting by keepRatio * delta unchanged
5. Redundant constraint detection unchanged
6. Builder is stateless (no constructor dependencies required)
7. `npm run test:unit -- --testPathPattern="recommendationEngine"` passes
8. `npm run test:unit -- --testPathPattern="recommendationFactsBuilderGateClamp"` passes
9. `npm run typecheck` passes
10. `npx eslint <modified-files>` passes

## Verification Commands

```bash
# Run new builder tests
npm run test:unit -- --testPathPattern="GateClampRecommendationBuilder"

# Run existing tests that use gate clamp
npm run test:unit -- --testPathPattern="recommendationEngine"
npm run test:unit -- --testPathPattern="recommendationFactsBuilderGateClamp"

# Run new integration tests
npm run test:integration -- --testPathPattern="gateClampRecommendation"

# Type check
npm run typecheck

# Lint modified files
npx eslint src/expressionDiagnostics/services/RecommendationEngine.js \
           src/expressionDiagnostics/services/recommendationBuilders/GateClampRecommendationBuilder.js
```

## Dependencies

- RECENGREFANA-000 (shared utilities for getConfidence, getSeverity)

## Estimated Diff Size

- New source file: ~420 lines
- New unit test file: ~300 lines
- New integration test file: ~120 lines
- RecommendationEngine.js changes: ~420 lines removed, ~15 lines added
- DI files: ~6 lines
- **Total: ~1,280 lines changed** (net reduction in RecommendationEngine: ~405 lines)
