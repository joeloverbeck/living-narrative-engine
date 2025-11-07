# OPEHANIMP-005: Enhance Error Messages in Operation Registry

**Priority**: High
**Effort**: Medium
**Phase**: 1 (Day 2)
**Dependencies**: None

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
   Look for: container.register(tokens.IDrinkFromHandler, DrinkFromHandler)

2. Check token is defined:
   File: src/dependencyInjection/tokens/tokens-core.js
   Look for: IDrinkFromHandler: 'IDrinkFromHandler'

3. Check operation is mapped:
   File: src/dependencyInjection/registrations/interpreterRegistrations.js
   Look for: operationRegistry.registerOperation('DRINK_FROM', tokens.IDrinkFromHandler)

📊 Currently registered operations (45 total):
  - ADD_COMPONENT
  - DRINK_ENTIRELY
  - DROP_ITEM_AT_LOCATION
  - OPEN_CONTAINER
  ... (showing first 10, run with --verbose for full list)

🔍 Verification:
  npm run validate:operations  # Check registration completeness

📚 See docs/adding-operations.md for complete guide
```

### 2. Update Operation Registry

**File**: `src/logic/operationRegistry.js` (or similar)

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

  const tokenName = 'I' + operationType.split('_').map(word =>
    word.charAt(0) + word.slice(1).toLowerCase()
  ).join('') + 'Handler';

  if (!diagnostics.tokenDefined) {
    lines.push('1. Define the token:');
    lines.push('   File: src/dependencyInjection/tokens/tokens-core.js');
    lines.push(`   Add: ${tokenName}: '${tokenName}',`);
    lines.push('');
  }

  if (!diagnostics.handlerRegistered) {
    const handlerClassName = tokenName.substring(1); // Remove leading 'I'
    lines.push('2. Register the handler:');
    lines.push('   File: src/dependencyInjection/registrations/operationHandlerRegistrations.js');
    lines.push(`   Add: container.register(tokens.${tokenName}, ${handlerClassName});`);
    lines.push('');
  }

  lines.push('3. Map the operation:');
  lines.push('   File: src/dependencyInjection/registrations/interpreterRegistrations.js');
  lines.push(`   Add: operationRegistry.registerOperation('${operationType}', tokens.${tokenName});`);
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
  lines.push('  npm run validate:operations  # Check registration completeness');
  lines.push('');
  lines.push('📚 Complete guide:');
  lines.push('  docs/adding-operations.md');
  lines.push('  CLAUDE.md (search "Adding New Operations")');

  return lines.join('\n');
}

/**
 * Performs diagnostic checks on operation registration
 *
 * @param {string} operationType - Operation type to diagnose
 * @param {Object} container - DI container
 * @returns {Object} Diagnostic results
 */
function diagnoseOperationRegistration(operationType, container) {
  const diagnostics = {
    schemaExists: false,
    schemaReferenced: false,
    inWhitelist: false,
    tokenDefined: false,
    handlerRegistered: false,
  };

  try {
    // Check schema file exists
    const schemaFileName = operationType.toLowerCase().split('_').map((word, idx) =>
      idx === 0 ? word : word.charAt(0) + word.slice(1)
    ).join('') + '.schema.json';
    const schemaPath = path.join(process.cwd(), 'data/schemas/operations', schemaFileName);
    diagnostics.schemaExists = fs.existsSync(schemaPath);

    // Check schema referenced
    const operationSchemaPath = path.join(process.cwd(), 'data/schemas/operations/operation.schema.json');
    const operationSchema = JSON.parse(fs.readFileSync(operationSchemaPath, 'utf8'));
    diagnostics.schemaReferenced = operationSchema.oneOf?.some(ref => ref.$ref?.includes(schemaFileName));

    // Check whitelist (import from preValidationUtils)
    const { KNOWN_OPERATION_TYPES } = require('../utils/preValidationUtils.js');
    diagnostics.inWhitelist = KNOWN_OPERATION_TYPES.includes(operationType);

    // Check token defined
    const tokenName = 'I' + operationType.split('_').map(word =>
      word.charAt(0) + word.slice(1).toLowerCase()
    ).join('') + 'Handler';
    const { tokens } = require('../dependencyInjection/tokens/tokens-core.js');
    diagnostics.tokenDefined = tokenName in tokens;

    // Check handler registered
    if (diagnostics.tokenDefined) {
      try {
        container.resolve(tokens[tokenName]);
        diagnostics.handlerRegistered = true;
      } catch {
        diagnostics.handlerRegistered = false;
      }
    }
  } catch (error) {
    // If diagnostics fail, continue with what we have
  }

  return diagnostics;
}

/**
 * Operation Registry Implementation
 */
class OperationRegistry {
  #handlers = new Map();
  #logger;
  #container;

  constructor({ logger, container }) {
    assertPresent(logger, 'Logger is required');
    assertPresent(container, 'Container is required');
    this.#logger = logger;
    this.#container = container;
  }

  /**
   * Register an operation type with its handler token
   */
  registerOperation(operationType, handlerToken) {
    assertPresent(operationType, 'Operation type is required');
    assertPresent(handlerToken, 'Handler token is required');

    const handler = this.#container.resolve(handlerToken);
    this.#handlers.set(operationType, handler);
    this.#logger.debug('Operation registered', { operationType, handlerToken });
  }

  /**
   * Execute an operation
   *
   * @throws {OperationHandlerNotFoundError} If handler is not registered
   */
  async execute(operation, context) {
    const handler = this.#handlers.get(operation.type);

    if (!handler) {
      // Gather diagnostic information
      const registeredOperations = Array.from(this.#handlers.keys()).sort();
      const diagnostics = diagnoseOperationRegistration(operation.type, this.#container);

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

    return await handler.execute(context);
  }

  /**
   * Check if an operation is registered
   */
  hasOperation(operationType) {
    return this.#handlers.has(operationType);
  }

  /**
   * Get all registered operation types
   */
  getRegisteredOperations() {
    return Array.from(this.#handlers.keys()).sort();
  }
}

export default OperationRegistry;
export { OperationHandlerNotFoundError };
```

## Acceptance Criteria

- [ ] `OperationHandlerNotFoundError` class is created
- [ ] Error message includes diagnostic checklist
- [ ] Error shows currently registered operations
- [ ] Error provides specific file paths and code to add
- [ ] Diagnostic function checks all registration points
- [ ] Operation registry uses enhanced error formatting
- [ ] Tests verify error message content
- [ ] Error messages are readable in terminal output

## Testing

### Unit Tests

**File**: `tests/unit/logic/operationRegistry.test.js`

```javascript
describe('OperationRegistry - Enhanced Error Messages', () => {
  it('should provide detailed error when handler not found', async () => {
    const registry = new OperationRegistry({ logger: mockLogger, container: mockContainer });

    registry.registerOperation('ADD_COMPONENT', mockHandler);

    await expect(
      registry.execute({ type: 'UNREGISTERED_OP' }, {})
    ).rejects.toThrow(OperationHandlerNotFoundError);

    await expect(
      registry.execute({ type: 'UNREGISTERED_OP' }, {})
    ).rejects.toThrow(/No handler registered/);

    await expect(
      registry.execute({ type: 'UNREGISTERED_OP' }, {})
    ).rejects.toThrow(/Currently registered operations/);
  });

  it('should include diagnostic information in error', async () => {
    const registry = new OperationRegistry({ logger: mockLogger, container: mockContainer });

    try {
      await registry.execute({ type: 'UNREGISTERED_OP' }, {});
      fail('Should have thrown error');
    } catch (error) {
      expect(error.message).toContain('Required registrations checklist');
      expect(error.message).toMatch(/✓|✗/); // Contains check marks
    }
  });

  it('should list registered operations in error', async () => {
    const registry = new OperationRegistry({ logger: mockLogger, container: mockContainer });

    registry.registerOperation('ADD_COMPONENT', mockHandler);
    registry.registerOperation('REMOVE_COMPONENT', mockHandler);

    try {
      await registry.execute({ type: 'UNREGISTERED_OP' }, {});
      fail('Should have thrown error');
    } catch (error) {
      expect(error.message).toContain('ADD_COMPONENT');
      expect(error.message).toContain('REMOVE_COMPONENT');
    }
  });
});
```

## Implementation Notes

- Import `fs` and `path` modules for diagnostics
- Handle file system errors gracefully in diagnostic function
- Keep diagnostic checks fast (use try-catch)
- Format error for 80-column terminal readability

## Time Estimate

4-5 hours (including testing)

## Related Tickets

- OPEHANIMP-004: Improve error messages in preValidationUtils.js

## Success Metrics

- Developers can identify and fix handler registration issues in <15 minutes
- Error messages provide all necessary information without documentation lookup
- Reduced support requests about "No handler registered" errors
