# MONCARADVMET-003: Implement Percentile Calculation and Exposure

## Status: ✅ COMPLETED

## Summary

Add percentile calculation (p50, p90) to `HierarchicalClauseNode` and wire the results through `MonteCarloSimulator` output to the `ClauseResult` typedef.

## Priority: High | Effort: Medium

## Rationale

Mean violation is misleading when failures are heavy-tailed. A few large violations can inflate the mean while most failures are minor. Percentiles reveal:
- **p50 (median)**: The *typical* shortfall
- **p90**: The *worst-case* shortfall (excluding extreme outliers)

This enables content creators to understand: "Most failures are small (p50 << mean), but some are severe (p90 >> mean)."

## Dependencies

- **MONCARADVMET-002** - Requires `violationValues` array to be populated

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/models/HierarchicalClauseNode.js` | **Modify** |
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | **Modify** |
| `tests/unit/expressionDiagnostics/models/HierarchicalClauseNode.test.js` | **Modify** |
| `tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js` | **Modify** |

## Out of Scope

- **DO NOT** modify `FailureExplainer.js` - that's MONCARADVMET-008
- **DO NOT** modify UI components - that's MONCARADVMET-009/010
- **DO NOT** add near-miss or last-mile metrics - those are separate tickets
- **DO NOT** implement reservoir sampling
- **DO NOT** change the existing `averageViolation` field (it remains)

## Implementation Details

### HierarchicalClauseNode Changes

Add percentile calculation method:

```javascript
/**
 * Calculate the percentile of violation values
 * Uses linear interpolation for non-integer indices
 *
 * @param {number} p - Percentile as decimal (0.5 for p50, 0.9 for p90)
 * @returns {number|null} The percentile value, or null if no violations
 */
getViolationPercentile(p) {
  const values = this.#violationValues;

  if (values.length === 0) {
    return null;
  }

  if (values.length === 1) {
    return values[0];
  }

  // Sort a copy (don't mutate the original)
  const sorted = [...values].sort((a, b) => a - b);

  // Calculate index using linear interpolation
  const index = p * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  // Linear interpolation between adjacent values
  const fraction = index - lower;
  return sorted[lower] * (1 - fraction) + sorted[upper] * fraction;
}

/**
 * Convenience getters for common percentiles
 */
get violationP50() {
  return this.getViolationPercentile(0.5);
}

get violationP90() {
  return this.getViolationPercentile(0.9);
}

get violationP99() {
  return this.getViolationPercentile(0.99);
}
```

Update `toJSON()` to include percentiles:

```javascript
toJSON() {
  return {
    // existing fields...
    averageViolation: this.averageViolation,

    // NEW: Percentile fields
    violationP50: this.violationP50,
    violationP90: this.violationP90,
    violationSampleCount: this.violationSampleCount,
  };
}
```

### MonteCarloSimulator Changes

Update the `ClauseResult` typedef and `#finalizeClauseResults()`:

```javascript
/**
 * @typedef {Object} ClauseResult
 * @property {string} clauseDescription
 * @property {number} clauseIndex
 * @property {number} failureCount
 * @property {number} failureRate
 * @property {number} averageViolation
 * @property {number|null} violationP50 - NEW: Median violation
 * @property {number|null} violationP90 - NEW: 90th percentile violation
 * @property {Object} hierarchicalBreakdown
 */

#finalizeClauseResults() {
  return this.#clauseNodes.map((node, index) => ({
    clauseDescription: node.description,
    clauseIndex: index,
    failureCount: node.failureCount,
    failureRate: node.failureRate,
    averageViolation: node.averageViolation,

    // NEW: Percentile fields
    violationP50: node.violationP50,
    violationP90: node.violationP90,

    hierarchicalBreakdown: node.toJSON(),
  }));
}
```

### Algorithm Choice: Simple Sort vs Quickselect

For this implementation, we use simple sort + indexing because:
1. Violation arrays are typically <10k elements
2. Sort is O(n log n) which is acceptable for finalization
3. Implementation is straightforward and correct
4. Quickselect optimization can be added later if needed

### Edge Cases

1. **Zero violations**: Return `null` for all percentiles
2. **Single violation**: Return that value for all percentiles
3. **Two violations**: p50 is average, p90 closer to max
4. **NaN/undefined in array**: Should not occur (guard in recordEvaluation)

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/ --verbose
```

**New unit tests for HierarchicalClauseNode:**

1. `getViolationPercentile() returns null for empty array`:
   ```javascript
   it('should return null when no violations recorded', () => {
     const node = new HierarchicalClauseNode({ type: 'leaf', logic: {} });
     expect(node.violationP50).toBeNull();
     expect(node.violationP90).toBeNull();
   });
   ```

2. `getViolationPercentile() returns value for single violation`:
   ```javascript
   it('should return the single value for all percentiles', () => {
     const node = new HierarchicalClauseNode({ type: 'leaf', logic: {} });
     node.recordEvaluation(false, 0.25);

     expect(node.violationP50).toBe(0.25);
     expect(node.violationP90).toBe(0.25);
   });
   ```

3. `getViolationPercentile() calculates correct median`:
   ```javascript
   it('should calculate correct p50 (median)', () => {
     const node = new HierarchicalClauseNode({ type: 'leaf', logic: {} });
     // Add values: 0.1, 0.2, 0.3, 0.4, 0.5
     [0.3, 0.1, 0.5, 0.2, 0.4].forEach(v => node.recordEvaluation(false, v));

     expect(node.violationP50).toBe(0.3); // Middle value
   });
   ```

4. `getViolationPercentile() interpolates correctly`:
   ```javascript
   it('should interpolate between values for even-length arrays', () => {
     const node = new HierarchicalClauseNode({ type: 'leaf', logic: {} });
     // Add values: 0.1, 0.2, 0.3, 0.4
     [0.1, 0.2, 0.3, 0.4].forEach(v => node.recordEvaluation(false, v));

     expect(node.violationP50).toBe(0.25); // Interpolated between 0.2 and 0.3
   });
   ```

5. `violationP90 is higher than violationP50`:
   ```javascript
   it('should have p90 >= p50 for any distribution', () => {
     const node = new HierarchicalClauseNode({ type: 'leaf', logic: {} });
     [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].forEach(v =>
       node.recordEvaluation(false, v)
     );

     expect(node.violationP90).toBeGreaterThanOrEqual(node.violationP50);
   });
   ```

6. `toJSON() includes percentile fields`:
   ```javascript
   it('should include violationP50 and violationP90 in toJSON()', () => {
     const node = new HierarchicalClauseNode({ type: 'leaf', logic: {} });
     node.recordEvaluation(false, 0.1);
     node.recordEvaluation(false, 0.2);

     const json = node.toJSON();

     expect(json).toHaveProperty('violationP50');
     expect(json).toHaveProperty('violationP90');
   });
   ```

**New unit tests for MonteCarloSimulator:**

1. `ClauseResult includes violationP50 and violationP90`:
   ```javascript
   it('should include percentile fields in clause results', () => {
     const result = simulator.simulate(expression, { trackClauses: true });

     result.clauseFailures.forEach(clause => {
       expect(clause).toHaveProperty('violationP50');
       expect(clause).toHaveProperty('violationP90');
     });
   });
   ```

### Invariants That Must Remain True

1. **Existing tests pass** - All current tests must continue to pass
2. **averageViolation unchanged** - Must produce identical values
3. **percentile ordering** - p50 <= p90 <= max(violations)
4. **percentile bounds** - All percentiles within [min, max] of violations

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/ --verbose

# Run with coverage
npm run test:unit -- --testPathPattern="expressionDiagnostics" --coverage

# Type check
npm run typecheck
```

## Definition of Done

- [x] `getViolationPercentile(p)` method implemented
- [x] `violationP50`, `violationP90` getters implemented (note: `violationP99` not added per spec)
- [x] `toJSON()` includes percentile fields
- [x] `ClauseResult` typedef updated
- [x] `#finalizeClauseResults()` includes percentiles in output
- [x] Unit tests for percentile calculation edge cases
- [x] Unit tests for ClauseResult structure
- [x] All existing tests pass
- [x] No type errors

---

## Outcome

### Completed: 2026-01-10

### What Was Actually Implemented

**HierarchicalClauseNode.js:**
- Added `getViolationPercentile(p)` method with linear interpolation algorithm
- Added `violationP50` and `violationP90` convenience getters
- Updated `toJSON()` to include `violationP50`, `violationP90`, and `violationSampleCount`

**MonteCarloSimulator.js:**
- Updated `ClauseResult` typedef to include `violationP50` and `violationP90` properties
- Updated `#finalizeClauseResults()` to extract percentiles from hierarchical trees

**Tests Added:**
- 9 new unit tests for HierarchicalClauseNode percentile calculation:
  - Empty array returns null
  - Single value returns that value for all percentiles
  - Correct p50 (median) for odd-length array
  - Linear interpolation for even-length arrays
  - p90 >= p50 invariant
  - Correct p90 for 10-element array
  - Does not mutate original violationValues array
  - toJSON includes percentile fields
  - Boundary values for p0 and p100
- 3 new unit tests for MonteCarloSimulator ClauseResult percentile fields:
  - ClauseResult includes violationP50 and violationP90
  - Percentiles match hierarchicalBreakdown values
  - Numeric percentiles returned when violations recorded

### Discrepancies from Ticket

1. **violationP99 getter**: The ticket mentioned adding `violationP99` but the spec (`specs/monte-carlo-advanced-metrics.md`) only defines p50 and p90 for `ClauseResult` output. Following the spec, only `violationP50` and `violationP90` were implemented. The general `getViolationPercentile(p)` method allows any percentile to be calculated if needed in the future.

2. **Test code examples**: The ticket's test examples used incorrect constructor parameters (e.g., `{ type: 'leaf', logic: {} }`). Actual implementation required correct parameters per the class validation (`{ id, nodeType, description }`).

### Test Results

- All 27 test suites pass (1156 total tests)
- No ESLint errors in modified files
- Pre-existing typecheck warnings remain unaffected

### Files Modified

| File | Lines Changed |
|------|---------------|
| `src/expressionDiagnostics/models/HierarchicalClauseNode.js` | +50 |
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | +6 |
| `tests/unit/expressionDiagnostics/models/HierarchicalClauseNode.test.js` | +85 |
| `tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js` | +55 |
