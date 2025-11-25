# PERTESFLAANA-005: Relax SlotGenerator Performance Test Thresholds

**Reference**: [Performance Test Flakiness Analysis](../../docs/analysis/performance-test-flakiness-analysis.md)

## Status
- Completed (thresholds relaxed and archived after verification)

## Summary

Update the `SlotGenerator` performance test thresholds to account for CI environment variability. The current assertions target 15ms total / 0.015ms per call while the test name still claims "<0.01ms". Recent CI runs occasionally report ~30ms total for the 1,000-iteration sample, which is still acceptable. We need to relax the thresholds and align the test description with the actual intent without changing production code.

## Problem Statement

The test `"should generate single slot efficiently (<0.01ms)"` in `tests/performance/anatomy/slotGenerator.performance.test.js` currently asserts:

```
expect(totalTime).toBeLessThan(15);
expect(avgTime).toBeLessThan(0.015);
```

Despite the label "<0.01ms", the thresholds are 0.015ms per call and 15ms total. CI occasionally reports ~30ms total (~0.03ms per call), which is acceptable but trips the current expectations.

**Root cause**: CI environment variability, not production performance issues.

**Analysis findings**:
- Production code is optimized and performant
- 30 microseconds per slot generation is imperceptible to users
- Slot generation is infrequent (only on character creation)
- Test already reduced from 10,000 to 1,000 iterations for CI
- Warmup loop already reduced to 100 iterations to limit overhead

## Files Expected to Touch

### Modified Files
- `tests/performance/anatomy/slotGenerator.performance.test.js`
  - Single-slot performance test near the top of the file: update description and thresholds
  - Add comment explaining the CI safety margin

## Out of Scope

**DO NOT CHANGE**:
- Production code in `src/anatomy/slotGenerator.js` (no performance issues)
- Test structure or iteration counts
- Other performance tests in the file
- Any code outside the specific test case
- Threshold values for other tests
- GOAP performance test thresholds (separate tickets)

## Implementation Details

### Current Test (Flaky)

```javascript
it('should generate single slot efficiently (<0.01ms)', () => {
  const template = createStructureTemplate(1, 1);
  const iterations = 1000; // Reduced from 10000 for faster tests

  // Warmup phase to ensure JIT compilation
  for (let i = 0; i < 100; i++) {
    slotGenerator.generateBlueprintSlots(template);
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    slotGenerator.generateBlueprintSlots(template);
  }
  const totalTime = performance.now() - start;
  const avgTime = totalTime / iterations;

  // Current thresholds (too strict for CI)
  expect(totalTime).toBeLessThan(15); // 15ms total
  expect(avgTime).toBeLessThan(0.015); // 0.015ms per call
});
```

### Updated Test (Recommended)

```javascript
it('should generate single slot efficiently (<0.05ms)', () => {
  const template = createStructureTemplate(1, 1);
  const iterations = 1000;

  // Warmup to stabilize JIT
  for (let i = 0; i < 100; i++) {
    slotGenerator.generateBlueprintSlots(template);
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    slotGenerator.generateBlueprintSlots(template);
  }
  const totalTime = performance.now() - start;
  const avgTime = totalTime / iterations;

  // Updated thresholds with ~3x CI safety margin
  // Original expectation: ~10-15ms local, ~30ms CI
  // Analysis shows ~0.03ms per call is normal and acceptable
  // Reference: docs/analysis/performance-test-flakiness-analysis.md
  expect(totalTime).toBeLessThan(50);   // 50ms total for 1000 iterations
  expect(avgTime).toBeLessThan(0.05);   // 0.05ms = 50 microseconds per call
});
```

### Alternative: Statistical Approach (If Flakiness Persists)

```javascript
it('should generate single slot efficiently (median <0.05ms)', async () => {
  const timings = [];
  
  // Run multiple samples to get stable measurement
  for (let run = 0; run < 5; run++) {
    const start = performance.now();
    
    for (let i = 0; i < 1000; i++) {
      slotGenerator.generateBlueprintSlots(template);
    }
    
    timings.push(performance.now() - start);
  }
  
  // Use median to reduce impact of GC pauses and CPU spikes
  timings.sort((a, b) => a - b);
  const median = timings[Math.floor(timings.length / 2)];
  const avgTime = median / 1000;
  
  expect(median).toBeLessThan(50);      // 50ms median for 1000 iterations
  expect(avgTime).toBeLessThan(0.05);   // 0.05ms median per call
});
```

### Threshold Justification

| Metric | Current | Observed | Proposed | Rationale |
|--------|---------|----------|----------|-----------|
| Total (1000 iter) | 15ms | 29.66ms | 50ms | ~3x CI safety margin while catching regressions |
| Per call | 0.015ms | 0.03ms | 0.05ms | Aligns test name with expectation and CI variance |

**Performance context**:
- Slot generation happens once during character blueprint initialization
- User-facing operation (character creation) takes seconds anyway
- 50 microseconds vs 15 microseconds is indistinguishable to users
- No performance complaints or issues reported

## Acceptance Criteria

1. Single-slot performance test description and expectations reflect the relaxed 50ms / 0.05ms thresholds.
2. Rationale comment references the flakiness analysis to justify the CI safety margin.
3. Other performance cases in the file remain unchanged and still validate their original budgets.
4. No production code was modified.

## Validation Results

- [x] Thresholds updated to 50ms / 0.05ms with explanatory comments.
- [x] SlotGenerator performance suite passes after the change (`npm run test:performance -- tests/performance/anatomy/slotGenerator.performance.test.js --runInBand`).
- [x] Only the targeted performance test changed; other cases and production code were untouched.
- [x] Ticket archived with outcome summary.

## Outcome

- Thresholds for the single-slot performance test were relaxed to 50ms total / 0.05ms per call, and the test name now reflects the new expectation.
- Added inline rationale tying the new margins to CI variability documented in the flakiness analysis.
- Kept all other performance cases and production code unchanged; reran the SlotGenerator performance suite to confirm the adjustments pass.

## Success Metrics

- Test passes consistently (>95% success rate in CI)
- No false negatives (catches real performance regressions)
- No false positives (doesn't fail on normal CI variability)

## Future Considerations

If test continues to show flakiness after this fix:
1. Implement statistical approach with multiple samples
2. Add percentile-based assertions (p50, p95, p99)
3. Consider warmup phase to reduce JIT variability
4. Document expected ranges for different CI runners

See ticket PERTESFLAANA-006 for percentile-based approach.
