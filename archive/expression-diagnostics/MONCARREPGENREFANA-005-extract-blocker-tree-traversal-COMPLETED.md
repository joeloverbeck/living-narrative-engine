# MONCARREPGENREFANA-005: Extract BlockerTreeTraversal

## Summary

Extract 14 OR/AND tree traversal methods from MonteCarloReportGenerator into a dedicated BlockerTreeTraversal service. These methods operate on hierarchical blocker trees and calculate pass rates, overlaps, and unions.

## Priority: High | Effort: Medium | Risk: MEDIUM

## Rationale

These methods:
- All operate on hierarchical blocker trees
- Well-tested through orOverlap.test.js and orUnion.test.js
- Form a cohesive domain for tree analysis
- All pure functions with no external dependencies

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/BlockerTreeTraversal.js` | **Create** - New service (~200 lines) |
| `tests/unit/expressionDiagnostics/services/blockerTreeTraversal.test.js` | **Create** - Unit tests |
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | **Modify** - Remove methods, add service usage |
| `src/expressionDiagnostics/services/index.js` | **Modify** - Export new service |

> **Note**: MonteCarloReportWorker.js does NOT need modification - BlockerTreeTraversal is created internally by MonteCarloReportGenerator using the same pattern as StatisticalComputationService.

## Out of Scope

- **DO NOT** change StatisticalComputationService
- **DO NOT** change ReportDataExtractor
- **DO NOT** change section generators (they will use this service)
- **DO NOT** change integrity analysis methods
- **DO NOT** modify DI registrations

## Methods to Extract

```javascript
// Tree flattening
#flattenLeaves(node, leaves)
#collectOrBlocks(blockers)
#collectFunnelLeaves({ blockers, clauseFailures })
#buildStructuredTree(node)

// OR calculations
#calculateOrPassRate(orNode)
#calculateOrInRegimeFailureRate(orNode)
#resolveOrUnionCount(orNode)
#resolveOrUnionInRegimeCount(orNode)

// Tree analysis
#isAndOnlyBlockers(blockers)
#isAndOnlyBreakdown(node)
#isEmotionThresholdLeaf(leaf)

// Finding methods
#findDominantSuppressor(orNode)
#findMostTunableLeaf(leaves)
#findWorstLastMileLeaf(leaves)
```

## Implementation Details

### Service Structure

```javascript
/**
 * @file BlockerTreeTraversal - OR/AND tree traversal for blocker analysis
 * All methods are pure functions with no external dependencies.
 */

class BlockerTreeTraversal {
  // Tree flattening
  flattenLeaves(node, results = []) { /* recursive tree flattening */ }
  collectOrBlocks(blockers) { /* deduplication */ }
  collectFunnelLeaves({ blockers, clauseFailures }) { /* prefer clauseFailures */ }
  buildStructuredTree(node) { /* recursive transform */ }

  // OR calculations
  calculateOrPassRate(orNode) { /* from evaluationCount/failureCount */ }
  calculateOrInRegimeFailureRate(orNode) { /* in-regime rate */ }
  resolveOrUnionCount(orNode) { /* with fallback */ }
  resolveOrUnionInRegimeCount(orNode) { /* with fallback */ }

  // Tree analysis
  isAndOnlyBlockers(blockers) { /* validate no OR nodes */ }
  isAndOnlyBreakdown(node) { /* recursive check */ }
  isEmotionThresholdLeaf(leaf) { /* variablePath pattern */ }

  // Finding methods
  findDominantSuppressor(axisContributions) { /* min contribution */ }
  findMostTunableLeaf(hb) { /* highest impact score */ }
  findWorstLastMileLeaf(hb) { /* highest lastMileFailRate */ }
}

export default BlockerTreeTraversal;
```

### Integration Pattern

In MonteCarloReportGenerator:
```javascript
constructor(deps) {
  // ... existing
  this.#treeTraversal = deps.treeTraversal ?? new BlockerTreeTraversal();
}
```

> **Note**: No statisticsService dependency needed - all 14 methods are pure functions.

## Acceptance Criteria

### Tests That Must Pass

1. **New BlockerTreeTraversal unit tests:**
   ```bash
   npm run test:unit -- tests/unit/expressionDiagnostics/services/blockerTreeTraversal.test.js --verbose
   ```

2. **Existing OR tests still pass:**
   ```bash
   npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.orOverlap.test.js --verbose
   npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.orUnion.test.js --verbose
   ```

3. **Snapshot test unchanged:**
   ```bash
   npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --verbose
   ```

### Invariants That Must Remain True

1. **Report output identical**: Snapshot test must pass unchanged
2. **Internal creation pattern**: Service is created internally if not injected (like StatisticalComputationService)
3. **Tree traversal accuracy**: All OR/AND calculations match original
4. **Recursive safety**: No stack overflow on deep trees

## Verification Commands

```bash
# Run new unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/blockerTreeTraversal.test.js --verbose

# Verify OR tests still pass
npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.orOverlap.test.js --verbose
npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.orUnion.test.js --verbose

# Verify snapshot unchanged
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --verbose

# Run all related tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator --verbose

# Lint new files
npx eslint src/expressionDiagnostics/services/BlockerTreeTraversal.js
```

## Definition of Done

- [x] BlockerTreeTraversal.js created with all 14 methods
- [x] Unit tests cover all methods including recursive edge cases
- [x] MonteCarloReportGenerator.js updated to use service (internal creation pattern)
- [x] index.js exports new service
- [x] Snapshot test passes unchanged
- [x] orOverlap.test.js and orUnion.test.js pass
- [x] ~200 lines removed from MonteCarloReportGenerator.js

## Dependencies

- **Requires**: None (all methods are pure functions)
- **Blocks**: MONCARREPGENREFANA-010 (BlockerSectionGenerator uses this)

## Outcome

**Status**: ✅ COMPLETED

### Changes Made

1. **Created `BlockerTreeTraversal.js`** (409 lines)
   - All 14 pure functions extracted
   - Tree flattening: `flattenLeaves`, `collectOrBlocks`, `collectFunnelLeaves`, `buildStructuredTree`
   - OR calculations: `calculateOrPassRate`, `calculateOrInRegimeFailureRate`, `resolveOrUnionCount`, `resolveOrUnionInRegimeCount`
   - Tree analysis: `isAndOnlyBlockers`, `isAndOnlyBreakdown`, `isEmotionThresholdLeaf`
   - Finding methods: `findDominantSuppressor`, `findMostTunableLeaf`, `findWorstLastMileLeaf`

2. **Updated `MonteCarloReportGenerator.js`**
   - Added import for BlockerTreeTraversal
   - Added `#treeTraversal` private field
   - Constructor accepts optional `treeTraversal` parameter with internal creation fallback
   - Replaced all 14 method calls to use service
   - Deleted all 14 private method definitions

3. **Updated `index.js`**
   - Added export for BlockerTreeTraversal

4. **Created `blockerTreeTraversal.test.js`** (82 tests)
   - Comprehensive coverage for all 14 methods
   - Edge cases: null inputs, empty arrays, deep nesting, deduplication
   - Fallback logic testing for OR calculations

### Test Results

- **Unit tests (blockerTreeTraversal.test.js)**: 82/82 passed ✅
- **orOverlap.test.js**: 1/1 passed ✅
- **orUnion.test.js**: 1/1 passed ✅
- **Snapshot integration tests**: 8/8 passed ✅

### Ticket Corrections Applied

The original ticket had incorrect assumptions:
- Removed references to `statisticsService` dependency (methods are pure functions)
- Clarified that MonteCarloReportWorker.js does NOT need modification
- Updated constructor pattern to match actual implementation
