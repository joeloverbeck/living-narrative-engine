# CHABUITESFIX-003: Event Listener Abstraction Alignment

**Status**: Ready for Implementation
**Priority**: MEDIUM (Specific Issue - Fixes 8% of Test Failures)
**Estimated Effort**: 1.5 hours
**Reference**: [BASCHACUICONREF-011-implementation-complete.md](../claudedocs/BASCHACUICONREF-011-implementation-complete.md)

---

## Problem Statement

During the BaseCharacterBuilderController service delegation refactoring (BASCHACUICONREF-011), event listener registration was abstracted through the `EventListenerRegistry` service. However, tests are still verifying event listeners at the wrong abstraction level by spying on raw `addEventListener` calls instead of the service abstraction. This causes **8% of test failures**.

**Evidence from Implementation Document:**
> **Event Listener Verification at Wrong Abstraction Level** (8% of failures)
> - **Pattern**: Tests spy on `addEventListener` but code uses `EventListenerRegistry` service
> - **Fix**: Update tests to verify through service abstraction

**Root Cause:** Tests were written against the old direct `addEventListener` pattern and were not updated to verify through the new `EventListenerRegistry` service abstraction.

---

## Architectural Context

### Old Pattern (Before Refactoring)
```javascript
// Controller code:
element.addEventListener('click', handler);

// Test code:
jest.spyOn(element, 'addEventListener');
expect(element.addEventListener).toHaveBeenCalledWith('click', handler);
```

### New Pattern (After Service Delegation)
```javascript
// Controller code:
this._addEventListener(element, 'click', handler);
// Internally calls: this.#eventListenerRegistry.register(element, 'click', handler)

// Test code (CORRECT):
expect(mockEventListenerRegistry.register).toHaveBeenCalledWith(element, 'click', handler);

// Test code (WRONG - what currently exists):
jest.spyOn(element, 'addEventListener'); // ❌ Tests wrong abstraction level
```

**Key Insight:** The controller no longer calls `addEventListener` directly—it uses the `EventListenerRegistry` service. Tests must verify the service call, not the DOM API call.

---

## Scope

**Primary Affected Controller:**
- `SpeechPatternsGeneratorController` (most event listener usage)

**Affected Test Files:**
1. `tests/unit/characterBuilder/controllers/SpeechPatternsGeneratorController.test.js`
2. `tests/unit/characterBuilder/controllers/SpeechPatternsGeneratorController.coverageEnhanced.test.js`
3. `tests/unit/characterBuilder/controllers/SpeechPatternsGeneratorController.edgeCases.test.js`
4. `tests/unit/characterBuilder/controllers/speechPatternsCharacterValidation.test.js`

**Secondary Check:**
- Other controllers may have similar issues (TraitsGeneratorController, TraitsRewriterController)

**Total Tests Impacted:** ~30 failing tests (8% of 377 total)

---

## Implementation Tasks

### Task 1: Audit Current Event Listener Test Patterns

**Search for Wrong Abstraction Level:**
```bash
# Find tests spying on addEventListener directly
grep -rn "addEventListener" tests/unit/characterBuilder/controllers/SpeechPatternsGeneratorController*.test.js

# Find tests expecting addEventListener calls
grep -rn "toHaveBeenCalledWith.*addEventListener" tests/unit/characterBuilder/controllers/
```

**Expected Findings:**
- Multiple instances of `jest.spyOn(element, 'addEventListener')`
- Test assertions expecting `addEventListener` to be called
- No verification of `EventListenerRegistry.register` calls

**Output:** Create inventory of:
1. Test file path and line number
2. Event type being tested (click, input, change, etc.)
3. Element being tested
4. Expected handler function

---

### Task 2: Update SpeechPatternsGeneratorController.test.js

**File:** `tests/unit/characterBuilder/controllers/SpeechPatternsGeneratorController.test.js`

**Pattern to Find:**
```javascript
// OLD pattern (wrong abstraction):
jest.spyOn(element, 'addEventListener');
expect(element.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
```

**Pattern to Replace With:**
```javascript
// NEW pattern (correct abstraction):
// Assumes test bed provides mockEventListenerRegistry
expect(mockEventListenerRegistry.register).toHaveBeenCalledWith(
  element,
  'click',
  expect.any(Function)
);
```

**Validation:**
```bash
NODE_ENV=test npx jest tests/unit/characterBuilder/controllers/SpeechPatternsGeneratorController.test.js --no-coverage
```

**Expected Outcome:**
- Pass rate increases from 19/84 (23%) → ~40/84 (48%)
- No `addEventListener` spies remain in tests
- All event listener tests verify `EventListenerRegistry.register` instead

---

### Task 3: Update Test Bed to Expose EventListenerRegistry Mock

**File:** `tests/common/speechPatternsGeneratorTestBed.js`

**Verify Mock Export:**
```javascript
// Test bed should export:
return {
  // ... existing exports
  mockEventListenerRegistry, // ✅ Must be accessible to tests
};
```

**If Missing, Add:**
```javascript
const mockEventListenerRegistry = {
  register: jest.fn(),
  unregister: jest.fn(),
  unregisterAll: jest.fn(),
};

// Register in DI container:
container.registerInstance(tokens.IEventListenerRegistry, mockEventListenerRegistry);

// Export for test access:
return {
  // ... existing exports
  mockEventListenerRegistry,
};
```

**Validation:**
```javascript
// In test file, verify access:
const testBed = createSpeechPatternsGeneratorTestBed();
expect(testBed.mockEventListenerRegistry).toBeDefined();
expect(testBed.mockEventListenerRegistry.register).toEqual(expect.any(Function));
```

---

### Task 4: Update Additional SpeechPatternsGeneratorController Test Files

**Files to Update:**
1. `SpeechPatternsGeneratorController.coverageEnhanced.test.js`
2. `SpeechPatternsGeneratorController.edgeCases.test.js`
3. `speechPatternsCharacterValidation.test.js`

**Process for Each File:**
1. Search for `addEventListener` patterns
2. Replace with `EventListenerRegistry.register` verification
3. Run tests individually to verify fixes
4. Track pass rate improvements

**Expected Outcome:**
- Additional ~10-15 tests fixed across these files
- Total SpeechPatternsGeneratorController pass rate → ~60-65%

---

### Task 5: Cross-Check Other Controllers for Event Listener Issues

**Controllers to Audit:**
- `TraitsGeneratorController`
- `TraitsRewriterController`
- `BaseCharacterBuilderController` (reference implementation)

**Method:**
```bash
# Search for addEventListener spies in other controller tests
grep -rn "addEventListener" tests/unit/characterBuilder/controllers/TraitsGeneratorController*.test.js
grep -rn "addEventListener" tests/unit/characterBuilder/controllers/TraitsRewriterController*.test.js
```

**Action:**
- If found: Apply same abstraction alignment pattern
- If not found: No action needed

**Expected Outcome:**
- 0-5 additional tests fixed (if issues exist)

---

## Success Criteria

✅ **Primary Criteria:**
1. No tests spy on raw `addEventListener` DOM API calls
2. All event listener tests verify `EventListenerRegistry.register` service calls
3. Test beds expose `mockEventListenerRegistry` for test access
4. Event listener verification matches the service delegation architecture

✅ **Validation Metrics:**
- SpeechPatternsGeneratorController: Pass rate increases from 23% → 60-65%
- Total test suite: +30 passing tests (from ~244/377 → ~274/377)

✅ **Quality Gates:**
```bash
# SpeechPatternsGeneratorController tests should show significant improvement
NODE_ENV=test npx jest tests/unit/characterBuilder/controllers/SpeechPatternsGeneratorController.test.js --no-coverage

# Expected: ~50/84 tests passing (60% pass rate)

# Verify no addEventListener spies remain
grep -rn "spyOn.*addEventListener" tests/unit/characterBuilder/controllers/ | wc -l
# Expected: 0 (or only in BaseCharacterBuilderController as reference)

# Full child controller suite
NODE_ENV=test npx jest tests/unit/characterBuilder/controllers/ --no-coverage --silent | grep -E "Tests:|Passed:"

# Expected: ~274/377 tests passing (73% pass rate)
```

---

## Dependencies

**Blocked By:**
- CHABUITESFIX-001 (Orchestrator Mock Integration) - Must complete first

**Blocks:**
- CHABUITESFIX-005 (Obsolete Test Removal Assessment) - Should fix salvageable tests first

**Parallel With:**
- CHABUITESFIX-002 (Test Expectations Modernization)
- CHABUITESFIX-004 (DOM Setup Enhancement)

---

## Implementation Notes

### Service Abstraction Principle

**Key Concept:** Tests should verify behavior at the same abstraction level as the production code.

**Production Code Abstraction:**
```javascript
// BaseCharacterBuilderController uses wrapper method
this._addEventListener(element, 'click', handler);

// Which delegates to service
this.#eventListenerRegistry.register(element, 'click', handler);
```

**Test Abstraction (Aligned):**
```javascript
// Verify the SERVICE was called correctly
expect(mockEventListenerRegistry.register).toHaveBeenCalledWith(
  element,
  'click',
  expect.any(Function)
);
```

**Why This Matters:**
- Tests verify controller behavior, not DOM internals
- Tests remain valid if EventListenerRegistry implementation changes
- Tests match architectural boundaries (service delegation pattern)

### EventListenerRegistry Mock Interface

The mock must implement the complete interface:
```javascript
{
  register: jest.fn(),          // Called by _addEventListener wrapper
  unregister: jest.fn(),        // Called by cleanup logic
  unregisterAll: jest.fn(),     // Called by controller destruction
}
```

### Test Migration Pattern

For each test verifying event listeners:

**Step 1: Identify Pattern**
```javascript
// Find this pattern:
jest.spyOn(button, 'addEventListener');
controller.initialize();
expect(button.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
```

**Step 2: Replace Pattern**
```javascript
// Replace with:
controller.initialize();
expect(mockEventListenerRegistry.register).toHaveBeenCalledWith(
  button,
  'click',
  expect.any(Function)
);
```

**Step 3: Verify**
- Run test individually
- Check that event listener tests pass
- Verify no `addEventListener` spies remain

---

## Risk Assessment

**Risk Level:** 🟢 LOW

**Rationale:**
- Purely test infrastructure updates (no production code changes)
- Service abstraction is already working (BaseCharacterBuilderController 51/51 passing)
- Clear pattern to follow (align with service delegation architecture)
- Easy to verify correctness (run tests after each change)

**Potential Issues:**
- Missing EventListenerRegistry mock in test beds (mitigation: Task 3 ensures mock availability)
- Incomplete mock interface (mitigation: copy working pattern from BaseCharacterBuilderController tests)
- Tests verifying event handler behavior (not just registration) may need additional updates (mitigation: handle case-by-case)

---

## Architectural Alignment Reference

**BaseCharacterBuilderController Tests** (51/51 passing) demonstrate correct pattern:
- File: `tests/unit/characterBuilder/controllers/BaseCharacterBuilderController.test.js`
- Pattern: Tests verify `mockEventListenerRegistry.register` calls
- Result: 100% pass rate proves pattern correctness

**Use as Template:**
1. Review how BaseCharacterBuilderController tests verify event listeners
2. Apply same verification pattern to child controller tests
3. Ensure test beds provide equivalent mock access

---

## Completion Checklist

- [ ] Audit all SpeechPatternsGeneratorController test files for `addEventListener` spies
- [ ] Create comprehensive inventory of event listener test patterns
- [ ] Verify `speechPatternsGeneratorTestBed.js` exposes `mockEventListenerRegistry`
- [ ] Update SpeechPatternsGeneratorController.test.js event listener tests
- [ ] Update SpeechPatternsGeneratorController.coverageEnhanced.test.js
- [ ] Update SpeechPatternsGeneratorController.edgeCases.test.js
- [ ] Update speechPatternsCharacterValidation.test.js
- [ ] Cross-check TraitsGeneratorController tests for event listener issues
- [ ] Cross-check TraitsRewriterController tests for event listener issues
- [ ] Run SpeechPatternsGeneratorController full test suite - verify 60-65% pass rate
- [ ] Verify no `addEventListener` spies remain (grep verification)
- [ ] Run all child controller tests - verify ~274/377 passing
- [ ] Document abstraction alignment pattern for future reference
- [ ] Update test metrics in implementation document

---

**Created:** 2025-11-16
**Dependencies:** CHABUITESFIX-001 (blocks)
**Estimated Impact:** +30 passing tests
**Next Steps:** Can proceed in parallel with CHABUITESFIX-002 and CHABUITESFIX-004
