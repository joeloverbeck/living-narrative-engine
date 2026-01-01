# FACARCANA-008: Delete Testing Facades & Cleanup

## Summary

Remove all testing facade files and their unit tests now that all consumers have been migrated to the container-based approach. This is the final cleanup ticket that should only be executed after all other FACARCANA tickets are complete.

## Dependencies

- **FACARCANA-001** through **FACARCANA-007** must ALL be completed
- All e2e, integration, and performance tests must be migrated
- No remaining imports from `tests/common/facades/`

## Files to Touch

### Delete

#### Testing Facades (6 files)
- `tests/common/facades/testingFacadeRegistrations.js`
- `tests/common/facades/llmServiceFacade.js`
- `tests/common/facades/actionServiceFacade.js`
- `tests/common/facades/entityServiceFacade.js`
- `tests/common/facades/turnExecutionFacade.js`
- `tests/common/facades/index.js`

#### Unit Tests for Testing Facades (4 files)
- `tests/unit/testing/facades/llmServiceFacade.test.js`
- `tests/unit/testing/facades/turnExecutionFacade.test.js`
- `tests/unit/testing/facades/testingFacadeRegistrations.test.js`
- `tests/unit/common/facades/entityServiceFacade.test.js`

### DO NOT MODIFY

- `src/shared/facades/*` - Production facades (KEEP)
- `src/anatomy/facades/*` - Production facades (KEEP)
- `src/clothing/facades/*` - Production facades (KEEP)
- `src/dependencyInjection/registrations/infrastructureRegistrations.js` - Production registrations (KEEP)

## Out of Scope

- DO NOT modify production facades in `src/`
- DO NOT modify production DI registrations
- DO NOT modify migrated test files
- DO NOT add new test utilities

## Acceptance Criteria

### Pre-Deletion Verification

Before deleting any files, verify:

1. **No remaining imports**
   ```bash
   grep -r "createMockFacades" tests/
   # Should return empty

   grep -r "common/facades" tests/
   # Should only return e2e/common (container builder location)
   ```

2. **All dependent tests migrated**
   - All e2e tests use `createE2ETestEnvironment()`
   - All integration tests use container-based approach
   - All performance tests use real services

### Deletion Requirements

1. **Complete Removal**
   - All 10 files listed above are deleted
   - No orphaned directories remain
   - No broken imports anywhere in codebase

2. **Directory Cleanup**
   - `tests/common/facades/` directory is removed if empty
   - `tests/unit/testing/facades/` directory is removed if empty
   - `tests/unit/common/facades/` directory is removed if empty

### Tests That Must Pass

1. **Full Test Suite**
   - `npm run test:ci` passes
   - `npm run test:e2e` passes
   - `npm run test:integration` passes
   - `npm run test:performance` passes

2. **Verification Commands**
   ```bash
   # No remaining facade imports
   grep -r "createMockFacades" tests/
   # Should return empty

   grep -r "common/facades" tests/
   # Should only return legitimate references (if any)

   # No broken imports
   npm run typecheck
   ```

### Invariants

1. Production facades in `src/shared/facades/` remain unchanged
2. Production facades in `src/anatomy/facades/` remain unchanged
3. Production facades in `src/clothing/facades/` remain unchanged
4. DI registrations in `infrastructureRegistrations.js` remain unchanged
5. All existing tests continue to pass
6. No new test failures introduced
7. Production code is unaffected

## Implementation Notes

### Pre-Flight Checklist

Before deleting, run these verification commands:

```bash
# 1. Verify no imports remain
echo "=== Checking for createMockFacades imports ==="
grep -r "createMockFacades" tests/
echo "Expected: No output"

echo "=== Checking for common/facades imports ==="
grep -r "common/facades" tests/ | grep -v "e2e/common"
echo "Expected: No output"

# 2. Verify all tests pass
echo "=== Running full test suite ==="
npm run test:ci

# 3. Verify typecheck passes
echo "=== Running typecheck ==="
npm run typecheck
```

### Deletion Order

1. **Delete unit tests first** (they depend on facades)
   ```bash
   rm tests/unit/testing/facades/llmServiceFacade.test.js
   rm tests/unit/testing/facades/turnExecutionFacade.test.js
   rm tests/unit/testing/facades/testingFacadeRegistrations.test.js
   rm tests/unit/common/facades/entityServiceFacade.test.js
   ```

2. **Delete facade files**
   ```bash
   rm tests/common/facades/testingFacadeRegistrations.js
   rm tests/common/facades/llmServiceFacade.js
   rm tests/common/facades/actionServiceFacade.js
   rm tests/common/facades/entityServiceFacade.js
   rm tests/common/facades/turnExecutionFacade.js
   rm tests/common/facades/index.js
   ```

3. **Remove empty directories**
   ```bash
   rmdir tests/common/facades/
   rmdir tests/unit/testing/facades/
   rmdir tests/unit/common/facades/
   # Only if empty
   ```

### Post-Deletion Verification

```bash
# Verify files are gone
ls tests/common/facades/
# Should fail: No such file or directory

ls tests/unit/testing/facades/
# Should fail: No such file or directory

# Verify no broken imports
npm run typecheck

# Verify all tests still pass
npm run test:ci

# Final verification
grep -r "common/facades" tests/
# Should only return legitimate references (e2e/common is OK)
```

## Verification Checklist

```bash
# Pre-deletion checks
grep -r "createMockFacades" tests/
grep -r "common/facades" tests/ | grep -v "e2e/common"
npm run test:ci

# Delete files (as listed above)

# Post-deletion checks
npm run typecheck
npm run test:ci
npm run test:e2e
npm run test:integration
npm run test:performance

# Final verification
grep -r "createMockFacades" .
# Should return empty

ls tests/common/facades/
# Should fail: No such file or directory
```

## Definition of Done

- [ ] Pre-deletion verification passes (no remaining imports)
- [ ] All 6 testing facade files deleted
- [ ] All 4 unit test files for facades deleted
- [ ] Empty directories removed
- [ ] `npm run typecheck` passes
- [ ] `npm run test:ci` passes
- [ ] No remaining `createMockFacades` imports anywhere
- [ ] No remaining `common/facades` imports (except e2e/common)
- [ ] Production facades in `src/` unchanged
- [ ] Production DI registrations unchanged

## Rollback Plan

If issues are discovered after deletion:

1. **Immediate**: Revert deletion via git
   ```bash
   git checkout HEAD -- tests/common/facades/ tests/unit/testing/facades/ tests/unit/common/facades/
   ```

2. **Investigation**: Identify which test still depends on facades

3. **Resolution**: Migrate the remaining test per FACARCANA-002 through FACARCANA-007 patterns

4. **Retry**: Re-attempt deletion after all dependencies resolved
