# RECENGREFANA-003: Extract AxisConflictAnalyzer

## Description

Extract the axis conflict analysis cluster (~340 lines) from `RecommendationEngine.js` into a dedicated analyzer class. This handles detection of prototype weight/regime constraint conflicts and provides binary choice framing (Option A: relax regime, Option B: change emotion).

## Files to Create

- `src/expressionDiagnostics/services/analyzers/AxisConflictAnalyzer.js`
- `tests/unit/expressionDiagnostics/services/analyzers/AxisConflictAnalyzer.test.js`
- `tests/integration/expressionDiagnostics/analyzers/axisConflictAnalysis.integration.test.js`

## Files to Modify

- `src/expressionDiagnostics/services/RecommendationEngine.js` - Delegate to new analyzer
- `src/dependencyInjection/tokens/tokens-diagnostics.js` - Add `IAxisConflictAnalyzer` token
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` - Add registration

## Out of Scope

- PrototypeCreateSuggestionBuilder (RECENGREFANA-001)
- GateClampRecommendationBuilder (RECENGREFANA-002)
- OverconstrainedConjunctionBuilder (RECENGREFANA-004)
- SoleBlockerRecommendationBuilder (RECENGREFANA-005)
- Changes to EmotionSimilarityService
- Changes to prototype mismatch detection logic

## Implementation Details

### AxisConflictAnalyzer.js

```javascript
/**
 * @file AxisConflictAnalyzer - Analyzes axis sign conflicts between prototypes and regimes
 * @see RecommendationEngine.js (original location)
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';
import { getConfidence, getSeverity } from '../utils/recommendationUtils.js';

class AxisConflictAnalyzer {
  #emotionSimilarityService;

  /**
   * @param {object} deps
   * @param {object} [deps.emotionSimilarityService] - Optional service for alternative emotion suggestions
   */
  constructor({ emotionSimilarityService = null } = {}) {
    if (emotionSimilarityService) {
      validateDependency(emotionSimilarityService, 'IEmotionSimilarityService', console, {
        requiredMethods: ['findEmotionsWithCompatibleAxisSign'],
      });
    }
    this.#emotionSimilarityService = emotionSimilarityService;
  }

  /**
   * Analyzes axis conflicts and produces structured analysis results.
   *
   * @param {Array} axisConflicts - Array of axis conflict objects
   * @param {string} prototypeId - Prototype identifier
   * @param {number} moodSampleCount - Sample count for confidence calculation
   * @returns {{
   *   actions: string[],
   *   structuredActions: object,
   *   evidence: Array
   * }} Analysis results
   */
  analyze(axisConflicts, prototypeId, moodSampleCount) {
    // Move logic from RecommendationEngine:
    // - #normalizeAxisConflicts(axisConflicts)
    // - #buildAxisConflictEvidence(axisConflicts, moodSampleCount)
    // - #buildAxisSignConflictActions(axisConflicts, prototypeId)
    // - #buildConflictSummary(axisConflicts, prototypeId)
    // - #buildRequirementText(conflict)
    // - #buildRegimeRelaxationOption(axisConflicts) → Option A
    // - #buildEmotionAlternativeOption(axisConflicts, prototypeId) → Option B
    // - #formatAxisName(axisName)
  }

  /**
   * Calculates severity for axis conflicts.
   *
   * @param {object} params
   * @param {Array} params.axisConflicts - Conflict details
   * @param {object} params.clause - Associated clause
   * @param {number} params.impact - Impact score
   * @returns {'high'|'medium'|'low'} Severity level
   */
  getSeverity({ axisConflicts, clause, impact }) {
    // Move #getAxisConflictSeverity logic
    // Move #getMaxLostIntensity logic
  }
}

export default AxisConflictAnalyzer;
```

### DI Token

Add to `tokens-diagnostics.js`:
```javascript
IAxisConflictAnalyzer: 'IAxisConflictAnalyzer',
```

### DI Registration

Add to `expressionDiagnosticsRegistrations.js`:
```javascript
registrar.singletonFactory(
  diagnosticsTokens.IAxisConflictAnalyzer,
  (c) => new AxisConflictAnalyzer({
    emotionSimilarityService: c.resolve(diagnosticsTokens.IEmotionSimilarityService),
  })
);
```

### Update RecommendationEngine.js

```javascript
// Add import
import AxisConflictAnalyzer from './analyzers/AxisConflictAnalyzer.js';

class RecommendationEngine {
  #axisConflictAnalyzer;

  constructor({
    prototypeSynthesisService = null,
    emotionSimilarityService = null,
  } = {}) {
    this.#axisConflictAnalyzer = new AxisConflictAnalyzer({ emotionSimilarityService });
    // ... rest
  }

  generate(diagnosticFacts) {
    // In prototype processing, replace axis conflict handling:
    // const axisAnalysis = this.#axisConflictAnalyzer.analyze(
    //   prototype.axisSignConflicts,
    //   prototype.prototypeId,
    //   diagnosticFacts.moodRegime?.sampleCount ?? 0
    // );
    // Use axisAnalysis.actions, axisAnalysis.structuredActions, axisAnalysis.evidence
    // Use this.#axisConflictAnalyzer.getSeverity({...}) for severity calculation
  }
}

// REMOVE from RecommendationEngine.js:
// - #normalizeAxisConflicts(axisConflicts)
// - #buildAxisConflictEvidence(axisConflicts, moodSampleCount)
// - #buildAxisSignConflictActions(axisConflicts, prototypeId)
// - #buildConflictSummary(axisConflicts, prototypeId)
// - #buildRequirementText(conflict)
// - #buildRegimeRelaxationOption(axisConflicts)
// - #buildEmotionAlternativeOption(axisConflicts, prototypeId)
// - #formatAxisName(axisName)
// - #getAxisConflictSeverity({axisConflicts, clause, impact})
// - #getMaxLostIntensity(axisConflicts)
```

## Acceptance Criteria

### Tests That Must Pass

#### New Unit Tests (AxisConflictAnalyzer.test.js)

Extract and adapt test cases from `recommendationEngine.test.js` (lines 452-801):

1. **Constructor**:
   ```javascript
   it('initializes without emotionSimilarityService', () => {
     const analyzer = new AxisConflictAnalyzer();
     expect(analyzer).toBeDefined();
   });

   it('initializes with emotionSimilarityService', () => {
     const analyzer = new AxisConflictAnalyzer({
       emotionSimilarityService: mockEmotionSimilarityService,
     });
     expect(analyzer).toBeDefined();
   });
   ```

2. **analyze() method**:
   ```javascript
   it('produces actions, structuredActions, and evidence', () => {
     const result = analyzer.analyze(axisConflicts, 'test-proto', 500);
     expect(result).toHaveProperty('actions');
     expect(result).toHaveProperty('structuredActions');
     expect(result).toHaveProperty('evidence');
   });

   it('builds evidence with conflict details', () => {
     const result = analyzer.analyze([
       { axis: 'valence', prototypeWeight: 0.8, regimeDirection: 'negative' }
     ], 'test-proto', 500);
     expect(result.evidence).toContainEqual(
       expect.objectContaining({ label: expect.stringContaining('Valence') })
     );
   });
   ```

3. **Binary choice framing**:
   ```javascript
   it('builds Option A: regime relaxation', () => {
     const result = analyzer.analyze(conflicts, 'proto', 500);
     expect(result.structuredActions.optionA).toMatchObject({
       type: 'relax_regime',
       axesToRelax: expect.any(Array),
     });
   });

   it('builds Option B: emotion alternative when service available', () => {
     const analyzer = new AxisConflictAnalyzer({
       emotionSimilarityService: mockService,
     });
     const result = analyzer.analyze(conflicts, 'proto', 500);
     expect(result.structuredActions.optionB).toMatchObject({
       type: 'change_emotion',
       alternatives: expect.any(Array),
     });
   });

   it('omits Option B when no emotionSimilarityService', () => {
     const analyzer = new AxisConflictAnalyzer();
     const result = analyzer.analyze(conflicts, 'proto', 500);
     expect(result.structuredActions.optionB).toBeUndefined();
   });
   ```

4. **Axis name formatting**:
   ```javascript
   it('formats snake_case axis names to Title Case', () => {
     const result = analyzer.analyze([
       { axis: 'body_tension', prototypeWeight: 0.5, regimeDirection: 'positive' }
     ], 'proto', 500);
     expect(result.evidence.some(e => e.label.includes('Body Tension'))).toBe(true);
   });
   ```

5. **Conflict normalization**:
   ```javascript
   it('normalizes axis conflicts to consistent structure', () => {
     // Various input formats → consistent output
   });
   ```

6. **getSeverity() method**:
   ```javascript
   it('returns high severity for large lost intensity', () => {
     expect(analyzer.getSeverity({
       axisConflicts: [{ lostIntensity: 0.8 }],
       clause: {},
       impact: 0.7,
     })).toBe('high');
   });

   it('returns medium severity for moderate conflicts', () => {
     expect(analyzer.getSeverity({
       axisConflicts: [{ lostIntensity: 0.4 }],
       clause: {},
       impact: 0.4,
     })).toBe('medium');
   });

   it('returns low severity for minor conflicts', () => {
     expect(analyzer.getSeverity({
       axisConflicts: [{ lostIntensity: 0.1 }],
       clause: {},
       impact: 0.2,
     })).toBe('low');
   });
   ```

7. **Edge cases**:
   ```javascript
   it('handles empty axisConflicts array', () => {
     const result = analyzer.analyze([], 'proto', 500);
     expect(result.actions).toEqual([]);
     expect(result.evidence).toEqual([]);
   });

   it('handles null axisConflicts', () => {
     expect(() => analyzer.analyze(null, 'proto', 500)).not.toThrow();
   });
   ```

#### New Integration Tests (axisConflictAnalysis.integration.test.js)

1. **Full pipeline with EmotionSimilarityService**:
   ```javascript
   it('produces axis_sign_conflict recommendation in report', () => {
     // Setup real EmotionSimilarityService with prototype registry
     // Create diagnosticFacts with axis conflicts
     // Verify recommendation appears with binary choice options
   });
   ```

2. **Alternative emotion suggestions**:
   ```javascript
   it('suggests compatible emotions from prototype registry', () => {
     const prototypeRegistry = createMockPrototypeRegistry();
     const emotionSimilarityService = new EmotionSimilarityService({
       prototypeRegistryService: prototypeRegistry,
       logger,
     });
     const analyzer = new AxisConflictAnalyzer({ emotionSimilarityService });

     const result = analyzer.analyze(conflicts, 'guilt', 500);

     // Should suggest emotions with compatible axis signs
     expect(result.structuredActions.optionB.alternatives.length).toBeGreaterThan(0);
   });
   ```

3. **NOT emitted for <= clauses**:
   ```javascript
   it('axis sign conflict suppressed for <= operator clauses', () => {
     // Existing behavior - verify through RecommendationEngine
   });
   ```

#### Existing Tests That Must Still Pass

All tests in:
- `tests/unit/expressionDiagnostics/services/recommendationEngine.test.js` (lines 452-801)
- `tests/integration/expressionDiagnostics/overconstrainedConjunction.integration.test.js`

### Invariants That Must Remain True

1. RecommendationEngine.generate() produces identical output for identical inputs
2. `axis_sign_conflict` recommendations have identical structure
3. Binary choice framing preserved (Option A: regime, Option B: emotion)
4. Axis name formatting unchanged (snake_case → Title Case)
5. Severity calculation logic unchanged
6. Works gracefully without EmotionSimilarityService
7. Suppression for `<=` operator clauses unchanged
8. `npm run test:unit -- --testPathPattern="recommendationEngine"` passes
9. `npm run typecheck` passes
10. `npx eslint <modified-files>` passes

## Verification Commands

```bash
# Run new analyzer tests
npm run test:unit -- --testPathPattern="AxisConflictAnalyzer"

# Run existing tests that use axis conflicts
npm run test:unit -- --testPathPattern="recommendationEngine"

# Run new integration tests
npm run test:integration -- --testPathPattern="axisConflictAnalysis"

# Type check
npm run typecheck

# Lint modified files
npx eslint src/expressionDiagnostics/services/RecommendationEngine.js \
           src/expressionDiagnostics/services/analyzers/AxisConflictAnalyzer.js
```

## Dependencies

- RECENGREFANA-000 (shared utilities for getConfidence, getSeverity)

## Estimated Diff Size

- New source file: ~340 lines
- New unit test file: ~350 lines
- New integration test file: ~150 lines
- RecommendationEngine.js changes: ~340 lines removed, ~20 lines added
- DI files: ~8 lines
- **Total: ~1,210 lines changed** (net reduction in RecommendationEngine: ~320 lines)
