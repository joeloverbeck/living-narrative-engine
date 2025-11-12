# ARMSYSANA-006: Run Comprehensive Tests

**Phase**: Phase 2 - Priority System Update
**Priority**: Critical
**Risk Level**: Low (Validation only)
**Estimated Effort**: 20 minutes

## Context

After completing all Phase 2 updates (slot access resolver and related coverage logic), it's essential to run a comprehensive test suite to verify that:
1. All armor priority logic works correctly
2. No regressions were introduced
3. Integration between components is correct
4. Performance remains acceptable

This ticket is a checkpoint to validate Phase 2 completion before moving to Phase 3 (Documentation and Examples).

## Objective

Run the complete test suite with emphasis on clothing, coverage, and scope resolution to ensure armor support is fully functional and all systems work together correctly.

## Prerequisites

The following Phase 2 tickets must be completed first:
- ✅ ARMSYSANA-004: Update Slot Access Resolver
- ✅ ARMSYSANA-005: Update Related Coverage Logic

## Test Commands

Run the following commands in sequence:

### 1. Integration Tests - Scope DSL Clothing Resolution

```bash
npm run test:integration -- tests/integration/scopeDsl/clothing-resolution
```

**Expected Result**: All tests pass

**What This Tests**:
- Scope DSL resolution with armor
- Clothing priority resolution
- Slot access with armor layer
- Coverage mapping with armor

**If Tests Fail**:
- Review SlotAccessResolver changes (ARMSYSANA-004)
- Check priority constant values
- Verify armor priority logic

### 2. Integration Tests - Clothing System

```bash
npm run test:integration -- tests/integration/clothing/
```

**Expected Result**: All tests pass

**What This Tests**:
- Clothing system integration
- Equipment and unequipment with armor
- Layer stacking with armor
- Coverage conflict resolution

**If Tests Fail**:
- Review coverage logic changes (ARMSYSANA-005)
- Check component integration
- Verify layer validation

### 3. Unit Tests - Scope DSL

```bash
npm run test:unit -- tests/unit/scopeDsl/
```

**Expected Result**: All tests pass

**What This Tests**:
- SlotAccessResolver unit tests
- Priority calculation logic
- Coverage priority resolution
- Edge cases in armor handling

**If Tests Fail**:
- Review unit test expectations
- Check for hardcoded layer lists
- Update tests to include armor

### 4. Unit Tests - Clothing Components

```bash
npm run test:unit -- tests/unit/clothing/
```

**Expected Result**: All tests pass

**What This Tests**:
- Clothing component logic
- Wearable component handling
- Coverage mapping logic
- Layer validation

**If Tests Fail**:
- Review component changes
- Check for missed armor references
- Update component tests

### 5. Full CI Test Suite

```bash
npm run test:ci
```

**Expected Result**: All tests pass

**What This Tests**:
- Complete integration
- Unit + Integration + E2E tests
- Full system validation
- No regressions anywhere

**If Tests Fail**:
- Identify failing test categories
- Review related changes
- Fix issues before proceeding

### 6. Type Checking

```bash
npm run typecheck
```

**Expected Result**: No type errors

**What This Tests**:
- TypeScript type consistency
- No type mismatches
- Proper type definitions

### 7. Linting

```bash
npx eslint src/scopeDsl/ src/clothing/ src/anatomy/
```

**Expected Result**: No linting errors

**What This Tests**:
- Code style consistency
- No syntax errors
- Best practices followed

## Specific Test Scenarios to Verify

Create manual test scenarios to verify armor behavior:

### Scenario 1: Armor Visibility (Outer Over Armor)

**Setup**:
- Character wearing: shirt (base), chainmail (armor), cloak (outer)

**Expected**:
- Cloak should be visible (priority 100)
- Chainmail should be hidden by cloak
- Action text should mention cloak, not chainmail

**Verification**:
```javascript
// In integration test
const visibleLayer = resolveVisibleLayer(allLayers);
expect(visibleLayer.layer).toBe('outer'); // Cloak
```

### Scenario 2: Armor Visibility (No Outer Layer)

**Setup**:
- Character wearing: shirt (base), chainmail (armor)

**Expected**:
- Chainmail should be visible (priority 150)
- Shirt should be hidden by chainmail
- Action text should mention chainmail

**Verification**:
```javascript
const visibleLayer = resolveVisibleLayer(allLayers);
expect(visibleLayer.layer).toBe('armor'); // Chainmail
```

### Scenario 3: Armor Over Base

**Setup**:
- Character wearing: pants (base), leg armor (armor)

**Expected**:
- Leg armor should be visible (priority 150)
- Pants should be hidden by armor
- Coverage resolution should favor armor

**Verification**:
```javascript
const legsCoverage = getCoverageForSlot('legs');
expect(legsCoverage.layer).toBe('armor');
```

### Scenario 4: Multiple Armor Pieces

**Setup**:
- Character wearing: cuirass (armor/torso), bracers (armor/arms)

**Expected**:
- Both armor pieces should be visible
- No conflicts between armor pieces on different slots
- Coverage resolution should work per-slot

**Verification**:
```javascript
const torsoCoverage = getCoverageForSlot('torso_upper');
const armsCoverage = getCoverageForSlot('left_arm_clothing');
expect(torsoCoverage.layer).toBe('armor');
expect(armsCoverage.layer).toBe('armor');
```

## Performance Testing

### Performance Test 1: Coverage Resolution Speed

Verify that adding armor doesn't significantly impact performance:

```bash
npm run test:performance -- tests/performance/scopeDsl/
```

**Expected**: Performance degradation < 5%

### Performance Test 2: Large Equipment Sets

Test with characters wearing many items (underwear + base + armor + outer + accessories):

```bash
npm run test:performance -- tests/performance/clothing/
```

**Expected**: No performance issues with 5-layer stacking

## Success Indicators

Check for these indicators:

- [ ] All integration tests pass
- [ ] All unit tests pass
- [ ] `npm run test:ci` passes without errors
- [ ] No type checking errors
- [ ] No linting errors
- [ ] Manual test scenarios all behave correctly
- [ ] Performance tests show < 5% degradation
- [ ] No console errors or warnings during tests

## Common Issues and Fixes

### Issue 1: Priority Resolution Incorrect

**Symptom**: Armor not visible when expected, or visible when should be hidden

**Cause**: Priority constants incorrect or coverage logic flawed

**Fix**:
- Verify priority values (outer: 100, armor: 150, base: 200)
- Check coverage resolution logic in SlotAccessResolver
- Review ARMSYSANA-004 implementation

### Issue 2: Test Failures in Existing Tests

**Symptom**: Tests that worked before now fail

**Cause**: Tests may have hardcoded layer expectations

**Fix**:
- Update test expectations to include armor
- Review test fixtures for hardcoded layers
- Modify tests to be armor-aware

### Issue 3: Integration Failures

**Symptom**: Components don't work together correctly with armor

**Cause**: Missed component in ARMSYSANA-005

**Fix**:
- Review component discovery process
- Identify missed components
- Update and test

### Issue 4: Type Errors

**Symptom**: TypeScript complains about armor layer

**Cause**: Type definitions not updated

**Fix**:
- Update type definitions to include armor
- Add armor to layer type unions
- Re-run type checking

## Troubleshooting Commands

### If Tests Fail

1. **Get detailed test output**
   ```bash
   npm run test:integration -- tests/integration/scopeDsl/ --verbose
   ```

2. **Run specific failing test**
   ```bash
   npm run test:unit -- tests/unit/scopeDsl/nodes/slotAccessResolver.test.js -t "armor priority"
   ```

3. **Check test coverage**
   ```bash
   npm run test:unit -- --coverage
   ```

4. **Debug specific test**
   ```bash
   node --inspect-brk ./node_modules/.bin/jest tests/unit/scopeDsl/nodes/slotAccessResolver.test.js
   ```

## Documentation Requirements

Document the following in ticket notes:

1. **Test Results Summary**
   - Total tests run
   - Tests passed
   - Tests failed (with details)
   - Test coverage percentage

2. **Manual Test Scenarios**
   - Scenarios tested
   - Results for each scenario
   - Any unexpected behavior

3. **Performance Results**
   - Performance test results
   - Any degradation noted
   - Comparison to baseline

4. **Issues Found**
   - List of issues discovered
   - How issues were resolved
   - Any remaining issues (create tickets)

## Success Criteria

- [ ] All integration tests for clothing/scope resolution pass
- [ ] All unit tests for clothing/scope resolution pass
- [ ] `npm run test:ci` passes completely
- [ ] Type checking shows no errors
- [ ] Linting shows no errors
- [ ] Manual test scenarios all work correctly
- [ ] Performance degradation < 5%
- [ ] No console errors during test runs
- [ ] Test coverage maintained or improved

## Related Tickets

- **Previous**: ARMSYSANA-005 (Update Coverage Logic)
- **Next**: ARMSYSANA-007 (Update Documentation)
- **Depends On**: ARMSYSANA-004, ARMSYSANA-005

## Notes

This is a **Phase 2 checkpoint ticket** - it validates that all priority system updates are complete and working correctly.

If all tests pass, Phase 2 is complete and the armor layer is fully functional in the system. You can proceed to Phase 3 (Documentation and Examples).

If tests fail:
1. Stop and investigate failures
2. Fix issues in related tickets
3. Re-run this validation
4. Do not proceed to Phase 3 until all tests pass

Phase 2 is considered **medium risk** because it involves behavior changes to core systems. Thorough testing is essential before moving forward.

## Reference

Test commands from CLAUDE.md:
- `npm run test:unit` - Run unit tests with coverage
- `npm run test:integration` - Run integration tests with coverage
- `npm run test:ci` - Full CI test suite
- `npm run typecheck` - TypeScript type checking
- `npx eslint [files]` - Lint specific files
