# ENTARCREDANA-002: Update DI Registration to Return EntityManager Directly

## Summary

Modify the dependency injection registration so that the `IEntityManager` token resolves directly to `EntityManager` (with `LocationQueryService` injected) instead of `EntityManagerAdapter`. This removes the adapter from the DI graph.

## Priority: High | Effort: Low | Risk: Medium

## Rationale

After ENTARCREDANA-001 adds `getEntitiesInLocation()` to EntityManager, the adapter provides zero unique value - every method is pure delegation. By updating the DI registration, all consumers of `IEntityManager` will receive the EntityManager directly, eliminating an unnecessary abstraction layer.

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` | **Modify** - Update IEntityManager factory |

## Out of Scope

- **DO NOT** delete `EntityManagerAdapter` file - that's ENTARCREDANA-003
- **DO NOT** modify `EntityManager` class - that was ENTARCREDANA-001
- **DO NOT** modify any test files beyond what's needed for this change
- **DO NOT** modify `EntityCreationManager` or `EntityMutationManager` - that's ENTARCREDANA-004/005
- **DO NOT** change any other DI registrations

## Implementation Details

### Step 1: Modify IEntityManager Registration

**File:** `src/dependencyInjection/registrations/worldAndEntityRegistrations.js`

Locate the `IEntityManager` registration (around lines 129-149) and modify:

**Before:**
```javascript
registrar.singletonFactory(tokens.IEntityManager, (c) => {
  const entityManager = new EntityManager({
    registry: c.resolve(tokens.IDataRegistry),
    validator: c.resolve(tokens.ISchemaValidator),
    logger: c.resolve(tokens.ILogger),
    dispatcher: c.resolve(tokens.ISafeEventDispatcher),
  });

  const locationQueryService = c.resolve(tokens.LocationQueryService);

  return new EntityManagerAdapter({
    entityManager,
    locationQueryService,
  });
});
```

**After:**
```javascript
registrar.singletonFactory(tokens.IEntityManager, (c) => {
  return new EntityManager({
    registry: c.resolve(tokens.IDataRegistry),
    validator: c.resolve(tokens.ISchemaValidator),
    logger: c.resolve(tokens.ILogger),
    dispatcher: c.resolve(tokens.ISafeEventDispatcher),
    locationQueryService: c.resolve(tokens.LocationQueryService),
  });
});
```

### Step 2: Remove EntityManagerAdapter Import

Remove or comment out the import for EntityManagerAdapter at the top of the file:

**Before:**
```javascript
import EntityManagerAdapter from '../../entities/entityManagerAdapter.js';
```

**After:**
```javascript
// Removed: EntityManagerAdapter is no longer used
// import EntityManagerAdapter from '../../entities/entityManagerAdapter.js';
```

**Note:** Keep the import commented rather than deleted until ENTARCREDANA-003 confirms full removal.

## Acceptance Criteria

### Tests That Must Pass

- [ ] `npm run test:unit` passes (all unit tests)
- [ ] `npm run test:integration` passes (all integration tests)
- [ ] `npm run test:e2e` passes (all e2e tests)
- [ ] `npm run test:ci` passes (full test suite)
- [ ] `npm run typecheck` passes

### Invariants That Must Remain True

1. **API Compatibility**: All code using `IEntityManager` must continue to work identically
2. **Method Availability**: All 23 methods from `IEntityManager` interface must remain accessible
3. **getEntitiesInLocation**: Must return correct results (delegating to LocationQueryService)
4. **Singleton Behavior**: IEntityManager must still resolve as a singleton
5. **No Runtime Errors**: Application must start and run without DI resolution errors

## Verification Steps

```bash
# Run full test suite (critical for DI changes)
npm run test:ci

# Run specific integration tests that exercise IEntityManager
npm run test:integration -- --testPathPattern="entityManager"

# Type check
npm run typecheck

# Lint modified file
npx eslint src/dependencyInjection/registrations/worldAndEntityRegistrations.js

# Manual verification: Start the application and verify basic entity operations
npm run dev
```

## Risk Mitigation

This is a **medium-risk change** because it affects all consumers of `IEntityManager`. Mitigation:

1. **Full Test Suite**: Run `npm run test:ci` to catch any regressions
2. **Manual Smoke Test**: Start the application and perform basic entity operations
3. **Easy Rollback**: If issues arise, revert to EntityManagerAdapter by uncommenting the import and restoring the old factory

## Dependencies

- **ENTARCREDANA-001** must be completed first (EntityManager needs `getEntitiesInLocation`)

## Blocked By

- ENTARCREDANA-001

## Blocks

- ENTARCREDANA-003 (adapter file deletion)
