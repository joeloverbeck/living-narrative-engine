# GOADISANA-012: Remove GOAP Unit Tests

## Context

The GOAP unit tests verify behavior of services that attempted to auto-generate planning effects from rules. With core services removed, these tests are no longer relevant and cannot run.

**Fatal Flaw Context**: These tests validated services that tried to simulate planning without execution context - services that are now completely removed.

## Objective

Remove the `tests/unit/goap/` directory containing all GOAP-specific unit tests.

## Files Affected

**To be REMOVED** (13 files in `tests/unit/goap/`):
- `schemas/planningEffects.schema.test.js`
- `analysis/effectsAnalyzer.test.js`
- `analysis/effectsAnalyzer.edgeCases.test.js`
- `analysis/effectsAnalyzer.additionalBranches.test.js`
- `generation/effectsGenerator.test.js`
- `generation/effectsGenerator.validation.test.js`
- `validation/effectsValidator.test.js`
- `goals/goalStateEvaluator.test.js`
- `goals/goalManager.test.js`
- `simulation/abstractPreconditionSimulator.test.js`
- `selection/actionSelector.test.js`
- `planning/simplePlanner.test.js`
- `planning/planCache.test.js`

## Detailed Steps

1. **Verify directory exists**:
   ```bash
   test -d tests/unit/goap/ && echo "Directory exists" || echo "Directory not found"
   ```

2. **List files to be removed** (for documentation):
   ```bash
   find tests/unit/goap/ -name "*.test.js" > tickets/removed-unit-tests-list.txt
   ```

3. **Remove entire directory**:
   ```bash
   rm -rf tests/unit/goap/
   ```

4. **Verify removal**:
   ```bash
   test -d tests/unit/goap/ && echo "ERROR: Directory still exists" || echo "OK: Directory removed"
   ```

5. **Verify unit tests still run** (other tests):
   ```bash
   npm run test:unit
   ```

## Acceptance Criteria

- [ ] `tests/unit/goap/` directory removed completely
- [ ] All 13 unit test files removed
- [ ] List of removed files documented in `tickets/removed-unit-tests-list.txt`
- [ ] Remaining unit tests still pass: `npm run test:unit` succeeds
- [ ] No orphaned test files remain in tests/unit/
- [ ] Commit message lists all removed test files

## Dependencies

**Requires**:
- GOADISANA-011 (schema cleanup complete)

**Can run in PARALLEL with**:
- GOADISANA-013 (integration tests removal)
- GOADISANA-014 (e2e tests removal)
- GOADISANA-015 (performance tests removal)
- GOADISANA-016 (memory tests removal)
- GOADISANA-017 (test helpers removal)

## Verification Commands

```bash
# Verify directory removed
test -d tests/unit/goap/ && echo "FAIL" || echo "PASS"

# Check file list backup
cat tickets/removed-unit-tests-list.txt

# Verify no goap test files remain in unit tests
find tests/unit/ -name "*goap*"
# Should return empty

# Run remaining unit tests
npm run test:unit

# Check test count (should be lower than before)
find tests/unit/ -name "*.test.js" | wc -l
```

## Expected Test Output

After removal:
- Total unit tests reduced by 13 files
- All remaining unit tests should pass
- No GOAP-related test failures
- Test coverage may drop (expected - GOAP code removed)

## Notes

- These tests cannot run without GOAP services (removed in GOADISANA-004)
- Tests validated flawed logic, so no loss of valuable coverage
- All test files remain in git history for reference
- Test removal reduces maintenance burden
- No changes to non-GOAP unit tests needed
