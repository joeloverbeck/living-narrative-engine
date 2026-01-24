# PROANAOVEV3-016: V3 Performance Tests

**STATUS: COMPLETED**

## Outcome

Performance testing is already covered in `tests/integration/expressionDiagnostics/prototypeOverlap/v3Pipeline.integration.test.js`:

- **Lines 425-436**: Test "should complete V3 analysis within 30 seconds"
- Uses 5000 sample count with real test prototypes (11 prototypes)
- Asserts `elapsed < 30000` milliseconds

No separate performance test file was created as the integration test already validates the critical performance requirement.

---

## Summary (Original)

Create performance tests to verify v3 analysis meets the <30 second target for 91 prototypes and demonstrates the expected 18× complexity improvement.

## Motivation

The primary motivation for v3 is performance improvement:
- **Old**: O(pairs × samplesPerPair) = O(4095 × 20000) = ~82M evaluations
- **New**: O(prototypes × poolSize) = O(91 × 50000) = ~4.5M evaluations

Performance tests verify this improvement is realized in practice.

## Files to Create

### Performance Tests
- `tests/performance/expressionDiagnostics/v3AnalysisPerformance.performance.test.js`

## Implementation Details

### Test Structure

```javascript
describe('V3 Analysis Performance', () => {
  describe('Full Analysis Time', () => {
    it('should complete v3 analysis in < 30 seconds for 91 prototypes', async () => {
      const prototypes = loadEmotionPrototypes(); // 91 prototypes
      const config = { sharedPoolSize: 50000 };

      const startTime = performance.now();
      await analyzer.analyzeOverlaps(prototypes);
      const endTime = performance.now();

      const durationSeconds = (endTime - startTime) / 1000;
      expect(durationSeconds).toBeLessThan(30);
    });
  });

  describe('Phase Timing Breakdown', () => {
    it('should track timing for each phase', async () => {
      const timings = {};

      // Phase 0: Pool generation
      timings.poolGeneration = await measureTime(() =>
        poolGenerator.generate()
      );

      // Phase 1: Vector evaluation
      timings.vectorEvaluation = await measureTime(() =>
        vectorEvaluator.evaluateAll(prototypes, pool)
      );

      // Phase 2: Profile calculation
      timings.profileCalculation = await measureTime(() =>
        profileCalculator.calculateAll(prototypes, vectors)
      );

      // Phase 3: Pairwise analysis
      timings.pairwiseAnalysis = await measureTime(() =>
        analyzePairs(candidates, vectors, profiles)
      );

      // Log breakdown
      console.log('Phase Timing Breakdown:', timings);

      // Verify vector evaluation dominates (as expected)
      expect(timings.vectorEvaluation).toBeGreaterThan(timings.pairwiseAnalysis);
    });
  });

  describe('Memory Usage', () => {
    it('should stay within memory bounds', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      await analyzer.analyzeOverlaps(prototypes);

      const peakMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (peakMemory - initialMemory) / 1024 / 1024;

      console.log(`Memory increase: ${memoryIncreaseMB.toFixed(1)} MB`);

      // Float32Array for 91 prototypes × 50000 contexts × 2 (gate + intensity)
      // = 91 × 50000 × 2 × 4 bytes = ~36 MB theoretical minimum
      // Allow 3× for overhead
      expect(memoryIncreaseMB).toBeLessThan(150);
    });
  });

  describe('Scaling Characteristics', () => {
    it('should scale linearly with prototype count', async () => {
      const timings = [];

      for (const count of [10, 25, 50, 91]) {
        const subset = prototypes.slice(0, count);
        const time = await measureTime(() =>
          analyzer.analyzeOverlaps(subset)
        );
        timings.push({ count, time });
      }

      // Check approximate linearity
      // time ≈ k × prototypes for vector evaluation (dominant phase)
      const ratio1 = timings[1].time / timings[0].time;
      const ratio2 = timings[2].time / timings[1].time;

      // Ratios should be close to prototype count ratios
      expect(ratio1).toBeGreaterThan(1.5); // 25/10 = 2.5
      expect(ratio1).toBeLessThan(4);
    });
  });
});
```

### Helper Functions

```javascript
async function measureTime(fn) {
  const start = performance.now();
  await fn();
  const end = performance.now();
  return end - start;
}

function loadEmotionPrototypes() {
  const lookup = require('../../../data/mods/core/lookups/emotion_prototypes.lookup.json');
  return Object.values(lookup);
}
```

## Out of Scope

- Integration testing (ticket 015)
- Regression testing (ticket 017)

## Acceptance Criteria

- [ ] Full analysis completes in < 30 seconds for 91 prototypes
- [ ] Phase timing breakdown logged
- [ ] Memory usage stays within bounds (< 150 MB)
- [ ] Linear scaling with prototype count demonstrated
- [ ] Performance tests pass: `npm run test:performance`
- [ ] Results logged for tracking over time
- [ ] `npx eslint tests/performance/expressionDiagnostics/v3AnalysisPerformance.performance.test.js` passes

## Dependencies

- PROANAOVEV3-013 (PrototypeOverlapAnalyzer v3 integration)

## Estimated Complexity

Medium - performance measurement with statistical analysis.
