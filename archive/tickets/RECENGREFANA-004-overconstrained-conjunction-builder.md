# RECENGREFANA-004: Extract OverconstrainedConjunctionBuilder

## Description

Extract the overconstrained conjunction analysis cluster (~75 lines) from `RecommendationEngine.js` into a dedicated builder class. This handles detection of ANDed emotion thresholds with individually low pass rates and suggests 2-of-N or OR-softening alternatives.

## Files to Create

- `src/expressionDiagnostics/services/recommendationBuilders/OverconstrainedConjunctionBuilder.js`
- `tests/unit/expressionDiagnostics/services/recommendationBuilders/OverconstrainedConjunctionBuilder.test.js`

## Files to Modify

- `src/expressionDiagnostics/services/RecommendationEngine.js` - Delegate to new builder
- `src/dependencyInjection/tokens/tokens-diagnostics.js` - Add `IOverconstrainedConjunctionBuilder` token
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` - Add registration

## Out of Scope

- PrototypeCreateSuggestionBuilder (RECENGREFANA-001)
- GateClampRecommendationBuilder (RECENGREFANA-002)
- AxisConflictAnalyzer (RECENGREFANA-003)
- SoleBlockerRecommendationBuilder (RECENGREFANA-005)
- Changes to CoreSectionGenerator detection logic
- Changes to EmotionSimilarityService
- Changes to MonteCarloReportGenerator

## Implementation Details

### OverconstrainedConjunctionBuilder.js

```javascript
/**
 * @file OverconstrainedConjunctionBuilder - Generates overconstrained conjunction recommendations
 * @see RecommendationEngine.js (original location)
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';
import { getConfidence } from '../utils/recommendationUtils.js';

class OverconstrainedConjunctionBuilder {
  #emotionSimilarityService;

  /**
   * @param {object} deps
   * @param {object} [deps.emotionSimilarityService] - Optional for OR-softening suggestions
   */
  constructor({ emotionSimilarityService = null } = {}) {
    if (emotionSimilarityService) {
      validateDependency(emotionSimilarityService, 'IEmotionSimilarityService', console, {
        requiredMethods: ['checkGroupSimilarity', 'findSimilarEmotions'],
      });
    }
    this.#emotionSimilarityService = emotionSimilarityService;
  }

  /**
   * Builds an overconstrained conjunction recommendation.
   *
   * Detects when multiple emotion thresholds are ANDed together with individually
   * low pass rates, making joint probability near-zero.
   *
   * @param {object} info - OverconstrainedConjunctionInfo from CoreSectionGenerator
   * @returns {object} Recommendation object
   */
  build(info) {
    // Move logic from RecommendationEngine:
    // - Lines 79-102 in generate() for inline handling
    // - #buildOverconstrainedSuggestions(info)
  }

  /**
   * Builds suggestion actions for overconstrained conjunctions.
   *
   * @param {object} info - Overconstrained info object
   * @returns {string[]} Array of suggestion strings
   * @private
   */
  #buildOverconstrainedSuggestions(info) {
    // Move logic from RecommendationEngine#buildOverconstrainedSuggestions
    // - 2-of-N rule suggestions
    // - OR-softening suggestions with similar emotions
    // - Functionally similar emotion groups detection
  }
}

export default OverconstrainedConjunctionBuilder;
```

### DI Token

Add to `tokens-diagnostics.js`:
```javascript
IOverconstrainedConjunctionBuilder: 'IOverconstrainedConjunctionBuilder',
```

### DI Registration

Add to `expressionDiagnosticsRegistrations.js`:
```javascript
registrar.singletonFactory(
  diagnosticsTokens.IOverconstrainedConjunctionBuilder,
  (c) => new OverconstrainedConjunctionBuilder({
    emotionSimilarityService: c.resolve(diagnosticsTokens.IEmotionSimilarityService),
  })
);
```

### Update RecommendationEngine.js

```javascript
// Add import
import OverconstrainedConjunctionBuilder from './recommendationBuilders/OverconstrainedConjunctionBuilder.js';

class RecommendationEngine {
  #overconstrainedBuilder;

  constructor({
    prototypeSynthesisService = null,
    emotionSimilarityService = null,
  } = {}) {
    this.#overconstrainedBuilder = new OverconstrainedConjunctionBuilder({
      emotionSimilarityService,
    });
    // ... rest
  }

  generate(diagnosticFacts) {
    // Replace lines 79-102:
    for (const info of diagnosticFacts.overconstrainedDetails ?? []) {
      recommendations.push(this.#overconstrainedBuilder.build(info));
    }
    // ... rest
  }
}

// REMOVE from RecommendationEngine.js:
// - Inline logic in generate() for overconstrained handling (lines 79-102)
// - #buildOverconstrainedSuggestions(info)
```

## Acceptance Criteria

### Tests That Must Pass

#### New Unit Tests (OverconstrainedConjunctionBuilder.test.js)

Extract and adapt test cases from `recommendationEngine.overconstrained.test.js` (494 lines):

1. **Constructor**:
   ```javascript
   it('initializes without emotionSimilarityService', () => {
     const builder = new OverconstrainedConjunctionBuilder();
     expect(builder).toBeDefined();
   });

   it('initializes with emotionSimilarityService', () => {
     const builder = new OverconstrainedConjunctionBuilder({
       emotionSimilarityService: mockService,
     });
     expect(builder).toBeDefined();
   });
   ```

2. **Basic recommendation generation**:
   ```javascript
   it('produces overconstrained_conjunction recommendation type', () => {
     const info = createOverconstrainedInfo();
     const rec = builder.build(info);
     expect(rec.type).toBe('overconstrained_conjunction');
   });

   it('sets severity to high', () => {
     const rec = builder.build(createOverconstrainedInfo());
     expect(rec.severity).toBe('high');
   });

   it('includes affected clauses in recommendation', () => {
     const info = createOverconstrainedInfo();
     const rec = builder.build(info);
     expect(rec.structuredData.affectedClauses).toHaveLength(info.lowPassChildren.length);
   });

   it('includes naive joint probability', () => {
     const rec = builder.build(createOverconstrainedInfo());
     expect(rec.structuredData.naiveJointProbability).toBeDefined();
   });
   ```

3. **2-of-N rule suggestions**:
   ```javascript
   it('suggests 2-of-N rule for 4+ emotions', () => {
     const info = createOverconstrainedInfo({ emotionCount: 4 });
     const rec = builder.build(info);
     expect(rec.actions.some(a => a.includes('2-of-4'))).toBe(true);
   });

   it('correctly calculates n/2 for group suggestions', () => {
     const info = createOverconstrainedInfo({ emotionCount: 6 });
     const rec = builder.build(info);
     expect(rec.actions.some(a => a.includes('3-of-6'))).toBe(true);
   });
   ```

4. **OR-softening suggestions**:
   ```javascript
   it('suggests OR-softening with similar emotions when service available', () => {
     const builder = new OverconstrainedConjunctionBuilder({
       emotionSimilarityService: createMockSimilarityService(),
     });
     const rec = builder.build(createOverconstrainedInfo());
     expect(rec.actions.some(a => a.includes('OR'))).toBe(true);
   });

   it('formats similarity percentage correctly (85%)', () => {
     const builder = new OverconstrainedConjunctionBuilder({
       emotionSimilarityService: createMockSimilarityService({ similarity: 0.85 }),
     });
     const rec = builder.build(createOverconstrainedInfo());
     expect(rec.actions.some(a => a.includes('85%'))).toBe(true);
   });

   it('does NOT add OR-softening when no similar emotions found', () => {
     const builder = new OverconstrainedConjunctionBuilder({
       emotionSimilarityService: createMockSimilarityService({ noSimilar: true }),
     });
     const rec = builder.build(createOverconstrainedInfo());
     expect(rec.actions.every(a => !a.includes('OR softening'))).toBe(true);
   });
   ```

5. **Graceful degradation**:
   ```javascript
   it('works without EmotionSimilarityService', () => {
     const builder = new OverconstrainedConjunctionBuilder();
     const rec = builder.build(createOverconstrainedInfo());
     expect(rec).toBeDefined();
     expect(rec.type).toBe('overconstrained_conjunction');
   });
   ```

6. **Description formatting**:
   ```javascript
   it('includes emotion count in title', () => {
     const info = createOverconstrainedInfo({ emotionCount: 3 });
     const rec = builder.build(info);
     expect(rec.title).toContain('3');
   });

   it('formats joint probability in description', () => {
     const rec = builder.build(createOverconstrainedInfo());
     expect(rec.description).toMatch(/\d+\.\d+%/);
   });
   ```

7. **Edge cases**:
   ```javascript
   it('handles null threshold in formatting', () => {
     const info = createOverconstrainedInfo({ nullThreshold: true });
     expect(() => builder.build(info)).not.toThrow();
   });

   it('handles empty lowPassChildren', () => {
     const info = { ...createOverconstrainedInfo(), lowPassChildren: [] };
     const rec = builder.build(info);
     expect(rec).toBeDefined();
   });
   ```

#### Existing Integration Tests That Must Still Pass

The existing integration test already covers this:
- `tests/integration/expressionDiagnostics/overconstrainedConjunction.integration.test.js`

This test file validates:
- Full simulation flow with detection
- EmotionSimilarityService integration
- CoreSectionGenerator detection
- Recommendation generation with OR-softening suggestions

### Invariants That Must Remain True

1. RecommendationEngine.generate() produces identical output for identical inputs
2. `overconstrained_conjunction` recommendations have identical structure
3. Severity always 'high' for this recommendation type
4. 2-of-N calculation unchanged (n/2)
5. OR-softening only suggested when:
   - EmotionSimilarityService available
   - Similar emotions found with similarity > threshold
6. Joint probability calculation unchanged
7. Works gracefully without EmotionSimilarityService
8. All existing integration tests pass
9. `npm run test:unit -- --testPathPattern="overconstrained"` passes
10. `npm run typecheck` passes
11. `npx eslint <modified-files>` passes

## Verification Commands

```bash
# Run new builder tests
npm run test:unit -- --testPathPattern="OverconstrainedConjunctionBuilder"

# Run existing overconstrained tests (critical)
npm run test:unit -- --testPathPattern="recommendationEngine.overconstrained"

# Run existing integration tests (critical - already covers this feature)
npm run test:integration -- --testPathPattern="overconstrainedConjunction"

# Run all RecommendationEngine tests
npm run test:unit -- --testPathPattern="recommendationEngine"

# Type check
npm run typecheck

# Lint modified files
npx eslint src/expressionDiagnostics/services/RecommendationEngine.js \
           src/expressionDiagnostics/services/recommendationBuilders/OverconstrainedConjunctionBuilder.js
```

## Dependencies

- RECENGREFANA-000 (shared utilities for getConfidence)

## Estimated Diff Size

- New source file: ~100 lines
- New unit test file: ~250 lines
- RecommendationEngine.js changes: ~75 lines removed, ~10 lines added
- DI files: ~6 lines
- **Total: ~440 lines changed** (net reduction in RecommendationEngine: ~65 lines)
