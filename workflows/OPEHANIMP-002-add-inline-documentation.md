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
 * 3. Run `npm run validate:operations` to verify consistency
 *
 * Common mistake: Forgetting this step causes "Unknown operation type" errors
 *
 * Related files:
 * - data/schemas/operations/[operationName].schema.json (type constant)
 * - src/dependencyInjection/registrations/interpreterRegistrations.js (registry mapping)
 *
 * @see docs/adding-operations.md for complete checklist
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
 * - Handler token must be defined in tokens-core.js
 * - Handler must be registered in operationHandlerRegistrations.js
 *
 * Verification:
 * Run `npm run validate:operations` to check consistency
 *
 * @see src/dependencyInjection/tokens/tokens-core.js
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js
 * @see src/utils/preValidationUtils.js (KNOWN_OPERATION_TYPES)
 */
export function registerInterpreter(container) {
  const operationRegistry = container.resolve(tokens.IOperationRegistry);

  // Operation mappings - keep alphabetically sorted
  // Format: operationRegistry.registerOperation('OPERATION_TYPE', tokens.IHandlerToken);
  operationRegistry.registerOperation('ADD_COMPONENT', tokens.IAddComponentHandler);
  operationRegistry.registerOperation('DRINK_ENTIRELY', tokens.IDrinkEntirelyHandler);
  operationRegistry.registerOperation('DRINK_FROM', tokens.IDrinkFromHandler);
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
 * Registers operation handler classes with the DI container
 *
 * When adding a new operation handler:
 * 1. Import the handler class at the top of this file
 * 2. Add container.register(tokens.IHandlerToken, HandlerClass)
 * 3. Ensure token is defined in tokens-core.js
 * 4. Keep imports and registrations alphabetically sorted
 *
 * Requirements:
 * - Handler class must extend BaseOperationHandler
 * - Token must be defined in tokens-core.js
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

export function registerOperationHandlers(container) {
  // Register operation handlers (keep alphabetically sorted)
  // Format: container.register(tokens.IHandlerToken, HandlerClass);
  container.register(tokens.IAddComponentHandler, AddComponentHandler);
  container.register(tokens.IDrinkEntirelyHandler, DrinkEntirelyHandler);
  container.register(tokens.IDrinkFromHandler, DrinkFromHandler);
  // ... ADD NEW REGISTRATIONS HERE (alphabetically)
}
```

### 4. src/dependencyInjection/tokens/tokens-core.js

**Add Documentation** at the top of the tokens object:

```javascript
/**
 * Dependency Injection Tokens
 *
 * Tokens for operation handlers follow the pattern:
 * I[OperationName]Handler: 'I[OperationName]Handler'
 *
 * Naming conventions:
 * - Start with 'I' (Interface convention)
 * - Use PascalCase for operation name
 * - End with 'Handler'
 * - Example: IDrinkFromHandler for DRINK_FROM operation
 *
 * When adding a new operation handler token:
 * 1. Add token following the pattern above
 * 2. Keep tokens alphabetically sorted
 * 3. Register handler in operationHandlerRegistrations.js
 * 4. Map operation in interpreterRegistrations.js
 *
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js
 */
export const tokens = {
  // Operation Handler Tokens (alphabetically sorted)
  IAddComponentHandler: 'IAddComponentHandler',
  IDrinkEntirelyHandler: 'IDrinkEntirelyHandler',
  IDrinkFromHandler: 'IDrinkFromHandler',
  // ... ADD NEW OPERATION HANDLER TOKENS HERE (alphabetically)

  // Other tokens...
};
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
