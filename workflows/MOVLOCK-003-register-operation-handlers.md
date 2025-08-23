# MOVLOCK-003: Register Operation Handlers

**Status**: NOT_STARTED  
**Priority**: HIGH  
**Dependencies**: MOVLOCK-001, MOVLOCK-002  
**Estimated Effort**: 1 hour

## Context

After creating the lock and unlock movement handlers, they must be registered with the dependency injection container. This involves adding tokens for the handlers and configuring their factory functions in the registration system.

## Implementation Steps

### 1. Add Handler Tokens

**File**: `src/dependencyInjection/tokens.js`

Add the following tokens to the exports (maintain alphabetical order if present):

```javascript
LockMovementHandler: Symbol('LockMovementHandler'),
UnlockMovementHandler: Symbol('UnlockMovementHandler'),
```

**Location**: Add these in the appropriate section with other operation handler tokens. Look for similar handlers like `MergeClosenessCircleHandler` or `RemoveFromClosenessCircleHandler`.

### 2. Update Operation Handler Registrations

**File**: `src/dependencyInjection/registrations/operationHandlerRegistrations.js`

#### Step 2.1: Add Imports

Add at the top of the file with other handler imports:

```javascript
import LockMovementHandler from '../../logic/operationHandlers/lockMovementHandler.js';
import UnlockMovementHandler from '../../logic/operationHandlers/unlockMovementHandler.js';
```

#### Step 2.2: Add Handler Factory Configurations

Find the `handlerFactories` array and add these entries:

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

**Note**: The factory functions resolve the exact dependencies required by the handlers' constructors.

### 3. Implementation Checklist

- [ ] Open `src/dependencyInjection/tokens.js`
- [ ] Add `LockMovementHandler` symbol
- [ ] Add `UnlockMovementHandler` symbol
- [ ] Open `src/dependencyInjection/registrations/operationHandlerRegistrations.js`
- [ ] Add import for LockMovementHandler
- [ ] Add import for UnlockMovementHandler
- [ ] Add factory configuration for LockMovementHandler
- [ ] Add factory configuration for UnlockMovementHandler
- [ ] Ensure proper comma placement in arrays
- [ ] Verify dependency resolution matches handler constructors

## Validation Criteria

1. **Tokens defined**: Both handler symbols exist in tokens.js
2. **Imports added**: Both handler classes imported in registrations
3. **Factory functions**: Both handlers have factory configurations
4. **Dependency resolution**: Factory functions resolve correct dependencies
5. **Array syntax**: Proper comma separation in handlerFactories array
6. **No syntax errors**: File parses correctly

## Testing Requirements

After implementation:

1. Run build to check for syntax errors: `npm run build`
2. Run linter: `npm run lint`
3. Verify imports resolve: Check that handler files exist at specified paths

## Common Issues to Avoid

1. **Missing commas**: Ensure commas between array entries
2. **Token naming**: Use exact same token names across files
3. **Import paths**: Verify relative paths are correct
4. **Dependency order**: Logger, entityManager, safeEventDispatcher (in that order)
5. **Factory function**: Use arrow function with (c, Handler) parameters

## Code Structure Reference

The registration pattern follows this structure:

```javascript
[
  tokens.HandlerToken,           // Token from tokens.js
  HandlerClass,                  // Imported class
  (c, Handler) => new Handler({  // Factory function
    dependency1: c.resolve(tokens.IDependency1),
    dependency2: c.resolve(tokens.IDependency2),
    // ... match constructor parameters
  }),
],
```

## Notes

- The order of entries in handlerFactories doesn't matter functionally, but consider grouping related handlers together
- The factory function receives the container (c) and the Handler class
- All three dependencies (logger, entityManager, safeEventDispatcher) are standard for operation handlers
- These registrations make the handlers available to the interpreter but don't bind them to operations yet (that's MOVLOCK-004)

## References

- Token definitions: `src/dependencyInjection/tokens.js`
- Registration file: `src/dependencyInjection/registrations/operationHandlerRegistrations.js`
- Similar handlers: Look for `MergeClosenessCircleHandler` and `RemoveFromClosenessCircleHandler` registrations
