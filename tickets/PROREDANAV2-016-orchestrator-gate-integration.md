# PROREDANAV2-016: Integrate Gate Structure Services into PrototypeOverlapAnalyzer

## Description

Update the orchestrator to call gate constraint extraction and implication evaluation for each candidate pair. This enables the classifier and recommendation builder to use gate implication information.

## Files to Touch

### Modify
- `src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js`

### Create
- `tests/unit/expressionDiagnostics/services/prototypeOverlapAnalyzer.gateIntegration.test.js`

## Out of Scope

- GateBandingSuggestionBuilder integration (PROREDANAV2-017)
- UI changes
- Config changes
- DI registration changes (already done in PROREDANAV2-013)

## Changes Required

### 1. Add New Dependencies

```javascript
constructor({
  candidatePairFilter,
  behavioralOverlapEvaluator,
  overlapClassifier,
  overlapRecommendationBuilder,
  gateConstraintExtractor,      // NEW
  gateImplicationEvaluator,     // NEW
  config,
  logger
}) {
  // Validate new dependencies
  validateDependency(gateConstraintExtractor, 'IGateConstraintExtractor', logger, {
    requiredMethods: ['extract']
  });
  validateDependency(gateImplicationEvaluator, 'IGateImplicationEvaluator', logger, {
    requiredMethods: ['evaluate']
  });

  this.#gateConstraintExtractor = gateConstraintExtractor;
  this.#gateImplicationEvaluator = gateImplicationEvaluator;
  // ...
}
```

### 2. Extract Gate Constraints Before Evaluation Loop

```javascript
async analyze(prototypes, onProgress) {
  // Stage A: Filter candidates (existing)
  const { candidates, stats } = this.#candidatePairFilter.filterCandidates(prototypes);

  // NEW: Pre-extract gate constraints for all prototypes
  const gateConstraintsMap = new Map();
  for (const prototype of prototypes) {
    const gates = prototype.gates || [];
    const extraction = this.#gateConstraintExtractor.extract(gates);
    gateConstraintsMap.set(prototype.id, extraction);
  }

  // Stage B: Behavioral evaluation (existing loop)
  for (const candidate of candidates) {
    // ... existing behavioral evaluation

    // NEW: Evaluate gate implication
    const gateImplication = this.#evaluateGateImplication(
      candidate.prototypeA,
      candidate.prototypeB,
      gateConstraintsMap
    );

    // Pass to classifier and recommendation builder
    // ...
  }
}
```

### 3. Implement Gate Implication Evaluation

```javascript
#evaluateGateImplication(prototypeA, prototypeB, gateConstraintsMap) {
  const constraintsA = gateConstraintsMap.get(prototypeA.id);
  const constraintsB = gateConstraintsMap.get(prototypeB.id);

  // Handle partial or failed parsing
  if (!constraintsA || !constraintsB) {
    this.#logger.debug('Gate constraints missing for implication evaluation');
    return null;
  }

  if (constraintsA.parseStatus === 'failed' || constraintsB.parseStatus === 'failed') {
    this.#logger.debug('Gate parsing failed, skipping implication evaluation');
    return {
      A_implies_B: false,
      B_implies_A: false,
      evidence: [],
      unparsedGates: [
        ...constraintsA.unparsedGates,
        ...constraintsB.unparsedGates
      ],
      parseStatus: 'partial'
    };
  }

  const result = this.#gateImplicationEvaluator.evaluate(
    constraintsA.intervals,
    constraintsB.intervals
  );

  // Add unparsed gates info
  result.unparsedGates = [
    ...constraintsA.unparsedGates,
    ...constraintsB.unparsedGates
  ];

  return result;
}
```

### 4. Pass Gate Implication to Downstream Services

```javascript
// In the evaluation loop:
const classification = this.#overlapClassifier.classify(
  candidateMetrics,
  behaviorMetrics,
  gateImplication  // NEW parameter
);

const recommendation = this.#overlapRecommendationBuilder.build(
  prototypeA,
  prototypeB,
  classification,
  candidateMetrics,
  behaviorMetrics,
  divergenceExamples,
  gateImplication,  // NEW parameter
  prototypeFamily
);
```

### 5. Update Metadata

```javascript
metadata: {
  // ... existing fields
  gateAnalysis: {
    prototypesWithCompleteGateParsing: completeCount,
    prototypesWithPartialGateParsing: partialCount,
    prototypesWithFailedGateParsing: failedCount,
    implicationEvaluations: implicationCount
  }
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **Gate constraints extracted for all prototypes**:
   - Before evaluation loop, constraints extracted

2. **Gate implication passed to classifier**:
   - Classifier receives gateImplication parameter

3. **Gate implication passed to recommendation builder**:
   - Builder receives gateImplication parameter

4. **Graceful handling of missing gates**:
   - Prototype with no gates → empty intervals, implication still works

5. **Graceful handling of parse failures**:
   - Unparsed gates → implication returns with unparsedGates list

6. **Metadata includes gate analysis stats**:
   - Output metadata has gateAnalysis section

7. **Existing tests pass**:
   - All existing orchestrator tests unchanged

8. **Mocked services work**:
   - Tests can mock gate services

### Invariants That Must Remain True

- Existing orchestrator flow unchanged (stages A, B, C, D)
- Recommendations still generated even if gate analysis fails
- Progress callbacks still work
- Performance acceptable (gate extraction is O(n) prototypes)

## Estimated Size

~100 lines of code changes + ~150 lines of tests

## Dependencies

- PROREDANAV2-013 (DI registration complete)
- PROREDANAV2-014 (evidence payload accepts gateImplication)

## Verification Commands

```bash
# Run gate integration tests
npm run test:unit -- --testPathPattern=prototypeOverlapAnalyzer.gateIntegration

# Run all orchestrator tests
npm run test:unit -- --testPathPattern=prototypeOverlapAnalyzer

# Run integration tests
npm run test:integration -- --testPathPattern=prototypeOverlap

# Lint
npx eslint src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js
```
