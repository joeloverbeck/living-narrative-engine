# GOADISANA-023: Verify All Tests Pass

## Context

After removing all GOAP tests and verifying the build works, we must confirm that the remaining test suite passes completely. This ensures that GOAP removal hasn't introduced regressions in non-GOAP functionality.

**Fatal Flaw Context**: Removing GOAP code should not affect other systems. This verification ensures clean separation and no unexpected dependencies.

## Objective

Run the complete test suite (unit, integration, e2e) and verify all remaining tests pass without failures or errors.

## Files Affected

**No files modified** - verification only

**Generated files**:
- Test coverage reports
- Test output logs

## Detailed Steps

1. **Run complete test suite**:
   ```bash
   npm run test:ci 2>&1 | tee tickets/test-ci-output.txt
   ```
   - Must complete with all tests passing
   - Note total test count

2. **Run unit tests individually**:
   ```bash
   npm run test:unit 2>&1 | tee tickets/test-unit-output.txt
   ```
   - Verify all unit tests pass
   - Check coverage metrics

3. **Run integration tests individually**:
   ```bash
   npm run test:integration 2>&1 | tee tickets/test-integration-output.txt
   ```
   - Verify all integration tests pass
   - Check for integration issues

4. **Run e2e tests** (if applicable):
   ```bash
   npm run test:e2e 2>&1 | tee tickets/test-e2e-output.txt
   ```
   - Verify all e2e tests pass
   - May skip if e2e suite not configured

5. **Compare test counts** with baseline (from GOADISANA-002):
   ```bash
   # Extract test counts from outputs
   grep "Tests:" tickets/test-ci-output.txt
   ```
   - Total should be lower (GOAP tests removed)
   - Calculate: baseline - GOAP tests (47) = expected count

6. **Check coverage metrics**:
   ```bash
   npm run test:unit -- --coverage
   # Save coverage/lcov-report/ for comparison
   ```
   - Coverage may be similar or higher (GOAP code removed from denominator)

7. **Search for GOAP-related test failures**:
   ```bash
   grep -i "goap\|effectsGenerator\|goalManager" tickets/test-*-output.txt
   ```
   - Should return empty (no GOAP test failures)

## Acceptance Criteria

- [ ] `npm run test:ci` passes with 100% of remaining tests passing
- [ ] Unit tests pass: `npm run test:unit` exits 0
- [ ] Integration tests pass: `npm run test:integration` exits 0
- [ ] E2E tests pass: `npm run test:e2e` exits 0 (if applicable)
- [ ] Test count reduced by 47 (GOAP test removal confirmed)
- [ ] No GOAP-related test failures
- [ ] Test outputs saved to `tickets/test-*-output.txt` files
- [ ] Coverage report generated and saved
- [ ] No unexpected regressions introduced

## Dependencies

**Requires**:
- GOADISANA-022 (build verification passed)

**Blocks**:
- GOADISANA-024 (player type routing verification)

## Verification Commands

```bash
# Run full test suite
npm run test:ci
echo "Test CI exit code: $?"

# Run individual suites
npm run test:unit
echo "Unit tests exit code: $?"

npm run test:integration
echo "Integration tests exit code: $?"

# Count tests
echo "=== Test Counts ==="
grep "Tests:" tickets/test-ci-output.txt

# Check for GOAP test references
grep -i "goap" tickets/test-ci-output.txt || echo "No GOAP tests (expected)"

# Verify coverage
npm run test:unit -- --coverage --silent
echo "Coverage exit code: $?"

# Compare with baseline (from GOADISANA-002)
echo "=== Baseline vs Current ==="
echo "Baseline total: [from GOADISANA-002 documentation]"
echo "Current total: [from test output]"
echo "Expected reduction: 47 GOAP tests"
```

## Expected Test Results

**Test Counts**:
- Unit tests: Baseline - 13 GOAP unit tests
- Integration tests: Baseline - 14 GOAP integration tests
- E2E tests: Baseline - 16 GOAP e2e tests
- Performance tests: Baseline - 2 GOAP performance tests
- Memory tests: Baseline - 1 GOAP memory test
- **Total reduction**: 47 tests (13+14+16+2+1+1 helper)

**Coverage**:
- Overall coverage may increase (GOAP uncovered code removed)
- Non-GOAP code coverage should remain similar
- No new uncovered branches introduced

**Pass Rate**:
- 100% of remaining tests must pass
- 0 failures, 0 errors
- 0 skipped tests (unless pre-existing)

## If Tests Fail

**Scenario: Non-GOAP tests failing**
1. Identify which tests are failing
2. Determine if failure related to GOAP removal
3. Analyze error messages
4. Fix regressions before proceeding

**Common Failure Reasons**:
- Dependency injection errors (missing providers)
- Import errors (incomplete cleanup)
- Integration issues (shared components)
- Configuration problems (test setup)

**Resolution Steps**:
1. Read failure output carefully
2. Check if test imports GOAP code
3. Verify test setup is correct
4. Fix issue and re-run tests
5. Document fix in commit message

## Coverage Comparison

**Baseline Coverage** (from GOADISANA-002):
- Branches: X%
- Functions: Y%
- Lines: Z%

**Expected After Removal**:
- May increase (GOAP uncovered code removed)
- Should not decrease significantly
- Non-GOAP coverage should be unchanged

## Notes

- All tests must pass before proceeding to routing verification
- Test count reduction confirms complete test removal
- No GOAP-related failures expected
- Save all test outputs for troubleshooting
- Coverage metrics useful for tracking system health
- This verification ensures system stability post-removal
