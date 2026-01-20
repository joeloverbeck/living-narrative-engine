# RECENGREFANA-005: Extract SoleBlockerRecommendationBuilder - COMPLETED

**Status**: ✅ COMPLETED
**Completed Date**: 2026-01-19

## Summary of Changes

### Files Created
- `src/expressionDiagnostics/services/recommendationBuilders/SoleBlockerRecommendationBuilder.js` (~260 lines)
- `tests/unit/expressionDiagnostics/services/recommendationBuilders/SoleBlockerRecommendationBuilder.test.js` (62 tests)
- `tests/integration/expressionDiagnostics/recommendationBuilders/soleBlockerRecommendation.integration.test.js` (14 tests)

### Files Modified
- `src/expressionDiagnostics/services/RecommendationEngine.js` - Removed ~114 lines, added delegation to builder
- `src/dependencyInjection/tokens/tokens-diagnostics.js` - Added `ISoleBlockerRecommendationBuilder` token
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` - Added registration

### Verification Results
- ✅ 62 unit tests pass for SoleBlockerRecommendationBuilder
- ✅ 59 existing RecommendationEngine tests pass (backward compatibility)
- ✅ 14 integration tests pass
- ✅ Typecheck passes (no new errors)
- ✅ ESLint passes (0 errors)

### Corrections to Original Ticket
- Confidence thresholds: <200 = low, 200-499 = medium, >=500 = high (not <50/50-499/>=500)

---

# Original Ticket Content

## Description

Extract the sole blocker analysis cluster (~120 lines) from `RecommendationEngine.js` into a dedicated builder class. This handles "decisive blocker" detection where all other clauses pass and only one fails, and suggests threshold edits with percentile-based guidance.

## Files to Create

- `src/expressionDiagnostics/services/recommendationBuilders/SoleBlockerRecommendationBuilder.js`
- `tests/unit/expressionDiagnostics/services/recommendationBuilders/SoleBlockerRecommendationBuilder.test.js`
- `tests/integration/expressionDiagnostics/recommendationBuilders/soleBlockerRecommendation.integration.test.js`

## Files to Modify

- `src/expressionDiagnostics/services/RecommendationEngine.js` - Delegate to new builder
- `src/dependencyInjection/tokens/tokens-diagnostics.js` - Add `ISoleBlockerRecommendationBuilder` token
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` - Add registration

## Out of Scope

- PrototypeCreateSuggestionBuilder (RECENGREFANA-001)
- GateClampRecommendationBuilder (RECENGREFANA-002)
- AxisConflictAnalyzer (RECENGREFANA-003)
- OverconstrainedConjunctionBuilder (RECENGREFANA-004)
- Changes to how lastMileFailRate is calculated
- Changes to percentile extraction from stored contexts

## Implementation Details

### SoleBlockerRecommendationBuilder.js

```javascript
/**
 * @file SoleBlockerRecommendationBuilder - Generates sole blocker edit recommendations
 * @see RecommendationEngine.js (original location)
 */

import { getConfidence, getSeverity } from '../utils/recommendationUtils.js';

// === CONSTANTS (moved from RecommendationEngine.js) ===

const SOLE_BLOCKER_MIN_RATE = 0.1;
const SOLE_BLOCKER_MIN_SAMPLES = 10;

class SoleBlockerRecommendationBuilder {
  /**
   * Builds a sole blocker edit recommendation.
   *
   * Detects when a clause is the "decisive blocker" - all other clauses pass
   * but this one fails. Suggests threshold edits at P50 and P90 percentiles.
   *
   * @param {object} clause - Clause data with lastMile stats
   * @returns {object|null} Recommendation or null if not applicable
   */
  build(clause) {
    // Move all logic from RecommendationEngine#buildSoleBlockerRecommendation
  }
}

export default SoleBlockerRecommendationBuilder;
```

### DI Token

Add to `tokens-diagnostics.js`:
```javascript
ISoleBlockerRecommendationBuilder: 'ISoleBlockerRecommendationBuilder',
```

### DI Registration

Add to `expressionDiagnosticsRegistrations.js`:
```javascript
registrar.singletonFactory(
  diagnosticsTokens.ISoleBlockerRecommendationBuilder,
  () => new SoleBlockerRecommendationBuilder()
);
```

### Update RecommendationEngine.js

```javascript
// Add import
import SoleBlockerRecommendationBuilder from './recommendationBuilders/SoleBlockerRecommendationBuilder.js';

class RecommendationEngine {
  #soleBlockerBuilder;

  constructor({
    prototypeSynthesisService = null,
    emotionSimilarityService = null,
  } = {}) {
    this.#soleBlockerBuilder = new SoleBlockerRecommendationBuilder();
    // ... rest
  }

  generate(diagnosticFacts) {
    // In clause processing loop, replace:
    // const soleBlockerRec = this.#buildSoleBlockerRecommendation(clause);
    // with:
    const soleBlockerRec = this.#soleBlockerBuilder.build(clause);
    if (soleBlockerRec) {
      recommendations.push(soleBlockerRec);
    }
    // ... rest
  }
}

// REMOVE from RecommendationEngine.js:
// - #buildSoleBlockerRecommendation(clause)
// - SOLE_BLOCKER_MIN_RATE, SOLE_BLOCKER_MIN_SAMPLES constants
```

## Acceptance Criteria

### Tests That Must Pass

#### New Unit Tests (SoleBlockerRecommendationBuilder.test.js)

Extract and adapt test cases from `recommendationEngine.test.js` (lines 1525-1720):

1. **Basic recommendation generation**:
   ```javascript
   it('produces sole_blocker_edit recommendation type', () => {
     const clause = createSoleBlockerClause();
     const rec = builder.build(clause);
     expect(rec.type).toBe('sole_blocker_edit');
   });

   it('produces "Best First Edit" title', () => {
     const rec = builder.build(createSoleBlockerClause());
     expect(rec.title).toBe('Best First Edit');
   });
   ```

2. **Direction suggestions**:
   ```javascript
   it('suggests "Lower" direction for >= operator', () => {
     const clause = createSoleBlockerClause({ operator: '>=' });
     const rec = builder.build(clause);
     expect(rec.structuredActions.direction).toBe('lower');
   });

   it('suggests "Raise" direction for <= operator', () => {
     const clause = createSoleBlockerClause({ operator: '<=' });
     const rec = builder.build(clause);
     expect(rec.structuredActions.direction).toBe('raise');
   });
   ```

3. **Percentile suggestions**:
   ```javascript
   it('includes P50 threshold suggestion', () => {
     const rec = builder.build(createSoleBlockerClause());
     expect(rec.structuredActions.suggestions).toContainEqual(
       expect.objectContaining({ percentile: 50 })
     );
   });

   it('includes P90 threshold suggestion', () => {
     const rec = builder.build(createSoleBlockerClause());
     expect(rec.structuredActions.suggestions).toContainEqual(
       expect.objectContaining({ percentile: 90 })
     );
   });

   it('includes specific threshold targets', () => {
     const clause = createSoleBlockerClause({ p50: 0.35, p90: 0.52 });
     const rec = builder.build(clause);
     expect(rec.structuredActions.suggestions[0].threshold).toBe(0.35);
     expect(rec.structuredActions.suggestions[1].threshold).toBe(0.52);
   });
   ```

4. **Evidence building**:
   ```javascript
   it('includes current threshold in evidence', () => {
     const clause = createSoleBlockerClause({ threshold: 0.45 });
     const rec = builder.build(clause);
     expect(rec.evidence).toContainEqual(
       expect.objectContaining({ label: 'Current threshold', value: '0.45' })
     );
   });

   it('includes percentile values in evidence', () => {
     const rec = builder.build(createSoleBlockerClause());
     expect(rec.evidence.some(e => e.label.includes('P50'))).toBe(true);
     expect(rec.evidence.some(e => e.label.includes('P90'))).toBe(true);
   });
   ```

5. **Confidence scaling**:
   ```javascript
   it('sets low confidence for < 50 samples', () => {
     const clause = createSoleBlockerClause({ sampleCount: 30 });
     const rec = builder.build(clause);
     expect(rec.confidence).toBe('low');
   });

   it('sets medium confidence for 50-499 samples', () => {
     const clause = createSoleBlockerClause({ sampleCount: 200 });
     const rec = builder.build(clause);
     expect(rec.confidence).toBe('medium');
   });

   it('sets high confidence for >= 500 samples', () => {
     const clause = createSoleBlockerClause({ sampleCount: 500 });
     const rec = builder.build(clause);
     expect(rec.confidence).toBe('high');
   });
   ```

6. **Related clause linking**:
   ```javascript
   it('includes relatedClauseIds', () => {
     const clause = createSoleBlockerClause({ id: 'clause-123' });
     const rec = builder.build(clause);
     expect(rec.relatedClauseIds).toContain('clause-123');
   });
   ```

7. **Minimum thresholds**:
   ```javascript
   it('returns null when lastMileFailRate < 0.1', () => {
     const clause = createSoleBlockerClause({ lastMileFailRate: 0.05 });
     expect(builder.build(clause)).toBeNull();
   });

   it('returns null when sampleCount < 10', () => {
     const clause = createSoleBlockerClause({ sampleCount: 5 });
     expect(builder.build(clause)).toBeNull();
   });

   it('builds recommendation at exactly minimum thresholds', () => {
     const clause = createSoleBlockerClause({
       lastMileFailRate: 0.1,
       sampleCount: 10,
     });
     expect(builder.build(clause)).not.toBeNull();
   });
   ```

8. **Edge cases**:
   ```javascript
   it('returns null for clause without lastMile data', () => {
     expect(builder.build({})).toBeNull();
     expect(builder.build({ lastMileFailRate: null })).toBeNull();
   });

   it('handles missing percentile data gracefully', () => {
     const clause = createSoleBlockerClause({ p50: null, p90: null });
     const rec = builder.build(clause);
     // Should still produce recommendation, but without specific suggestions
     expect(rec).toBeDefined();
   });
   ```

#### New Integration Tests (soleBlockerRecommendation.integration.test.js)

1. **Full pipeline**:
   ```javascript
   it('produces sole blocker recommendation from realistic diagnosticFacts', () => {
     // Create facts with one clause being decisive blocker
     // Verify recommendation appears in MonteCarloReportGenerator output
   });
   ```

2. **Coexistence with other recommendations**:
   ```javascript
   it('coexists with prototype mismatch recommendations', () => {
     // Facts trigger both types
     // Verify sorting is correct (higher impact first)
   });
   ```

3. **Determinism**:
   ```javascript
   it('produces deterministic output', () => {
     const results = [1, 2, 3].map(() => builder.build(testClause));
     expect(new Set(results.map(JSON.stringify)).size).toBe(1);
   });
   ```

#### Existing Tests That Must Still Pass

All tests in:
- `tests/unit/expressionDiagnostics/services/recommendationEngine.test.js` (lines 1525-1720)
- `tests/integration/expressionDiagnostics/overconstrainedConjunction.integration.test.js`

### Invariants That Must Remain True

1. RecommendationEngine.generate() produces identical output for identical inputs
2. `sole_blocker_edit` recommendations have identical structure
3. Minimum thresholds unchanged:
   - lastMileFailRate >= 0.1
   - sampleCount >= 10
4. Direction logic unchanged (>= → lower, <= → raise)
5. Percentile suggestions at P50 and P90
6. Confidence based on sample count (same thresholds as other recommendations)
7. Builder is stateless (no constructor dependencies)
8. `npm run test:unit -- --testPathPattern="recommendationEngine"` passes
9. `npm run typecheck` passes
10. `npx eslint <modified-files>` passes

## Verification Commands

```bash
# Run new builder tests
npm run test:unit -- --testPathPattern="SoleBlockerRecommendationBuilder"

# Run existing tests
npm run test:unit -- --testPathPattern="recommendationEngine"

# Run new integration tests
npm run test:integration -- --testPathPattern="soleBlockerRecommendation"

# Type check
npm run typecheck

# Lint modified files
npx eslint src/expressionDiagnostics/services/RecommendationEngine.js \
           src/expressionDiagnostics/services/recommendationBuilders/SoleBlockerRecommendationBuilder.js
```

## Dependencies

- RECENGREFANA-000 (shared utilities for getConfidence, getSeverity)

## Estimated Diff Size

- New source file: ~120 lines
- New unit test file: ~300 lines
- New integration test file: ~100 lines
- RecommendationEngine.js changes: ~120 lines removed, ~10 lines added
- DI files: ~6 lines
- **Total: ~660 lines changed** (net reduction in RecommendationEngine: ~110 lines)
