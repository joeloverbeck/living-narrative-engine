# OPEHANIMP-005: Enhance Error Messages in Operation Registry

**Priority**: High
**Effort**: Medium
**Phase**: 1 (Day 2)
**Dependencies**: None

---

## CRITICAL CORRECTIONS

**This workflow has been corrected after validation against the actual codebase.**

**Key corrections made:**
1. Implement in `OperationInterpreter`, NOT `OperationRegistry` (Registry only stores handlers, doesn't execute)
2. Token names: Use `DrinkFromHandler`, NOT `IDrinkFromHandler` (no "I" prefix for operation handlers)
3. Registry methods: `register()` and `getHandler()`, NOT `registerOperation()` or `execute()`
4. Cannot use Node.js modules (`fs`, `path`, `require`) - must be browser-compatible
5. Schema location: `data/schemas/operation.schema.json` (NOT `data/schemas/operations/operation.schema.json`)
6. Schema uses `anyOf`, NOT `oneOf`
7. Documentation: Reference `CLAUDE.md`, NOT `docs/adding-operations.md` (doesn't exist)

**See validation report at end of file for complete details.**

---

## Objective

Improve error messages in the operation registry to provide actionable guidance when operations are not mapped to handlers, including a list of currently registered operations and specific steps to fix the issue.

## Background

Current error when operation handler is not registered:
```
No handler registered for operation type: DRINK_FROM
```

This doesn't tell developers:
- Which files to check for registration
- What tokens should exist
- What other operations are registered (for comparison)
- How to verify the fix

## Requirements

### 1. Enhanced Error Message Format

When an operation is requested but no handler is mapped, provide:

```
❌ No handler registered for operation type: "DRINK_FROM"

The operation type exists in the schema but is not mapped to a handler.

📋 Required registrations checklist:

  ✓ Schema file exists
  ✓ Schema referenced in operation.schema.json
  ✓ Type in KNOWN_OPERATION_TYPES whitelist
  ✗ Handler registered (MISSING)
  ✗ Operation mapped (MISSING)

🔧 To fix this:

1. Check handler is registered:
   File: src/dependencyInjection/registrations/operationHandlerRegistrations.js
   Look for: [tokens.DrinkFromHandler, DrinkFromHandler, (c, Handler) => new Handler({...})]
   in the handlerFactories array

2. Check token is defined:
   File: src/dependencyInjection/tokens/tokens-core.js
   Look for: DrinkFromHandler: 'DrinkFromHandler'
   Note: Operation handlers do NOT use 'I' prefix

3. Check operation is mapped:
   File: src/dependencyInjection/registrations/interpreterRegistrations.js
   Look for: registry.register('DRINK_FROM', bind(tokens.DrinkFromHandler))

📊 Currently registered operations (45 total):
  - ADD_COMPONENT
  - DRINK_ENTIRELY
  - DROP_ITEM_AT_LOCATION
  - OPEN_CONTAINER
  ... (showing first 10, run with --verbose for full list)

🔍 Verification:
  npm run validate  # Check registration completeness

📚 Complete guide:
  See CLAUDE.md - search for "Adding New Operations - Complete Checklist"
```

### 2. Update OperationInterpreter (Not OperationRegistry)

**IMPORTANT**: The error enhancement should be implemented in `src/logic/operationInterpreter.js`, NOT in `operationRegistry.js`.

**Rationale**:
- OperationRegistry is a simple storage class with only `register()` and `getHandler()` methods
- It has no `execute()` method and no access to the DI container
- OperationInterpreter is the component that executes operations and can throw enhanced errors
- The registry is browser-compatible and cannot use Node.js `fs`/`path`/`require` modules

**File**: `src/logic/operationInterpreter.js`

```javascript
import { assertPresent } from '../utils/dependencyUtils.js';

/**
 * Custom error for operation handler not found
 */
class OperationHandlerNotFoundError extends Error {
  constructor(operationType, registeredOperations, diagnostics) {
    const message = formatHandlerNotFoundError(operationType, registeredOperations, diagnostics);
    super(message);
    this.name = 'OperationHandlerNotFoundError';
    this.operationType = operationType;
    this.registeredOperations = registeredOperations;
  }
}

/**
 * Formats detailed error message for missing handler
 *
 * @param {string} operationType - The operation type that has no handler
 * @param {string[]} registeredOperations - List of all registered operation types
 * @param {Object} diagnostics - Diagnostic information about registration state
 * @returns {string} Formatted error message
 */
function formatHandlerNotFoundError(operationType, registeredOperations, diagnostics) {
  const lines = [
    `❌ No handler registered for operation type: "${operationType}"`,
    '',
    'The operation type exists in the schema but is not mapped to a handler.',
    '',
    '📋 Required registrations checklist:',
    '',
  ];

  // Show diagnostic checks
  lines.push(`  ${diagnostics.schemaExists ? '✓' : '✗'} Schema file exists`);
  lines.push(`  ${diagnostics.schemaReferenced ? '✓' : '✗'} Schema referenced in operation.schema.json`);
  lines.push(`  ${diagnostics.inWhitelist ? '✓' : '✗'} Type in KNOWN_OPERATION_TYPES whitelist`);
  lines.push(`  ${diagnostics.tokenDefined ? '✓' : '✗'} Token defined`);
  lines.push(`  ${diagnostics.handlerRegistered ? '✓' : '✗'} Handler registered`);
  lines.push(`  ✗ Operation mapped (MISSING - this is the current error)`);
  lines.push('');

  // Provide fix instructions
  lines.push('🔧 To fix this:');
  lines.push('');

  // Convert DRINK_FROM -> DrinkFromHandler (no 'I' prefix for operation handlers)
  const tokenName = operationType.split('_').map(word =>
    word.charAt(0) + word.slice(1).toLowerCase()
  ).join('') + 'Handler';

  if (!diagnostics.tokenDefined) {
    lines.push('1. Define the token:');
    lines.push('   File: src/dependencyInjection/tokens/tokens-core.js');
    lines.push(`   Add: ${tokenName}: '${tokenName}',`);
    lines.push('');
  }

  if (!diagnostics.handlerRegistered) {
    lines.push('2. Register the handler:');
    lines.push('   File: src/dependencyInjection/registrations/operationHandlerRegistrations.js');
    lines.push(`   Add to handlerFactories array:`);
    lines.push(`   [tokens.${tokenName}, ${tokenName}, (c, Handler) => new Handler({...})],`);
    lines.push('');
  }

  lines.push('3. Map the operation:');
  lines.push('   File: src/dependencyInjection/registrations/interpreterRegistrations.js');
  lines.push(`   Add: registry.register('${operationType}', bind(tokens.${tokenName}));`);
  lines.push('');

  // Show registered operations
  lines.push(`📊 Currently registered operations (${registeredOperations.length} total):`);

  if (registeredOperations.length <= 10) {
    registeredOperations.forEach(op => lines.push(`  - ${op}`));
  } else {
    registeredOperations.slice(0, 10).forEach(op => lines.push(`  - ${op}`));
    lines.push(`  ... and ${registeredOperations.length - 10} more`);
    lines.push('');
    lines.push('💡 Tip: Check if your operation type has a typo by comparing to the list above');
  }

  lines.push('');
  lines.push('🔍 Verification:');
  lines.push('  npm run validate  # Check registration completeness');
  lines.push('');
  lines.push('📚 Complete guide:');
  lines.push('  CLAUDE.md (search "Adding New Operations - Complete Checklist")');

  return lines.join('\n');
}

/**
 * Performs diagnostic checks on operation registration
 *
 * IMPORTANT: This function must be browser-compatible.
 * Cannot use Node.js modules (fs, path, require).
 *
 * @param {string} operationType - Operation type to diagnose
 * @param {Map} registeredOperations - Map of registered operation types (from registry)
 * @returns {Object} Diagnostic results
 */
function diagnoseOperationRegistration(operationType, registeredOperations) {
  const diagnostics = {
    schemaExists: null,        // Cannot check in browser
    schemaReferenced: null,    // Cannot check in browser
    inWhitelist: false,
    tokenDefined: null,        // Cannot check reliably in browser
    handlerRegistered: false,
  };

  try {
    // Check whitelist (must be imported at module level)
    // Import KNOWN_OPERATION_TYPES from '../utils/preValidationUtils.js' at top of file
    diagnostics.inWhitelist = KNOWN_OPERATION_TYPES.includes(operationType);

    // Check if handler is registered in the registry
    diagnostics.handlerRegistered = registeredOperations.has(operationType);

    // Note: Schema and token checks require file system access and are not
    // feasible in a browser-compatible implementation. These checks should be
    // done during build/validation time, not runtime.
  } catch (error) {
    // If diagnostics fail, continue with what we have
  }

  return diagnostics;
}

/**
 * IMPORTANT: This implementation goes in OperationInterpreter, NOT OperationRegistry
 *
 * OperationInterpreter Enhancement
 *
 * The actual OperationRegistry only has:
 * - register(operationType, handler)
 * - getHandler(operationType)
 *
 * It does NOT execute operations. That's OperationInterpreter's job.
 */

// Add to src/logic/operationInterpreter.js:
import { KNOWN_OPERATION_TYPES } from '../utils/preValidationUtils.js';

class OperationInterpreter {
  #logger;
  #operationRegistry;

  constructor({ logger, operationRegistry }) {
    this.#logger = logger;
    this.#operationRegistry = operationRegistry;
  }

  /**
   * Execute an operation
   *
   * @throws {OperationHandlerNotFoundError} If handler is not registered
   */
  async execute(operation, context) {
    const handler = this.#operationRegistry.getHandler(operation.type);

    if (!handler) {
      // Gather diagnostic information
      // Note: We can't get all registered operations from current OperationRegistry API
      // You may need to add a getRegisteredTypes() method to OperationRegistry
      const registeredOperations = []; // TODO: Get from registry
      const diagnostics = diagnoseOperationRegistration(
        operation.type,
        new Map(registeredOperations.map(op => [op, true]))
      );

      // Create detailed error
      const error = new OperationHandlerNotFoundError(
        operation.type,
        registeredOperations,
        diagnostics
      );

      this.#logger.error('Operation handler not found', {
        operationType: operation.type,
        registeredOperations: registeredOperations.length,
        diagnostics,
      });

      throw error;
    }

    // Execute the handler
    return await handler(operation, context);
  }
}

export default OperationInterpreter;
export { OperationHandlerNotFoundError };

// Note: You'll need to add a method to OperationRegistry to get all registered types:
// In src/logic/operationRegistry.js, add:
//
// getRegisteredTypes() {
//   return Array.from(this.#registry.keys()).sort();
// }
```

## Acceptance Criteria

- [ ] `OperationHandlerNotFoundError` class is created
- [ ] Error message includes diagnostic checklist
- [ ] Error shows currently registered operations
- [ ] Error provides specific file paths and code to add
- [ ] Diagnostic function checks whitelist and registration status
- [ ] OperationInterpreter (not Registry) uses enhanced error formatting
- [ ] OperationRegistry.getRegisteredTypes() method added for listing operations
- [ ] Tests verify error message content in OperationInterpreter
- [ ] Error messages are readable in terminal output

## Testing

### Unit Tests

**File**: `tests/unit/logic/operationInterpreter.test.js`

```javascript
describe('OperationInterpreter - Enhanced Error Messages', () => {
  let mockRegistry;
  let mockLogger;
  let interpreter;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockRegistry = {
      getHandler: jest.fn(),
      getRegisteredTypes: jest.fn().mockReturnValue(['ADD_COMPONENT', 'REMOVE_COMPONENT']),
    };

    interpreter = new OperationInterpreter({
      logger: mockLogger,
      operationRegistry: mockRegistry
    });
  });

  it('should provide detailed error when handler not found', async () => {
    mockRegistry.getHandler.mockReturnValue(undefined);

    await expect(
      interpreter.execute({ type: 'UNREGISTERED_OP' }, {})
    ).rejects.toThrow(OperationHandlerNotFoundError);

    await expect(
      interpreter.execute({ type: 'UNREGISTERED_OP' }, {})
    ).rejects.toThrow(/No handler registered/);

    await expect(
      interpreter.execute({ type: 'UNREGISTERED_OP' }, {})
    ).rejects.toThrow(/Currently registered operations/);
  });

  it('should include diagnostic information in error', async () => {
    mockRegistry.getHandler.mockReturnValue(undefined);

    try {
      await interpreter.execute({ type: 'UNREGISTERED_OP' }, {});
      fail('Should have thrown error');
    } catch (error) {
      expect(error.message).toContain('Required registrations checklist');
      expect(error.message).toMatch(/✓|✗/); // Contains check marks
    }
  });

  it('should list registered operations in error', async () => {
    mockRegistry.getHandler.mockReturnValue(undefined);

    try {
      await interpreter.execute({ type: 'UNREGISTERED_OP' }, {});
      fail('Should have thrown error');
    } catch (error) {
      expect(error.message).toContain('ADD_COMPONENT');
      expect(error.message).toContain('REMOVE_COMPONENT');
    }
  });
});
```

**Additional Tests for OperationRegistry**:

**File**: `tests/unit/logic/operationRegistry.test.js`

```javascript
describe('OperationRegistry - getRegisteredTypes', () => {
  it('should return sorted list of registered operation types', () => {
    const registry = new OperationRegistry({ logger: mockLogger });

    registry.register('QUERY_COMPONENT', mockHandler);
    registry.register('ADD_COMPONENT', mockHandler);
    registry.register('REMOVE_COMPONENT', mockHandler);

    const types = registry.getRegisteredTypes();

    expect(types).toEqual(['ADD_COMPONENT', 'QUERY_COMPONENT', 'REMOVE_COMPONENT']);
  });

  it('should return empty array when no operations registered', () => {
    const registry = new OperationRegistry({ logger: mockLogger });

    expect(registry.getRegisteredTypes()).toEqual([]);
  });
});
```

## Implementation Notes

- **DO NOT** use Node.js modules (`fs`, `path`, `require`) - code must be browser-compatible
- Import `KNOWN_OPERATION_TYPES` from `preValidationUtils.js` at module level
- Keep diagnostic checks fast (use try-catch)
- Format error for 80-column terminal readability
- Add `getRegisteredTypes()` method to OperationRegistry first
- Implement enhanced errors in OperationInterpreter, NOT OperationRegistry
- Token names for operation handlers do NOT use 'I' prefix (e.g., `DrinkFromHandler`, not `IDrinkFromHandler`)
- Use `registry.register()`, not `registerOperation()`
- Schema root location: `data/schemas/operation.schema.json` (no "operations" subdirectory)
- Individual schemas: `data/schemas/operations/[operationName].schema.json`

## Time Estimate

4-5 hours (including testing)

## Related Tickets

- OPEHANIMP-004: Improve error messages in preValidationUtils.js

## Success Metrics

- Developers can identify and fix handler registration issues in <15 minutes
- Error messages provide all necessary information without documentation lookup
- Reduced support requests about "No handler registered" errors

---

## VALIDATION REPORT

**Validated Against Codebase:** 2025-11-07

### Discrepancies Found and Corrected

#### 1. **Wrong Component for Implementation** ❌ CRITICAL
- **Original**: Assumed implementation in `OperationRegistry`
- **Actual**: Must be in `OperationInterpreter`
- **Reason**: Registry only stores/retrieves handlers; Interpreter executes them

#### 2. **Incorrect API Methods** ❌ CRITICAL
- **Original**: `registerOperation()`, `execute()`, `hasOperation()`, `getRegisteredOperations()`
- **Actual**: Only `register()` and `getHandler()` exist
- **Impact**: Code would not compile

#### 3. **Token Naming Convention** ❌ CRITICAL
- **Original**: `IDrinkFromHandler` (with "I" prefix)
- **Actual**: `DrinkFromHandler` (NO "I" prefix for operation handlers)
- **Source**: `/home/user/living-narrative-engine/src/dependencyInjection/tokens/tokens-core.js` lines 18-20

#### 4. **DI Registration Pattern** ❌ CRITICAL
- **Original**: `container.register(tokens.IDrinkFromHandler, DrinkFromHandler)`
- **Actual**: Factory array pattern in `operationHandlerRegistrations.js`
- **Correct**: `[tokens.DrinkFromHandler, DrinkFromHandler, (c, Handler) => new Handler({...})]`

#### 5. **Operation Mapping Method** ❌ CRITICAL
- **Original**: `operationRegistry.registerOperation('DRINK_FROM', tokens.IDrinkFromHandler)`
- **Actual**: `registry.register('DRINK_FROM', bind(tokens.DrinkFromHandler))`
- **Source**: `/home/user/living-narrative-engine/src/dependencyInjection/registrations/interpreterRegistrations.js`

#### 6. **Schema Location** ❌
- **Original**: `data/schemas/operations/operation.schema.json`
- **Actual**: `data/schemas/operation.schema.json` (no "operations" subdirectory for root schema)
- **Note**: Individual schemas ARE in `data/schemas/operations/`

#### 7. **Schema Structure** ❌
- **Original**: Uses `oneOf`
- **Actual**: Uses `anyOf` (line 37 of operation.schema.json)

#### 8. **Constructor Parameters** ❌ CRITICAL
- **Original**: `constructor({ logger, container })`
- **Actual**: `constructor({ logger })` (no container parameter)
- **Impact**: Would cause runtime error

#### 9. **Node.js Module Usage** ❌ CRITICAL
- **Original**: Used `fs`, `path`, `require()`
- **Actual**: Code must be browser-compatible
- **Impact**: Would break browser execution

#### 10. **Documentation Reference** ❌
- **Original**: `docs/adding-operations.md`
- **Actual**: File does not exist; use `CLAUDE.md` instead

#### 11. **Test File Location** ✅ CORRECT
- `tests/unit/logic/operationRegistry.test.js` exists
- However, new tests should be in `operationInterpreter.test.js`

#### 12. **File Paths** ✅ CORRECT
- `/home/user/living-narrative-engine/src/logic/operationRegistry.js`
- `/home/user/living-narrative-engine/src/utils/preValidationUtils.js`
- `/home/user/living-narrative-engine/src/dependencyInjection/tokens/tokens-core.js`
- `/home/user/living-narrative-engine/src/dependencyInjection/registrations/operationHandlerRegistrations.js`
- `/home/user/living-narrative-engine/src/dependencyInjection/registrations/interpreterRegistrations.js`

### Implementation Checklist Post-Validation

- [ ] Add `getRegisteredTypes()` method to OperationRegistry
- [ ] Create `OperationHandlerNotFoundError` in errors/ directory
- [ ] Implement error formatting functions (browser-compatible)
- [ ] Update OperationInterpreter to use enhanced errors
- [ ] Write tests for OperationInterpreter error handling
- [ ] Write tests for OperationRegistry.getRegisteredTypes()
- [ ] Verify error messages are readable in terminal
- [ ] Update related documentation if needed

### Validation Sources

All validations performed against production code in:
- `/home/user/living-narrative-engine/src/logic/operationRegistry.js`
- `/home/user/living-narrative-engine/src/logic/operationInterpreter.js`
- `/home/user/living-narrative-engine/src/dependencyInjection/tokens/tokens-core.js`
- `/home/user/living-narrative-engine/src/dependencyInjection/registrations/operationHandlerRegistrations.js`
- `/home/user/living-narrative-engine/src/dependencyInjection/registrations/interpreterRegistrations.js`
- `/home/user/living-narrative-engine/data/schemas/operation.schema.json`
- `/home/user/living-narrative-engine/src/utils/preValidationUtils.js`
- `/home/user/living-narrative-engine/tests/unit/logic/operationRegistry.test.js`
