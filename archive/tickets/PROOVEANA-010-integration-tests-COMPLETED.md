# PROOVEANA-010: Integration Tests

## Description

Create comprehensive integration tests for the Prototype Overlap Analyzer system. These tests verify the complete analysis pipeline using real prototype data, validate known overlap detection scenarios, and ensure acceptable performance characteristics.

## Files to Create

- `tests/integration/expressionDiagnostics/prototypeOverlap/prototypeOverlapAnalyzer.integration.test.js`

## Files to Modify

None

## Out of Scope

- E2E browser tests
- Performance benchmarks (beyond sanity check)
- Any source code changes
- Visual/UI testing

## Implementation Details

### Test Categories

1. **Full Pipeline** - End-to-end analysis with real prototypes
2. **Known Overlap Detection** - Verify detection of engineered test cases
3. **Performance Sanity** - Ensure acceptable execution time

### prototypeOverlapAnalyzer.integration.test.js

```javascript
/**
 * @file Integration tests for Prototype Overlap Analyzer
 * @see specs/prototype-overlap-analyzer.md
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createIntegrationTestBed } from '../../../common/testBed.js';
import { diagnosticsTokens } from '../../../../src/dependencyInjection/tokens/tokens-diagnostics.js';

describe('PrototypeOverlapAnalyzer Integration', () => {
  let testBed;
  let analyzer;

  beforeAll(async () => {
    testBed = await createIntegrationTestBed();
    analyzer = testBed.container.resolve(diagnosticsTokens.IPrototypeOverlapAnalyzer);
  });

  afterAll(() => {
    testBed?.cleanup();
  });

  describe('Full Pipeline', () => {
    it('analyzes real emotion prototypes from lookup', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 2000, // Reduced for test speed
      });

      // Verify result structure
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('metadata');
      expect(Array.isArray(result.recommendations)).toBe(true);

      // Verify metadata
      expect(result.metadata.totalPrototypes).toBeGreaterThan(0);
      expect(result.metadata.sampleCount).toBe(2000);
      expect(result.metadata.elapsed).toBeGreaterThan(0);

      // Verify recommendation structure if any exist
      if (result.recommendations.length > 0) {
        const rec = result.recommendations[0];
        expect(rec).toHaveProperty('type');
        expect(rec).toHaveProperty('prototypes');
        expect(rec).toHaveProperty('severity');
        expect(rec).toHaveProperty('confidence');
        expect(rec).toHaveProperty('actions');
        expect(rec).toHaveProperty('candidateMetrics');
        expect(rec).toHaveProperty('behaviorMetrics');
        expect(rec).toHaveProperty('evidence');
      }
    });

    it('analyzes real sexual state prototypes', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'sexual',
        sampleCount: 2000,
      });

      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata.totalPrototypes).toBeGreaterThanOrEqual(0);
    });

    it('invokes progress callback during analysis', async () => {
      const progressCalls = [];

      await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 1000,
        onProgress: (stage, completed, total) => {
          progressCalls.push({ stage, completed, total });
        },
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls.some(p => p.stage === 'filtering')).toBe(true);
    });
  });

  describe('Known Overlap Detection', () => {
    it('detects MERGE for near-identical test prototypes', async () => {
      // This test relies on actual prototype data
      // If no merge recommendations exist, it validates the system doesn't false-positive
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      const mergeRecs = result.recommendations.filter(
        r => r.type === 'prototype_merge_suggestion'
      );

      // Each merge recommendation should have valid structure
      mergeRecs.forEach(rec => {
        expect(rec.severity).toBeGreaterThanOrEqual(0);
        expect(rec.severity).toBeLessThanOrEqual(1);
        expect(rec.confidence).toBeGreaterThanOrEqual(0);
        expect(rec.confidence).toBeLessThanOrEqual(1);
        expect(rec.prototypes.a).toBeDefined();
        expect(rec.prototypes.b).toBeDefined();
        expect(rec.actions.length).toBeGreaterThan(0);
      });
    });

    it('detects SUBSUMED for subset prototypes', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 4000,
      });

      const subsumptionRecs = result.recommendations.filter(
        r => r.type === 'prototype_subsumption_suggestion'
      );

      // Each subsumption recommendation should have valid structure
      subsumptionRecs.forEach(rec => {
        expect(rec.severity).toBeGreaterThanOrEqual(0);
        expect(rec.severity).toBeLessThanOrEqual(1);
        expect(rec.actions.some(a =>
          a.includes('remove') || a.includes('tighten')
        )).toBe(true);
      });
    });

    it('returns sorted recommendations by severity descending', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 2000,
      });

      if (result.recommendations.length > 1) {
        for (let i = 1; i < result.recommendations.length; i++) {
          expect(result.recommendations[i - 1].severity)
            .toBeGreaterThanOrEqual(result.recommendations[i].severity);
        }
      }
    });
  });

  describe('Performance Sanity', () => {
    it('completes analysis with 8000 samples in < 30 seconds', async () => {
      const startTime = Date.now();

      await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 8000,
      });

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(30000);
    });

    it('handles empty prototype list gracefully', async () => {
      // Test with a family that might have no prototypes
      // The system should return empty results, not throw
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 100,
      });

      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('metadata');
    });
  });

  describe('Metric Validity', () => {
    it('all recommendation metrics are within valid bounds', async () => {
      const result = await analyzer.analyze({
        prototypeFamily: 'emotion',
        sampleCount: 2000,
      });

      result.recommendations.forEach(rec => {
        // Severity and confidence in [0,1]
        expect(rec.severity).toBeGreaterThanOrEqual(0);
        expect(rec.severity).toBeLessThanOrEqual(1);
        expect(rec.confidence).toBeGreaterThanOrEqual(0);
        expect(rec.confidence).toBeLessThanOrEqual(1);

        // Candidate metrics in [0,1]
        expect(rec.candidateMetrics.activeAxisOverlap).toBeGreaterThanOrEqual(0);
        expect(rec.candidateMetrics.activeAxisOverlap).toBeLessThanOrEqual(1);
        expect(rec.candidateMetrics.signAgreement).toBeGreaterThanOrEqual(0);
        expect(rec.candidateMetrics.signAgreement).toBeLessThanOrEqual(1);

        // Cosine similarity in [-1,1]
        expect(rec.candidateMetrics.weightCosineSimilarity).toBeGreaterThanOrEqual(-1);
        expect(rec.candidateMetrics.weightCosineSimilarity).toBeLessThanOrEqual(1);

        // Gate overlap rates in [0,1]
        expect(rec.behaviorMetrics.gateOverlap.onEitherRate).toBeGreaterThanOrEqual(0);
        expect(rec.behaviorMetrics.gateOverlap.onEitherRate).toBeLessThanOrEqual(1);
        expect(rec.behaviorMetrics.gateOverlap.onBothRate).toBeGreaterThanOrEqual(0);
        expect(rec.behaviorMetrics.gateOverlap.onBothRate).toBeLessThanOrEqual(1);

        // Correlation in [-1,1]
        expect(rec.behaviorMetrics.intensity.pearsonCorrelation).toBeGreaterThanOrEqual(-1);
        expect(rec.behaviorMetrics.intensity.pearsonCorrelation).toBeLessThanOrEqual(1);

        // meanAbsDiff >= 0
        expect(rec.behaviorMetrics.intensity.meanAbsDiff).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

```javascript
describe('Full Pipeline', () => {
  it('analyzes real emotion prototypes from lookup', async () => {
    // Load from data/mods/core/lookups/emotion_prototypes.lookup.json
    // Run analysis
    // Verify recommendations have valid structure
  });

  it('analyzes real sexual state prototypes', async () => {
    // Similar for sexual states
  });

  it('invokes progress callback during analysis');
});

describe('Known Overlap Detection', () => {
  it('detects MERGE for near-identical test prototypes', async () => {
    // Verify merge recommendations if any exist
    // Validate structure and constraints
  });

  it('detects SUBSUMED for subset prototype', async () => {
    // Verify subsumption recommendations if any exist
  });

  it('returns sorted recommendations by severity descending');
});

describe('Performance Sanity', () => {
  it('completes analysis with 8000 samples in < 30 seconds', async () => {
    // Time the analysis
    // Assert reasonable performance
  });

  it('handles empty prototype list gracefully');
});

describe('Metric Validity', () => {
  it('all recommendation metrics are within valid bounds');
});
```

### Invariants

- All integration tests use real DI container
- Tests do not modify prototype data files
- Performance test completes within 30 seconds
- All metrics in returned recommendations are within valid bounds
- `npm run test:integration -- --grep "prototypeOverlapAnalyzer"` passes

## Verification Commands

```bash
npm run test:integration -- --testPathPattern="prototypeOverlapAnalyzer.integration"
```

## Dependencies

- PROOVEANA-006 (DI registration complete)
- PROOVEANA-005 (PrototypeOverlapAnalyzer)
- PROOVEANA-009 (Controller, for full system availability)

## Estimated Diff Size

- Tests: ~300 lines
- **Total: ~300 lines**

## Outcome

**Status**: COMPLETED

### Test File Created

`tests/integration/expressionDiagnostics/prototypeOverlap/prototypeOverlapAnalyzer.integration.test.js`

### Discrepancies Corrected During Implementation

The original ticket contained several incorrect assumptions about the codebase that were corrected:

| Ticket Assumption | Actual Code | Fix Applied |
|------------------|-------------|-------------|
| `createIntegrationTestBed()` | `CommonBootstrapper` with JSDOM | Used CommonBootstrapper pattern |
| `testBed.container.resolve()` | Direct `container.resolve()` | Bootstrapper returns container directly |
| `result.metadata.elapsed` | Does NOT exist | Removed assertion |
| `result.metadata.sampleCount` | `sampleCountPerPair` | Corrected field name |
| `behaviorMetrics.gateOverlap.onEitherRate` (nested) | `behaviorMetrics.onEitherRate` (flat) | Used flat structure |
| `behaviorMetrics.intensity.pearsonCorrelation` (nested) | `behaviorMetrics.pearsonCorrelation` (flat) | Used flat structure |

### Key Implementation Details

1. **CommonBootstrapper Pattern**: Integration tests for expression diagnostics require `CommonBootstrapper` instead of `IntegrationTestBed` to get full service initialization chain.

2. **JSDOM Setup**: Required for browser-like environment:
   ```javascript
   dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
     url: 'http://localhost',
     pretendToBeVisual: true,
   });
   global.window = dom.window;
   global.document = dom.window.document;
   global.navigator = dom.window.navigator;
   ```

3. **Manual Lookup Data**: Since `skipModLoading: true` is required (to avoid network errors in jsdom), prototype data is registered manually via `dataRegistry.store('lookups', key, data)` in the `postInitHook`.

4. **Service Registration**: Both `registerExpressionServices` and `registerExpressionDiagnosticsServices` must be called in `postInitHook`.

5. **NaN Handling**: `pearsonCorrelation` and `meanAbsDiff` can be `NaN` with insufficient samples. Tests use `Number.isNaN()` checks before asserting bounds.

### Test Results

All 9 test cases pass:
- Full Pipeline (3 tests): emotion prototypes, sexual prototypes, progress callback
- Known Overlap Detection (3 tests): merge detection, subsumption detection, severity sorting
- Performance Sanity (2 tests): 8000-sample timing, empty prototype handling
- Metric Validity (1 test): bounds validation for all metrics

### Verification Command

```bash
npm run test:integration -- --testPathPatterns="prototypeOverlapAnalyzer.integration"
```
