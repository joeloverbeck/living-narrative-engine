# PROREDANAV2-021: Integration Test for CONVERT_TO_EXPRESSION and Output Shape Snapshot

## Description

Create integration test for the convert_to_expression classification and a snapshot test to ensure output shape stability across changes.

## Files to Touch

### Create
- `tests/integration/expressionDiagnostics/prototypeOverlap/convertToExpression.integration.test.js`
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/outputShape.snapshot.test.js`

## Out of Scope

- Implementing actual delta gate logic
- UI changes
- Expression file creation

## Changes Required

### 1. Create Convert To Expression Integration Test

```javascript
/**
 * @file Integration test for CONVERT_TO_EXPRESSION classification
 * Tests contentment↔relief style pairs with feature flag enabled
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('PrototypeOverlapAnalyzer - CONVERT_TO_EXPRESSION Integration', () => {
  let container;
  let analyzer;

  beforeAll(async () => {
    // Bootstrap DI container with enableConvertToExpression=true
    // Ensure 'relief' is in changeEmotionNameHints
  });

  // Test cases
});
```

### 2. Create Contentment-Relief Style Prototypes

```javascript
const createContentmentReliefPair = () => {
  // Contentment: steady positive state
  // Relief: nested under contentment, implies threat drop

  const contentment = {
    id: 'test:contentment_like',
    family: 'emotion',
    weights: {
      valence: 0.5,
      arousal: -0.2,
      dominance: 0.3,
      threat: -0.4
    },
    gates: [
      'valence >= 0.2',
      'threat <= 0.3'
    ]
  };

  const relief = {
    id: 'test:relief',  // Name matches hint
    family: 'emotion',
    weights: {
      valence: 0.4,
      arousal: -0.1,
      dominance: 0.2,
      threat: -0.5
    },
    gates: [
      'valence >= 0.2',
      'threat <= 0.2'  // Stricter - implies contentment
    ]
  };

  return [contentment, relief];
};
```

### 3. Test Convert To Expression Classification

```javascript
describe('with enableConvertToExpression=true', () => {
  it('should classify relief as convert_to_expression', async () => {
    const prototypes = createContentmentReliefPair();

    const result = await analyzer.analyze(prototypes);

    expect(result.recommendations[0].classification.v2Type).toBe('convert_to_expression');
  });

  it('should include conversion hint in result', async () => {
    const prototypes = createContentmentReliefPair();

    const result = await analyzer.analyze(prototypes);

    const classification = result.recommendations[0].classification;
    expect(classification.conversionHint).toBeDefined();
    expect(classification.conversionHint.matchedBy).toBe('name_hint');
    expect(classification.conversionHint.candidatePrototype).toContain('relief');
  });

  it('should suggest delta gate for threat axis', async () => {
    const prototypes = createContentmentReliefPair();

    const result = await analyzer.analyze(prototypes);

    const actions = result.recommendations[0].actions;
    const hasDeltaHint = actions.some(a =>
      a.toLowerCase().includes('delta') || a.toLowerCase().includes('expression')
    );
    expect(hasDeltaHint).toBe(true);
  });
});

describe('with enableConvertToExpression=false', () => {
  let analyzerWithFlagOff;

  beforeAll(async () => {
    // Bootstrap with flag disabled
  });

  it('should NOT classify as convert_to_expression when flag disabled', async () => {
    const prototypes = createContentmentReliefPair();

    const result = await analyzerWithFlagOff.analyze(prototypes);

    expect(result.recommendations[0].classification.v2Type).not.toBe('convert_to_expression');
    // Should fall through to nested_siblings
    expect(result.recommendations[0].classification.v2Type).toBe('nested_siblings');
  });
});
```

### 4. Create Output Shape Snapshot Test

```javascript
/**
 * @file Snapshot test for v2 output shape stability
 */

import { describe, it, expect } from '@jest/globals';

describe('Prototype Overlap Output Shape - Snapshot', () => {

  it('should maintain stable output shape for merge_recommended', async () => {
    const prototypes = createMergeablePrototypes();
    const result = await analyzer.analyze(prototypes);

    // Snapshot the full recommendation structure
    expect(result.recommendations[0]).toMatchSnapshot({
      // Ignore volatile fields
      evidence: expect.objectContaining({
        pearsonCorrelation: expect.any(Number),
        gateOverlap: expect.any(Object),
        passRates: expect.any(Object),
        intensitySimilarity: expect.any(Object),
        highCoactivation: expect.any(Object),
        gateImplication: expect.any(Object)
      }),
      suggestedGateBands: expect.any(Array)
    });
  });

  it('should maintain stable output shape for nested_siblings', async () => {
    const prototypes = createNestedSiblingPrototypes();
    const result = await analyzer.analyze(prototypes);

    expect(result.recommendations[0]).toMatchSnapshot({
      evidence: expect.any(Object),
      suggestedGateBands: expect.any(Array)
    });
  });

  it('should maintain stable metadata shape', async () => {
    const prototypes = createMergeablePrototypes();
    const result = await analyzer.analyze(prototypes);

    expect(result.metadata).toMatchSnapshot({
      gateAnalysis: expect.any(Object)
    });
  });
});
```

### 5. Verify Backward Compatibility

```javascript
describe('backward compatibility', () => {
  it('should include legacyType for v1 consumers', async () => {
    const prototypes = createMergeablePrototypes();
    const result = await analyzer.analyze(prototypes);

    const classification = result.recommendations[0].classification;
    expect(classification.legacyType).toBeDefined();
    expect(['merge', 'subsumed', 'not_redundant']).toContain(classification.legacyType);
  });

  it('should map v2 types to v1 types correctly', async () => {
    // Test various v2 types map correctly
    // merge_recommended → merge
    // subsumed_recommended → subsumed
    // nested_siblings → not_redundant
    // etc.
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

1. **convert_to_expression with flag on**:
   - relief name matches hint → convert_to_expression

2. **convert_to_expression with flag off**:
   - Same prototypes → nested_siblings (not convert_to_expression)

3. **Conversion hint present**:
   - matchedBy field indicates how matched
   - candidatePrototype identifies which one

4. **Delta gate suggestion in actions**:
   - Actions mention delta or expression conversion

5. **Snapshot stability**:
   - Output shape matches snapshot
   - Changes to shape are caught

6. **Backward compatibility**:
   - legacyType present and valid
   - v2 types map to v1 correctly

### Invariants That Must Remain True

- Feature flag completely gates convert_to_expression
- Snapshot tests catch unintended shape changes
- Tests are deterministic

## Estimated Size

~100 lines of test code

## Dependencies

- PROREDANAV2-017 (full orchestrator integration)

## Verification Commands

```bash
# Run convert to expression integration test
npm run test:integration -- --testPathPattern=convertToExpression.integration

# Run snapshot test
npm run test:unit -- --testPathPattern=outputShape.snapshot

# Update snapshots if intentional changes made
npm run test:unit -- --testPathPattern=outputShape.snapshot --updateSnapshot

# Run all prototypeOverlap tests
npm run test:unit -- --testPathPattern=prototypeOverlap
npm run test:integration -- --testPathPattern=prototypeOverlap
```
