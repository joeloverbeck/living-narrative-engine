# CHADATXMLREW-007: Deprecate and Remove CharacterDataFormatter

**Priority:** P2 - MEDIUM (Cleanup)
**Effort:** 1-2 hours
**Status:** COMPLETED
**Spec Reference:** [specs/character-data-xml-rework.md](../specs/character-data-xml-rework.md) - "Phase 4: Cleanup" section
**Depends On:** CHADATXMLREW-004, CHADATXMLREW-006 (integration complete and tests updated)

---

## Problem Statement

After the successful integration of `CharacterDataXmlBuilder`, the original `CharacterDataFormatter` class is no longer used. This ticket handles:

1. Removing the deprecated class file
2. Removing associated unit tests
3. Cleaning up any remaining references or imports
4. Verifying no dead code remains

This is a cleanup ticket - all functionality has been replaced by this point.

---

## Assumptions Assessment (2025-11-25)

**Original Ticket Assumptions vs Reality:**

| Assumption                                                                                            | Reality                                                                                                                         | Impact                                                                  |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/prompting/CharacterDataFormatter.js` exists                                                      | ✅ CORRECT                                                                                                                      | Will be deleted                                                         |
| `tests/unit/prompting/CharacterDataFormatter.test.js` exists                                          | ✅ CORRECT                                                                                                                      | Will be deleted                                                         |
| No imports in `AIPromptContentProvider.js`                                                            | ✅ CORRECT                                                                                                                      | Already uses `CharacterDataXmlBuilder`                                  |
| `tests/integration/prompting/CharacterDataFormatter.integration.test.js` tests CharacterDataFormatter | ⚠️ PARTIALLY - Tests CharacterDataFormatter directly via import, but also tests AIPromptContentProvider with mocked XML builder | Delete - coverage maintained via unit tests for CharacterDataXmlBuilder |
| `tests/integration/CharacterDataFormatter.integration.test.js` exists                                 | ❌ WRONG FILE - Contains MultiTargetValidation tests (unrelated)                                                                | NO ACTION needed on this file                                           |
| `characterDataXmlBuilder.integration.test.js` should exist                                            | ❌ File does not exist                                                                                                          | Not required - coverage maintained via unit tests                       |
| `tests/integration/prompting/enhancedCharacterPrompts.integration.test.js` exists                     | ⚠️ DISCOVERED - Imports CharacterDataFormatter directly, tests deprecated class                                                 | Delete - tests deprecated functionality                                 |

**Key Finding:** The integration test file `tests/integration/prompting/CharacterDataFormatter.integration.test.js`:

- Imports `CharacterDataFormatter` directly
- Tests CharacterDataFormatter methods like `formatCharacterPersona()`, `formatPhysicalDescription()`, etc.
- Uses a mock `characterDataXmlBuilder` for AIPromptContentProvider integration
- This test file is deprecated along with the class it tests

---

## Files to Delete

| File                                                                       | Reason                                                             |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/prompting/CharacterDataFormatter.js`                                  | Replaced by CharacterDataXmlBuilder                                |
| `tests/unit/prompting/CharacterDataFormatter.test.js`                      | Tests deprecated class                                             |
| `tests/integration/prompting/CharacterDataFormatter.integration.test.js`   | Tests deprecated class directly                                    |
| `tests/integration/prompting/enhancedCharacterPrompts.integration.test.js` | Tests deprecated class directly (discovered during implementation) |

---

## Files to Verify/Clean

| File                                       | Action | Description                                               |
| ------------------------------------------ | ------ | --------------------------------------------------------- |
| `src/prompting/AIPromptContentProvider.js` | VERIFY | ✅ Confirmed: no import of CharacterDataFormatter         |
| `src/prompting/characterDataXmlBuilder.js` | VERIFY | Remove `@see CharacterDataFormatter.js` comment reference |

---

## Out of Scope

**DO NOT modify:**

- `CharacterDataXmlBuilder.js` - already complete (except removing legacy reference comment)
- `XmlElementBuilder.js` - already complete
- `AIPromptContentProvider.js` functionality (only verify no dead imports)
- `tests/integration/CharacterDataFormatter.integration.test.js` (root-level) - WRONG FILE, unrelated MultiTargetValidation tests
- Any other source files

---

## Implementation Details

### Step 1: Delete Source File

```bash
rm src/prompting/CharacterDataFormatter.js
```

### Step 2: Delete Unit Tests

```bash
rm tests/unit/prompting/CharacterDataFormatter.test.js
```

### Step 3: Delete Integration Tests

```bash
rm tests/integration/prompting/CharacterDataFormatter.integration.test.js
```

### Step 4: Clean Up Reference Comment

Remove the `@see CharacterDataFormatter.js` comment from `characterDataXmlBuilder.js` line 7.

### Step 5: Verify Build and Tests

```bash
# Verify no import errors
npm run build

# Run all tests to verify nothing breaks
npm run test:ci

# Lint for dead code detection
npx eslint src/prompting/ tests/unit/prompting/ tests/integration/prompting/
```

---

## Acceptance Criteria

### Verification Checks

1. **No compile errors**
   - `npm run build` succeeds
   - `npm run typecheck` succeeds

2. **No import references remain**
   - `grep -r "CharacterDataFormatter" src/` returns nothing
   - `grep -r "from.*CharacterDataFormatter" tests/` returns nothing

3. **All tests pass**
   - `npm run test:ci` passes
   - No test is looking for the deleted file

4. **Coverage maintained**
   - CharacterDataXmlBuilder has comprehensive unit tests
   - AIPromptContentProvider tests verify XML builder integration

### Files That Should NOT Exist After This Ticket

- `src/prompting/CharacterDataFormatter.js`
- `tests/unit/prompting/CharacterDataFormatter.test.js`
- `tests/integration/prompting/CharacterDataFormatter.integration.test.js`
- Any reference to `CharacterDataFormatter` in remaining codebase (except archived docs)

### Files That SHOULD Exist (Verification)

- `src/prompting/characterDataXmlBuilder.js`
- `src/prompting/xmlElementBuilder.js`
- `tests/unit/prompting/characterDataXmlBuilder.test.js`
- `tests/unit/prompting/xmlElementBuilder.test.js`

---

## Testing Commands

```bash
# Pre-deletion verification
grep -r "CharacterDataFormatter" src/ tests/

# Post-deletion verification
npm run build
npm run typecheck
npm run test:ci

# Coverage check
npm run test:unit -- --coverage --testPathPattern="prompting"

# Lint specific files
npx eslint src/prompting/ tests/unit/prompting/ tests/integration/prompting/
```

---

## Rollback Plan

If issues are discovered after deletion:

1. Restore from git:

   ```bash
   git checkout HEAD -- src/prompting/CharacterDataFormatter.js
   git checkout HEAD -- tests/unit/prompting/CharacterDataFormatter.test.js
   git checkout HEAD -- tests/integration/prompting/CharacterDataFormatter.integration.test.js
   ```

2. Investigate the dependency

3. Update integration point before re-attempting deletion

---

## Notes

- This is a cleanup ticket - should be low risk since prior tickets confirmed correct integration
- The class has ~600 lines of code being removed
- Integration tests file (~1500 lines) is deleted as it tests the deprecated class directly
- Test coverage is maintained via existing CharacterDataXmlBuilder unit tests
- The root-level `tests/integration/CharacterDataFormatter.integration.test.js` is a DIFFERENT file (MultiTargetValidation tests) - do not touch

---

## Outcome

**Originally Planned:**

- Delete 2 files: source and unit tests
- Rename/delete integration test file
- Verify no dead code

**Actually Changed:**

- Deleted 4 files: source, unit tests, and two integration test files
- Removed `@see` comment reference in characterDataXmlBuilder.js
- Verified no remaining references in codebase (except archived docs/reports)

**Tests Modified:** None (existing CharacterDataXmlBuilder tests provide coverage)
**Tests Added:** None (coverage already comprehensive)
**Tests Deleted:**

- `src/prompting/CharacterDataFormatter.js` - deprecated class (~618 lines)
- `tests/unit/prompting/CharacterDataFormatter.test.js` - deprecated class tests
- `tests/integration/prompting/CharacterDataFormatter.integration.test.js` - deprecated class integration tests (~1500 lines)
- `tests/integration/prompting/enhancedCharacterPrompts.integration.test.js` - discovered during implementation, tests deprecated CharacterDataFormatter directly (~490 lines)

**Rationale:** All deleted test files directly instantiated and tested CharacterDataFormatter, which is being deprecated. The AIPromptContentProvider integration is already tested via unit tests that mock the characterDataXmlBuilder dependency. CharacterDataXmlBuilder has its own comprehensive unit tests.
