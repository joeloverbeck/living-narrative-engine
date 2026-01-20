# PROREDANAV2-019: Integration Test for NESTED_SIBLINGS Classification

## Description

Create an integration test verifying the nested siblings classification works correctly, including gate implication detection and banding suggestions.

## Files to Touch

### Create
- `tests/integration/expressionDiagnostics/prototypeOverlap/nestedSiblings.integration.test.js`

## Out of Scope

- Other classification integration tests
- CONVERT_TO_EXPRESSION testing (PROREDANAV2-021)
- UI tests
- Performance optimization

## Changes Required

### 1. Create Test File

```javascript
/**
 * @file Integration test for NESTED_SIBLINGS classification
 * Tests interest↔curiosity style pairs where one implies the other
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('PrototypeOverlapAnalyzer - NESTED_SIBLINGS Integration', () => {
  let container;
  let analyzer;

  beforeAll(async () => {
    // Bootstrap DI container
  });

  // Test cases
});
```

### 2. Create Nested Sibling Prototypes

```javascript
const createNestedSiblingPrototypes = () => {
  // Interest (broader) and Curiosity (narrower)
  // Curiosity has stricter gates, so curiosity implies interest

  const interest = {
    id: 'test:interest_like',
    family: 'emotion',
    weights: {
      valence: 0.2,
      arousal: 0.3,
      dominance: 0.1,
      threat: -0.1
    },
    gates: [
      'arousal >= 0.1',
      'threat <= 0.4'
    ]
  };

  const curiosity = {
    id: 'test:curiosity_like',
    family: 'emotion',
    weights: {
      valence: 0.25,
      arousal: 0.4,
      dominance: 0.15,
      threat: -0.15
    },
    gates: [
      'arousal >= 0.3',   // Stricter than interest
      'threat <= 0.2'     // Stricter than interest
    ]
  };

  return [interest, curiosity];
};
```

### 3. Test Gate Implication Detection

```javascript
it('should detect that curiosity implies interest via gate implication', async () => {
  const prototypes = createNestedSiblingPrototypes();

  const result = await analyzer.analyze(prototypes);

  const rec = result.recommendations[0];
  expect(rec.evidence.gateImplication).toBeDefined();
  // curiosity (narrower) implies interest (broader)
  // A_implies_B or B_implies_A should be true, but not both
  const hasOneWayImplication = (
    (rec.evidence.gateImplication.A_implies_B && !rec.evidence.gateImplication.B_implies_A) ||
    (!rec.evidence.gateImplication.A_implies_B && rec.evidence.gateImplication.B_implies_A)
  );
  expect(hasOneWayImplication).toBe(true);
});
```

### 4. Test Classification Result

```javascript
it('should classify interest-curiosity style pair as nested_siblings', async () => {
  const prototypes = createNestedSiblingPrototypes();

  const result = await analyzer.analyze(prototypes);

  expect(result.recommendations).toHaveLength(1);
  expect(result.recommendations[0].classification.v2Type).toBe('nested_siblings');
});
```

### 5. Test Banding Suggestions

```javascript
it('should generate gate banding suggestions for nested siblings', async () => {
  const prototypes = createNestedSiblingPrototypes();

  const result = await analyzer.analyze(prototypes);

  const suggestions = result.recommendations[0].suggestedGateBands;
  expect(suggestions).toBeDefined();
  expect(suggestions.length).toBeGreaterThan(0);

  // Should have at least one gate_band suggestion
  const gateBandSuggestions = suggestions.filter(s => s.type === 'gate_band');
  expect(gateBandSuggestions.length).toBeGreaterThan(0);

  // Should have expression suppression suggestion
  const suppressionSuggestion = suggestions.find(s => s.type === 'expression_suppression');
  expect(suppressionSuggestion).toBeDefined();
});
```

### 6. Test Additional Nested Sibling Patterns

```javascript
describe('embarrassment ↔ humiliation pattern', () => {
  it('should classify as nested_siblings with humiliation as narrower', async () => {
    const prototypes = createEmbarrassmentHumiliationPair();
    const result = await analyzer.analyze(prototypes);

    expect(result.recommendations[0].classification.v2Type).toBe('nested_siblings');
  });
});

describe('frustration ↔ confusion pattern', () => {
  it('should classify as nested_siblings', async () => {
    const prototypes = createFrustrationConfusionPair();
    const result = await analyzer.analyze(prototypes);

    expect(result.recommendations[0].classification.v2Type).toBe('nested_siblings');
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

1. **Classification correct**:
   - interest↔curiosity → nested_siblings

2. **Gate implication detected**:
   - One-way implication identified
   - A_implies_B XOR B_implies_A

3. **Banding suggestions generated**:
   - At least one gate_band suggestion
   - Expression suppression suggestion present

4. **Evidence complete**:
   - gateImplication section with A_implies_B, B_implies_A
   - evidence array with axis relations

5. **Actions appropriate**:
   - Reference to hierarchy
   - Reference to banding suggestions

6. **Multiple patterns work**:
   - embarrassment↔humiliation classified correctly
   - frustration↔confusion classified correctly

### Invariants That Must Remain True

- Full pipeline executes without errors
- Nested siblings not confused with merge
- Banding suggestions sensible (suggest opposite bound)
- Test is deterministic

## Estimated Size

~80 lines of test code

## Dependencies

- PROREDANAV2-017 (full orchestrator integration)

## Verification Commands

```bash
# Run this specific integration test
npm run test:integration -- --testPathPattern=nestedSiblings.integration

# Run all prototypeOverlap integration tests
npm run test:integration -- --testPathPattern=prototypeOverlap
```
