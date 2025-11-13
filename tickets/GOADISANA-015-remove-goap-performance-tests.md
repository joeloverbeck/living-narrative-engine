# GOADISANA-015: Remove GOAP Performance Tests

## Context

The GOAP performance tests benchmark effects generation and planning performance. With GOAP services removed, these benchmarks are no longer relevant.

**Fatal Flaw Context**: These tests measured performance of services attempting to auto-generate effects and simulate planning - services that are now completely removed.

## Objective

Remove the `tests/performance/goap/` directory containing GOAP-specific performance benchmarks.

## Files Affected

**To be REMOVED** (2 files in `tests/performance/goap/`):
- `effectsGeneration.performance.test.js`
- `GoapPlanningPerformance.test.js`

## Detailed Steps

1. **Verify directory exists**:
   ```bash
   test -d tests/performance/goap/ && echo "Directory exists" || echo "Directory not found"
   ```

2. **List files to be removed** (for documentation):
   ```bash
   find tests/performance/goap/ -name "*.test.js" > tickets/removed-performance-tests-list.txt
   ```

3. **Remove entire directory**:
   ```bash
   rm -rf tests/performance/goap/
   ```

4. **Verify removal**:
   ```bash
   test -d tests/performance/goap/ && echo "ERROR: Directory still exists" || echo "OK: Directory removed"
   ```

5. **Verify performance tests still run** (if other performance tests exist):
   ```bash
   npm run test:performance || echo "No performance tests or command not configured"
   ```

## Acceptance Criteria

- [ ] `tests/performance/goap/` directory removed completely
- [ ] Both performance test files removed
- [ ] List of removed files documented in `tickets/removed-performance-tests-list.txt`
- [ ] Remaining performance tests still pass (if any exist)
- [ ] No orphaned test files remain in tests/performance/
- [ ] Commit message lists removed benchmark files

## Dependencies

**Requires**:
- GOADISANA-011 (schema cleanup complete)

**Can run in PARALLEL with**:
- GOADISANA-012 (unit tests removal)
- GOADISANA-013 (integration tests removal)
- GOADISANA-014 (e2e tests removal)
- GOADISANA-016 (memory tests removal)
- GOADISANA-017 (test helpers removal)

## Verification Commands

```bash
# Verify directory removed
test -d tests/performance/goap/ && echo "FAIL" || echo "PASS"

# Check file list backup
cat tickets/removed-performance-tests-list.txt

# Verify no goap test files remain
find tests/performance/ -name "*goap*"
# Should return empty

# Run remaining performance tests (if applicable)
npm run test:performance 2>&1 | head -20

# Check if performance directory is now empty
ls -la tests/performance/
```

## Expected Outcomes

After removal:
- Performance test suite reduced by 2 files
- GOAP-specific benchmarks no longer run
- May need to skip performance tests if none remain
- Performance testing infrastructure preserved (if other tests exist)

## Performance Metrics Lost

These tests measured:
- **Effects generation time**: How long to analyze rules and generate effects
- **Planning performance**: How long to select actions and create plans
- **Benchmark comparisons**: Performance across different scenarios

**Impact**: No longer relevant as services removed

## Future Considerations

When implementing task-based system:
- Create new performance tests for task decomposition
- Benchmark task-to-action selection
- Compare task-based vs effects-based performance (historical)

## Notes

- Performance benchmarks validated speed of flawed services
- Metrics are no longer meaningful with services removed
- All test files remain in git history for performance comparisons
- May want to preserve performance testing infrastructure for future use
- If `tests/performance/` becomes empty, consider keeping directory structure
