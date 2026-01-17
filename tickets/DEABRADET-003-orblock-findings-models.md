# DEABRADET-003: OrBlock and DeadBranchFindings Data Models

## Description

Create the OrBlock and DeadBranchFindings models that aggregate alternatives and findings across OR blocks.

## Files to Create

- `src/expressionDiagnostics/models/OrBlock.js`
- `src/expressionDiagnostics/models/DeadBranchFindings.js`
- `tests/unit/expressionDiagnostics/models/OrBlock.test.js`
- `tests/unit/expressionDiagnostics/models/DeadBranchFindings.test.js`

## Files to Modify

- `src/expressionDiagnostics/models/index.js` - Add exports for OrBlock and DeadBranchFindings

## Out of Scope

- Alternative creation logic (handled by DEABRADET-002)
- Detection logic (DEABRADET-007)
- Service integration
- Report rendering

## Implementation Details

### OrBlock.js

Must export:
- `POPULATION_TYPES` - frozen array `['mood-regime', 'global', 'stored-mood-regime']`
- `isValidPopulationType(type)` - validator function
- `computeEffectiveAlternativeCount(alternatives)` - pure function counting non-DEAD_BRANCH
- `createOrBlock(props)` - factory function

**OrBlock shape**:
```javascript
{
  id: string,                       // Stable path/node ID
  population: 'mood-regime' | 'global' | 'stored-mood-regime',
  support: number,                  // N samples evaluated
  alternatives: Alternative[],      // List of alternatives
  effectiveAlternativeCount: number, // Count where status != DEAD_BRANCH
}
```

### DeadBranchFindings.js

Must export:
- `computeTotalDeadBranches(orBlocks)` - pure function summing DEAD_BRANCH across all OR blocks
- `computeCollapsedOrBlocks(orBlocks)` - pure function counting OR blocks where effectiveCount === 1
- `createDeadBranchFindings(props)` - factory function

**DeadBranchFindings shape**:
```javascript
{
  orBlocks: OrBlock[],
  totalDeadBranches: number,
  collapsedOrBlocks: number,  // Count where effectiveAlternativeCount == 1
}
```

### Computation Logic

```javascript
// effectiveAlternativeCount
function computeEffectiveAlternativeCount(alternatives) {
  return alternatives.filter(alt => alt.status !== 'DEAD_BRANCH').length;
}

// totalDeadBranches
function computeTotalDeadBranches(orBlocks) {
  return orBlocks.reduce((sum, block) =>
    sum + block.alternatives.filter(alt => alt.status === 'DEAD_BRANCH').length, 0);
}

// collapsedOrBlocks
function computeCollapsedOrBlocks(orBlocks) {
  return orBlocks.filter(block => block.effectiveAlternativeCount === 1).length;
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **OrBlock.test.js**:
   - `createOrBlock()` creates valid object with all required fields
   - `createOrBlock()` throws when `id` is missing
   - `createOrBlock()` throws when `population` is invalid
   - `createOrBlock()` throws when `support` is not a number
   - `createOrBlock()` throws when `alternatives` is not an array
   - `computeEffectiveAlternativeCount()` counts non-DEAD_BRANCH alternatives
   - `computeEffectiveAlternativeCount([])` returns 0 for empty array
   - `computeEffectiveAlternativeCount()` with all DEAD_BRANCH returns 0
   - `computeEffectiveAlternativeCount()` with mixed statuses returns correct count
   - Created objects are frozen (immutable)
   - `alternatives` array is frozen
   - `isValidPopulationType()` validates correctly

2. **DeadBranchFindings.test.js**:
   - `createDeadBranchFindings()` creates valid object
   - `createDeadBranchFindings()` throws when `orBlocks` is not an array
   - `computeTotalDeadBranches()` sums DEAD_BRANCH across all blocks
   - `computeTotalDeadBranches([])` returns 0 for empty array
   - `computeCollapsedOrBlocks()` counts blocks with effectiveCount === 1
   - `computeCollapsedOrBlocks([])` returns 0 for empty array
   - Created objects are frozen (immutable)
   - `orBlocks` array is frozen

### Invariants That Must Remain True

1. All computed counts derived from alternatives array (no stale cached values)
2. `effectiveAlternativeCount` is always computed fresh when creating OrBlock
3. All created objects and nested arrays are frozen
4. Computation functions are pure (no side effects)
5. Existing tests in `tests/unit/expressionDiagnostics/models/` continue to pass
6. `npm run typecheck` passes
7. `npx eslint src/expressionDiagnostics/models/OrBlock.js src/expressionDiagnostics/models/DeadBranchFindings.js` passes

## Dependencies

- DEABRADET-002 (Alternative model used in OrBlock.alternatives array)

## Estimated Diff Size

~180 lines of source code + ~280 lines of tests = ~460 lines total
