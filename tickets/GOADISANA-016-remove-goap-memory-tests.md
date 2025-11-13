# GOADISANA-016: Remove GOAP Memory Tests

## Context

The GOAP memory tests detect memory leaks in GOAP services, particularly plan caching and effects generation. With GOAP services removed, these memory tests cannot run.

**Fatal Flaw Context**: These tests checked for memory leaks in services attempting to simulate planning and cache effects - services that are now completely removed.

## Objective

Remove the `tests/memory/goap/` directory containing GOAP-specific memory leak tests.

## Files Affected

**To be REMOVED** (1 file in `tests/memory/goap/`):
- `GoapMemoryUsage.test.js`

## Detailed Steps

1. **Verify directory exists**:
   ```bash
   test -d tests/memory/goap/ && echo "Directory exists" || echo "Directory not found"
   ```

2. **List files to be removed** (for documentation):
   ```bash
   find tests/memory/goap/ -name "*.test.js" > tickets/removed-memory-tests-list.txt
   ```

3. **Remove entire directory**:
   ```bash
   rm -rf tests/memory/goap/
   ```

4. **Verify removal**:
   ```bash
   test -d tests/memory/goap/ && echo "ERROR: Directory still exists" || echo "OK: Directory removed"
   ```

5. **Verify memory tests still run** (if other memory tests exist):
   ```bash
   npm run test:memory || echo "No memory tests or command not configured"
   ```

## Acceptance Criteria

- [ ] `tests/memory/goap/` directory removed completely
- [ ] Memory test file removed
- [ ] List of removed file documented in `tickets/removed-memory-tests-list.txt`
- [ ] Remaining memory tests still pass (if any exist)
- [ ] No orphaned test files remain in tests/memory/
- [ ] Commit message documents memory test removal

## Dependencies

**Requires**:
- GOADISANA-011 (schema cleanup complete)

**Can run in PARALLEL with**:
- GOADISANA-012 (unit tests removal)
- GOADISANA-013 (integration tests removal)
- GOADISANA-014 (e2e tests removal)
- GOADISANA-015 (performance tests removal)
- GOADISANA-017 (test helpers removal)

## Verification Commands

```bash
# Verify directory removed
test -d tests/memory/goap/ && echo "FAIL" || echo "PASS"

# Check file list backup
cat tickets/removed-memory-tests-list.txt

# Verify no goap test files remain
find tests/memory/ -name "*goap*"
# Should return empty

# Run remaining memory tests (if applicable)
npm run test:memory 2>&1 | head -20

# Check if memory directory structure preserved
ls -la tests/memory/
```

## Expected Outcomes

After removal:
- Memory test suite reduced by 1 file
- GOAP-specific leak detection no longer run
- Memory testing infrastructure preserved (if other tests exist)
- No memory leak warnings for removed services

## Memory Tests Lost

The removed test checked for leaks in:
- Plan cache growth over time
- Effects generation memory allocation
- Goal manager state accumulation
- Planner simulation overhead

**Impact**: No longer relevant as services removed

## Future Considerations

When implementing task-based system:
- Create memory tests for task decomposition
- Monitor task cache growth
- Check for task state accumulation
- Verify task-based provider doesn't leak

## Notes

- Memory tests validated that removed services didn't leak
- No longer needed with services removed
- All test files remain in git history
- Memory testing infrastructure should be preserved for future systems
- Good practice to create memory tests for task-based replacement
