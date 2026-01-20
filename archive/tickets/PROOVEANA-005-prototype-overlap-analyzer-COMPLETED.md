# PROOVEANA-005: PrototypeOverlapAnalyzer Orchestrator

## Description

Implement the main orchestrator service that coordinates the full overlap analysis pipeline. This service ties together candidate filtering, behavioral evaluation, classification, and recommendation building into a single coherent analysis flow.

## Files to Create

- `src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js`
- `tests/unit/expressionDiagnostics/services/prototypeOverlapAnalyzer.test.js`

## Files to Modify

None

## Out of Scope

- UI controller - PROOVEANA-009
- DI registration - PROOVEANA-006
- HTML page - PROOVEANA-008
- Integration tests - PROOVEANA-010

## Implementation Details

### Analysis Flow

1. Get prototypes via `prototypeRegistryService.getPrototypesByType()`
2. Run Stage A via `candidatePairFilter.filterCandidates()`
3. Enforce `maxCandidatePairs` limit (safety)
4. For each candidate pair:
   - Evaluate via `behavioralOverlapEvaluator.evaluate()`
   - Classify via `overlapClassifier.classify()`
   - Build recommendation via `recommendationBuilder.build()`
5. Filter out `not_redundant` classifications (only show actionable results)
6. Sort recommendations by severity descending
7. Return with metadata

### PrototypeOverlapAnalyzer.js

```javascript
/**
 * @file PrototypeOverlapAnalyzer - Main orchestrator for prototype overlap analysis
 * @see specs/prototype-overlap-analyzer.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {object} AnalysisOptions
 * @property {'emotion'|'sexual'} prototypeFamily - Type of prototypes to analyze
 * @property {number} [sampleCount] - Override default sample count
 * @property {function} [onProgress] - Progress callback (stage, completed, total)
 */

/**
 * @typedef {object} AnalysisResult
 * @property {Array<object>} recommendations - Sorted by severity descending
 * @property {object} metadata - Analysis metadata
 */

class PrototypeOverlapAnalyzer {
  #prototypeRegistryService;
  #candidatePairFilter;
  #behavioralOverlapEvaluator;
  #overlapClassifier;
  #recommendationBuilder;
  #config;
  #logger;

  /**
   * @param {object} deps
   * @param {object} deps.prototypeRegistryService - IPrototypeRegistryService
   * @param {object} deps.candidatePairFilter - ICandidatePairFilter
   * @param {object} deps.behavioralOverlapEvaluator - IBehavioralOverlapEvaluator
   * @param {object} deps.overlapClassifier - IOverlapClassifier
   * @param {object} deps.recommendationBuilder - IOverlapRecommendationBuilder
   * @param {object} deps.config - PROTOTYPE_OVERLAP_CONFIG
   * @param {object} deps.logger - ILogger
   */
  constructor({
    prototypeRegistryService,
    candidatePairFilter,
    behavioralOverlapEvaluator,
    overlapClassifier,
    recommendationBuilder,
    config,
    logger,
  }) {
    validateDependency(prototypeRegistryService, 'IPrototypeRegistryService', logger, {
      requiredMethods: ['getPrototypesByType'],
    });
    validateDependency(candidatePairFilter, 'ICandidatePairFilter', logger, {
      requiredMethods: ['filterCandidates'],
    });
    validateDependency(behavioralOverlapEvaluator, 'IBehavioralOverlapEvaluator', logger, {
      requiredMethods: ['evaluate'],
    });
    validateDependency(overlapClassifier, 'IOverlapClassifier', logger, {
      requiredMethods: ['classify'],
    });
    validateDependency(recommendationBuilder, 'IOverlapRecommendationBuilder', logger, {
      requiredMethods: ['build'],
    });

    this.#prototypeRegistryService = prototypeRegistryService;
    this.#candidatePairFilter = candidatePairFilter;
    this.#behavioralOverlapEvaluator = behavioralOverlapEvaluator;
    this.#overlapClassifier = overlapClassifier;
    this.#recommendationBuilder = recommendationBuilder;
    this.#config = config;
    this.#logger = logger;
  }

  /**
   * Run overlap analysis for a prototype family.
   *
   * @param {AnalysisOptions} options
   * @returns {Promise<AnalysisResult>}
   */
  async analyze(options) {
    const { prototypeFamily, sampleCount, onProgress } = options;
    const startTime = Date.now();

    // 1. Get prototypes
    const prototypes = this.#prototypeRegistryService.getPrototypesByType(prototypeFamily);

    // 2. Stage A: Filter candidates
    onProgress?.('filtering', 0, prototypes.length);
    const candidatePairs = this.#candidatePairFilter.filterCandidates(prototypes);

    // 3. Enforce safety limit
    const limitedPairs = candidatePairs.slice(0, this.#config.maxCandidatePairs);

    // 4. Stage B: Evaluate each pair
    const recommendations = [];
    for (let i = 0; i < limitedPairs.length; i++) {
      const pair = limitedPairs[i];
      onProgress?.('evaluating', i + 1, limitedPairs.length);

      const behaviorMetrics = this.#behavioralOverlapEvaluator.evaluate(
        pair.prototypeA,
        pair.prototypeB,
        sampleCount ?? this.#config.sampleCountPerPair
      );

      const classification = this.#overlapClassifier.classify(
        pair.candidateMetrics,
        behaviorMetrics
      );

      // Only include actionable recommendations
      if (classification.type !== 'not_redundant') {
        const recommendation = this.#recommendationBuilder.build(
          pair.prototypeA,
          pair.prototypeB,
          classification,
          pair.candidateMetrics,
          behaviorMetrics,
          behaviorMetrics.divergenceExamples
        );
        recommendations.push(recommendation);
      }
    }

    // 5. Sort by severity
    recommendations.sort((a, b) => b.severity - a.severity);

    return {
      recommendations,
      metadata: {
        totalPrototypes: prototypes.length,
        candidatePairs: candidatePairs.length,
        processedPairs: limitedPairs.length,
        elapsed: Date.now() - startTime,
        sampleCount: sampleCount ?? this.#config.sampleCountPerPair,
      },
    };
  }
}

export default PrototypeOverlapAnalyzer;
```

## Acceptance Criteria

### Tests That Must Pass

```javascript
// Orchestration
it('calls services in correct order')
it('passes prototypes to candidatePairFilter')
it('passes candidate pairs to behavioralOverlapEvaluator')
it('passes metrics to overlapClassifier')
it('passes classification to recommendationBuilder')

// Progress
it('invokes onProgress callback during analysis')
it('reports candidate filtering progress')
it('reports evaluation progress per pair')

// Results
it('returns recommendations sorted by severity descending')
it('returns metadata with correct counts')
it('filters out not_redundant classifications from recommendations')

// Safety
it('respects maxCandidatePairs limit')
it('handles empty prototype list gracefully')
```

### Invariants

- Recommendations sorted by severity descending
- `metadata.candidatePairs <= config.maxCandidatePairs`
- Only actionable recommendations (merge/subsumed) returned
- `npm run test:unit -- --grep "prototypeOverlapAnalyzer"` passes with >90% coverage
- `npx eslint <created-files>` passes

## Verification Commands

```bash
npm run test:unit -- --testPathPattern="prototypeOverlapAnalyzer"
npx eslint src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js
```

## Dependencies

- PROOVEANA-001 (CandidatePairFilter)
- PROOVEANA-002 (BehavioralOverlapEvaluator)
- PROOVEANA-003 (OverlapClassifier)
- PROOVEANA-004 (OverlapRecommendationBuilder)

## Estimated Diff Size

- Source: ~200 lines
- Tests: ~350 lines
- **Total: ~550 lines**
