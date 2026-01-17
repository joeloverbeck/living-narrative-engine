# DEABRADET-002: Alternative Data Model

## Description

Create the Alternative model representing a single alternative within an OR block, including status derivation logic and arrays for evidence/constraints.

## Files to Create

- `src/expressionDiagnostics/models/Alternative.js`
- `tests/unit/expressionDiagnostics/models/Alternative.test.js`

## Files to Modify

- `src/expressionDiagnostics/models/index.js` - Add exports for Alternative

## Out of Scope

- OrBlock model (DEABRADET-003)
- DeadBranchFindings model (DEABRADET-003)
- ID generation logic (DEABRADET-004) - accept ID as input parameter
- Structural impossibility analysis (DEABRADET-005)
- Any service logic

## Implementation Details

### Alternative.js

Must export:
- `ALTERNATIVE_KINDS` - frozen array `['leaf', 'and_group']`
- `ALTERNATIVE_STATUSES` - frozen array `['ACTIVE', 'RARE', 'DEAD_BRANCH', 'UNOBSERVED']`
- `RARE_THRESHOLD` - constant `0.05` (5% pass rate threshold)
- `isValidAlternativeKind(kind)` - validator function
- `isValidAlternativeStatus(status)` - validator function
- `deriveAlternativeStatus({ passCount, passRate, hasStructuralImpossibility })` - pure function
- `createAlternative(props)` - factory function

**Alternative shape**:
```javascript
{
  id: string,                        // Stable hash-based ID (provided externally)
  kind: 'leaf' | 'and_group',        // Type of alternative
  clauseRefs: string[],              // Leaf clause references (sorted)
  passCount: number,                 // Pass count within population
  passRate: number,                  // Pass rate (0-1)
  support: number,                   // N samples evaluated
  status: AlternativeStatus,         // Computed status
  deadEvidence: DeadEvidence[],      // Evidence when DEAD_BRANCH
  limitingConstraints: LimitingConstraint[], // Constraints causing dead branch
}
```

### Status Derivation Logic

The `deriveAlternativeStatus()` function must implement:

```javascript
if (passCount > 0) {
  return passRate >= RARE_THRESHOLD ? 'ACTIVE' : 'RARE';
}
// passCount === 0
if (hasStructuralImpossibility) {
  return 'DEAD_BRANCH';
}
return 'UNOBSERVED';
```

**Critical invariant**: `passCount > 0` can NEVER yield `DEAD_BRANCH`.

### Clause Refs Sorting

The factory must sort `clauseRefs` alphabetically before storing to ensure order-invariance (spec invariant 1).

## Acceptance Criteria

### Tests That Must Pass

1. **Alternative.test.js**:
   - `createAlternative()` creates valid object with all required fields
   - `createAlternative()` throws when `id` is missing
   - `createAlternative()` throws when `kind` is invalid
   - `createAlternative()` throws when `clauseRefs` is not an array
   - `createAlternative()` throws when `passCount` is not a number
   - `createAlternative()` throws when `passRate` is not a number
   - `createAlternative()` throws when `support` is not a number
   - `createAlternative()` throws when `status` is invalid
   - `createAlternative()` sorts clauseRefs alphabetically
   - `createAlternative()` defaults empty arrays for `deadEvidence` and `limitingConstraints`
   - Created objects are frozen (immutable)
   - `clauseRefs` array is frozen
   - `deadEvidence` array is frozen
   - `limitingConstraints` array is frozen

2. **Status derivation tests**:
   - `deriveAlternativeStatus({ passCount: 100, passRate: 0.15, hasStructuralImpossibility: false })` → `'ACTIVE'`
   - `deriveAlternativeStatus({ passCount: 5, passRate: 0.01, hasStructuralImpossibility: false })` → `'RARE'`
   - `deriveAlternativeStatus({ passCount: 0, passRate: 0, hasStructuralImpossibility: true })` → `'DEAD_BRANCH'`
   - `deriveAlternativeStatus({ passCount: 0, passRate: 0, hasStructuralImpossibility: false })` → `'UNOBSERVED'`
   - `deriveAlternativeStatus({ passCount: 1, passRate: 0.001, hasStructuralImpossibility: true })` → `'RARE'` (NOT DEAD_BRANCH - spec invariant 4)

3. **Validator function tests**:
   - `isValidAlternativeKind()` returns true for 'leaf' and 'and_group'
   - `isValidAlternativeKind()` returns false for other values
   - `isValidAlternativeStatus()` returns true for all four statuses
   - `isValidAlternativeStatus()` returns false for other values

### Invariants That Must Remain True

1. **Spec invariant 4**: If `passCount > 0`, status can NEVER be `DEAD_BRANCH`
2. **Spec invariant 1**: `clauseRefs` stored in sorted order for order-invariance
3. All created objects and nested arrays are frozen
4. `deriveAlternativeStatus()` is a pure function with no side effects
5. Existing tests in `tests/unit/expressionDiagnostics/models/` continue to pass
6. `npm run typecheck` passes
7. `npx eslint src/expressionDiagnostics/models/Alternative.js` passes

## Dependencies

- DEABRADET-001 (DeadEvidence and LimitingConstraint types used in arrays)

## Estimated Diff Size

~150 lines of source code + ~250 lines of tests = ~400 lines total
