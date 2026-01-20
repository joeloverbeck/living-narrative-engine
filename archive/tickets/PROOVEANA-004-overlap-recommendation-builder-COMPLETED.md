# PROOVEANA-004: OverlapRecommendationBuilder Service

## Description

Implement the recommendation builder that constructs actionable recommendations from classification results. This service transforms raw analysis data into user-friendly recommendations with severity, confidence, suggested actions, and supporting evidence.

## Files to Create

- `src/expressionDiagnostics/services/prototypeOverlap/OverlapRecommendationBuilder.js`
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/overlapRecommendationBuilder.test.js`

## Files to Modify

None

## Out of Scope

- Candidate filtering - PROOVEANA-001
- Behavioral evaluation - PROOVEANA-002
- Classification logic - PROOVEANA-003
- DI registration - PROOVEANA-006
- Integration tests - PROOVEANA-010

## Implementation Details

### Recommendation Types

- `prototype_merge_suggestion` - Two prototypes should be merged/aliased
- `prototype_subsumption_suggestion` - One prototype subsumes another
- `prototype_overlap_info` - Informational notice about overlap (not_redundant)

### OverlapRecommendationBuilder.js

```javascript
/**
 * @file OverlapRecommendationBuilder - Builds actionable recommendations from overlap analysis
 * @see specs/prototype-overlap-analyzer.md
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * @typedef {object} OverlapRecommendation
 * @property {'prototype_merge_suggestion'|'prototype_subsumption_suggestion'|'prototype_overlap_info'} type
 * @property {'emotion'|'sexual'} prototypeFamily
 * @property {{a: string, b: string}} prototypes - Prototype IDs
 * @property {number} severity - 0-1 score
 * @property {number} confidence - 0-1 score
 * @property {string[]} actions - Suggested actions
 * @property {object} candidateMetrics - Stage A metrics
 * @property {object} behaviorMetrics - Stage B metrics
 * @property {object} evidence - Supporting evidence
 */

class OverlapRecommendationBuilder {
  #config;
  #logger;

  /**
   * @param {object} deps
   * @param {object} deps.config - PROTOTYPE_OVERLAP_CONFIG
   * @param {object} deps.logger - ILogger
   */
  constructor({ config, logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });
    this.#config = config;
    this.#logger = logger;
  }

  /**
   * Build a recommendation from analysis results.
   *
   * @param {object} prototypeA
   * @param {object} prototypeB
   * @param {object} classification - From OverlapClassifier
   * @param {object} candidateMetrics - From CandidatePairFilter
   * @param {object} behaviorMetrics - From BehavioralOverlapEvaluator
   * @param {Array} divergenceExamples - Top K divergence examples
   * @returns {OverlapRecommendation}
   */
  build(prototypeA, prototypeB, classification, candidateMetrics, behaviorMetrics, divergenceExamples) {
    // Implementation:
    // 1. Map classification type to recommendation type
    // 2. Compute severity and confidence
    // 3. Generate action suggestions
    // 4. Build evidence structure
    // 5. Return complete recommendation
  }

  /**
   * Map classification type to recommendation type.
   */
  #mapClassificationToType(classification) {}

  /**
   * Compute severity score based on overlap strength.
   */
  #computeSeverity(classification, behaviorMetrics) {}

  /**
   * Compute confidence score based on sample quality.
   */
  #computeConfidence(behaviorMetrics) {}

  /**
   * Generate action suggestions based on classification.
   */
  #buildActions(classification, prototypeA, prototypeB) {}

  /**
   * Build evidence structure with shared drivers and differentiators.
   */
  #buildEvidence(prototypeA, prototypeB, behaviorMetrics, divergenceExamples) {}

  /**
   * Extract shared axis drivers from overlapping weights.
   */
  #extractSharedDrivers(weightsA, weightsB) {}

  /**
   * Identify key differentiators between prototypes.
   */
  #identifyDifferentiators(prototypeA, prototypeB, behaviorMetrics) {}
}

export default OverlapRecommendationBuilder;
```

## Acceptance Criteria

### Tests That Must Pass

```javascript
// Structure
it('returns all required fields')
it('maps classification type to recommendation type')
it('includes prototype IDs')

// Severity
it('computes severity in [0,1] range')
it('increases merge severity with higher correlation')
it('increases subsumption severity with higher dominance')

// Confidence
it('computes confidence in [0,1] range')
it('increases confidence with higher sample count')

// Actions
it('suggests "merge/alias" actions for merge type')
it('suggests "remove/tighten" actions for subsumption type')
it('suggests appropriate subsumed prototype in action text')

// Evidence
it('extracts shared drivers from overlapping weights')
it('identifies key differentiators')
it('passes through divergence examples')
```

### Invariants

- `severity` and `confidence` in [0, 1]
- `evidence.divergenceExamples[i].absDiff === |intensityA - intensityB|`
- Actions are appropriate for classification type
- `npm run test:unit -- --grep "overlapRecommendationBuilder"` passes with >90% coverage
- `npx eslint <created-files>` passes

## Verification Commands

```bash
npm run test:unit -- --testPathPattern="overlapRecommendationBuilder"
npx eslint src/expressionDiagnostics/services/prototypeOverlap/OverlapRecommendationBuilder.js
```

## Dependencies

- PROOVEANA-000 (config)
- PROOVEANA-003 (classification structure understanding)

## Estimated Diff Size

- Source: ~200 lines
- Tests: ~300 lines
- **Total: ~500 lines**

## Outcome

**Status**: ✅ COMPLETED

### Files Created

- `src/expressionDiagnostics/services/prototypeOverlap/OverlapRecommendationBuilder.js` (465 lines)
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/overlapRecommendationBuilder.test.js` (1115 lines)

### Actual vs Planned

| Aspect | Planned | Actual |
|--------|---------|--------|
| Source lines | ~200 | 465 |
| Test lines | ~300 | 1115 |
| Total | ~500 | 1580 |
| Test cases | 18 | 47 |

### Implementation Notes

1. **prototypeFamily parameter**: Added as optional 7th parameter with default `'emotion'` as designed in the plan
2. **Severity formula**: Implemented as specified with clamp to [0,1]
3. **Confidence bands**: Implemented using onEitherRate thresholds as specified
4. **Shared drivers**: Extracts axes where both prototypes have significant weights (>activeAxisEpsilon)
5. **Key differentiators**: Identifies opposite signs and one-sided weights
6. **Additional helpers**: Added `#safeNumber`, `#flattenBehaviorMetrics`, `#validateConfig` for robustness
7. **Expanded test coverage**: Added edge case tests for NaN handling, empty weights, undefined fields, determinism verification

### Verification Results

- ✅ ESLint: 0 errors, 0 warnings
- ✅ Unit tests: 47/47 passed
- ✅ All acceptance criteria met
