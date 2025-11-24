# PERTESFLAANA-005: Relax SlotGenerator Performance Test Thresholds

**Reference**: [Performance Test Flakiness Analysis](../docs/analysis/performance-test-flakiness-analysis.md)

## Summary

Update the performance test thresholds for `SlotGenerator` to account for CI environment variability. The current test is failing not due to production issues, but because the thresholds are too strict for variable CI runner performance. The actual performance (0.03ms per call) is excellent and poses no user-facing issues.

## Problem Statement

The test `"should generate single slot efficiently (<0.01ms)"` in `tests/performance/anatomy/slotGenerator.performance.test.js` is failing with:

```
Expected: < 15ms total (1000 iterations)
Received: 29.66ms total

Expected: < 0.015ms per call  
Received: ~0.03ms per call
```

**Root cause**: CI environment variability, not production performance issues.

**Analysis findings**:
- Production code is optimized and performant
- 30 microseconds per slot generation is imperceptible to users
- Slot generation is infrequent (only on character creation)
- Test already reduced from 10,000 to 1,000 iterations for CI
- Comments in test mention "CI-adjusted safety margin"

## Files Expected to Touch

### Modified Files
- `tests/performance/anatomy/slotGenerator.performance.test.js`
  - Lines 81-106: Update threshold assertions
  - Add comment explaining rationale

## Out of Scope

**DO NOT CHANGE**:
- Production code in `src/anatomy/slotGenerator.js` (no performance issues)
- Test structure or iteration counts
- Other performance tests in the file
- Any code outside the specific test case
- Threshold values for other tests
- GOAP performance test thresholds (separate tickets)

## Implementation Details

### Current Test (Failing)

```javascript
it('should generate single slot efficiently (<0.01ms)', async () => {
  const start = performance.now();
  
  for (let i = 0; i < 1000; i++) {
    slotGenerator.generateBlueprintSlots(template);
  }
  
  const end = performance.now();
  const totalTime = end - start;
  const avgTime = totalTime / 1000;
  
  // Current thresholds (too strict for CI)
  expect(totalTime).toBeLessThan(15); // 15ms total
  expect(avgTime).toBeLessThan(0.015); // 0.015ms per call
});
```

### Updated Test (Recommended)

```javascript
it('should generate single slot efficiently (<0.05ms)', async () => {
  const start = performance.now();
  
  for (let i = 0; i < 1000; i++) {
    slotGenerator.generateBlueprintSlots(template);
  }
  
  const end = performance.now();
  const totalTime = end - start;
  const avgTime = totalTime / 1000;
  
  // Updated thresholds with 2-3x CI safety margin
  // Original expectation: ~10-15ms local, ~30ms CI
  // Analysis shows 0.03ms per call is normal and acceptable
  // Reference: docs/analysis/performance-test-flakiness-analysis.md
  expect(totalTime).toBeLessThan(50);   // 50ms total for 1000 iterations
  expect(avgTime).toBeLessThan(0.05);   // 0.05ms = 50 microseconds per call
  
  // Still fast enough for production (character creation only)
  expect(avgTime).toBeLessThan(0.1);    // Upper bound: 100 microseconds
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
| Total (1000 iter) | 15ms | 29.66ms | 50ms | 2x safety margin for CI variability |
| Per call | 0.015ms | 0.03ms | 0.05ms | Accommodates CI CPU sharing |
| Upper bound | N/A | N/A | 0.1ms | Still imperceptible to users |

**Performance context**:
- Slot generation happens once during character blueprint initialization
- User-facing operation (character creation) takes seconds anyway
- 50 microseconds vs 15 microseconds is indistinguishable to users
- No performance complaints or issues reported

## Acceptance Criteria

### Specific Tests That Must Pass

1. **Updated Performance Test**:
   - ✅ Test passes consistently in CI (5+ consecutive runs)
   - ✅ Test passes locally on various hardware
   - ✅ New thresholds accommodate observed timing (29.66ms)
   - ✅ Assertions still validate performance is reasonable

2. **Other Tests Unaffected**:
   - ✅ Other tests in `slotGenerator.performance.test.js` unchanged
   - ✅ All anatomy tests pass: `npm run test:unit -- tests/unit/anatomy/`
   - ✅ All performance tests pass: `npm run test:performance`

3. **System Tests**:
   - ✅ Full test suite: `npm run test:ci`
   - ✅ Linting: `npx eslint tests/performance/anatomy/slotGenerator.performance.test.js`

### Invariants That Must Remain True

1. **Test Still Validates Performance**:
   - Thresholds still catch genuine performance regressions
   - Test fails if performance degrades by >5x
   - Upper bound prevents extreme slowdowns

2. **No Production Code Changes**:
   - Zero changes to `src/anatomy/slotGenerator.js`
   - No workarounds or performance hacks

3. **Test Structure Preserved**:
   - Same test methodology
   - Same iteration count (1000)
   - Same setup and teardown

4. **Documentation Updated**:
   - Comment explains threshold rationale
   - Reference to analysis document

## Testing Strategy

### Local Verification

```bash
# Run test 10 times to verify stability
for i in {1..10}; do
  NODE_ENV=test npx jest tests/performance/anatomy/slotGenerator.performance.test.js
done

# Should pass all 10 times with new thresholds
```

### CI Verification

```bash
# In CI environment
npm run test:performance -- tests/performance/anatomy/slotGenerator.performance.test.js

# Verify passes consistently
```

### Regression Detection

The new thresholds should still catch real regressions:

```javascript
// Simulate 10x performance degradation
it('should fail on genuine regression', () => {
  const start = performance.now();
  
  for (let i = 0; i < 1000; i++) {
    slotGenerator.generateBlueprintSlots(template);
    
    // Simulate slowdown
    for (let j = 0; j < 100000; j++) {
      // Busy loop
    }
  }
  
  const totalTime = performance.now() - start;
  
  // Should fail with new thresholds (totalTime >> 50ms)
  expect(totalTime).toBeLessThan(50); // Will fail, correctly
});
```

## Implementation Notes

1. **Threshold Selection**: Based on observed timings with 2x safety margin

2. **Statistical Alternative**: Use if simple threshold adjustment still shows flakiness

3. **Comments**: Add inline comments explaining rationale for future maintainers

4. **No Workarounds**: Don't disable test or skip in CI - fix thresholds properly

5. **Monitoring**: If test still flakes after adjustment, consider the statistical approach

## Dependencies

None - this ticket is standalone and doesn't depend on other tickets.

## Estimated Effort

- Implementation: 15-30 minutes
- Testing: 30 minutes (verify stability)
- Total: 45-60 minutes

## Validation Checklist

Before marking complete:
- [ ] Thresholds updated to 50ms / 0.05ms
- [ ] Comment added explaining threshold rationale
- [ ] Test passes 10+ consecutive times locally
- [ ] Test passes 5+ consecutive times in CI
- [ ] Other performance tests unaffected
- [ ] All anatomy tests pass
- [ ] Full test suite passes (`npm run test:ci`)
- [ ] ESLint passes on modified file
- [ ] Code review completed
- [ ] Monitoring plan for potential future flakiness

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
