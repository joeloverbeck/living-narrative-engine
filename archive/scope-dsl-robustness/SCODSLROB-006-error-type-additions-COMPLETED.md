# SCODSLROB-006: Error Type Additions

## Status: COMPLETED (NO CODE CHANGES REQUIRED)

## Summary
Add new error codes to errorCodes.js for filter evaluation and condition resolution failures. Update error message templates in errorFactory.js.

## Reassessment Findings (2026-01-03)

This ticket was written as a dependency for SCODSLROB-003 (condition ref fail-fast). However, because tickets 001-005 were implemented before this ticket was executed, the required infrastructure was already in place or deemed unnecessary.

### Assumptions vs Reality

| Ticket Assumption | Reality | Status |
|-------------------|---------|--------|
| Add `FILTER_EVALUATION_FAILED: 'SCOPE_3002'` | Already exists as `FILTER_EVAL_FAILED: 'SCOPE_3002'` (line 70 of errorCodes.js) | ✅ Already done |
| Add `CONDITION_REF_NOT_FOUND: 'SCOPE_3003'` | `SCOPE_3003` used for `ENTITY_RESOLUTION_FAILED`. SCODSLROB-003 decided NOT to add a dedicated code - uses `ScopeResolutionError` with rich context instead | ✅ Intentionally skipped |
| Add `filterEvaluationFailed` template | SCODSLROB-002 implemented fail-fast using `ScopeResolutionError` directly with context object | ✅ Alternative approach used |
| Add `conditionRefNotFound` template | SCODSLROB-003 implemented fail-fast using `ScopeResolutionError` directly with helpful message | ✅ Alternative approach used |
| Create `errorCodes.test.js` | Already exists with 55 tests | ✅ Already exists |
| Create `errorFactory.templates.test.js` | `errorFactory.test.js` exists with 43 comprehensive tests | ✅ Already exists |

### Implementation Decisions Made in Prior Tickets

1. **SCODSLROB-002** (Filter Evaluation Fail-Fast):
   - Used existing `FILTER_EVAL_FAILED` code
   - Throws `ScopeResolutionError` with rich context (entityId, filterLogic, scopeName)
   - No new templates needed

2. **SCODSLROB-003** (Condition Reference Fail-Fast):
   - Explicitly decided: "NO new error codes needed (use existing ScopeResolutionError)"
   - Error message includes condition name and helpful hint
   - No new templates needed

## File List

### Files That Already Exist (No Changes Needed)
1. `src/scopeDsl/constants/errorCodes.js` - Already has `FILTER_EVAL_FAILED: 'SCOPE_3002'`
2. `src/scopeDsl/core/errorFactory.js` - Existing templates sufficient
3. `tests/unit/scopeDsl/constants/errorCodes.test.js` - 55 comprehensive tests
4. `tests/unit/scopeDsl/core/errorFactory.test.js` - 43 comprehensive tests

### Out of Scope (Per Original Ticket)
- NO new error classes (use existing ScopeResolutionError) ✓
- NO changes to BaseError ✓
- NO changes to error handler ✓
- NO changes to existing error codes ✓

## Acceptance Criteria

### Tests That Must Pass
All existing tests continue to pass:
- ✅ `errorCodes.test.js` - 55 tests pass
- ✅ `errorFactory.test.js` - 43 tests pass
- ✅ `filterResolver.failFast.test.js` - 12 tests pass
- ✅ `filterResolver.conditionRefErrors.test.js` - 7 tests pass

### Invariants That Must Remain True
- ✅ Existing error codes unchanged
- ✅ Error code numbering scheme consistent (3xxx = resolution errors)
- ✅ Templates produce valid ScopeResolutionError context

---

## Outcome

### What Was Actually Changed vs Originally Planned

**No code changes required.** The work this ticket envisioned was either:
1. Already implemented (FILTER_EVAL_FAILED exists)
2. Intentionally skipped in favor of better alternatives (direct ScopeResolutionError with context)

### Rationale for No Changes

The original ticket was designed as a prerequisite for fail-fast behavior. When SCODSLROB-002 and SCODSLROB-003 were implemented, they found that:

1. The existing `FILTER_EVAL_FAILED` code was sufficient
2. Adding a `CONDITION_REF_NOT_FOUND` code would duplicate `SCOPE_3003` (already used by `ENTITY_RESOLUTION_FAILED`)
3. The errorFactory templates were unnecessary - using `ScopeResolutionError` directly with rich context objects provides better debugging information

### Test Verification (2026-01-03)
```
$ NODE_ENV=test npx jest tests/unit/scopeDsl/constants/errorCodes.test.js tests/unit/scopeDsl/core/errorFactory.test.js --no-coverage --silent
PASS tests/unit/scopeDsl/constants/errorCodes.test.js
PASS tests/unit/scopeDsl/core/errorFactory.test.js
Test Suites: 2 passed, 2 total
Tests: 98 passed, 98 total
```

### New/Modified Tests
None required - existing test coverage is comprehensive.

### Completion Date
2026-01-03
