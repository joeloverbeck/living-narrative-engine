# GOADISANA-013: Remove GOAP Integration Tests

## Context

The GOAP integration tests verify end-to-end workflows of the planning system, including effects generation, goal selection, and action planning. With GOAP services removed, these integration tests cannot run.

**Fatal Flaw Context**: These tests validated integration of services attempting to auto-generate effects and simulate planning - workflows that are now completely dismantled.

## Objective

Remove the `tests/integration/goap/` directory containing all GOAP-specific integration tests.

## Files Affected

**To be REMOVED** (14 files in `tests/integration/goap/`):
- `schemaIntegration.test.js`
- `effectsGeneration.integration.test.js`
- `effectsValidation.integration.test.js`
- `effectsGenerator.realDependencies.integration.test.js`
- `effectsValidation.realDependencies.integration.test.js`
- `effectsAnalyzer.integration.test.js`
- `goalSelection.integration.test.js`
- `planning.integration.test.js`
- `planCacheLogger.integration.test.js`
- `goalStateEvaluator.integration.test.js`
- `actionSelection.integration.test.js`
- `abstractPreconditionSimulator.integration.test.js`
- `turnIntegration.test.js`
- `goapWorkflow.integration.test.js`

## Detailed Steps

1. **Verify directory exists**:
   ```bash
   test -d tests/integration/goap/ && echo "Directory exists" || echo "Directory not found"
   ```

2. **List files to be removed** (for documentation):
   ```bash
   find tests/integration/goap/ -name "*.test.js" > tickets/removed-integration-tests-list.txt
   ```

3. **Remove entire directory**:
   ```bash
   rm -rf tests/integration/goap/
   ```

4. **Verify removal**:
   ```bash
   test -d tests/integration/goap/ && echo "ERROR: Directory still exists" || echo "OK: Directory removed"
   ```

5. **Verify integration tests still run** (other tests):
   ```bash
   npm run test:integration
   ```

## Acceptance Criteria

- [ ] `tests/integration/goap/` directory removed completely
- [ ] All 14 integration test files removed
- [ ] List of removed files documented in `tickets/removed-integration-tests-list.txt`
- [ ] Remaining integration tests still pass: `npm run test:integration` succeeds
- [ ] No orphaned test files remain in tests/integration/
- [ ] Commit message lists all removed test files

## Dependencies

**Requires**:
- GOADISANA-011 (schema cleanup complete)

**Can run in PARALLEL with**:
- GOADISANA-012 (unit tests removal)
- GOADISANA-014 (e2e tests removal)
- GOADISANA-015 (performance tests removal)
- GOADISANA-016 (memory tests removal)
- GOADISANA-017 (test helpers removal)

## Verification Commands

```bash
# Verify directory removed
test -d tests/integration/goap/ && echo "FAIL" || echo "PASS"

# Check file list backup
cat tickets/removed-integration-tests-list.txt

# Verify no goap test files remain
find tests/integration/ -name "*goap*"
# Should return empty

# Run remaining integration tests
npm run test:integration

# Check test count
find tests/integration/ -name "*.test.js" | wc -l
```

## Expected Test Output

After removal:
- Total integration tests reduced by 14 files
- All remaining integration tests should pass
- No GOAP-related test failures
- Some integration workflows no longer tested (expected)

## Notable Removed Tests

- **turnIntegration.test.js**: Tested GOAP turn handling (now uses stub)
- **goapWorkflow.integration.test.js**: Tested complete GOAP decision flow
- **effectsGeneration.integration.test.js**: Tested core flawed workflow

## Notes

- Integration tests verified workflows that are fundamentally removed
- Player type routing integration will be tested in Phase 7 (GOADISANA-024)
- All test files remain in git history for reference
- Future task-based system will need new integration tests
