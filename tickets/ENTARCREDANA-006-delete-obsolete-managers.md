# ENTARCREDANA-006: Delete Obsolete Manager Files and Tests

## Summary

Delete the now-unused `EntityCreationManager` and `EntityMutationManager` class files along with their associated test files. This completes the manager consolidation phase.

## Priority: Medium | Effort: Low | Risk: Low

## Rationale

After ENTARCREDANA-004 and ENTARCREDANA-005, these managers are no longer instantiated or used anywhere in the codebase. Their methods have been inlined into EntityManager. Keeping these files would be dead code that:
- Confuses developers about the actual architecture
- Requires maintenance for unused code
- Bloats the codebase unnecessarily

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/entities/managers/EntityCreationManager.js` | **Delete** - No longer used |
| `src/entities/managers/EntityMutationManager.js` | **Delete** - No longer used |
| `tests/unit/entities/managers/EntityCreationManager.test.js` | **Delete** - Tests obsolete class |
| `tests/unit/entities/managers/EntityMutationManager.test.js` | **Delete** - Tests obsolete class |

## Out of Scope

- **DO NOT** delete `EntityQueryManager.js` - this one has actual query logic and stays
- **DO NOT** delete `EntityQueryManager.test.js` - tests for preserved class
- **DO NOT** modify `EntityManager` - that was ENTARCREDANA-004/005
- **DO NOT** delete the `managers/` directory - EntityQueryManager remains there
- **DO NOT** modify any validation utilities used by the managers

## Implementation Details

### Step 1: Verify No References Remain

Before deleting, verify no code references these managers:

```bash
# Search for EntityCreationManager references
grep -r "EntityCreationManager" src/ --include="*.js"
grep -r "entityCreationManager" src/ --include="*.js"

# Search for EntityMutationManager references
grep -r "EntityMutationManager" src/ --include="*.js"
grep -r "entityMutationManager" src/ --include="*.js"
```

Expected: No results (managers should be unused after ENTARCREDANA-004/005)

### Step 2: Delete Source Files

```bash
rm src/entities/managers/EntityCreationManager.js
rm src/entities/managers/EntityMutationManager.js
```

### Step 3: Delete Test Files

```bash
rm tests/unit/entities/managers/EntityCreationManager.test.js
rm tests/unit/entities/managers/EntityMutationManager.test.js
```

### Step 4: Verify managers/ Directory Structure

After deletion, the managers directory should still exist with EntityQueryManager:

```bash
ls -la src/entities/managers/
# Expected:
# EntityQueryManager.js (preserved)
# possibly index.js or other files
```

### Step 5: Verify No Broken Imports

```bash
# Check for any imports of deleted files
grep -r "EntityCreationManager" src/ tests/ --include="*.js"
grep -r "EntityMutationManager" src/ tests/ --include="*.js"
```

Expected: No results referencing the deleted files

### Step 6: Verify Test Directory Structure

```bash
ls -la tests/unit/entities/managers/
# Should still contain:
# EntityQueryManager.test.js (preserved)
```

If the directory becomes empty (no EntityQueryManager tests), it can be removed. Otherwise, keep it.

## Acceptance Criteria

### Tests That Must Pass

- [ ] `npm run test:unit` passes (deleted tests should not cause failures)
- [ ] `npm run test:integration` passes
- [ ] `npm run test:ci` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds (no missing module errors)

### Invariants That Must Remain True

1. **No Dead Code**: Deleted manager files must not exist
2. **No Orphan Tests**: Test files for deleted classes must not exist
3. **No Broken Imports**: No file should import deleted managers
4. **Build Success**: Application must build without missing module errors
5. **EntityQueryManager Preserved**: `EntityQueryManager.js` and its tests must NOT be deleted
6. **managers/ Directory Preserved**: Directory should remain (contains EntityQueryManager)

## Verification Steps

```bash
# Verify source files are deleted
ls src/entities/managers/EntityCreationManager.js 2>&1 | grep "No such file"
ls src/entities/managers/EntityMutationManager.js 2>&1 | grep "No such file"

# Verify test files are deleted
ls tests/unit/entities/managers/EntityCreationManager.test.js 2>&1 | grep "No such file"
ls tests/unit/entities/managers/EntityMutationManager.test.js 2>&1 | grep "No such file"

# Verify EntityQueryManager still exists
ls src/entities/managers/EntityQueryManager.js
# Should exist

# Verify no remaining references
grep -r "EntityCreationManager\|EntityMutationManager" src/ --include="*.js"
# Should return nothing

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
| `src/entities/managers/EntityCreationManager.js` | DELETE | Inlined into EntityManager |
| `src/entities/managers/EntityMutationManager.js` | DELETE | Inlined into EntityManager |
| `src/entities/managers/EntityQueryManager.js` | **KEEP** | Contains actual query logic |
| `tests/unit/entities/managers/EntityCreationManager.test.js` | DELETE | Tests obsolete class |
| `tests/unit/entities/managers/EntityMutationManager.test.js` | DELETE | Tests obsolete class |
| `tests/unit/entities/managers/EntityQueryManager.test.js` | **KEEP** | Tests preserved class |

## Post-Deletion Verification

After completing this ticket, run the metrics check from the original analysis:

```bash
# Count files in entities directory
find src/entities -name "*.js" | wc -l
# Expected: 59 (down from 62)

# Count lines (rough estimate)
wc -l src/entities/*.js src/entities/**/*.js 2>/dev/null | tail -1
# Expected: ~5,100 (down from ~5,500)
```

## Dependencies

- **ENTARCREDANA-004** must be completed first (EntityCreationManager inlined)
- **ENTARCREDANA-005** must be completed first (EntityMutationManager inlined)

## Blocked By

- ENTARCREDANA-004
- ENTARCREDANA-005

## Blocks

- None (this completes Phase 2 and the entire cleanup)

## Final Architecture

After this ticket, the entity management hierarchy becomes:

```
EntityManager (Facade)
├── Direct Methods:
│   ├── createEntityInstance() (was EntityCreationManager)
│   ├── reconstructEntity() (was EntityCreationManager)
│   ├── addComponent() (was EntityMutationManager)
│   ├── removeComponent() (was EntityMutationManager)
│   ├── removeEntityInstance() (was EntityMutationManager)
│   └── getEntitiesInLocation() (was EntityManagerAdapter)
├── EntityQueryManager (KEPT - has actual query logic)
└── Supporting Services:
    ├── EntityLifecycleManager (orchestrates creation/removal)
    ├── ComponentMutationService (handles mutations)
    └── LocationQueryService (spatial queries)
```

This is cleaner, has fewer abstraction layers, and maintains all functionality.
