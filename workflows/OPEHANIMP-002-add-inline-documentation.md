# OPEHANIMP-002: Add Inline Documentation to Registration Files

**Priority**: High
**Effort**: Low
**Phase**: 1 (Day 1)
**Dependencies**: None

## Objective

Add comprehensive inline comments and documentation to all operation handler registration files to provide guidance at the point of modification.

## Background

Developers frequently update registration files (`preValidationUtils.js`, `interpreterRegistrations.js`, `operationHandlerRegistrations.js`, `tokens-core.js`) but these files lack contextual documentation explaining:
- Why each registration is necessary
- What happens if registration is missed
- Links to related files
- Verification commands

## Files to Update

### 1. src/utils/preValidationUtils.js

**Current State**: Minimal comments on `KNOWN_OPERATION_TYPES`

**Add Documentation**:

```javascript
/**
 * CRITICAL: Pre-validation whitelist for operation types
 *
 * ⚠️ EVERY new operation MUST be added here before validation will pass
 *
 * When adding a new operation handler:
 * 1. Add operation type constant to this array
 * 2. Ensure it matches the "const" value in your schema exactly
 * 3. Run `npm run validate` or `npm run validate:strict` to verify consistency
 *
 * Common mistake: Forgetting this step causes "Unknown operation type" errors
 *
 * Related files:
 * - data/schemas/operations/[operationName].schema.json (type constant)
 * - src/dependencyInjection/registrations/interpreterRegistrations.js (registry mapping)
 *
 * @see CLAUDE.md "Adding New Operations - Complete Checklist" for complete checklist
 */
const KNOWN_OPERATION_TYPES = [
  'ADD_COMPONENT',
  'REMOVE_COMPONENT',
  'DRINK_FROM',      // Added for DRINK_FROM operation
  'DRINK_ENTIRELY',  // Added for DRINK_ENTIRELY operation
  // ... ADD NEW OPERATION TYPES HERE (keep alphabetically sorted)
];
```

### 2. src/dependencyInjection/registrations/interpreterRegistrations.js

**Current State**: Basic function with registrations

**Add Documentation**:

```javascript
/**
 * Operation Registry Mappings
 *
 * Maps operation type strings to handler tokens
 *
 * Requirements:
 * - Operation type must match schema "const" value exactly
 * - Handler token must be defined in tokens-core.js (without "I" prefix)
 * - Handler must be registered in operationHandlerRegistrations.js
 *
 * Verification:
 * Run `npm run validate` or `npm run validate:strict` to check consistency
 *
 * @see src/dependencyInjection/tokens/tokens-core.js
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js
 * @see src/utils/preValidationUtils.js (KNOWN_OPERATION_TYPES)
 */
export function registerInterpreters(container) {
  const registrar = new Registrar(container);

  // ... other registrations ...

  // ---------------------------------------------------------------------------
  //  OperationRegistry
  // ---------------------------------------------------------------------------
  registrar.singletonFactory(tokens.OperationRegistry, (c) => {
    const registry = new OperationRegistry({
      logger: c.resolve(tokens.ILogger),
    });

  // Defer resolution of handlers until execution time
  const bind =
    (tkn) =>
    (...args) =>
      c.resolve(tkn).execute(...args);

  // Operation mappings - keep alphabetically sorted
  // Format: registry.register('OPERATION_TYPE', bind(tokens.HandlerToken));
  registry.register('ADD_COMPONENT', bind(tokens.AddComponentHandler));
  registry.register('DRINK_ENTIRELY', bind(tokens.DrinkEntirelyHandler));
  registry.register('DRINK_FROM', bind(tokens.DrinkFromHandler));
  // ... ADD NEW MAPPINGS HERE (alphabetically)
}
```

### 3. src/dependencyInjection/registrations/operationHandlerRegistrations.js

**Current State**: Simple registration calls

**Add Documentation**:

```javascript
/**
 * Operation Handler Factory Registrations
 *
 * Registers operation handler classes with the DI container using factory pattern
 *
 * When adding a new operation handler:
 * 1. Import the handler class at the top of this file
 * 2. Add factory entry to handlerFactories array: [token, HandlerClass, factory function]
 * 3. Ensure token is defined in tokens-core.js (without "I" prefix)
 * 4. Keep imports and factory entries alphabetically sorted
 *
 * Requirements:
 * - Handler class must extend BaseOperationHandler
 * - Token must be defined in tokens-core.js (e.g., DrinkFromHandler, not IDrinkFromHandler)
 * - Handler file must exist in src/logic/operationHandlers/
 *
 * Verification:
 * Run `npm run typecheck` to verify imports and registrations
 *
 * @see src/dependencyInjection/tokens/tokens-core.js
 * @see src/logic/operationHandlers/ (handler implementations)
 */

// Import handlers (keep alphabetically sorted)
import AddComponentHandler from '../../logic/operationHandlers/addComponentHandler.js';
import DrinkEntirelyHandler from '../../logic/operationHandlers/drinkEntirelyHandler.js';
import DrinkFromHandler from '../../logic/operationHandlers/drinkFromHandler.js';
// ... ADD NEW IMPORTS HERE (alphabetically)

export function registerOperationHandlers(registrar) {
  const handlerFactories = [
    [
      tokens.AddComponentHandler,
      AddComponentHandler,
      (c, Handler) =>
        new Handler({
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
          gameDataRepository: c.resolve(tokens.IGameDataRepository),
        }),
    ],
    [
      tokens.DrinkEntirelyHandler,
      DrinkEntirelyHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.DrinkFromHandler,
      DrinkFromHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    // ... ADD NEW FACTORY ENTRIES HERE (alphabetically)
  ];

  for (const [token, ctor, factory] of handlerFactories) {
    registrar.singletonFactory(token, (c) => factory(c, ctor));
  }
}
```

### 4. src/dependencyInjection/tokens/tokens-core.js

**Add Documentation** at the top of the tokens object:

```javascript
/**
 * Dependency Injection Tokens
 *
 * Tokens for operation handlers follow the pattern:
 * [OperationName]Handler: '[OperationName]Handler'
 *
 * Naming conventions:
 * - Use PascalCase for operation name
 * - End with 'Handler'
 * - Do NOT use 'I' prefix for operation handlers (unlike other service interfaces)
 * - Example: DrinkFromHandler for DRINK_FROM operation (not IDrinkFromHandler)
 *
 * When adding a new operation handler token:
 * 1. Add token following the pattern above (without "I" prefix)
 * 2. Keep tokens alphabetically sorted within the operation handlers section
 * 3. Register handler in operationHandlerRegistrations.js
 * 4. Map operation in interpreterRegistrations.js
 *
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js
 */
export const coreTokens = freeze({
  // ... other tokens ...

  // Operation Handler Tokens (alphabetically sorted, NO "I" prefix)
  AddComponentHandler: 'AddComponentHandler',
  DrinkEntirelyHandler: 'DrinkEntirelyHandler',
  DrinkFromHandler: 'DrinkFromHandler',
  // ... ADD NEW OPERATION HANDLER TOKENS HERE (alphabetically)

  // ... other tokens...
});
```

## Acceptance Criteria

- [ ] All four registration files have comprehensive header documentation
- [ ] Each file includes:
  - Purpose and usage explanation
  - Step-by-step instructions for adding new operations
  - Links to related files
  - Verification commands
  - Common mistakes warnings
- [ ] Documentation uses consistent formatting
- [ ] All cross-references are accurate
- [ ] Code examples are correct

## Testing

1. Review each file's documentation for clarity
2. Verify all file paths and cross-references are correct
3. Test that verification commands work as documented
4. Have a peer review for comprehension

## Implementation Notes

- Use JSDoc-style comments for consistency
- Keep existing code structure unchanged
- Add inline comments for complex sections
- Maintain alphabetical sorting guidelines

## Time Estimate

2-3 hours

## Related Tickets

- OPEHANIMP-001: Update CLAUDE.md with enhanced checklist

## Success Metrics

- Developers spend less time searching for "what to update next"
- Reduced context switching between documentation and code
- Fewer missed registration steps
