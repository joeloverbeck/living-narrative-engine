# UNWITEOPE-003: DI Registration for UnwieldItemHandler

## Summary

Register the `UnwieldItemHandler` in the dependency injection container. This includes defining the token, creating the factory registration, mapping the operation type to the handler, and adding the operation type to the pre-validation whitelist.

## Files to Modify

| File | Change |
|------|--------|
| `src/dependencyInjection/tokens/tokens-core.js` | Add `UnwieldItemHandler` token |
| `src/dependencyInjection/registrations/operationHandlerRegistrations.js` | Add factory registration |
| `src/dependencyInjection/registrations/interpreterRegistrations.js` | Add operation type mapping |
| `src/utils/preValidationUtils.js` | Add `UNWIELD_ITEM` to whitelist |

## Implementation Details

### 1. Token Definition

**File**: `src/dependencyInjection/tokens/tokens-core.js`

Add the token (maintain alphabetical order within the handlers section):

```javascript
UnwieldItemHandler: 'UnwieldItemHandler',
```

### 2. Factory Registration

**File**: `src/dependencyInjection/registrations/operationHandlerRegistrations.js`

Add import at top of file:

```javascript
import UnwieldItemHandler from '../../logic/operationHandlers/unwieldItemHandler.js';
```

Add factory to the `handlerFactories` array (maintain alphabetical order):

```javascript
[
  tokens.UnwieldItemHandler,
  UnwieldItemHandler,
  (c, Handler) =>
    new Handler({
      logger: c.resolve(tokens.ILogger),
      entityManager: c.resolve(tokens.IEntityManager),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
    }),
],
```

### 3. Interpreter Mapping

**File**: `src/dependencyInjection/registrations/interpreterRegistrations.js`

Add the operation type to handler mapping (maintain alphabetical order):

```javascript
registry.register('UNWIELD_ITEM', bind(tokens.UnwieldItemHandler));
```

### 4. Pre-validation Whitelist

**File**: `src/utils/preValidationUtils.js`

Add to the `KNOWN_OPERATION_TYPES` array (maintain alphabetical order):

```javascript
'UNWIELD_ITEM',
```

Insert after `'UNLOCK_GRABBING'` and before `'VALIDATE_INVENTORY_CAPACITY'` (or at correct alphabetical position).

## Out of Scope

- **DO NOT** create the schema (UNWITEOPE-001)
- **DO NOT** create the handler (UNWITEOPE-002)
- **DO NOT** create unit tests (UNWITEOPE-004)
- **DO NOT** modify any rule files (UNWITEOPE-005, UNWITEOPE-006)
- **DO NOT** create integration tests (UNWITEOPE-007)
- **DO NOT** modify any other source code files

## Acceptance Criteria

### Tests That Must Pass

```bash
# Type checking
npm run typecheck

# Lint modified files
npx eslint src/dependencyInjection/tokens/tokens-core.js \
  src/dependencyInjection/registrations/operationHandlerRegistrations.js \
  src/dependencyInjection/registrations/interpreterRegistrations.js \
  src/utils/preValidationUtils.js

# Validate mod files use correct operation type
npm run validate

# Full CI validation
npm run test:ci
```

### Manual Verification Checklist

1. [ ] Token `UnwieldItemHandler` defined in `tokens-core.js`
2. [ ] Import statement added to `operationHandlerRegistrations.js`
3. [ ] Factory registered with correct dependencies (logger, entityManager, safeEventDispatcher)
4. [ ] Operation type `'UNWIELD_ITEM'` mapped to handler token in `interpreterRegistrations.js`
5. [ ] Operation type `'UNWIELD_ITEM'` added to `KNOWN_OPERATION_TYPES` in `preValidationUtils.js`
6. [ ] All additions maintain alphabetical ordering

### Invariants That Must Remain True

- [ ] All existing handlers continue to resolve correctly
- [ ] All existing operation types continue to map correctly
- [ ] All existing operation types remain in whitelist
- [ ] `npm run validate` passes
- [ ] `npm run test:ci` passes
- [ ] No modifications to files outside the file list

## Dependencies

- **Depends on**: UNWITEOPE-001 (schema), UNWITEOPE-002 (handler class)
- **Blocked by**: UNWITEOPE-002
- **Blocks**: UNWITEOPE-004 (unit tests need DI), UNWITEOPE-005, UNWITEOPE-006 (rules need operation)

## Reference Files

| File | Purpose |
|------|---------|
| `src/logic/operationHandlers/unlockGrabbingHandler.js` | Similar handler pattern |
| `src/dependencyInjection/registrations/operationHandlerRegistrations.js` | Registration pattern |
| `src/dependencyInjection/registrations/interpreterRegistrations.js` | Mapping pattern |

## Common Pitfalls

- **Type string mismatch**: Ensure `'UNWIELD_ITEM'` is identical in:
  - Schema `type.const` value
  - `interpreterRegistrations.js` mapping
  - `preValidationUtils.js` whitelist
- **Missing whitelist entry**: Will cause "Unknown operation type" error during mod loading
- **Missing import**: Will cause "UnwieldItemHandler is not defined" error
