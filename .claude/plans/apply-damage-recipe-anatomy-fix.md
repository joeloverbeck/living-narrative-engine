# Implementation Plan: Fix APPLY_DAMAGE Recipe-Based Anatomy Issue

## Problem Summary

`ApplyDamageHandler.#selectRandomPart()` fails when an entity has `anatomy:body` component with only `recipeId` (no `body.root`). The current flow:

1. `#selectRandomPart(entityId)` is called
2. Gets `anatomy:body` component which has `{ recipeId: "..." }` but no `body.root`
3. Calls `bodyGraphService.getAllParts(bodyComponent, entityId)`
4. `getAllParts()` checks for `body.root` or `root`, finds neither, returns `[]`
5. No candidate parts -> returns `null` -> error

## Design Questions Answered

### 1. Where should the fix go?

**Answer: In `ApplyDamageHandler.execute()`, before calling `#selectRandomPart()`**

Rationale:

- `#selectRandomPart()` is synchronous; making it async would require changing its signature
- The `execute()` method is already async, so adding an await is natural
- Adding anatomy generation to `bodyGraphService.getAllParts()` would violate single responsibility and create unexpected side effects
- The handler that needs the parts should ensure they exist

### 2. How should we handle async?

**Answer: Pre-generate in `execute()` before calling `#selectRandomPart()`**

Rationale:

- `execute()` is already async
- Adding `await anatomyGenerationService.generateAnatomyIfNeeded(entityId)` before `#selectRandomPart()` keeps `#selectRandomPart()` unchanged
- `generateAnatomyIfNeeded()` is idempotent - it returns `false` if anatomy already exists, so it's safe to call unconditionally

### 3. What's the minimal change approach?

**Answer: Three changes:**

1. Add `AnatomyGenerationService` as a new dependency to `ApplyDamageHandler`
2. Update DI registration to inject `AnatomyGenerationService`
3. Add a single `await` call in `execute()` before the `#selectRandomPart()` call

## Implementation Approach

### Option A: Generate anatomy before part selection (RECOMMENDED)

This is the minimal, safest change:

```javascript
// In execute(), after resolving entityId but before resolving partId:
if (!partId) {
  // Ensure anatomy is generated before selecting random part
  await this.#anatomyGenerationService.generateAnatomyIfNeeded(entityId);
  partId = this.#selectRandomPart(entityId, log);
  // ... rest of error handling
}
```

**Pros:**

- Minimal code change
- `generateAnatomyIfNeeded()` is idempotent (safe to call even if anatomy exists)
- Follows existing pattern used throughout the codebase
- No changes to `#selectRandomPart()` or `bodyGraphService`

**Cons:**

- Adds one dependency to `ApplyDamageHandler`
- Slight performance overhead on first damage to recipe-based entities (anatomy generation)

### Option B: Generate anatomy at entity instantiation time (NOT RECOMMENDED)

Would require changes to `EntityInstanceLoader` or similar. This is a larger architectural change that affects more systems.

### Option C: Make `bodyGraphService.getAllParts()` trigger generation (NOT RECOMMENDED)

Would violate single responsibility and create unexpected side effects in a read-only service.

## Detailed Implementation Steps

### Step 1: Add private field to ApplyDamageHandler

File: `src/logic/operationHandlers/applyDamageHandler.js`

Add after line 49 (after `#deathCheckService`):

```javascript
#anatomyGenerationService;
```

### Step 2: Update constructor parameter destructuring

File: `src/logic/operationHandlers/applyDamageHandler.js`

Modify constructor signature (line 51):

```javascript
constructor({
  logger,
  entityManager,
  safeEventDispatcher,
  jsonLogicService,
  bodyGraphService,
  damageTypeEffectsService,
  damagePropagationService,
  deathCheckService,
  anatomyGenerationService // NEW
}) {
```

### Step 3: Add dependency validation to super() call

Add to the `super()` call validation object:

```javascript
anatomyGenerationService: {
  value: anatomyGenerationService,
  requiredMethods: ['generateAnatomyIfNeeded'],
},
```

### Step 4: Assign the private field

After the existing assignments at the end of constructor:

```javascript
this.#anatomyGenerationService = anatomyGenerationService;
```

### Step 5: Update execute() to generate anatomy before part selection

File: `src/logic/operationHandlers/applyDamageHandler.js`

Find this block (around lines 286-293):

```javascript
if (!partId) {
  // Auto-resolve if missing or failed to resolve
  partId = this.#selectRandomPart(entityId, log);
  if (!partId) {
    safeDispatchError(
      this.#dispatcher,
      'APPLY_DAMAGE: Could not resolve target part',
      { entityId },
      log
    );
    return;
  }
}
```

Change to:

```javascript
if (!partId) {
  // Ensure anatomy is generated before selecting random part
  // (handles recipe-based entities that haven't been instantiated yet)
  await this.#anatomyGenerationService.generateAnatomyIfNeeded(entityId);

  // Auto-resolve if missing or failed to resolve
  partId = this.#selectRandomPart(entityId, log);
  if (!partId) {
    safeDispatchError(
      this.#dispatcher,
      'APPLY_DAMAGE: Could not resolve target part',
      { entityId },
      log
    );
    return;
  }
}
```

### Step 6: Update DI registration

File: `src/dependencyInjection/registrations/operationHandlerRegistrations.js`

Find the `ApplyDamageHandler` factory (around lines 215-228):

```javascript
[
  tokens.ApplyDamageHandler,
  ApplyDamageHandler,
  (c, Handler) =>
    new Handler({
      logger: c.resolve(tokens.ILogger),
      entityManager: c.resolve(tokens.IEntityManager),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      jsonLogicService: c.resolve(tokens.JsonLogicEvaluationService),
      bodyGraphService: c.resolve(tokens.BodyGraphService),
      damageTypeEffectsService: c.resolve(tokens.DamageTypeEffectsService),
      damagePropagationService: c.resolve(tokens.DamagePropagationService),
      deathCheckService: c.resolve(tokens.DeathCheckService),
    }),
],
```

Add the new dependency:

```javascript
[
  tokens.ApplyDamageHandler,
  ApplyDamageHandler,
  (c, Handler) =>
    new Handler({
      logger: c.resolve(tokens.ILogger),
      entityManager: c.resolve(tokens.IEntityManager),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      jsonLogicService: c.resolve(tokens.JsonLogicEvaluationService),
      bodyGraphService: c.resolve(tokens.BodyGraphService),
      damageTypeEffectsService: c.resolve(tokens.DamageTypeEffectsService),
      damagePropagationService: c.resolve(tokens.DamagePropagationService),
      deathCheckService: c.resolve(tokens.DeathCheckService),
      anatomyGenerationService: c.resolve(tokens.AnatomyGenerationService), // NEW
    }),
],
```

### Step 7: Update unit tests

File: `tests/unit/logic/operationHandlers/applyDamageHandler.test.js`

Add mock for `anatomyGenerationService` in test setup:

```javascript
const mockAnatomyGenerationService = {
  generateAnatomyIfNeeded: jest.fn().mockResolvedValue(true),
};
```

Add to handler instantiation in tests.

Add new test case for the fix:

```javascript
describe('recipe-based anatomy generation', () => {
  it('should generate anatomy before selecting random part when entity has only recipeId', async () => {
    // Setup: entity has anatomy:body with recipeId but no body.root
    mockEntityManager.hasComponent.mockImplementation(
      (id, comp) => comp === 'anatomy:body'
    );
    mockEntityManager.getComponentData.mockImplementation((id, comp) => {
      if (comp === 'anatomy:body') {
        return { recipeId: 'anatomy:human_male' }; // No body.root
      }
      return null;
    });

    // After generation, body should have parts
    mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
      async () => {
        // Simulate anatomy generation populating body
        mockEntityManager.getComponentData.mockImplementation((id, comp) => {
          if (comp === 'anatomy:body') {
            return {
              recipeId: 'anatomy:human_male',
              body: { root: 'torso-entity-id', parts: {} },
            };
          }
          return null;
        });
        return true;
      }
    );

    // ... execute and verify
  });
});
```

### Step 8: Update or add integration tests

File: `tests/integration/mods/weapons/swingAtTargetDamageApplication.integration.test.js`

Add test case for recipe-based entities:

```javascript
it('should apply damage to entity with recipe-based anatomy (no pre-generated body)', async () => {
  // Create entity with only recipeId (no body.root)
  const entity = await fixture.createEntityWithRecipeOnlyAnatomy();

  // Execute damage action
  await fixture.executeSwingAction(actorId, entity.id);

  // Verify anatomy was generated and damage was applied
  const bodyComponent = fixture.entityManager.getComponentData(
    entity.id,
    'anatomy:body'
  );
  expect(bodyComponent.body).toBeDefined();
  expect(bodyComponent.body.root).toBeDefined();
});
```

## Error Handling Considerations

The `generateAnatomyIfNeeded()` method has built-in error handling:

- Returns `false` if entity not found
- Returns `false` if no recipeId
- Returns `false` if anatomy already generated
- Throws if recipe doesn't exist
- Throws if blueprint doesn't exist
- Throws if generation fails

For our use case, if generation fails, we should log and fall back to the existing error path (no parts found). The current error handling in `execute()` will catch this:

```javascript
if (!partId) {
  safeDispatchError(
    this.#dispatcher,
    'APPLY_DAMAGE: Could not resolve target part',
    { entityId },
    log
  );
  return;
}
```

## Backward Compatibility

This change is fully backward compatible:

- Entities with already-generated anatomy (has `body.root`) - `generateAnatomyIfNeeded()` returns `false` immediately (no-op)
- Entities with direct anatomy (has `body.root`) - works unchanged
- Recipe-based entities - now get anatomy generated on first damage

## Performance Impact

- **First damage to recipe-based entity**: One-time anatomy generation overhead
- **Subsequent damage**: `generateAnatomyIfNeeded()` check is O(1) - just checks if `body` property exists

## Files to Modify

| File                                                                                | Change                                           |
| ----------------------------------------------------------------------------------- | ------------------------------------------------ |
| `src/logic/operationHandlers/applyDamageHandler.js`                                 | Add dependency, call `generateAnatomyIfNeeded()` |
| `src/dependencyInjection/registrations/operationHandlerRegistrations.js`            | Add `anatomyGenerationService` to factory        |
| `tests/unit/logic/operationHandlers/applyDamageHandler.test.js`                     | Add mock, add test cases                         |
| `tests/integration/mods/weapons/swingAtTargetDamageApplication.integration.test.js` | Add integration test for recipe-based anatomy    |

## Critical Files for Implementation

1. `/home/joeloverbeck/projects/living-narrative-engine/src/logic/operationHandlers/applyDamageHandler.js` - Main handler needing the fix
2. `/home/joeloverbeck/projects/living-narrative-engine/src/dependencyInjection/registrations/operationHandlerRegistrations.js` - DI registration to update
3. `/home/joeloverbeck/projects/living-narrative-engine/src/anatomy/anatomyGenerationService.js` - Service to inject (reference for interface)
4. `/home/joeloverbeck/projects/living-narrative-engine/tests/unit/logic/operationHandlers/applyDamageHandler.test.js` - Unit tests to update
5. `/home/joeloverbeck/projects/living-narrative-engine/tests/integration/mods/weapons/swingAtTargetDamageApplication.integration.test.js` - Integration tests to update
