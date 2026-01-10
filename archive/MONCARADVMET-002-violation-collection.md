# MONCARADVMET-002: Add Violation Sample Collection

## Status: ✅ COMPLETED

## Summary

Extend `HierarchicalClauseNode` to store individual violation values in an array instead of only tracking the sum. This is the foundation for percentile calculations (MONCARADVMET-003).

## Priority: High | Effort: Low

## Rationale

Currently, the node only tracks `#violationSum` for calculating `averageViolation`. To compute percentiles (p50, p90), we need access to individual violation values. This ticket adds the storage infrastructure; percentile calculation is handled in MONCARADVMET-003.

## Dependencies

- None (can be implemented in parallel with MONCARADVMET-001)

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/models/HierarchicalClauseNode.js` | **Modify** |
| `tests/unit/expressionDiagnostics/models/HierarchicalClauseNode.test.js` | **Modify** |

## Out of Scope

- **DO NOT** modify `MonteCarloSimulator.js` - it already calls `recordEvaluation()` correctly
- **DO NOT** add percentile calculation - that's MONCARADVMET-003
- **DO NOT** modify `FailureExplainer.js` - that's MONCARADVMET-008
- **DO NOT** modify UI components
- **DO NOT** implement reservoir sampling (deferred for future work)
- **DO NOT** change the existing `averageViolation` calculation logic

## Implementation Details

### HierarchicalClauseNode Changes

Add a new private field to store violation samples:

```javascript
class HierarchicalClauseNode {
  // Existing fields
  #failureCount = 0;
  #violationSum = 0;
  #evaluationCount = 0;

  // NEW: Violation sample storage
  #violationValues = [];

  /**
   * Record an evaluation result
   * @param {boolean} passed - Whether the condition passed
   * @param {number} violation - Magnitude of violation (0 if passed)
   */
  recordEvaluation(passed, violation = 0) {
    this.#evaluationCount++;

    if (!passed) {
      this.#failureCount++;
      this.#violationSum += violation;

      // NEW: Store individual violation value
      if (violation > 0) {
        this.#violationValues.push(violation);
      }
    }
  }

  /**
   * Reset all statistics for re-running simulation
   */
  resetStats() {
    this.#failureCount = 0;
    this.#violationSum = 0;
    this.#evaluationCount = 0;

    // NEW: Clear violation array
    this.#violationValues = [];

    // Recursively reset children
    for (const child of this.#children) {
      child.resetStats();
    }
  }

  /**
   * Get the array of violation values for percentile calculation
   * @returns {number[]} Array of violation magnitudes
   */
  get violationValues() {
    return this.#violationValues;
  }

  /**
   * Get the count of stored violation samples
   * @returns {number}
   */
  get violationSampleCount() {
    return this.#violationValues.length;
  }
}
```

Update `toJSON()` to include violation sample count (NOT the full array, to avoid huge JSON):

```javascript
toJSON() {
  return {
    // existing fields...
    violationSampleCount: this.#violationValues.length,
    // Note: Full violationValues array is NOT serialized to avoid large payloads
    // Percentiles are computed and serialized instead (in MONCARADVMET-003)
  };
}
```

### Memory Considerations

- Each violation value is ~8 bytes (JavaScript number)
- At 100k failures, this uses ~800KB per clause
- For typical expressions with <10 clauses and <50k failures, total <4MB
- Reservoir sampling (for >100k) is deferred to future work

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/models/HierarchicalClauseNode.test.js --verbose
```

**New unit tests to add:**

1. `recordEvaluation() stores violation in violationValues array`:
   ```javascript
   it('should store violation values when recording failures', () => {
     const node = new HierarchicalClauseNode({ type: 'leaf', logic: {} });
     node.recordEvaluation(false, 0.15);
     node.recordEvaluation(false, 0.25);
     node.recordEvaluation(true, 0);  // pass, no violation stored

     expect(node.violationValues).toHaveLength(2);
     expect(node.violationValues).toContain(0.15);
     expect(node.violationValues).toContain(0.25);
   });
   ```

2. `recordEvaluation() does not store zero violations`:
   ```javascript
   it('should not store zero violations', () => {
     const node = new HierarchicalClauseNode({ type: 'leaf', logic: {} });
     node.recordEvaluation(false, 0);
     node.recordEvaluation(false, 0.1);

     expect(node.violationValues).toHaveLength(1);
     expect(node.violationValues[0]).toBe(0.1);
   });
   ```

3. `resetStats() clears violationValues array`:
   ```javascript
   it('should clear violationValues on resetStats()', () => {
     const node = new HierarchicalClauseNode({ type: 'leaf', logic: {} });
     node.recordEvaluation(false, 0.15);
     node.recordEvaluation(false, 0.25);

     node.resetStats();

     expect(node.violationValues).toHaveLength(0);
     expect(node.violationSampleCount).toBe(0);
   });
   ```

4. `violationSampleCount getter returns correct count`:
   ```javascript
   it('should return correct violationSampleCount', () => {
     const node = new HierarchicalClauseNode({ type: 'leaf', logic: {} });
     expect(node.violationSampleCount).toBe(0);

     node.recordEvaluation(false, 0.1);
     node.recordEvaluation(false, 0.2);
     node.recordEvaluation(false, 0.3);

     expect(node.violationSampleCount).toBe(3);
   });
   ```

5. `toJSON() includes violationSampleCount`:
   ```javascript
   it('should include violationSampleCount in toJSON()', () => {
     const node = new HierarchicalClauseNode({ type: 'leaf', logic: {} });
     node.recordEvaluation(false, 0.1);
     node.recordEvaluation(false, 0.2);

     const json = node.toJSON();

     expect(json.violationSampleCount).toBe(2);
   });
   ```

### Invariants That Must Remain True

1. **Existing tests pass** - All current HierarchicalClauseNode tests must continue to pass
2. **averageViolation unchanged** - The calculation `violationSum / failureCount` must produce identical results
3. **failureCount unchanged** - Must match the count before this change
4. **toJSON backward compatible** - New field is additive only

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/models/HierarchicalClauseNode.test.js --verbose

# Verify no regression across all expression diagnostics tests
npm run test:unit -- --testPathPattern="expressionDiagnostics" --verbose

# Type check
npm run typecheck
```

## Definition of Done

- [x] `#violationValues` array field added to HierarchicalClauseNode
- [x] `recordEvaluation()` appends violation to array (when > 0)
- [x] `resetStats()` clears the violation array
- [x] `violationValues` getter implemented
- [x] `violationSampleCount` getter implemented
- [x] `toJSON()` includes `violationSampleCount`
- [x] Unit tests for violation storage
- [x] Unit tests for reset behavior
- [x] Unit tests for getter behavior
- [x] All existing tests pass
- [x] No type errors

## Outcome

### What Was Changed

**As originally planned:**
- Added `#violationValues = []` private field to `HierarchicalClauseNode`
- Modified `recordEvaluation()` to push violation values to array when > 0
- Modified `resetStats()` to clear `#violationValues` array
- Added `violationValues` getter returning the array
- Added `violationSampleCount` getter returning array length
- Added `violationSampleCount` to `toJSON()` output
- Added 5 new unit tests in dedicated `violation sample collection` describe block
- Updated existing `toJSON` test to include `violationSampleCount: 1`

**No deviations from plan.** All ticket assumptions were verified as accurate before implementation.

### Files Modified

| File | Changes |
|------|---------|
| `src/expressionDiagnostics/models/HierarchicalClauseNode.js` | +21 lines (field, getters, storage logic) |
| `tests/unit/expressionDiagnostics/models/HierarchicalClauseNode.test.js` | +58 lines (5 new tests + 1 updated test) |

### Test Results

- All 37 unit tests pass (32 existing + 5 new)
- All 29 expression diagnostics tests pass (no regressions)
- 100% statement coverage on `HierarchicalClauseNode.js`
- 88.57% branch coverage (uncovered branches are pre-existing)
