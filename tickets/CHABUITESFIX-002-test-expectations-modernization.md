# CHABUITESFIX-002: Test Expectations Modernization

**Status**: Ready for Implementation
**Priority**: MEDIUM (Specific Issue - Fixes 7% of Test Failures)
**Estimated Effort**: 30 minutes
**Reference**: [BASCHACUICONREF-011-implementation-complete.md](../claudedocs/BASCHACUICONREF-011-implementation-complete.md)

---

## Problem Statement

During the BaseCharacterBuilderController service delegation refactoring (BASCHACUICONREF-011), operation names and error messages were updated to be more descriptive and accurate. However, some tests still expect the old operation names, causing **7% of test failures**.

**Evidence from Implementation Document:**
> **Outdated Test Expectations** (7% of failures)
> - **Pattern**: Tests expect old operation names
> - **Example**: "initial data loading failed" vs "load thematic directions failed"
> - **Fix**: Update test expectations to match current operation names

**Root Cause:** Test assertions were not updated when operation names were clarified during the migration to service delegation pattern.

---

## Scope

**Primary Affected Controller:**
- `TraitsGeneratorController` (most impacted by operation name changes)

**Secondary Affected Controllers:**
- `SpeechPatternsGeneratorController` (minor updates)
- `TraitsRewriterController` (minor updates)

**Test Files Requiring Updates:**
- `tests/unit/characterBuilder/controllers/TraitsGeneratorController.test.js`
- `tests/unit/characterBuilder/controllers/TraitsGeneratorController.conceptAccess.test.js`
- `tests/unit/characterBuilder/controllers/TraitsGeneratorController.additionalCoverage.test.js`
- Potentially other files as discovered during implementation

**Total Tests Impacted:** ~26 failing tests (7% of 377 total)

---

## Known Operation Name Changes

### 1. Thematic Directions Loading

**Old Operation Name:**
```javascript
"initial data loading failed"
```

**New Operation Name:**
```javascript
"load thematic directions failed"
```

**Why Changed:** More specific and descriptive of what actually failed

**Affected Code Location:**
- `src/characterBuilder/controllers/TraitsGeneratorController.js`
- Error handling in async initialization

**Test Update Pattern:**
```javascript
// OLD (fails):
expect(mockErrorHandler._handleServiceError).toHaveBeenCalledWith(
  expect.any(Error),
  'initial data loading failed'
);

// NEW (correct):
expect(mockErrorHandler._handleServiceError).toHaveBeenCalledWith(
  expect.any(Error),
  'load thematic directions failed'
);
```

---

## Implementation Tasks

### Task 1: Identify All Outdated Operation Name Expectations

**Method:** Search test files for old operation names

**Search Commands:**
```bash
# Search for old operation name in TraitsGeneratorController tests
grep -rn "initial data loading failed" tests/unit/characterBuilder/controllers/TraitsGeneratorController*.test.js

# Search for other potential outdated operation names
grep -rn "operation.*failed" tests/unit/characterBuilder/controllers/ | grep -v "load thematic directions"
```

**Expected Findings:**
- Multiple test assertions expecting "initial data loading failed"
- Potentially other outdated operation names not yet documented

**Output:** Create a list of:
1. Test file path
2. Line number
3. Old operation name
4. New operation name (from corresponding source code)

---

### Task 2: Update Operation Name Expectations in TraitsGeneratorController Tests

**File:** `tests/unit/characterBuilder/controllers/TraitsGeneratorController.test.js`

**Search Pattern:**
```javascript
// Find all instances of:
'initial data loading failed'
```

**Replace Pattern:**
```javascript
// Replace with:
'load thematic directions failed'
```

**Verification:**
```bash
# After updates, verify tests reflect new operation names
grep -n "load thematic directions failed" tests/unit/characterBuilder/controllers/TraitsGeneratorController.test.js

# Run tests to verify fixes
NODE_ENV=test npx jest tests/unit/characterBuilder/controllers/TraitsGeneratorController.test.js --no-coverage
```

**Expected Outcome:**
- ~10-15 tests fixed in this file
- Pass rate increases from 17/42 (40%) → 27-32/42 (64-76%)

---

### Task 3: Update Operation Names in Other TraitsGeneratorController Test Files

**Files:**
- `tests/unit/characterBuilder/controllers/TraitsGeneratorController.conceptAccess.test.js`
- `tests/unit/characterBuilder/controllers/TraitsGeneratorController.additionalCoverage.test.js`

**Process:**
1. Search for outdated operation names (from Task 1 findings)
2. Update to match current code operation names
3. Verify each file individually with `npx jest [file] --no-coverage`

**Expected Outcome:**
- Additional 5-10 tests fixed
- Full TraitsGeneratorController suite pass rate → 75-80%

---

### Task 4: Cross-Check Other Controllers for Operation Name Mismatches

**Controllers to Check:**
- `SpeechPatternsGeneratorController`
- `TraitsRewriterController`

**Method:**
1. Review source code for operation names passed to `_handleServiceError()`
2. Search test files for those operation names
3. Update any mismatches found

**Search Example:**
```bash
# Find error handling calls in source
grep "_handleServiceError" src/characterBuilder/controllers/SpeechPatternsGeneratorController.js

# Compare with test expectations
grep "_handleServiceError" tests/unit/characterBuilder/controllers/SpeechPatternsGeneratorController.test.js
```

**Expected Outcome:**
- 0-5 additional tests fixed
- Minor improvements to other controller test suites

---

## Success Criteria

✅ **Primary Criteria:**
1. All test expectations for operation names match current source code
2. No test failures due to operation name mismatches
3. Error handling tests verify the ACTUAL operation names used in code

✅ **Validation Metrics:**
- TraitsGeneratorController: Pass rate increases from 40% → 75-80%
- Total test suite: +26 passing tests (from ~218/377 → ~244/377)

✅ **Quality Gates:**
```bash
# TraitsGeneratorController tests should show significant improvement
NODE_ENV=test npx jest tests/unit/characterBuilder/controllers/TraitsGeneratorController.test.js --no-coverage

# Expected: ~32/42 tests passing (76% pass rate)

# Full child controller suite
NODE_ENV=test npx jest tests/unit/characterBuilder/controllers/ --no-coverage --silent | grep -E "Tests:|Passed:"

# Expected: ~244/377 tests passing (65% pass rate)
```

---

## Dependencies

**Blocked By:**
- CHABUITESFIX-001 (Orchestrator Mock Integration) - Must complete first

**Blocks:**
- CHABUITESFIX-005 (Obsolete Test Removal Assessment) - Should fix salvageable tests first

**Parallel With:**
- CHABUITESFIX-003 (Event Listener Abstraction Alignment)
- CHABUITESFIX-004 (DOM Setup Enhancement)

---

## Implementation Notes

### Operation Name Discovery Strategy

When finding the correct operation name:
1. **Source Code is Truth**: Always use operation name from controller source code
2. **Error Handling Context**: Look at `_handleServiceError()` calls in source
3. **Descriptive Names**: New names should be more specific than old ones

### Pattern for Verification

After each test file update:
```bash
# 1. Run the specific test file
NODE_ENV=test npx jest [test-file] --no-coverage

# 2. Check for operation name errors in output
# Look for messages like: "Expected: 'load thematic directions failed', Received: 'initial data loading failed'"

# 3. If no operation name errors remain, tests are correctly updated
```

### Common Operation Name Patterns

Based on the implementation document and service delegation pattern:

| Old Pattern | New Pattern | Reason |
|-------------|-------------|---------|
| "initial data loading failed" | "load thematic directions failed" | More specific |
| "[generic action] failed" | "[specific service operation] failed" | Clearer error context |
| Short names | Descriptive names | Better debugging |

---

## Risk Assessment

**Risk Level:** 🟢 LOW

**Rationale:**
- Purely test infrastructure updates (no production code changes)
- Operation names are determined by source code (no ambiguity)
- Changes are isolated to test assertions
- Easy to verify correctness (run tests after each change)

**Potential Issues:**
- Missing some operation name changes (mitigation: systematic search across all test files)
- Introducing new typos (mitigation: copy-paste from source code, not manual typing)

---

## Completion Checklist

- [ ] Search all test files for old operation name "initial data loading failed"
- [ ] Create comprehensive list of operation name mismatches
- [ ] Update TraitsGeneratorController.test.js operation names
- [ ] Update TraitsGeneratorController.conceptAccess.test.js operation names
- [ ] Update TraitsGeneratorController.additionalCoverage.test.js operation names
- [ ] Cross-check SpeechPatternsGeneratorController tests
- [ ] Cross-check TraitsRewriterController tests
- [ ] Run TraitsGeneratorController full test suite - verify 75-80% pass rate
- [ ] Run all child controller tests - verify ~244/377 passing
- [ ] Verify no operation name mismatch errors in test output
- [ ] Document any new operation name patterns discovered
- [ ] Update test metrics in implementation document

---

**Created:** 2025-11-16
**Dependencies:** CHABUITESFIX-001 (blocks)
**Estimated Impact:** +26 passing tests
**Next Steps:** Can proceed in parallel with CHABUITESFIX-003 and CHABUITESFIX-004
