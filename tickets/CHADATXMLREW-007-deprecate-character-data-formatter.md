# CHADATXMLREW-007: Deprecate and Remove CharacterDataFormatter

**Priority:** P2 - MEDIUM (Cleanup)
**Effort:** 1-2 hours
**Status:** Not Started
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

## Files to Delete

| File | Reason |
|------|--------|
| `src/prompting/CharacterDataFormatter.js` | Replaced by CharacterDataXmlBuilder |
| `tests/unit/prompting/CharacterDataFormatter.test.js` | Tests deprecated class |

---

## Files to Verify/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/prompting/AIPromptContentProvider.js` | VERIFY | Confirm no import of CharacterDataFormatter |
| `tests/integration/prompting/CharacterDataFormatter.integration.test.js` | RENAME | Rename to characterDataXmlBuilder.integration.test.js |
| `tests/integration/CharacterDataFormatter.integration.test.js` | DELETE OR REDIRECT | Remove duplicate or update |

---

## Out of Scope

**DO NOT modify:**
- `CharacterDataXmlBuilder.js` - already complete
- `XmlElementBuilder.js` - already complete
- `AIPromptContentProvider.js` functionality (only verify no dead imports)
- Any other source files

---

## Implementation Details

### Step 1: Verify No References Remain

Before deleting, search for any remaining references:

```bash
# Search for import statements
grep -r "CharacterDataFormatter" src/
grep -r "CharacterDataFormatter" tests/

# Expected results:
# - Only in the files we're deleting
# - No references in AIPromptContentProvider.js (removed in CHADATXMLREW-004)
```

### Step 2: Delete Source File

```bash
rm src/prompting/CharacterDataFormatter.js
```

### Step 3: Delete Unit Tests

```bash
rm tests/unit/prompting/CharacterDataFormatter.test.js
```

### Step 4: Handle Integration Tests

**Option A: Rename** (if tests were updated in CHADATXMLREW-006)
```bash
mv tests/integration/prompting/CharacterDataFormatter.integration.test.js \
   tests/integration/prompting/characterDataXmlBuilder.integration.test.js
```

**Option B: Delete** (if tests were migrated to a new file)
```bash
rm tests/integration/prompting/CharacterDataFormatter.integration.test.js
```

### Step 5: Clean Up Root-Level Integration Test

Check if `tests/integration/CharacterDataFormatter.integration.test.js` exists and handle appropriately:
- If it duplicates the prompting folder version → delete
- If it has unique tests → migrate to XML builder tests

### Step 6: Verify Build and Tests

```bash
# Verify no import errors
npm run build

# Run all tests to verify nothing breaks
npm run test:ci

# Check for unused files
npm run lint
```

---

## Acceptance Criteria

### Verification Checks

1. **No compile errors**
   - `npm run build` succeeds
   - `npm run typecheck` succeeds

2. **No import references remain**
   - `grep -r "CharacterDataFormatter" src/` returns nothing
   - `grep -r "from.*CharacterDataFormatter" tests/` returns nothing (excluding deleted files)

3. **All tests pass**
   - `npm run test:ci` passes
   - No test is looking for the deleted file

4. **Coverage maintained**
   - Overall coverage not reduced
   - No gaps introduced by removal

### Invariants That Must Remain True

- **No functionality regression** - all character persona features work via XML builder
- **No dead imports** - no files importing the removed class
- **Test coverage maintained** - equivalent tests exist for XML builder
- **Clean repository** - no orphaned files or references

### Files That Should NOT Exist After This Ticket

- `src/prompting/CharacterDataFormatter.js`
- `tests/unit/prompting/CharacterDataFormatter.test.js`
- Any reference to `CharacterDataFormatter` in remaining codebase

### Files That SHOULD Exist (Verification)

- `src/prompting/characterDataXmlBuilder.js`
- `src/prompting/xmlElementBuilder.js`
- `tests/unit/prompting/characterDataXmlBuilder.test.js`
- `tests/unit/prompting/xmlElementBuilder.test.js`
- `tests/integration/prompting/characterDataXmlBuilder.integration.test.js`

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
npm run test:unit -- --coverage
npm run test:integration -- --coverage

# Lint for dead code detection
npx eslint src/prompting/ tests/unit/prompting/ tests/integration/prompting/
```

---

## Rollback Plan

If issues are discovered after deletion:

1. Restore from git:
   ```bash
   git checkout HEAD -- src/prompting/CharacterDataFormatter.js
   git checkout HEAD -- tests/unit/prompting/CharacterDataFormatter.test.js
   ```

2. Investigate the dependency

3. Update integration point before re-attempting deletion

---

## Notes

- This is a cleanup ticket - should be low risk if prior tickets completed correctly
- The class has ~600 lines of code being removed - expect build time improvement
- Integration tests may need special handling depending on how CHADATXMLREW-006 handled them
- Consider adding a git tag before deletion for easy reference: `git tag pre-character-formatter-removal`
