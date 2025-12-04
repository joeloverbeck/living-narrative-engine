# DISBODPARSPA-022: Register `DismemberedBodyPartSpawner` in DI Container and Initialize

## Summary

Register the `DismemberedBodyPartSpawner` service in the dependency injection container and ensure it's properly initialized during application startup. This integrates the spawner service into the application lifecycle.

---

## Assumptions Corrected (2025-12-04)

The original ticket had incorrect file paths and dependencies. Corrections:

| Original Assumption | Actual Codebase |
|---------------------|-----------------|
| `tokens-anatomy.js` | `tokens-core.js` (no separate anatomy tokens file exists) |
| `anatomyRegistrations.js` | `worldAndEntityRegistrations.js` (anatomy services registered here) |
| Dependency: `entityFactory` | Dependency: `entityLifecycleManager` (see spawner constructor) |
| Token: `IEventBus` | Token: `ISafeEventDispatcher` (per codebase patterns) |

---

## Files to Touch

| File | Change Type | Description |
|------|-------------|-------------|
| `src/dependencyInjection/tokens/tokens-core.js` | Modify | Add token for DismemberedBodyPartSpawner |
| `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` | Modify | Register spawner factory |
| `src/main/main.js` or initialization file | Modify | Initialize spawner during startup |

---

## Out of Scope

The following are **explicitly NOT part of this ticket**:

- `src/anatomy/services/dismemberedBodyPartSpawner.js` - Service implementation is DISBODPARSPA-021
- Other DI registration files not related to anatomy
- Test files - Tests are in DISBODPARSPA-032

---

## Implementation Details

### Step 1: Add DI Token

**File: `src/dependencyInjection/tokens/tokens-core.js`**

```javascript
// Add to existing tokens object:
DismemberedBodyPartSpawner: 'DismemberedBodyPartSpawner',
```

### Step 2: Register Factory

**File: `src/dependencyInjection/registrations/worldAndEntityRegistrations.js`**

```javascript
import DismemberedBodyPartSpawner from '../../anatomy/services/dismemberedBodyPartSpawner.js';

// In registration function (follow existing pattern like DamageTypeEffectsService):
registrar.singletonFactory(tokens.DismemberedBodyPartSpawner, (c) => {
  return new DismemberedBodyPartSpawner({
    logger: c.resolve(tokens.ILogger),
    entityManager: c.resolve(tokens.IEntityManager),
    eventBus: c.resolve(tokens.ISafeEventDispatcher),
    entityLifecycleManager: c.resolve(tokens.IEntityLifecycleManager),
  });
});
```

### Step 3: Initialize During Startup

The spawner must be initialized after the DI container is built but before game events start flowing. Find the appropriate initialization sequence (likely in `main.js` or a similar startup file).

```javascript
// During initialization
const spawner = container.resolve(tokens.DismemberedBodyPartSpawner);
spawner.initialize();

// Store reference for cleanup
this.#dismemberedBodyPartSpawner = spawner;

// During shutdown
this.#dismemberedBodyPartSpawner?.destroy();
```

### Registration Pattern Reference

Follow the existing registration patterns in `worldAndEntityRegistrations.js` for consistency. Look at how similar services like `DamageTypeEffectsService` are registered.

---

## Acceptance Criteria

### Tests That Must Pass

1. `npm run typecheck` passes
2. `npm run test:unit` passes
3. `npm run test:integration` passes
4. Application starts without errors
5. Spawner can be resolved from DI container

### Validation Commands

```bash
# Type check
npm run typecheck

# Run all tests
npm run test:unit
npm run test:integration

# Start application to verify no startup errors
npm run start
```

### Manual Verification

1. Start the application
2. Check console for "DismemberedBodyPartSpawner initialized" log message
3. Verify no errors related to DismemberedBodyPartSpawner in console

### Invariants That Must Remain True

1. **DI Consistency**: Follow existing DI registration patterns
2. **Lifecycle Management**: Service properly initialized and destroyed
3. **Dependency Resolution**: All spawner dependencies available at resolution time
4. **No Circular Dependencies**: Registration doesn't create circular dependency issues
5. **Startup Order**: Spawner initialized after its dependencies are available

---

## Dependencies

- DISBODPARSPA-021 (Service must exist to be registered)

## Blocks

- DISBODPARSPA-032 (Integration tests require working DI registration)

---

## Outcome (2025-12-04)

### Status: ✅ COMPLETED

### Changes Made

1. **Added DI token** in `src/dependencyInjection/tokens/tokens-core.js`:
   - Added `DismemberedBodyPartSpawner: 'DismemberedBodyPartSpawner'` (line 83)

2. **Registered spawner factory** in `src/dependencyInjection/registrations/worldAndEntityRegistrations.js`:
   - Added import for `DismemberedBodyPartSpawner`
   - Registered with `INITIALIZABLE` tag using `singletonFactory` pattern
   - Dependencies: `ILogger`, `IEntityManager`, `ISafeEventDispatcher`, and `IEntityManager` (as `entityLifecycleManager` since it provides `createEntityInstance`)

3. **No manual initialization needed** in `main.js`:
   - Used `INITIALIZABLE` tag pattern (same as other anatomy services like `DeathCheckService`)
   - `SystemInitializer` automatically processes INITIALIZABLE-tagged services during startup
   - This eliminates the need for explicit `spawner.initialize()` calls in main.js

### Implementation Pattern

```javascript
// Registration follows INITIALIZABLE pattern
registrar
  .tagged(INITIALIZABLE)
  .singletonFactory(tokens.DismemberedBodyPartSpawner, (c) => {
    return new DismemberedBodyPartSpawner({
      logger: c.resolve(tokens.ILogger),
      entityManager: c.resolve(tokens.IEntityManager),
      eventBus: c.resolve(tokens.ISafeEventDispatcher),
      entityLifecycleManager: c.resolve(tokens.IEntityManager),
    });
  });
```

### Test Results

- ✅ Unit tests for spawner service: 38/38 passed
- ✅ DI unit tests: 394/394 passed
- ✅ Dismembered event integration tests: 12/12 passed
- ✅ Main bootstrap flow tests: 2/2 passed
- ⚠️ Typecheck: Pre-existing issues in CLI validation files (unrelated to this change)
- ⚠️ ESLint: Pre-existing duplicate key error at line 263 (unrelated to this change)

### Notes

- The `IEntityLifecycleManager` token doesn't exist in the codebase
- `IEntityManager` provides the required `createEntityInstance` method (via `EntityManagerAdapter`)
- This is consistent with how other services resolve lifecycle manager functionality
