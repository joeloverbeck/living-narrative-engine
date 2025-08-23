# MOVLOCK-004: Register Operations in Interpreter

**Status**: NOT_STARTED  
**Priority**: HIGH  
**Dependencies**: MOVLOCK-003 ⚠️ **PREREQUISITE NOT COMPLETE**  
**Estimated Effort**: 0.5 hours

## ⚠️ CRITICAL PREREQUISITE ISSUES

**This workflow cannot be executed until MOVLOCK-003 is completed.** The following dependencies are missing:

1. **Missing Tokens**: `LockMovementHandler` and `UnlockMovementHandler` tokens are not defined in the tokens system
2. **Missing Registrations**: The handlers are not registered with the dependency injection container
3. **Broken Reference**: Current `interpreterRegistrations.js` references non-existent `ResolveDirectionHandler` token (line 84)

**Action Required**: Complete MOVLOCK-003 first, or update this workflow to include the missing prerequisite steps.

## Context

After registering the handlers with the dependency injection container, they must be bound to operation names in the interpreter's operation registry. This allows the rules engine to execute LOCK_MOVEMENT and UNLOCK_MOVEMENT operations.

## Implementation Steps

### 1. **PREREQUISITE**: Complete Missing Token Definitions

**File**: `src/dependencyInjection/tokens/tokens-core.js`

**Status**: Currently missing from codebase

Add these tokens to the `coreTokens` object (maintain alphabetical order):

```javascript
LockMovementHandler: 'LockMovementHandler',
UnlockMovementHandler: 'UnlockMovementHandler',
```

### 2. **PREREQUISITE**: Register Handler Factories

**File**: `src/dependencyInjection/registrations/operationHandlerRegistrations.js`

**Status**: Currently missing from codebase

Add imports at the top:

```javascript
import LockMovementHandler from '../../logic/operationHandlers/lockMovementHandler.js';
import UnlockMovementHandler from '../../logic/operationHandlers/unlockMovementHandler.js';
```

Add to `handlerFactories` array:

```javascript
[
  tokens.LockMovementHandler,
  LockMovementHandler,
  (c, Handler) =>
    new Handler({
      logger: c.resolve(tokens.ILogger),
      entityManager: c.resolve(tokens.IEntityManager),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
    }),
],
[
  tokens.UnlockMovementHandler,
  UnlockMovementHandler,
  (c, Handler) =>
    new Handler({
      logger: c.resolve(tokens.ILogger),
      entityManager: c.resolve(tokens.IEntityManager),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
    }),
],
```

### 3. Update Interpreter Registrations

**File**: `src/dependencyInjection/registrations/interpreterRegistrations.js`

#### Step 3.1: Fix Broken Reference (Current Bug)

**Line 83-85** currently has a broken reference:

```javascript
registry.register(
  'RESOLVE_DIRECTION',
  bind(tokens.ResolveDirectionHandler) // ← This token doesn't exist
);
```

**Action**: Either create the missing `ResolveDirectionHandler` token and implementation, or remove this broken registration.

#### Step 3.2: Locate the Registry Section

Find the `OperationRegistry` factory around line 49. Within this factory, locate the section where operations are registered with the registry. Look for the existing pattern:

```javascript
registry.register('OPERATION_NAME', bind(tokens.HandlerToken));
```

#### Step 3.3: Add Operation Bindings

Add these two lines in the appropriate location (after line 133, maintaining alphabetical order):

```javascript
registry.register('LOCK_MOVEMENT', bind(tokens.LockMovementHandler));
registry.register('UNLOCK_MOVEMENT', bind(tokens.UnlockMovementHandler));
```

**Important**: The operation names ('LOCK_MOVEMENT' and 'UNLOCK_MOVEMENT') must match exactly what will be used in the rule JSON files.

### 4. Verify Import Requirements

Ensure that the correct import pattern is used at the top of the file:

```javascript
import { tokens } from '../tokens.js';
```

**Note**: The current codebase uses named imports `{ tokens }`, not default import `tokens`.

### 5. Implementation Checklist

**Prerequisites (MOVLOCK-003 items - MUST be completed first):**

- [ ] Add `LockMovementHandler` token to `tokens-core.js`
- [ ] Add `UnlockMovementHandler` token to `tokens-core.js`
- [ ] Add imports for both handlers in `operationHandlerRegistrations.js`
- [ ] Add factory configurations for both handlers in `handlerFactories` array

**Main Implementation (MOVLOCK-004 items):**

- [ ] Fix or remove broken `ResolveDirectionHandler` reference (line 83-85)
- [ ] Open `src/dependencyInjection/registrations/interpreterRegistrations.js`
- [ ] Locate the OperationRegistry factory (around line 49)
- [ ] Find the registry.register section within the factory
- [ ] Add LOCK_MOVEMENT registration after line 133
- [ ] Add UNLOCK_MOVEMENT registration after LOCK_MOVEMENT
- [ ] Verify operation names match exactly (case-sensitive)
- [ ] Verify token names match those defined in tokens-core.js
- [ ] Check that bind() function is available (it's defined within the factory)
- [ ] Ensure proper line endings and formatting

## Validation Criteria

1. **Prerequisites completed**: MOVLOCK-003 items must be done first
2. **Broken reference fixed**: ResolveDirectionHandler issue resolved
3. **Operations registered**: Both LOCK_MOVEMENT and UNLOCK_MOVEMENT bound
4. **Correct tokens**: Uses tokens.LockMovementHandler and tokens.UnlockMovementHandler
5. **Operation names**: Exact match with what rules will use
6. **Syntax valid**: No JavaScript errors
7. **Bind function**: Properly wraps the token references (local bind function)

## Testing Requirements

After completing all prerequisites and implementation:

1. **Syntax Validation**:

   ```bash
   npm run build
   npm run lint
   npm run typecheck
   ```

2. **Runtime Validation**:

   ```bash
   npm run dev
   ```

   - Check console for any registration errors
   - Verify no "Cannot resolve token" errors
   - Confirm both operations are available in the registry

3. **Token Resolution Test**:
   - Handlers should be resolvable from the DI container
   - Operations should be executable through the interpreter

## Operation Name Standards

- Use UPPER_SNAKE_CASE for operation names
- Be descriptive but concise
- Match the naming convention of similar operations
- These names will be referenced in rule JSON files

## Code Context

**Current Registration Pattern** (within OperationRegistry factory, line ~49):

```javascript
const registry = new OperationRegistry({
  logger: c.resolve(tokens.ILogger),
});

// Defer resolution of handlers until execution time
const bind =
  (tkn) =>
  (...args) =>
    c.resolve(tkn).execute(...args);

// Existing registrations...
registry.register('UNEQUIP_CLOTHING', bind(tokens.UnequipClothingHandler));

// Add new operations here (maintain alphabetical order if desired)
registry.register('LOCK_MOVEMENT', bind(tokens.LockMovementHandler));
registry.register('UNLOCK_MOVEMENT', bind(tokens.UnlockMovementHandler));

return registry;
```

## Common Issues to Avoid

1. **Missing prerequisites**: MOVLOCK-003 must be completed first
2. **Case sensitivity**: Operation names are case-sensitive
3. **Token mismatch**: Ensure token names match exactly with tokens-core.js (not tokens.js)
4. **Import syntax**: Use `{ tokens }` not `tokens` (named import)
5. **Missing bind**: The bind() wrapper is required (already defined in factory)
6. **Duplicate registration**: Don't register the same operation twice
7. **Wrong file location**: Registrations go inside the OperationRegistry factory, not at the top level
8. **Broken references**: Fix or remove the ResolveDirectionHandler reference first

## Current Issues in Codebase

⚠️ **Active Bug**: Line 83-85 in `interpreterRegistrations.js` references non-existent `ResolveDirectionHandler` token. This needs to be fixed before adding new registrations.

## Notes

- The operation names registered here are what the rules engine will look for
- These names will be used in the rule JSON files (MOVLOCK-005 and MOVLOCK-006)
- The bind() function creates a factory that the container can resolve
- Order of registration doesn't matter functionally, but alphabetical order improves maintainability
- The `bind` function is defined locally within the OperationRegistry factory

## References

- **Token Definitions**: `src/dependencyInjection/tokens/tokens-core.js` (not `tokens.js`)
- **Handler Registrations**: `src/dependencyInjection/registrations/operationHandlerRegistrations.js`
- **Interpreter Registrations**: `src/dependencyInjection/registrations/interpreterRegistrations.js`
- **Handler Implementations**:
  - `src/logic/operationHandlers/lockMovementHandler.js`
  - `src/logic/operationHandlers/unlockMovementHandler.js`
- **Rule Files** (will use these operations):
  - `data/mods/positioning/rules/kneel_before.rule.json`
  - `data/mods/positioning/rules/stand_up.rule.json`

## Workflow Dependencies

- **MOVLOCK-001**: Create lock movement handler (✅ Complete)
- **MOVLOCK-002**: Create unlock movement handler (✅ Complete)
- **MOVLOCK-003**: Register operation handlers with DI container (❌ **NOT COMPLETE** - blocking issue)
