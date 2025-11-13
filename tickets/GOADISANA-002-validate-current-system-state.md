# GOADISANA-002: Validate Current System State

## Context

Before removing the GOAP system, we must establish a baseline of the current system state to ensure that removal doesn't introduce regressions in non-GOAP functionality. This ticket validates that the system is currently working correctly.

**Fatal Flaw Summary**: The GOAP system attempted to auto-generate planning effects from execution rules. The system must be validated in its current state before removal to distinguish removal-related issues from pre-existing problems.

## Objective

Run complete test suite and validation checks to establish baseline system health before GOAP removal begins.

## Files Affected

- No source files modified
- Test output files (coverage reports) generated for documentation

## Detailed Steps

1. **Run full test suite**:
   ```bash
   npm run test:ci
   ```

2. **Verify all tests pass**:
   - Unit tests: `npm run test:unit`
   - Integration tests: `npm run test:integration`
   - E2E tests: `npm run test:e2e`
   - Performance tests: `npm run test:performance` (if applicable)
   - Memory tests: `npm run test:memory` (if applicable)

3. **Generate and save coverage report**:
   ```bash
   npm run test:unit -- --coverage
   # Save coverage/lcov-report/index.html for reference
   cp -r coverage pre-removal-coverage-$(date +%Y%m%d)
   ```

4. **Verify TypeScript compilation**:
   ```bash
   npm run typecheck
   ```

5. **Verify build succeeds**:
   ```bash
   npm run build
   ```

6. **Document baseline metrics**:
   - Total test count
   - Coverage percentages (branches, functions, lines)
   - Build output size
   - Any existing TypeScript errors (document, don't fail)

## Acceptance Criteria

- [ ] `npm run test:ci` passes with 100% of current tests passing
- [ ] Coverage report generated and saved to `pre-removal-coverage-YYYYMMDD/`
- [ ] TypeScript type checking passes: `npm run typecheck` exits 0
- [ ] Build completes successfully: `npm run build` exits 0
- [ ] Baseline metrics documented (test count, coverage %, build size)
- [ ] Any pre-existing issues documented (if any)

## Dependencies

**Requires**: GOADISANA-001 (historical reference points created)

## Verification Commands

```bash
# Run complete test suite
npm run test:ci

# Verify individual test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Check TypeScript compilation
npm run typecheck

# Verify build
npm run build

# Check if coverage directory exists
ls -la pre-removal-coverage-*/

# Get test counts (approximate)
find tests/ -name "*.test.js" | wc -l
```

## Notes

- This establishes the "known good" baseline
- Any test failures in this phase should be investigated and fixed BEFORE proceeding
- Coverage report serves as comparison point after removal
- If tests are currently failing, document the failures and ensure they're not GOAP-related
- Performance tests may be skipped if they're known to be flaky
