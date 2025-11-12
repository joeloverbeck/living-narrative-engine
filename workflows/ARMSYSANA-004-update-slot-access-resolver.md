# ARMSYSANA-004: Update Slot Access Resolver Priority System

**Phase**: Phase 2 - Priority System Update
**Priority**: Critical
**Risk Level**: Medium
**Estimated Effort**: 30 minutes

## Context

The `SlotAccessResolver` is responsible for determining which clothing item is visible when multiple items cover the same body region. It uses two priority systems:

1. **Coverage Priority**: Determines which coverage layer wins (outer > base > underwear > accessories)
2. **Layer Priority Within Coverage**: Tiebreaker when items have the same coverage priority

Currently, these systems don't include "armor" as a priority tier. This ticket adds armor priority constants to properly handle armor coverage resolution.

## Objective

Update the `SlotAccessResolver` to include armor priority constants, positioning armor between outer and base layers in the priority hierarchy.

## Current State

From the documentation and codebase:

```javascript
// src/scopeDsl/nodes/slotAccessResolver.js

const COVERAGE_PRIORITY = {
  outer: 100,
  base: 200,
  underwear: 300,
  accessories: 350,
  direct: 400
};

const LAYER_PRIORITY_WITHIN_COVERAGE = {
  outer: 10,
  base: 20,
  underwear: 30,
  accessories: 40
};
```

## Target State

Add armor priority constants between outer and base:

```javascript
const COVERAGE_PRIORITY = {
  outer: 100,
  armor: 150,      // NEW: Armor has priority between outer and base
  base: 200,
  underwear: 300,
  accessories: 350,
  direct: 400
};

const LAYER_PRIORITY_WITHIN_COVERAGE = {
  outer: 10,
  armor: 15,       // NEW: Armor layer priority
  base: 20,
  underwear: 30,
  accessories: 40
};
```

## Priority Hierarchy Explanation

With these changes, the coverage resolution order will be:

1. **outer (100)**: Cloaks, robes, long coats (most visible)
2. **armor (150)**: Cuirasses, chainmail, plate armor
3. **base (200)**: Regular clothing (shirts, pants, boots)
4. **underwear (300)**: Undergarments
5. **accessories (350)**: Jewelry, belts, gloves
6. **direct (400)**: Fallback for uncovered body parts

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

### 1. Locate the SlotAccessResolver

File: `src/scopeDsl/nodes/slotAccessResolver.js`

### 2. Find the Priority Constants

Search for:
- `COVERAGE_PRIORITY` constant definition
- `LAYER_PRIORITY_WITHIN_COVERAGE` constant definition

### 3. Add Armor Priority to COVERAGE_PRIORITY

```javascript
const COVERAGE_PRIORITY = {
  outer: 100,
  armor: 150,      // ADD THIS LINE
  base: 200,
  underwear: 300,
  accessories: 350,
  direct: 400
};
```

### 4. Add Armor Priority to LAYER_PRIORITY_WITHIN_COVERAGE

```javascript
const LAYER_PRIORITY_WITHIN_COVERAGE = {
  outer: 10,
  armor: 15,       // ADD THIS LINE
  base: 20,
  underwear: 30,
  accessories: 40
};
```

### 5. Update Any Related Functions

Check if any functions in `slotAccessResolver.js` need updates:

- **Priority calculation functions**: May need to handle "armor" case
- **Coverage resolution logic**: May need armor-specific handling
- **Error handling**: Should recognize "armor" as valid priority

### 6. Update JSDoc Comments

If the file has JSDoc comments describing priority values, update them to include armor.

## Testing Requirements

### Unit Tests

Create or update unit tests for `slotAccessResolver.js`:

```javascript
// tests/unit/scopeDsl/nodes/slotAccessResolver.test.js

describe('SlotAccessResolver - Armor Priority', () => {
  it('should prioritize armor over base layer', () => {
    // Test that armor (150) beats base (200)
  });

  it('should prioritize outer over armor layer', () => {
    // Test that outer (100) beats armor (150)
  });

  it('should handle armor coverage priority correctly', () => {
    // Test coverage resolution with armor
  });
});
```

### Integration Tests

Create or update integration tests for clothing coverage:

```javascript
// tests/integration/scopeDsl/clothing-resolution.test.js

describe('Clothing Coverage with Armor', () => {
  it('should show cloak over chainmail', () => {
    // Character with chainmail + cloak
    // Expect cloak to be visible
  });

  it('should show armor when no outer garment worn', () => {
    // Character with shirt + chainmail, no cloak
    // Expect chainmail to be visible
  });

  it('should handle armor under regular clothing', () => {
    // Character with armor under coat
    // Expect coat to be visible
  });
});
```

## Validation Steps

After implementation:

1. **Run unit tests**
   ```bash
   npm run test:unit -- tests/unit/scopeDsl/nodes/slotAccessResolver.test.js
   ```

2. **Run integration tests**
   ```bash
   npm run test:integration -- tests/integration/scopeDsl/clothing-resolution
   ```

3. **Run full test suite**
   ```bash
   npm run test:ci
   ```

4. **Lint the modified file**
   ```bash
   npx eslint src/scopeDsl/nodes/slotAccessResolver.js
   ```

5. **Type check**
   ```bash
   npm run typecheck
   ```

## Potential Issues

### Issue 1: Priority Constant Not Recognized

**Symptom**: Errors about unknown priority "armor"

**Cause**: Priority constant not added to all necessary locations

**Fix**: Search the file for all references to priority constants and ensure armor is included

### Issue 2: Coverage Resolution Logic Hardcoded

**Symptom**: Armor priority not working despite constants being added

**Cause**: Coverage resolution logic may have hardcoded layer checks

**Fix**: Review coverage resolution functions and ensure they use the priority constants dynamically

### Issue 3: Test Failures

**Symptom**: Existing tests fail after adding armor priority

**Cause**: Tests may have hardcoded priority expectations

**Fix**: Update tests to account for armor priority tier

## Impact Assessment

- **SlotAccessResolver**: ⚠️ Core update required
- **Coverage Resolution**: ⚠️ Behavior changes for armor
- **Existing Clothing**: ✅ Unaffected (armor is additive)
- **Performance**: ✅ Minimal impact (just constant lookup)

## Success Criteria

- [ ] `COVERAGE_PRIORITY` includes armor at priority 150
- [ ] `LAYER_PRIORITY_WITHIN_COVERAGE` includes armor at priority 15
- [ ] Unit tests pass for armor priority resolution
- [ ] Integration tests pass for armor coverage scenarios
- [ ] `npm run test:ci` passes without errors
- [ ] No ESLint errors in modified file
- [ ] Type checking passes

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

If the `slotAccessResolver.js` file uses a different structure than described here, adapt the implementation accordingly but maintain the same priority hierarchy.

## Reference

Coverage priority scoring from original system:
- `outer`: 100 (highest visibility)
- `base`: 200
- `underwear`: 300
- `accessories`: 350
- `direct`: 400 (fallback)

These values are well-established in the codebase and should not be changed. Armor is inserted between outer (100) and base (200) to maintain backward compatibility.
