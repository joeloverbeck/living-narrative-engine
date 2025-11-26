# ARMSYSANA-004: Update Priority Constants for Armor Support

**Phase**: Phase 2 - Priority System Update
**Priority**: Critical
**Risk Level**: Medium
**Estimated Effort**: 30 minutes
**Status**: ✅ COMPLETED

## Context

The priority system for clothing coverage resolution is implemented in `src/scopeDsl/prioritySystem/priorityConstants.js`. It uses two priority systems:

1. **Coverage Priority**: Determines which coverage layer wins (outer > base > underwear > direct)
2. **Layer Priority Within Coverage**: Tiebreaker when items have the same coverage priority

Currently, these systems don't include "armor" as a priority tier. This ticket adds armor priority constants to properly handle armor coverage resolution.

## Objective

Update the priority constants in `src/scopeDsl/prioritySystem/priorityConstants.js` to include armor priority, positioning armor between outer and base layers in the priority hierarchy.

## Current State

**Actual location**: `src/scopeDsl/prioritySystem/priorityConstants.js` (NOT `slotAccessResolver.js` as previously documented)

```javascript
// src/scopeDsl/prioritySystem/priorityConstants.js

export const COVERAGE_PRIORITY = Object.freeze({
  outer: 100,
  base: 200,
  underwear: 300,
  direct: 400,
});

export const LAYER_PRIORITY_WITHIN_COVERAGE = Object.freeze({
  outer: 10,
  base: 20,
  underwear: 30,
  accessories: 40,
});

export const VALID_COVERAGE_PRIORITIES = Object.freeze([
  'outer',
  'base',
  'underwear',
  'direct',
]);

export const VALID_LAYERS = Object.freeze([
  'outer',
  'base',
  'underwear',
  'accessories',
]);
```

### Corrected Assumptions

| Original Ticket Assumption | Actual Codebase |
|---------------------------|-----------------|
| Constants in `slotAccessResolver.js` | Constants in `priorityConstants.js` |
| `COVERAGE_PRIORITY` has `accessories: 350` | `accessories` is only in `LAYER_PRIORITY_WITHIN_COVERAGE` |
| 4 locations to update | 4 locations to update (constants + arrays) |

## Target State

Add armor priority constants between outer and base:

```javascript
export const COVERAGE_PRIORITY = Object.freeze({
  outer: 100,
  armor: 150,      // NEW: Armor has priority between outer and base
  base: 200,
  underwear: 300,
  direct: 400,
});

export const LAYER_PRIORITY_WITHIN_COVERAGE = Object.freeze({
  outer: 10,
  armor: 15,       // NEW: Armor layer priority
  base: 20,
  underwear: 30,
  accessories: 40,
});

export const VALID_COVERAGE_PRIORITIES = Object.freeze([
  'outer',
  'armor',         // NEW
  'base',
  'underwear',
  'direct',
]);

export const VALID_LAYERS = Object.freeze([
  'outer',
  'armor',         // NEW
  'base',
  'underwear',
  'accessories',
]);
```

## Priority Hierarchy Explanation

With these changes, the coverage resolution order will be:

1. **outer (100)**: Cloaks, robes, long coats (most visible)
2. **armor (150)**: Cuirasses, chainmail, plate armor
3. **base (200)**: Regular clothing (shirts, pants, boots)
4. **underwear (300)**: Undergarments
5. **direct (400)**: Fallback for uncovered body parts

**Lower numbers = higher visibility priority**

### Example Scenarios

**Scenario 1**: Character wearing shirt (base), chainmail (armor), and cloak (outer)
- Cloak is visible (priority 100)
- Chainmail is hidden by cloak
- Shirt is hidden by both

**Scenario 2**: Character wearing shirt (base) and chainmail (armor), no cloak
- Chainmail is visible (priority 150)
- Shirt is hidden by chainmail

**Scenario 3**: Character wearing chainmail (armor) under leather jacket (outer)
- Leather jacket is visible (priority 100)
- Chainmail is hidden by jacket

## Implementation Steps

### 1. Locate the Priority Constants

File: `src/scopeDsl/prioritySystem/priorityConstants.js`

### 2. Add Armor to COVERAGE_PRIORITY

```javascript
export const COVERAGE_PRIORITY = Object.freeze({
  outer: 100,
  armor: 150,      // ADD THIS LINE
  base: 200,
  underwear: 300,
  direct: 400,
});
```

### 3. Add Armor to LAYER_PRIORITY_WITHIN_COVERAGE

```javascript
export const LAYER_PRIORITY_WITHIN_COVERAGE = Object.freeze({
  outer: 10,
  armor: 15,       // ADD THIS LINE
  base: 20,
  underwear: 30,
  accessories: 40,
});
```

### 4. Add Armor to VALID_COVERAGE_PRIORITIES

```javascript
export const VALID_COVERAGE_PRIORITIES = Object.freeze([
  'outer',
  'armor',         // ADD THIS LINE
  'base',
  'underwear',
  'direct',
]);
```

### 5. Add Armor to VALID_LAYERS

```javascript
export const VALID_LAYERS = Object.freeze([
  'outer',
  'armor',         // ADD THIS LINE
  'base',
  'underwear',
  'accessories',
]);
```

## Testing Requirements

### Unit Tests

Update existing unit tests in `tests/unit/scopeDsl/prioritySystem/priorityConstants.test.js`:

1. Update count expectations from 4 to 5 for arrays with armor
2. Add specific armor value tests
3. Update ordering tests to include armor
4. Update spacing tests (armor breaks 100 spacing in COVERAGE_PRIORITY)

### New Test Cases

```javascript
describe('Armor Priority Integration', () => {
  it('should have armor in COVERAGE_PRIORITY between outer and base', () => {
    expect(COVERAGE_PRIORITY.armor).toBe(150);
    expect(COVERAGE_PRIORITY.outer).toBeLessThan(COVERAGE_PRIORITY.armor);
    expect(COVERAGE_PRIORITY.armor).toBeLessThan(COVERAGE_PRIORITY.base);
  });

  it('should have armor in LAYER_PRIORITY_WITHIN_COVERAGE between outer and base', () => {
    expect(LAYER_PRIORITY_WITHIN_COVERAGE.armor).toBe(15);
    expect(LAYER_PRIORITY_WITHIN_COVERAGE.outer).toBeLessThan(LAYER_PRIORITY_WITHIN_COVERAGE.armor);
    expect(LAYER_PRIORITY_WITHIN_COVERAGE.armor).toBeLessThan(LAYER_PRIORITY_WITHIN_COVERAGE.base);
  });

  it('should include armor in validation arrays', () => {
    expect(VALID_COVERAGE_PRIORITIES).toContain('armor');
    expect(VALID_LAYERS).toContain('armor');
  });
});
```

## Validation Steps

After implementation:

1. **Run unit tests**
   ```bash
   npm run test:unit -- tests/unit/scopeDsl/prioritySystem/priorityConstants.test.js
   ```

2. **Run related integration tests**
   ```bash
   npm run test:integration -- tests/integration/scopeDsl/
   ```

3. **Run full test suite**
   ```bash
   npm run test:ci
   ```

4. **Lint the modified file**
   ```bash
   npx eslint src/scopeDsl/prioritySystem/priorityConstants.js
   ```

5. **Type check**
   ```bash
   npm run typecheck
   ```

## Impact Assessment

- **priorityConstants.js**: ⚠️ Core update required
- **Coverage Resolution**: ⚠️ Behavior changes for armor
- **Existing Clothing**: ✅ Unaffected (armor is additive)
- **Performance**: ✅ Minimal impact (just constant lookup)
- **Tests**: ⚠️ Some existing tests need updates for new array lengths

## Success Criteria

- [x] `COVERAGE_PRIORITY` includes armor at priority 150
- [x] `LAYER_PRIORITY_WITHIN_COVERAGE` includes armor at priority 15
- [x] `VALID_COVERAGE_PRIORITIES` includes 'armor'
- [x] `VALID_LAYERS` includes 'armor'
- [x] Unit tests pass for armor priority resolution
- [x] `npm run test:ci` passes without errors
- [x] No ESLint errors in modified file
- [x] Type checking passes

## Related Tickets

- **Previous**: ARMSYSANA-003 (Run Validation Suite)
- **Next**: ARMSYSANA-005 (Update Coverage Logic)
- **Related**: ARMSYSANA-002 (Coverage Mapping Schema)
- **Depends On**: ARMSYSANA-001, ARMSYSANA-002, ARMSYSANA-003

## Notes

This is a **critical Phase 2 ticket**. Without these priority constants, armor entities will not be handled correctly by the coverage resolution system.

The priority values (150 and 15) were chosen to position armor between outer and base layers:
- Outer (100) > Armor (150) > Base (200)
- This allows armor to be worn under outer garments but over regular clothing

## Reference

Coverage priority scoring from actual system:
- `outer`: 100 (highest visibility)
- `armor`: 150 (NEW)
- `base`: 200
- `underwear`: 300
- `direct`: 400 (fallback)

Layer priority within coverage:
- `outer`: 10
- `armor`: 15 (NEW)
- `base`: 20
- `underwear`: 30
- `accessories`: 40

These values are well-established in the codebase and should not be changed. Armor is inserted between outer (100/10) and base (200/20) to maintain backward compatibility.

---

## Outcome

**Completed**: 2025-11-25

### What Was Actually Changed vs Originally Planned

**Originally Planned (Incorrect Assumptions)**:
- Expected constants to be in `src/scopeDsl/nodes/slotAccessResolver.js`
- Expected `COVERAGE_PRIORITY` to include `accessories: 350`
- Expected only 2 constants to update

**What Was Actually Changed**:
1. **Corrected ticket assumptions** - Updated ticket to reflect actual codebase structure:
   - Constants are in `src/scopeDsl/prioritySystem/priorityConstants.js`
   - `COVERAGE_PRIORITY` has: outer(100), base(200), underwear(300), direct(400)
   - `LAYER_PRIORITY_WITHIN_COVERAGE` has: outer(10), base(20), underwear(30), accessories(40)
   - 4 locations need updating (2 priority objects + 2 validation arrays)

2. **Code changes** in `src/scopeDsl/prioritySystem/priorityConstants.js`:
   - Added `armor: 150` to `COVERAGE_PRIORITY`
   - Added `armor: 15` to `LAYER_PRIORITY_WITHIN_COVERAGE`
   - Added `'armor'` to `VALID_COVERAGE_PRIORITIES` array
   - Added `'armor'` to `VALID_LAYERS` array

3. **Test updates** in `tests/unit/scopeDsl/prioritySystem/priorityConstants.test.js`:
   - Updated array length expectations from 4 to 5
   - Updated spacing tests to ordering tests (armor breaks uniform spacing)
   - Added specific armor value tests
   - Added new `Armor Priority Integration` test suite with 5 tests:
     - Armor positioning in COVERAGE_PRIORITY
     - Armor positioning in LAYER_PRIORITY_WITHIN_COVERAGE
     - Armor in validation arrays
     - Unique priority calculations with armor
     - Armor layering hierarchy validation

### Test Results
- All 41 unit tests pass in `priorityConstants.test.js`
- All 2127 scopeDsl tests pass (unit + integration)
- All 277 clothing integration tests pass
- No regressions introduced

### Files Modified
- `src/scopeDsl/prioritySystem/priorityConstants.js` (4 edits)
- `tests/unit/scopeDsl/prioritySystem/priorityConstants.test.js` (6 edits + new test suite)
