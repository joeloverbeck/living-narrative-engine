# MONCARADVMET-001: Add Threshold Extraction Infrastructure

## Status: COMPLETED

## Summary

Extract threshold values from JSON Logic conditions during hierarchical tree building. This is the foundational ticket that enables near-miss calculation (MONCARADVMET-006), max observed value tracking (MONCARADVMET-004), and ceiling gap analysis.

## Priority: High | Effort: Medium

## Rationale

Currently, the Monte Carlo simulator evaluates whether conditions pass/fail but doesn't preserve the threshold value used in comparisons. To compute metrics like "how close was the actual value to the threshold?" or "was the threshold ever achievable?", we need to extract and store the threshold from JSON Logic conditions like `{">=": [{"var": "emotions.joy"}, 0.55]}`.

## Dependencies

- None (this is a foundational ticket)

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | **Modify** |
| `src/expressionDiagnostics/models/HierarchicalClauseNode.js` | **Modify** |
| `tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js` | **Modify** |
| `tests/unit/expressionDiagnostics/models/HierarchicalClauseNode.test.js` | **Modify** |

## Out of Scope

- **DO NOT** modify `FailureExplainer.js` - that's MONCARADVMET-008
- **DO NOT** modify `ExpressionDiagnosticsController.js` - that's MONCARADVMET-009/010
- **DO NOT** add violation percentile tracking - that's MONCARADVMET-002/003
- **DO NOT** add near-miss detection logic - that's MONCARADVMET-006
- **DO NOT** add last-mile tracking - that's MONCARADVMET-007
- **DO NOT** modify expression schema or validation
- **DO NOT** change how existing metrics are calculated

## Implementation Details

### HierarchicalClauseNode Changes

Add a new private field to store the extracted threshold:

```javascript
class HierarchicalClauseNode {
  // Existing fields...

  // NEW: Threshold storage
  #thresholdValue = null;  // The numeric threshold from the condition
  #comparisonOperator = null;  // '>=', '<=', '>', '<', '=='
  #variablePath = null;  // e.g., 'emotions.joy', 'mood.valence'

  /**
   * Set threshold metadata for leaf nodes
   * @param {number|null} threshold - The threshold value
   * @param {string|null} operator - The comparison operator
   * @param {string|null} variablePath - The variable being compared
   */
  setThresholdMetadata(threshold, operator, variablePath) {
    this.#thresholdValue = threshold;
    this.#comparisonOperator = operator;
    this.#variablePath = variablePath;
  }

  /** @returns {number|null} */
  get thresholdValue() { return this.#thresholdValue; }

  /** @returns {string|null} */
  get comparisonOperator() { return this.#comparisonOperator; }

  /** @returns {string|null} */
  get variablePath() { return this.#variablePath; }
}
```

Update `toJSON()` to include new fields:

```javascript
toJSON() {
  return {
    // existing fields...
    thresholdValue: this.#thresholdValue,
    comparisonOperator: this.#comparisonOperator,
    variablePath: this.#variablePath,
  };
}
```

### MonteCarloSimulator Changes

Modify `#buildHierarchicalTree()` or the leaf node creation to extract threshold:

```javascript
#extractThresholdFromLogic(logic) {
  // Handle common patterns:
  // {">=": [{"var": "emotions.joy"}, 0.55]}
  // {"<=": [{"var": "mood.valence"}, 50]}
  // {"and": [...]} or {"or": [...]} - recurse

  const operators = ['>=', '<=', '>', '<', '=='];

  for (const op of operators) {
    if (logic[op]) {
      const [left, right] = logic[op];

      // Pattern: {"op": [{"var": "path"}, threshold]}
      if (left?.var && typeof right === 'number') {
        return {
          threshold: right,
          operator: op,
          variablePath: left.var
        };
      }

      // Pattern: {"op": [threshold, {"var": "path"}]} (reversed)
      if (right?.var && typeof left === 'number') {
        return {
          threshold: left,
          operator: this.#reverseOperator(op),
          variablePath: right.var
        };
      }
    }
  }

  return null; // Non-numeric or complex condition
}

#reverseOperator(op) {
  const reverseMap = {
    '>=': '<=',
    '<=': '>=',
    '>': '<',
    '<': '>',
    '==': '=='
  };
  return reverseMap[op] || op;
}
```

When building leaf nodes, call the extraction and set metadata:

```javascript
// In #buildLeafNode or equivalent
const thresholdInfo = this.#extractThresholdFromLogic(clause.logic);
if (thresholdInfo) {
  node.setThresholdMetadata(
    thresholdInfo.threshold,
    thresholdInfo.operator,
    thresholdInfo.variablePath
  );
}
```

### Edge Cases to Handle

1. **Boolean conditions** (e.g., `has_component`) - no threshold, return null
2. **Compound conditions** - AND/OR nodes don't have thresholds themselves
3. **Nested arithmetic** - e.g., `{">=": [{"*": [...]}, 0.5]}` - extract 0.5 as threshold
4. **String comparisons** - skip, no numeric threshold
5. **Missing var** - malformed logic, log warning and skip

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/ --verbose
```

**New unit tests to add:**

1. `HierarchicalClauseNode.test.js`:
   - `setThresholdMetadata() stores threshold, operator, and variablePath`
   - `toJSON() includes threshold metadata`
   - `thresholdValue getter returns null by default`

2. `monteCarloSimulator.test.js`:
   - `#extractThresholdFromLogic extracts from >=, <=, >, <, == operators`
   - `#extractThresholdFromLogic handles reversed operand order`
   - `#extractThresholdFromLogic returns null for boolean conditions`
   - `#extractThresholdFromLogic returns null for string comparisons`
   - `leaf nodes have threshold metadata after tree building`

### Invariants That Must Remain True

1. **Existing tests pass** - All current MonteCarloSimulator and HierarchicalClauseNode tests must continue to pass
2. **Simulation results unchanged** - `triggerRate`, `clauseFailures`, `averageViolation` must produce identical values
3. **toJSON structure compatible** - Existing consumers of toJSON output must not break (new fields are additive)
4. **No performance regression** - Tree building time should not increase by more than 5%

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/ --verbose

# Run specific test files
npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js --verbose
npm run test:unit -- tests/unit/expressionDiagnostics/models/HierarchicalClauseNode.test.js --verbose

# Verify no regression in existing tests
npm run test:unit -- --testPathPattern="expressionDiagnostics" --coverage

# Type check
npm run typecheck
```

## Definition of Done

- [x] `#thresholdValue`, `#comparisonOperator`, `#variablePath` fields added to HierarchicalClauseNode
- [x] `setThresholdMetadata()` method implemented
- [x] Getters for all three metadata fields implemented
- [x] `toJSON()` includes threshold metadata
- [x] `#extractThresholdFromLogic()` implemented in MonteCarloSimulator
- [x] Threshold extraction called during leaf node creation
- [x] Edge cases handled (boolean, string, compound conditions)
- [x] Unit tests for new HierarchicalClauseNode methods
- [x] Unit tests for threshold extraction logic
- [x] All existing tests pass
- [x] No type errors

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Ticket Assumptions**: All ticket assumptions were validated as accurate. No corrections to the ticket were needed.

**Implementation Changes**:

| Planned | Actual |
|---------|--------|
| Add 3 private fields to HierarchicalClauseNode | Done exactly as specified |
| Add `setThresholdMetadata()` method | Done exactly as specified |
| Add 3 getters | Done exactly as specified |
| Extend `toJSON()` | Done exactly as specified |
| Add `#extractThresholdFromLogic()` to MonteCarloSimulator | Done exactly as specified |
| Add `#reverseOperator()` helper | Done exactly as specified |
| Modify leaf node creation in 2 locations | Done exactly as specified |

**Test Changes**:

| Test File | Tests Added |
|-----------|-------------|
| `HierarchicalClauseNode.test.js` | 6 new tests in `describe('threshold metadata')` block |
| `monteCarloSimulator.test.js` | 11 new tests in `describe('Threshold extraction')` block |

**New Tests Added**:

1. **HierarchicalClauseNode.test.js** (6 tests):
   - `should have null threshold values by default`
   - `should store threshold metadata via setThresholdMetadata()`
   - `should include threshold metadata in toJSON()`
   - `should include null threshold metadata in toJSON() when not set`
   - `should handle all comparison operators`
   - `should handle integer threshold values`

2. **monteCarloSimulator.test.js** (11 tests):
   - `should extract threshold from >= operator`
   - `should extract threshold from <= operator`
   - `should extract threshold from > operator`
   - `should extract threshold from < operator`
   - `should extract threshold from == operator`
   - `should handle reversed operand order (threshold on left)`
   - `should return null threshold for boolean conditions`
   - `should return null threshold for string comparisons`
   - `should extract thresholds for leaf nodes in compound AND conditions`
   - `should extract thresholds for leaf nodes in compound OR conditions`
   - `should handle integer thresholds`

**Verification Results**:

- All 122 expression diagnostics tests pass
- All 32 HierarchicalClauseNode tests pass
- No type errors in the modified files
- No ESLint errors (only pre-existing JSDoc warnings)
- 100% line coverage on HierarchicalClauseNode.js
- 90.41% line coverage on MonteCarloSimulator.js

**Lines Changed**:
- `HierarchicalClauseNode.js`: +40 lines (fields, getters, setter, toJSON extension)
- `MonteCarloSimulator.js`: +55 lines (extraction methods, leaf node modification)
- `HierarchicalClauseNode.test.js`: +60 lines (6 new tests)
- `monteCarloSimulator.test.js`: +105 lines (11 new tests)

**Deviations from Plan**: None. Implementation matched ticket specifications exactly.
