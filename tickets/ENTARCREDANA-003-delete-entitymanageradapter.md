# ENTARCREDANA-003: Delete EntityManagerAdapter and Update Tests

## Summary

Delete the now-unused `EntityManagerAdapter` class file and update/remove its associated test files. This completes the adapter elimination phase.

## Priority: High | Effort: Low | Risk: Low

## Rationale

After ENTARCREDANA-001 and ENTARCREDANA-002, `EntityManagerAdapter` is no longer used anywhere in the codebase. Its sole purpose was to add `getEntitiesInLocation()` which is now directly on EntityManager. Keeping the file would be dead code that confuses developers.

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/entities/entityManagerAdapter.js` | **Delete** - No longer used |
| `tests/unit/entities/entityManagerAdapter.test.js` | **Delete** - Tests obsolete class |
| `tests/unit/entities/entityManagerAdapter.branches.test.js` | **Delete** - Tests obsolete class |
| `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` | **Modify** - Remove commented import |

## Out of Scope

- **DO NOT** modify `EntityManager` - that was ENTARCREDANA-001
- **DO NOT** modify any other DI registrations
- **DO NOT** modify test helper files (`tests/common/entities/TestEntityManagerAdapter.js`) - these serve different purposes for testing
- **DO NOT** touch `EntityCreationManager` or `EntityMutationManager` - that's ENTARCREDANA-004/005

## Implementation Details

### Step 1: Verify No References Remain

Before deleting, verify no code references EntityManagerAdapter:

```bash
# Search for any remaining references
grep -r "EntityManagerAdapter" src/ --include="*.js"
grep -r "entityManagerAdapter" src/ --include="*.js"
```

Expected: No results (or only the file itself and the commented import)

### Step 2: Delete Source File

```bash
rm src/entities/entityManagerAdapter.js
```

### Step 3: Delete Test Files

```bash
rm tests/unit/entities/entityManagerAdapter.test.js
rm tests/unit/entities/entityManagerAdapter.branches.test.js
```

### Step 4: Clean Up Commented Import

**File:** `src/dependencyInjection/registrations/worldAndEntityRegistrations.js`

Remove the commented import line that was left in ENTARCREDANA-002:

```javascript
// Remove this line entirely:
// import EntityManagerAdapter from '../../entities/entityManagerAdapter.js';
```

### Step 5: Verify No Broken Imports

```bash
# Check for any imports of the deleted file
grep -r "entityManagerAdapter" src/ tests/ --include="*.js"
```

Expected: No results referencing the deleted files

## Acceptance Criteria

### Tests That Must Pass

- [ ] `npm run test:unit` passes (deleted tests should not cause failures)
- [ ] `npm run test:integration` passes
- [ ] `npm run test:ci` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds (no missing module errors)

### Invariants That Must Remain True

1. **No Dead Code**: `src/entities/entityManagerAdapter.js` must not exist
2. **No Orphan Tests**: Test files for deleted class must not exist
3. **No Broken Imports**: No file should import `entityManagerAdapter`
4. **Build Success**: Application must build without missing module errors
5. **TestEntityManagerAdapter Preserved**: `tests/common/entities/TestEntityManagerAdapter.js` must NOT be deleted (different purpose)

## Verification Steps

```bash
# Verify files are deleted
ls src/entities/entityManagerAdapter.js 2>&1 | grep "No such file"
ls tests/unit/entities/entityManagerAdapter.test.js 2>&1 | grep "No such file"
ls tests/unit/entities/entityManagerAdapter.branches.test.js 2>&1 | grep "No such file"

# Verify no remaining references
grep -r "entityManagerAdapter" src/ --include="*.js"
# Should return nothing

# Verify test helper still exists (should NOT be deleted)
ls tests/common/entities/TestEntityManagerAdapter.js
# Should exist

# Run full test suite
npm run test:ci

# Build verification
npm run build

# Type check
npm run typecheck
```

## File Deletion Checklist

| File | Status | Notes |
|------|--------|-------|
| `src/entities/entityManagerAdapter.js` | DELETE | Main adapter class |
| `tests/unit/entities/entityManagerAdapter.test.js` | DELETE | Unit tests |
| `tests/unit/entities/entityManagerAdapter.branches.test.js` | DELETE | Branch coverage tests |
| `tests/common/entities/TestEntityManagerAdapter.js` | **KEEP** | Different class, used for testing |

## Dependencies

- **ENTARCREDANA-002** must be completed first (DI no longer uses adapter)

## Blocked By

- ENTARCREDANA-001
- ENTARCREDANA-002

## Blocks

- None (this completes Phase 1)
