# PROREDANAV2-020: Integration Test for KEEP_DISTINCT Classification

## Description

Create an integration test verifying the keep_distinct classification works correctly for prototype pairs with disjoint gate regions or insufficient overlap.

## Files to Touch

### Create
- `tests/integration/expressionDiagnostics/prototypeOverlap/keepDistinct.integration.test.js`

## Out of Scope

- Other classification tests
- UI tests
- Performance tests

## Changes Required

### 1. Create Test File

```javascript
/**
 * @file Integration test for KEEP_DISTINCT classification
 * Tests freeze↔submission style pairs with disjoint gate regions
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('PrototypeOverlapAnalyzer - KEEP_DISTINCT Integration', () => {
  let container;
  let analyzer;

  beforeAll(async () => {
    // Bootstrap DI container
  });

  // Test cases
});
```

### 2. Create Disjoint Prototypes

```javascript
const createDisjointPrototypes = () => {
  // Freeze and Submission - different behavioral states
  // Freeze: high threat, low arousal (frozen in fear)
  // Submission: low threat, low dominance (yielding)

  const freeze = {
    id: 'test:freeze_like',
    family: 'emotion',
    weights: {
      valence: -0.4,
      arousal: -0.3,
      dominance: -0.5,
      threat: 0.8
    },
    gates: [
      'threat >= 0.6',    // High threat required
      'arousal <= 0.1'    // Low arousal (frozen)
    ]
  };

  const submission = {
    id: 'test:submission_like',
    family: 'emotion',
    weights: {
      valence: -0.2,
      arousal: 0.1,
      dominance: -0.7,
      threat: 0.1
    },
    gates: [
      'threat <= 0.3',     // Low threat (not afraid)
      'dominance <= -0.3'  // Low dominance (yielding)
    ]
  };

  return [freeze, submission];
};
```

### 3. Test Low Gate Overlap

```javascript
it('should detect low gate overlap ratio for disjoint pairs', async () => {
  const prototypes = createDisjointPrototypes();

  const result = await analyzer.analyze(prototypes);

  const evidence = result.recommendations[0].evidence;
  expect(evidence.gateOverlap.gateOverlapRatio).toBeLessThan(0.25);
});
```

### 4. Test Classification Result

```javascript
it('should classify freeze-submission style pair as keep_distinct', async () => {
  const prototypes = createDisjointPrototypes();

  const result = await analyzer.analyze(prototypes);

  expect(result.recommendations).toHaveLength(1);
  expect(result.recommendations[0].classification.v2Type).toBe('keep_distinct');
});
```

### 5. Test No Banding Suggestions

```javascript
it('should NOT generate banding suggestions for keep_distinct', async () => {
  const prototypes = createDisjointPrototypes();

  const result = await analyzer.analyze(prototypes);

  const suggestions = result.recommendations[0].suggestedGateBands;
  expect(suggestions).toBeDefined();
  expect(suggestions).toHaveLength(0);
});
```

### 6. Test Additional Keep Distinct Patterns

```javascript
describe('anxiety ↔ panic pattern', () => {
  it('should classify as keep_distinct due to clear behavioral separation', async () => {
    const prototypes = createAnxietyPanicPair();
    const result = await analyzer.analyze(prototypes);

    expect(result.recommendations[0].classification.v2Type).toBe('keep_distinct');
  });
});

describe('stress_acute ↔ fear pattern', () => {
  it('should classify as keep_distinct due to different gate regions', async () => {
    const prototypes = createStressFearPair();
    const result = await analyzer.analyze(prototypes);

    expect(result.recommendations[0].classification.v2Type).toBe('keep_distinct');
  });
});

describe('low co-pass count scenario', () => {
  it('should classify as keep_distinct when coPassCount below threshold', async () => {
    // Create prototypes with minimal overlap that rarely co-pass
    const prototypes = createMinimalOverlapPair();
    const result = await analyzer.analyze(prototypes);

    // Even if some metrics look good, low coPassCount → keep_distinct
    expect(result.recommendations[0].evidence.passRates.coPassCount).toBeLessThan(200);
    expect(result.recommendations[0].classification.v2Type).toBe('keep_distinct');
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

1. **Classification correct**:
   - freeze↔submission → keep_distinct

2. **Low gate overlap detected**:
   - gateOverlapRatio < 0.25

3. **No banding suggestions**:
   - suggestedGateBands is empty array

4. **Evidence reflects separation**:
   - Low onBothRate
   - High pOnlyRate and qOnlyRate

5. **Additional patterns work**:
   - anxiety↔panic → keep_distinct
   - stress_acute↔fear → keep_distinct

6. **Low coPassCount triggers keep_distinct**:
   - Even with other factors, insufficient co-pass → keep_distinct

### Invariants That Must Remain True

- Full pipeline executes without errors
- Keep distinct is the default when nothing else matches
- No false positives for merge or nested
- Test is deterministic

## Estimated Size

~60 lines of test code

## Dependencies

- PROREDANAV2-017 (full orchestrator integration)

## Verification Commands

```bash
# Run this specific integration test
npm run test:integration -- --testPathPattern=keepDistinct.integration

# Run all prototypeOverlap integration tests
npm run test:integration -- --testPathPattern=prototypeOverlap
```
