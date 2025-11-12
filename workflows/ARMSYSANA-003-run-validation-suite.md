# ARMSYSANA-003: Run Validation Suite

**Phase**: Phase 1 - Core System Update
**Priority**: Critical
**Risk Level**: Minimal
**Estimated Effort**: 10 minutes

## Context

After updating the clothing component schemas to include "armor" as a layer (ARMSYSANA-001 and ARMSYSANA-002), it's essential to verify that:
1. The schema changes are syntactically correct
2. All existing clothing entities remain valid
3. No unintended side effects were introduced
4. The validation system recognizes the new armor layer

This ticket ensures the changes made in Phase 1 are safe and don't break existing functionality.

## Objective

Run the complete validation suite to verify that the schema changes for armor support don't introduce any regressions or validation errors.

## Prerequisites

The following tickets must be completed first:
- ✅ ARMSYSANA-001: Update Wearable Component Schema
- ✅ ARMSYSANA-002: Update Coverage Mapping Schema

## Validation Commands

Run the following commands in sequence:

### 1. General Validation

```bash
npm run validate
```

**Expected Result**: No validation errors. All mods should load successfully.

**What This Tests**:
- Schema syntax is valid
- All component schemas are well-formed
- Mod manifests are correct
- Cross-references are valid

### 2. Unit Tests (Clothing)

```bash
npm run test:unit -- tests/unit/clothing/
```

**Expected Result**: All clothing-related unit tests pass.

**What This Tests**:
- Clothing component logic
- Wearable component handling
- Coverage mapping logic
- Layer priority calculations

### 3. Integration Tests (Clothing)

```bash
npm run test:integration -- tests/integration/clothing/
```

**Expected Result**: All clothing-related integration tests pass.

**What This Tests**:
- Clothing system integration
- Equipment slot assignments
- Coverage resolution
- Layer stacking behavior

### 4. Type Checking

```bash
npm run typecheck
```

**Expected Result**: No type errors.

**What This Tests**:
- TypeScript type definitions are consistent
- No type mismatches in clothing system

## What to Check For

### Success Indicators

- [ ] `npm run validate` completes without errors
- [ ] All unit tests in `tests/unit/clothing/` pass
- [ ] All integration tests in `tests/integration/clothing/` pass
- [ ] `npm run typecheck` shows no type errors
- [ ] No warnings about unknown layer types
- [ ] No schema validation failures

### Common Issues to Watch For

1. **Schema Validation Errors**
   - Error: "Unknown layer type 'armor'"
   - Cause: Schema not properly updated
   - Fix: Review ARMSYSANA-001 and ARMSYSANA-002

2. **Test Failures**
   - Error: Tests expecting specific enum values fail
   - Cause: Tests may have hardcoded layer expectations
   - Fix: Update tests to include "armor" layer (document in ticket notes)

3. **Type Errors**
   - Error: TypeScript complains about layer type
   - Cause: Type definitions may need update
   - Fix: Update type definitions if necessary (document in ticket notes)

## Troubleshooting

### If Validation Fails

1. **Check JSON syntax**
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('data/mods/clothing/components/wearable.component.json'))"
   node -e "JSON.parse(require('fs').readFileSync('data/mods/clothing/components/coverage_mapping.component.json'))"
   ```

2. **Review schema changes**
   - Verify "armor" was added correctly to both schemas
   - Check for typos in enum values
   - Ensure proper comma placement

3. **Check existing entities**
   ```bash
   npm run validate:strict
   ```
   This will show any entities that fail validation.

### If Tests Fail

1. **Review test output**
   - Note which specific tests are failing
   - Check if tests have hardcoded layer expectations

2. **Document test updates needed**
   - Create follow-up ticket if tests need updating
   - Note: Tests should not fail if schemas were updated correctly

3. **Check for enum ordering issues**
   - Some tests may depend on specific enum ordering
   - Review test expectations and update if necessary

## Expected Behavior

### What Should Work

After this validation:
- All existing clothing entities should load correctly
- The system should recognize "armor" as a valid layer
- No new validation errors should appear
- All tests should pass (or document which tests need updating)

### What Won't Work Yet

- **Coverage priority resolution for armor**: Requires ARMSYSANA-004
- **Armor entities**: Can be created but priority handling needs update
- **Action text with armor**: May not display correctly until priority system is updated

## Success Criteria

- [ ] `npm run validate` passes without errors
- [ ] Unit tests in `tests/unit/clothing/` all pass
- [ ] Integration tests in `tests/integration/clothing/` all pass
- [ ] `npm run typecheck` shows no type errors
- [ ] No regressions in existing clothing functionality
- [ ] Any test failures are documented and tickets created

## Documentation

Document the following in ticket notes:

1. **Validation Results**
   - All commands run
   - Any errors encountered
   - How errors were resolved

2. **Test Results**
   - Number of tests passed
   - Any failing tests
   - Root cause of any failures

3. **Follow-up Needed**
   - Any tests that need updating
   - Any type definitions that need changes
   - Any unexpected issues discovered

## Related Tickets

- **Previous**: ARMSYSANA-002 (Update Coverage Mapping Schema)
- **Next**: ARMSYSANA-004 (Update Slot Access Resolver)
- **Depends On**: ARMSYSANA-001, ARMSYSANA-002

## Notes

This is a **checkpoint ticket** - it validates that Phase 1 changes are safe before moving to Phase 2 (Priority System Update).

If validation passes, Phase 1 is complete and armor layer support is enabled at the schema level. However, the priority system (coverage resolution) will not work correctly until Phase 2 is complete.

If validation fails, stop and fix issues before proceeding to Phase 2.
