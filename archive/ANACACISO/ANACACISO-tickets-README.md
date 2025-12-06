# Anatomy Cache Isolation Initiative - Tickets

This directory contains detailed, actionable tickets for implementing comprehensive test coverage for the anatomy cache isolation fix.

## Quick Navigation

### Initiative Overview

- **[ANACACISO-000](ANACACISO-000-initiative-overview.md)** - Initiative Overview & Tracking

### Critical Path (Must Complete)

1. **[ANACACISO-001](ANACACISO-001-unique-part-ownership-test.md)** - Add Unique Part Ownership Test (2-4 hours)
2. **[ANACACISO-002](ANACACISO-002-cache-isolation-test.md)** - Add Cache Isolation Test (3-5 hours)
3. **[ANACACISO-003](ANACACISO-003-edge-case-tests.md)** - Add Edge Case Tests (3-4 hours)
4. **[ANACACISO-005](ANACACISO-005-ci-integration.md)** - CI Integration (1-2 hours)

### Recommended Path (Should Complete)

5. **[ANACACISO-004](ANACACISO-004-scalability-test.md)** - Add Scalability Test (2-3 hours)

## Ticket Structure

Each ticket includes:

### Standard Sections

- **Status**: Current state (To Do, In Progress, Complete)
- **Priority**: CRITICAL, HIGH, MEDIUM
- **Estimated Effort**: Time estimate in hours
- **Dependencies**: Other tickets required before starting

### Technical Details

- **Description**: What needs to be done and why
- **Files Expected to Touch**: Specific files that will be modified/created
- **Explicit Out of Scope**: What MUST NOT be changed
- **Implementation Details**: Code examples and approach

### Quality Gates

- **Acceptance Criteria**: Specific tests that must pass
- **Invariants That Must Remain True**: Properties that cannot be violated
- **Definition of Done**: Checklist for completion
- **Verification Commands**: Exact commands to validate work

## Workflow

### Recommended Implementation Order

**Day 1**: Parallel Development

```bash
# Developer A
cd tickets/
# Work on ANACACISO-001 (Unique Part Ownership Test)

# Developer B
cd tickets/
# Work on ANACACISO-003 (Edge Case Tests)
```

**Day 2**: Parallel Development

```bash
# Developer A
# Work on ANACACISO-002 (Cache Isolation Test)

# Developer B (optional)
# Work on ANACACISO-004 (Scalability Test)
```

**Day 3**: Integration

```bash
# Lead Developer
# Work on ANACACISO-005 (CI Integration)
# Verify all tests pass in CI
```

### Quick Start for Each Ticket

1. **Read the ticket completely** before starting
2. **Check "Explicit Out of Scope"** to understand boundaries
3. **Create test file** at specified path
4. **Implement tests** following provided structure
5. **Run verification commands** to validate
6. **Mark Definition of Done items** as complete
7. **Submit for review** with verification proof

## Validation Quick Reference

### Per-Ticket Validation

```bash
# For each ticket, run these commands after implementation:

# 1. Run the new tests
NODE_ENV=test npx jest <test-file-path> --no-coverage --verbose

# 2. Run 5 times for consistency
for i in {1..5}; do
  NODE_ENV=test npx jest <test-file-path> --no-coverage --silent
done

# 3. Verify no production code changes
git status

# 4. Verify code quality
npx eslint <test-file-path>
```

### Initiative-Wide Validation

```bash
# After all tickets complete, verify:

# 1. All anatomy tests pass
NODE_ENV=test npm run test:integration -- tests/integration/anatomy/ --silent

# 2. All unit tests pass
NODE_ENV=test npm run test:unit -- tests/unit/anatomy/ --silent

# 3. CI simulation
npm run test:ci
```

## Files Expected to Be Created

This initiative will create the following new test files:

```
tests/
├── unit/
│   └── anatomy/
│       └── anatomyCacheManager.edgeCases.test.js           (ANACACISO-003)
└── integration/
    └── anatomy/
        ├── anatomyCacheManager.uniquePartOwnership.integration.test.js    (ANACACISO-001)
        ├── anatomyCacheManager.concurrentIsolation.integration.test.js   (ANACACISO-002)
        └── anatomyCacheManager.scalability.test.js                       (ANACACISO-004)
```

**Total**: 4 new test files, ~1000 lines of test code

## Files That MUST NOT Be Modified

❌ **Do NOT modify these files**:

- `src/anatomy/anatomyCacheManager.js` (fix already implemented)
- `src/anatomy/bodyGraphService.js` (no changes needed)
- Any production code in `src/anatomy/`
- Existing test files (except to fix conflicts)
- Schema definitions in `data/schemas/`
- Component definitions in `data/mods/anatomy/`

✅ **Only create new test files** as specified in tickets

## Related Documentation

### Specification

- **Primary Spec**: `specs/anatomy-cache-isolation.spec.md` (2067 lines)
- **Context**: Original bug, root cause, fix implementation, requirements

### Architecture

- **ECS Pattern**: `docs/architecture/entity-component-system.md`
- **Anatomy System**: `docs/anatomy/anatomy-overview.md`
- **Event System**: `docs/architecture/event-driven-architecture.md`

### Existing Tests

- **Primary Regression**: `tests/integration/anatomy/multiCharacterClothingGeneration.test.js`
- **Fallback Logic**: `tests/integration/anatomy/anatomyCacheManager.disconnectedFallback.integration.test.js`

## Support & Questions

### If You Have Questions

1. **Read the spec**: `specs/anatomy-cache-isolation.spec.md` contains comprehensive context
2. **Check existing tests**: Look at `multiCharacterClothingGeneration.test.js` for patterns
3. **Review the fix**: See `src/anatomy/anatomyCacheManager.js` lines 440-516

### Common Questions

**Q: Can I modify production code?**
A: No. All tickets are test-only. The fix is already implemented.

**Q: What if a test fails consistently?**
A: This indicates a potential bug. Report to team before proceeding.

**Q: Can I skip the scalability test (ANACACISO-004)?**
A: Yes, it's marked MEDIUM priority. Complete CRITICAL tickets first.

**Q: How do I know if tests are comprehensive enough?**
A: Each ticket's "Acceptance Criteria" section defines what must be validated.

## Success Metrics

### Coverage Improvement

- **Before**: 1 regression test
- **After**: 5 test suites, 40+ test cases
- **Improvement**: 40x increase in anatomy cache test coverage

### Bug Prevention

- **Bug Class**: Concurrent processing race conditions
- **Detection**: Tests fail if parts shared between actors
- **Prevention**: CI blocks merge if tests fail

### Team Impact

- **Development**: Clear test requirements prevent regressions
- **QA**: Automated validation reduces manual testing
- **Product**: Confidence in multi-character gameplay

---

**Last Updated**: 2025-11-23
**Initiative Status**: Ready to Start
**Estimated Completion**: 2-3 days (11-18 hours)
