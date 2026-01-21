# PROREDANAV2-018: Integration Test for MERGE_RECOMMENDED Classification

## Description

Create an integration test verifying the merge classification works correctly with realistic prototype data through the full pipeline.

## Files to Touch

### Create
- `tests/integration/expressionDiagnostics/prototypeOverlap/mergeRecommended.integration.test.js`

## Out of Scope

- Other classification integration tests (019, 020, 021)
- Snapshot tests
- UI tests
- Performance tests

## Changes Required

### 1. Create Test File with Full Pipeline Setup

```javascript
/**
 * @file Integration test for MERGE_RECOMMENDED classification
 * Tests the full pipeline with numbness↔apathy style prototype pairs
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
// Import test utilities for bootstrapping DI container

describe('PrototypeOverlapAnalyzer - MERGE_RECOMMENDED Integration', () => {
  let container;
  let analyzer;

  beforeAll(async () => {
    // Bootstrap full DI container
    // Load prototype overlap config
    // Resolve IPrototypeOverlapAnalyzer
  });

  afterAll(() => {
    // Cleanup
  });

  describe('numbness ↔ apathy style pair', () => {
    // Test cases
  });
});
```

### 2. Create Test Prototypes That Should Merge

```javascript
const createMergeablePrototypes = () => {
  // Two prototypes with:
  // - Very similar weights (high cosine similarity)
  // - Nearly identical gate regions (high overlap ratio)
  // - Same sign on all axes
  // - Similar intensity responses

  const prototypeA = {
    id: 'test:numbness_like',
    family: 'emotion',
    weights: {
      valence: -0.3,
      arousal: -0.5,
      dominance: -0.2,
      threat: -0.1
    },
    gates: [
      'valence <= 0.0',
      'arousal <= 0.2',
      'threat <= 0.3'
    ]
  };

  const prototypeB = {
    id: 'test:apathy_like',
    family: 'emotion',
    weights: {
      valence: -0.28,  // Very similar
      arousal: -0.52,  // Very similar
      dominance: -0.18,
      threat: -0.12
    },
    gates: [
      'valence <= 0.0',
      'arousal <= 0.2',
      'threat <= 0.3'  // Identical gates
    ]
  };

  return [prototypeA, prototypeB];
};
```

### 3. Test Classification Result

```javascript
it('should classify numbness-apathy style pair as merge_recommended', async () => {
  const prototypes = createMergeablePrototypes();

  const result = await analyzer.analyze(prototypes);

  expect(result.recommendations).toHaveLength(1);
  expect(result.recommendations[0].classification.v2Type).toBe('merge_recommended');
});
```

### 4. Verify Evidence Fields

```javascript
it('should include complete evidence for merge recommendation', async () => {
  const prototypes = createMergeablePrototypes();
  const result = await analyzer.analyze(prototypes);

  const evidence = result.recommendations[0].evidence;

  // All v2 evidence fields present
  expect(evidence.pearsonCorrelation).not.toBeNaN();
  expect(evidence.gateOverlap).toBeDefined();
  expect(evidence.gateOverlap.gateOverlapRatio).toBeGreaterThanOrEqual(0.8);
  expect(evidence.passRates).toBeDefined();
  expect(evidence.passRates.coPassCount).toBeGreaterThanOrEqual(200);
  expect(evidence.intensitySimilarity).toBeDefined();
  expect(evidence.intensitySimilarity.pctWithinEps).toBeGreaterThanOrEqual(0.85);
  expect(evidence.highCoactivation).toBeDefined();
});
```

### 5. Test Merge Criteria Boundaries

```javascript
it('should NOT classify as merge when correlation too low', async () => {
  const prototypes = createMergeablePrototypes();
  // Modify to have lower correlation
  prototypes[1].weights.valence = 0.5;  // Opposite sign

  const result = await analyzer.analyze(prototypes);

  expect(result.recommendations[0].classification.v2Type).not.toBe('merge_recommended');
});

it('should NOT classify as merge when coPassCount too low', async () => {
  // Test with config override for lower sample count
  // Verify guardrail prevents merge classification
});
```

## Acceptance Criteria

### Tests That Must Pass

1. **Merge classification correct**:
   - Prototypes with high similarity → merge_recommended

2. **Evidence fields complete**:
   - pearsonCorrelation is number (not NaN)
   - gateOverlap section present with all fields
   - passRates section present with coPassCount
   - intensitySimilarity with pctWithinEps
   - highCoactivation with thresholds array

3. **Threshold boundaries respected**:
   - Slightly below threshold → not merge_recommended
   - At threshold → merge_recommended

4. **Deterministic results**:
   - Same inputs → same classification

5. **No banding suggestions for merge**:
   - suggestedGateBands is empty array

6. **Actions appropriate**:
   - Actions suggest merging the prototypes

### Invariants That Must Remain True

- Full pipeline executes without errors
- DI container properly bootstrapped
- Config thresholds respected
- Test is deterministic (seeded or injected contexts)

## Estimated Size

~80 lines of test code

## Dependencies

- PROREDANAV2-017 (full orchestrator integration complete)

## Verification Commands

```bash
# Run this specific integration test
npm run test:integration -- --testPathPattern=mergeRecommended.integration

# Run all prototypeOverlap integration tests
npm run test:integration -- --testPathPattern=prototypeOverlap
```
