# MONCARADVMET-007: Add Others-Passed Tracking and Last-Mile Rate

## Summary

Track the "last-mile blocker rate" - the failure rate of each clause among samples where all OTHER clauses passed. This identifies which clause is the true final obstacle blocking expression triggers.

## Priority: High | Effort: High

## Outcome

**Status: COMPLETED**

### Implementation Summary

Successfully implemented last-mile rate tracking in both `HierarchicalClauseNode` and `MonteCarloSimulator`:

1. **HierarchicalClauseNode.js** - Added tracking fields and methods:
   - Private fields: `#lastMileFailCount`, `#othersPassedCount`, `#isSingleClause`
   - Methods: `recordLastMileFail()`, `recordOthersPassed()`
   - Getters: `lastMileFailCount`, `othersPassedCount`, `lastMileFailRate`, `isSingleClause`
   - Setter: `isSingleClause`
   - Updated `resetStats()` to clear last-mile fields (but preserve `isSingleClause` metadata)
   - Updated `toJSON()` to include all last-mile fields

2. **MonteCarloSimulator.js** - Implemented two-phase evaluation:
   - Modified `#initClauseTracking()` to mark single-clause case
   - Modified `#evaluateWithTracking()` to use two-phase evaluation:
     - Phase 1: Evaluate all clauses and collect results
     - Phase 2: Calculate last-mile stats for each clause
   - Updated `#finalizeClauseResults()` to include `lastMileFailRate`, `lastMileContext`, and `isSingleClause`

3. **Tests** - Added comprehensive test coverage:
   - 9 new tests for HierarchicalClauseNode last-mile tracking
   - 7 new tests for MonteCarloSimulator last-mile features
   - All 46,274 tests pass

### Key Design Decisions

- **Two-Phase Evaluation**: Required because last-mile stats need to know results of ALL clauses before recording
- **Single-Clause Detection**: When only one clause exists, `isSingleClause: true` is set and last-mile rate equals failure rate by definition
- **Metadata Preservation**: `isSingleClause` is NOT reset by `resetStats()` since it's metadata, not a statistic
- **Null Safety**: `lastMileFailRate` returns `null` when `othersPassedCount === 0` to distinguish from 0% rate

### Files Modified

| File | Changes |
|------|---------|
| `src/expressionDiagnostics/models/HierarchicalClauseNode.js` | Added last-mile tracking fields, methods, getters, setter, updated resetStats() and toJSON() |
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | Two-phase evaluation, single-clause marking, lastMileContext in results |
| `tests/unit/expressionDiagnostics/models/HierarchicalClauseNode.test.js` | 9 new tests + updated toJSON test for new fields |
| `tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js` | 7 new tests for last-mile features |

### Invariants Preserved

- ✅ All existing tests pass (46,274 total)
- ✅ `triggerRate` and basic `clauseFailures` structure unchanged
- ✅ `lastMileFailRate` always in [0, 1] or null
- ✅ `lastMileFailCount <= othersPassedCount`
- ✅ For single-clause: `lastMileFailRate ≈ failureRate`

---

## Rationale

A clause may have high overall failure rate but be irrelevant because other clauses fail first. Conversely, a clause with low overall failure rate could be the "final boss" blocking most near-triggers.

**Interpretation:**
- `failWhenOthersPass >> failAll`: This clause is the decisive blocker → tune this first
- `failWhenOthersPass << failAll`: Other clauses are masking this one
- `failWhenOthersPass ≈ 0`: This clause never blocks alone (possibly redundant)

This is the most actionable metric for prioritizing which thresholds to adjust.

## Dependencies

- **MONCARADVMET-001** - Optional but helpful for context (threshold info)

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
- **DO NOT** add percentile or near-miss metrics - those are separate tickets
- **DO NOT** change pass/fail evaluation logic
- **DO NOT** modify expression schema

## Implementation Details

### HierarchicalClauseNode Changes

Add fields for last-mile tracking:

```javascript
class HierarchicalClauseNode {
  // Existing fields...

  // NEW: Last-mile tracking
  #lastMileFailCount = 0;    // Failures when all other clauses passed
  #othersPassedCount = 0;    // Samples where all other clauses passed

  /**
   * Record a last-mile failure
   * Called when this clause fails AND all other clauses passed
   */
  recordLastMileFail() {
    this.#lastMileFailCount++;
  }

  /**
   * Record that all other clauses passed for this sample
   * Called regardless of whether this clause passed
   */
  recordOthersPassed() {
    this.#othersPassedCount++;
  }

  /**
   * Reset all statistics
   */
  resetStats() {
    // existing resets...
    this.#lastMileFailCount = 0;
    this.#othersPassedCount = 0;
  }

  /**
   * Get the last-mile failure count
   * @returns {number}
   */
  get lastMileFailCount() {
    return this.#lastMileFailCount;
  }

  /**
   * Get the count of samples where other clauses passed
   * @returns {number}
   */
  get othersPassedCount() {
    return this.#othersPassedCount;
  }

  /**
   * Get the last-mile failure rate
   * Failure rate among samples where all other clauses passed
   *
   * @returns {number|null} Rate [0, 1], or null if no samples with others passed
   */
  get lastMileFailRate() {
    if (this.#othersPassedCount === 0) {
      return null;
    }
    return this.#lastMileFailCount / this.#othersPassedCount;
  }

  /**
   * Check if this is a single-clause prerequisite
   * For single clauses, last-mile rate equals failure rate by definition
   * @returns {boolean}
   */
  get isSingleClause() {
    // Will be set by MonteCarloSimulator based on prerequisite count
    return this.#isSingleClause ?? false;
  }

  set isSingleClause(value) {
    this.#isSingleClause = value;
  }
}
```

Update `toJSON()`:

```javascript
toJSON() {
  return {
    // existing fields...
    lastMileFailCount: this.lastMileFailCount,
    othersPassedCount: this.othersPassedCount,
    lastMileFailRate: this.lastMileFailRate,
    isSingleClause: this.isSingleClause,
  };
}
```

### MonteCarloSimulator Changes

The key challenge: we need to know if ALL OTHER clauses passed before we can record last-mile stats. This requires a two-phase approach per sample:

```javascript
#evaluateWithTracking(context) {
  const clauseResults = [];

  // Phase 1: Evaluate all clauses and record results
  for (const node of this.#clauseNodes) {
    const passed = this.#evaluateHierarchicalNode(node, context);
    clauseResults.push({ node, passed });
    // recordEvaluation already called inside evaluation
  }

  // Phase 2: Calculate last-mile for each clause
  for (let i = 0; i < clauseResults.length; i++) {
    const { node: currentNode, passed: currentPassed } = clauseResults[i];

    // Check if all OTHER clauses passed
    const othersPassed = clauseResults.every((result, j) =>
      j === i || result.passed
    );

    if (othersPassed) {
      currentNode.recordOthersPassed();

      if (!currentPassed) {
        currentNode.recordLastMileFail();
      }
    }

    // Also compute last-mile for leaf nodes within hierarchical structure
    this.#recordLastMileForLeaves(currentNode, clauseResults, i);
  }

  // Return overall pass (all clauses must pass)
  return clauseResults.every(r => r.passed);
}

/**
 * Recursively record last-mile stats for leaf nodes within a hierarchical clause
 * This enables last-mile tracking at BOTH top-level and leaf level
 */
#recordLastMileForLeaves(node, allTopLevelResults, currentTopLevelIndex) {
  if (node.nodeType === 'leaf') {
    // For leaf nodes within hierarchical clauses, we compute last-mile
    // relative to other TOP-LEVEL clauses (not sibling leaves)
    // This is a simplification; full leaf-level analysis is more complex
    return;
  }

  // Recurse for compound nodes
  for (const child of node.children) {
    this.#recordLastMileForLeaves(child, allTopLevelResults, currentTopLevelIndex);
  }
}
```

Handle single-clause prerequisites:

```javascript
#initializeClauseNodes(expression) {
  // ... existing initialization ...

  // Mark single-clause case
  const isSingle = this.#clauseNodes.length === 1;
  for (const node of this.#clauseNodes) {
    node.isSingleClause = isSingle;
  }
}
```

Update `ClauseResult` typedef:

```javascript
/**
 * @typedef {Object} ClauseResult
 * @property {number|null} lastMileFailRate - NEW: Failure rate when others pass
 * @property {Object} lastMileContext - NEW: Detailed last-mile info
 * @property {number} lastMileContext.othersPassedCount
 * @property {number} lastMileContext.lastMileFailCount
 * @property {boolean} isSingleClause - NEW: Whether this is the only clause
 */
```

### Edge Cases

1. **Single-clause prerequisite**: Last-mile rate = failure rate (it's always the "last mile")
   - Mark with `isSingleClause: true` to avoid confusion in UI
2. **All clauses always pass**: `othersPassedCount = sampleCount`, `lastMileFailCount = 0`
3. **One clause always fails first**: Other clauses have `othersPassedCount = 0`
4. **Hierarchical AND/OR**: Track last-mile at top-level prerequisites; leaf-level tracking is for future enhancement

### Display Format (for reference in UI tickets)

```
fail_all: 47%
fail_when_others_pass: 82% ← tune this first
```

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/ --verbose
```

**New unit tests for HierarchicalClauseNode:**

1. `recordLastMileFail() and recordOthersPassed() track correctly`:
   ```javascript
   it('should track last-mile failures', () => {
     const node = new HierarchicalClauseNode({ type: 'leaf', logic: {} });

     node.recordOthersPassed();
     node.recordOthersPassed();
     node.recordLastMileFail();  // Only one of the two samples

     expect(node.othersPassedCount).toBe(2);
     expect(node.lastMileFailCount).toBe(1);
     expect(node.lastMileFailRate).toBe(0.5);
   });
   ```

2. `lastMileFailRate returns null when othersPassedCount is zero`:
   ```javascript
   it('should return null when no samples had others pass', () => {
     const node = new HierarchicalClauseNode({ type: 'leaf', logic: {} });
     expect(node.lastMileFailRate).toBeNull();
   });
   ```

3. `resetStats() clears last-mile tracking`:
   ```javascript
   it('should reset last-mile tracking', () => {
     const node = new HierarchicalClauseNode({ type: 'leaf', logic: {} });
     node.recordOthersPassed();
     node.recordLastMileFail();
     node.resetStats();

     expect(node.othersPassedCount).toBe(0);
     expect(node.lastMileFailCount).toBe(0);
   });
   ```

4. `toJSON() includes last-mile fields`:
   ```javascript
   it('should include last-mile fields in toJSON()', () => {
     const node = new HierarchicalClauseNode({ type: 'leaf', logic: {} });
     node.recordOthersPassed();
     node.recordLastMileFail();

     const json = node.toJSON();

     expect(json).toHaveProperty('lastMileFailRate', 1);
     expect(json).toHaveProperty('lastMileFailCount', 1);
     expect(json).toHaveProperty('othersPassedCount', 1);
   });
   ```

**New unit tests for MonteCarloSimulator:**

1. `Last-mile rate is higher than overall for decisive blockers`:
   ```javascript
   it('should identify decisive blocker with high last-mile rate', () => {
     // Expression where clause A rarely fails alone, but clause B often fails when A passes
     const result = simulator.simulate(decisiveBlockerExpression, {
       sampleCount: 5000,
       trackClauses: true
     });

     // Find the clause with highest last-mile rate
     const maxLastMile = Math.max(
       ...result.clauseFailures.map(c => c.lastMileFailRate ?? 0)
     );
     expect(maxLastMile).toBeGreaterThan(0);
   });
   ```

2. `Single-clause expression has isSingleClause true`:
   ```javascript
   it('should mark single-clause expressions', () => {
     const result = simulator.simulate(singleClauseExpression, {
       trackClauses: true
     });

     expect(result.clauseFailures[0].isSingleClause).toBe(true);
   });
   ```

3. `Multi-clause expression has last-mile context`:
   ```javascript
   it('should include lastMileContext for multi-clause expressions', () => {
     const result = simulator.simulate(multiClauseExpression, {
       sampleCount: 1000,
       trackClauses: true
     });

     result.clauseFailures.forEach(clause => {
       expect(clause).toHaveProperty('lastMileFailRate');
       expect(clause.lastMileContext).toBeDefined();
       expect(clause.lastMileContext).toHaveProperty('othersPassedCount');
       expect(clause.lastMileContext).toHaveProperty('lastMileFailCount');
     });
   });
   ```

### Invariants That Must Remain True

1. **Existing tests pass** - All current tests must continue to pass
2. **Simulation results unchanged** - triggerRate, clauseFailures array length unchanged
3. **lastMileFailRate bounds** - Always in [0, 1] or null
4. **Consistency**: `lastMileFailCount <= othersPassedCount`
5. **Single clause**: For single-clause expressions, `lastMileFailRate ≈ failureRate`

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

- [x] `#lastMileFailCount` and `#othersPassedCount` fields added
- [x] `recordLastMileFail()` and `recordOthersPassed()` methods implemented
- [x] `lastMileFailRate` getter implemented
- [x] `isSingleClause` property added
- [x] `resetStats()` clears last-mile tracking
- [x] `toJSON()` includes last-mile fields
- [x] MonteCarloSimulator evaluates all clauses before recording last-mile
- [x] Two-phase evaluation implemented (evaluate all, then record last-mile)
- [x] Single-clause case handled correctly
- [x] `ClauseResult` typedef updated with `lastMileContext`
- [x] Unit tests for last-mile counting
- [x] Unit tests for rate calculation
- [x] Unit tests for single-clause case
- [x] Integration test for decisive blocker detection
- [x] All existing tests pass
- [x] No type errors
