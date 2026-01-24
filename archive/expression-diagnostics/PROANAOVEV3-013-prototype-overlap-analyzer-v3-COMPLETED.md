# PROANAOVEV3-013: PrototypeOverlapAnalyzer V3 Integration

## Summary

Replace `PrototypeOverlapAnalyzer` orchestration with the v3 analysis pipeline, removing all v2 code paths. The analyzer will use shared pool generation, vector evaluation, and pass v3 data to downstream services.

## Motivation

This is the main orchestrator that ties all v3 services together. It must:
1. Generate shared context pool once
2. Evaluate all prototypes against pool
3. Compute profiles for all prototypes
4. Pass v3 data to evaluator, classifier, and recommendation builder

All v2 per-pair Monte Carlo paths are being removed.

## Files to Modify

### Service
- `src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js`

### Unit Tests
- `tests/unit/expressionDiagnostics/services/prototypeOverlapAnalyzer.test.js` (update existing)

## Implementation Details

### Constructor Changes

```javascript
class PrototypeOverlapAnalyzer {
  /**
   * @param {object} options
   * @param {object} options.sharedContextPoolGenerator - V3 pool generator
   * @param {object} options.prototypeVectorEvaluator - V3 vector evaluator
   * @param {object} options.prototypeProfileCalculator - V3 profile calculator
   * @param {object} options.agreementMetricsCalculator - V3 metrics calculator
   * @param {object} options.behavioralOverlapEvaluator - Existing service
   * @param {object} options.overlapClassifier - Existing service
   * @param {object} options.overlapRecommendationBuilder - Existing service
   * @param {object} options.config
   * @param {object} options.logger
   */
  constructor(options)
}
```

### V3 Analysis Flow

```javascript
async analyzeOverlaps(prototypes) {
  // Phase 0: Generate shared context pool once
  const contextPool = this.#sharedContextPoolGenerator.generate();
  this.#logger.info(`Generated shared context pool: ${contextPool.length} contexts`);

  // Phase 1: Evaluate all prototypes on shared pool
  const outputVectors = await this.#prototypeVectorEvaluator.evaluateAll(prototypes, contextPool);
  this.#logger.info(`Evaluated ${outputVectors.size} prototypes`);

  // Phase 2: Compute profiles for all prototypes
  const profiles = this.#prototypeProfileCalculator.calculateAll(prototypes, outputVectors);
  this.#logger.info(`Computed ${profiles.size} prototype profiles`);

  // Phase 3: Candidate filtering (enhanced with v3 similarity scores)
  const candidates = this.#filterCandidates(prototypes, outputVectors);

  // Phase 4-6: Evaluate, classify, recommend for each candidate
  const results = [];
  for (const candidate of candidates) {
    const result = await this.#analyzeCandidate(candidate, {
      contextPool,
      outputVectors,
      profiles,
    });
    results.push(result);
  }

  return this.#buildReport(results, { contextPool, outputVectors, profiles });
}

async #analyzeCandidate(candidate, v3Data) {
  const { prototypeA, prototypeB } = candidate;

  // Get v3 data for this pair (required, not optional)
  const vectorA = v3Data.outputVectors.get(prototypeA.id);
  const vectorB = v3Data.outputVectors.get(prototypeB.id);
  const profileA = v3Data.profiles.get(prototypeA.id);
  const profileB = v3Data.profiles.get(prototypeB.id);

  // Behavioral evaluation with v3 vectors
  const behavioralResult = this.#behavioralOverlapEvaluator.evaluate(
    prototypeA,
    prototypeB,
    { vectorA, vectorB }
  );

  // Classification with v3 profiles
  const classification = this.#overlapClassifier.classify({
    ...behavioralResult,
    profileA,
    profileB,
  });

  // Recommendations with v3 context
  const recommendations = this.#overlapRecommendationBuilder.build({
    classification,
    vectorA,
    vectorB,
    contextPool: v3Data.contextPool,
  });

  return { candidate, behavioralResult, classification, recommendations };
}
```

### Performance Logging

```javascript
this.#logger.info(`V3 Analysis Summary:
  - Pool size: ${contextPool.length}
  - Prototypes evaluated: ${outputVectors.size}
  - Evaluation complexity: O(${outputVectors.size} × ${contextPool.length})
  - Per-pair complexity: O(1) vector operations
`);
```

### V2 Code Removal

The following v2 code paths will be removed:
- Per-pair Monte Carlo orchestration
- Conditional v3 preprocessing
- Fallback null/undefined data passing
- V2 downstream service invocations

## Out of Scope

- Creating v3 services (tickets 001-007)
- Modifying downstream services (tickets 010-012, 014)

## Acceptance Criteria

- [ ] Shared pool generated once at start of analysis
- [ ] All prototypes evaluated against shared pool
- [ ] Profiles computed for all prototypes
- [ ] V3 data passed to `BehavioralOverlapEvaluator`
- [ ] V3 data passed to `OverlapClassifier`
- [ ] V3 data passed to `OverlapRecommendationBuilder`
- [ ] V2 orchestration code removed
- [ ] Performance logging shows complexity reduction
- [ ] Unit tests cover:
  - V3 analysis pipeline end-to-end
  - Data passing to downstream services
  - Performance logging
  - Error handling
- [ ] 80%+ branch coverage on new code
- [ ] `npm run typecheck` passes
- [ ] `npx eslint src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js` passes

## Dependencies

- PROANAOVEV3-001 through PROANAOVEV3-007 (v3 services)
- PROANAOVEV3-008 (V3 Config)
- PROANAOVEV3-009 (DI Registrations)
- PROANAOVEV3-010 through PROANAOVEV3-012 (downstream integrations)

## Estimated Complexity

High - main orchestrator coordinating all v3 services.
