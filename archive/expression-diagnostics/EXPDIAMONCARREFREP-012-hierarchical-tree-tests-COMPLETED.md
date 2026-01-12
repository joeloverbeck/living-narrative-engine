# EXPDIAMONCARREFREP-012: Add MonteCarloSimulator Hierarchical Tree Tests

## Summary
Add missing tests for hierarchical clause tree building and evaluation via the public `simulate()` API. The report identified that tree traversal and clause tracking for compound AND/OR trees are not explicitly tested. Note: the relevant helpers are private (`#buildHierarchicalTree`, `#evaluateHierarchicalNode`, `#extractCeilingData`, `#describeLeafCondition`, `#describeOperand`), so tests must assert their effects through `clauseFailures[].hierarchicalBreakdown` and related fields on the simulation result.

## Status
Completed

## Files to Create

| File | Action | Description |
|------|--------|-------------|
| `tests/unit/expressionDiagnostics/services/monteCarloSimulator.hierarchical.test.js` | Create | Tests for hierarchical tree behavior via `simulate()` |

## Out of Scope

- **DO NOT** modify any production code
- **DO NOT** modify existing `monteCarloSimulator.test.js`
- **DO NOT** modify `HierarchicalClauseNode.test.js`
- **DO NOT** add integration tests

## Acceptance Criteria

### Tests That Must Be Added (via `simulate()`)

#### Tree Construction (hierarchicalBreakdown)
1. Leaf node created for simple comparison logic
2. AND node created with multiple children and correct parentNodeType for children
3. OR node created with multiple children and correct parentNodeType for children
4. Nested AND/OR structure retained in hierarchicalBreakdown
5. Leaf descriptions reflect `describeLeafCondition` output for basic comparisons (e.g., `emotions.joy > 0.5`)
6. Leaf threshold metadata captured (thresholdValue, comparisonOperator, variablePath)

#### Evaluation + Stats (hierarchicalBreakdown)
1. Leaf evaluation updates evaluationCount/failureCount for pass and fail cases
2. AND node failure when any child fails, with sibling-conditioned stats tracked
3. OR node success when any child passes, with orContributionCount/orSuccessCount tracked

#### Ceiling + Clause Outputs (clauseFailures)
1. clauseFailures includes ceilingGap/maxObserved/thresholdValue from worst leaf in a compound tree
2. last-mile stats updated for multi-clause expressions (lastMileFailRate/othersPassedCount)

### Test Coverage Target
- Hierarchical tree behavior verified through simulation results
- All tree node types validated via hierarchicalBreakdown JSON

### Invariants That Must Remain True
1. Tests follow existing patterns in `monteCarloSimulator.test.js`
2. Tests use mock dependencies consistently
3. No production code modifications

## Implementation Notes

- The hierarchical methods are private; assertions should be made using:
  - `result.clauseFailures[].hierarchicalBreakdown` (tree structure + stats)
  - `result.clauseFailures[].ceilingGap/maxObserved/thresholdValue`
  - `result.clauseFailures[].lastMileFailRate/othersPassedCount`
- Use deterministic mocks for `randomStateGenerator` and `emotionCalculatorAdapter` to avoid flaky randomness.

## Verification Commands
```bash
npm run test:unit -- --testPathPatterns="monteCarloSimulator.hierarchical" --coverage=false
```

## Dependencies
- **Depends on**: None (can run independently)
- **Blocks**: None

## Outcome
- Added hierarchical tracking tests via `simulate()` output instead of private method access.
- Validated tree structure, evaluation stats, ceiling selection, and last-mile metrics with deterministic mocks.
