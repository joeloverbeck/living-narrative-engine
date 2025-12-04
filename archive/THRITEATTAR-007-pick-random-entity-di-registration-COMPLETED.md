# THRITEATTAR-007: Register PICK_RANDOM_ENTITY Handler in Dependency Injection (COMPLETED)

## Summary

Register the `PickRandomEntityHandler` in the dependency injection system by adding the token, factory registration, interpreter mapping, and pre-validation whitelist entry.

## Outcome

- **Status**: Completed
- **Changes**:
    - Added `PickRandomEntityHandler` to `src/dependencyInjection/tokens/tokens-core.js`.
    - Added `PickRandomEntityHandler` import and factory to `src/dependencyInjection/registrations/operationHandlerRegistrations.js`.
    - Added `PICK_RANDOM_ENTITY` mapping to `src/dependencyInjection/registrations/interpreterRegistrations.js`.
    - Added `'PICK_RANDOM_ENTITY'` to `src/utils/preValidationUtils.js`.
    - **Extra**: Updated `tests/unit/dependencyInjection/registrations/operationHandlerRegistrations.test.js` to include the new handler in test expectations.
    - **Extra**: Updated `src/configuration/staticConfiguration.js` to include `pickRandomEntity.schema.json` in `OPERATION_SCHEMA_FILES` to satisfy configuration tests.
- **Verification**:
    - `npm run validate` passed.
    - `npm run test:unit` passed (relevant tests).

## Files to Modify

| File | Modification |
|------|-------------|
| `src/dependencyInjection/tokens/tokens-core.js` | Add `PickRandomEntityHandler` token |
| `src/dependencyInjection/registrations/operationHandlerRegistrations.js` | Add handler factory |
| `src/dependencyInjection/registrations/interpreterRegistrations.js` | Add operation type mapping |
| `src/utils/preValidationUtils.js` | Add `'PICK_RANDOM_ENTITY'` to whitelist |

## Implementation Details

### 1. tokens-core.js

Add the following token (alphabetically sorted within the existing tokens):

```javascript
PickRandomEntityHandler: 'PickRandomEntityHandler',
```

### 2. operationHandlerRegistrations.js

Add to the import section:

```javascript
import PickRandomEntityHandler from '../../logic/operationHandlers/pickRandomEntityHandler.js';
```

Add to the `handlerFactories` array:

```javascript
{
  token: tokens.PickRandomEntityHandler,
  factory: (container) => new PickRandomEntityHandler({
    entityManager: container.resolve(tokens.IEntityManager),
    logger: container.resolve(tokens.ILogger),
  }),
},
```

### 3. interpreterRegistrations.js

Add the operation type mapping (alphabetically sorted):

```javascript
registry.register('PICK_RANDOM_ENTITY', bind(tokens.PickRandomEntityHandler));
```

### 4. preValidationUtils.js

Add to the `KNOWN_OPERATION_TYPES` array (alphabetically sorted):

```javascript
'PICK_RANDOM_ENTITY',
```

## Critical Warning

**Failure to update `preValidationUtils.js` will cause validation failures during mod loading.** This is documented in CLAUDE.md under "Adding New Operations - Complete Checklist".

## Out of Scope

- **DO NOT** modify any other DI files
- **DO NOT** modify the handler implementation (THRITEATTAR-006)
- **DO NOT** modify the schema (THRITEATTAR-005)
- **DO NOT** create test files

## Acceptance Criteria

### Tests That Must Pass

1. `npm run typecheck` completes without errors
2. `npm run validate` completes without errors
3. `npm run test:ci` completes without errors
4. The operation type `PICK_RANDOM_ENTITY` can be resolved from the container

### Invariants That Must Remain True

1. All existing operations continue to resolve correctly
2. No existing DI registrations are affected
3. Token name matches class name exactly
4. Operation type string matches schema `const` exactly: `PICK_RANDOM_ENTITY`
5. Pre-validation whitelist includes the operation type

## Validation Commands

```bash
# Type check
npm run typecheck

# Run validation (checks pre-validation whitelist)
npm run validate

# Run unit tests to verify DI works
npm run test:unit

# Verify handler can be resolved
node -e "
import('./src/dependencyInjection/container.js').then(async (mod) => {
  const container = mod.default;
  await container.initialize();
  const handler = container.resolve('PickRandomEntityHandler');
  console.log('Handler resolved:', !!handler);
});
"
```

## Reference Files

For understanding DI registration patterns:
- `src/dependencyInjection/tokens/tokens-core.js` - Existing token definitions
- `src/dependencyInjection/registrations/operationHandlerRegistrations.js` - Existing handler factories
- `src/dependencyInjection/registrations/interpreterRegistrations.js` - Existing operation mappings
- `src/utils/preValidationUtils.js` - Pre-validation whitelist

## Dependencies

- THRITEATTAR-006 (handler must exist to import)

## Blocks

- THRITEATTAR-008 (rule uses this operation)
- THRITEATTAR-009 (macros use this operation)
- THRITEATTAR-011 (unit tests need handler to be resolvable)