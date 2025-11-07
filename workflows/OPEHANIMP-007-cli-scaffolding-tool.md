# OPEHANIMP-007: Implement CLI Scaffolding Tool (npm run create-operation)

**Priority**: High
**Effort**: High
**Phase**: 2 (Week 1)
**Dependencies**: OPEHANIMP-001, OPEHANIMP-002, OPEHANIMP-003, OPEHANIMP-006

## Objective

Create a command-line tool that automatically scaffolds a complete operation handler implementation, including all necessary files, registrations, and test templates.

## Background

Currently, adding an operation requires manually creating/updating 9+ files. This is error-prone and time-consuming. A CLI tool can:
- Generate all boilerplate automatically
- Update all registration files
- Create test templates
- Ensure consistency
- Reduce time from 30+ minutes to <5 minutes

## Requirements

### 1. CLI Script Implementation

**File**: `scripts/createOperation.js`

**Functionality**:
- Accept operation name as command-line argument
- Convert naming conventions (snake_case → PascalCase, camelCase, UPPER_SNAKE_CASE)
- Generate operation schema from template
- Create handler class with boilerplate
- Update all registration files
- Create unit and integration test templates
- Validate completeness after generation
- Provide next steps guidance

### 2. Naming Convention Conversion

```javascript
// Input: "drink_from"
// Outputs:
// - PascalCase: "DrinkFrom"
// - camelCase: "drinkFrom"
// - UPPER_SNAKE_CASE: "DRINK_FROM"
// - Token: "IDrinkFromHandler"
// - Handler Class: "DrinkFromHandler"
```

### 3. File Generation

#### Schema File Template

Generate `data/schemas/operations/[camelCase].schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://living-narrative-engine/schemas/operations/[camelCase].schema.json",
  "description": "Schema for [UPPER_SNAKE_CASE] operation. Handler: src/logic/operationHandlers/[camelCase]Handler.js",
  "allOf": [
    {
      "$ref": "../base-operation.schema.json"
    },
    {
      "properties": {
        "type": {
          "const": "[UPPER_SNAKE_CASE]"
        },
        "parameters": {
          "type": "object",
          "properties": {
            "exampleParam": {
              "type": "string",
              "description": "TODO: Define actual parameters"
            }
          },
          "required": [],
          "additionalProperties": false
        }
      }
    }
  ]
}
```

#### Handler File Template

Generate `src/logic/operationHandlers/[camelCase]Handler.js`:

```javascript
/**
 * @file Handler for [UPPER_SNAKE_CASE] operation
 *
 * TODO: Add detailed description of what this operation does
 *
 * @see data/schemas/operations/[camelCase].schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - I[PascalCase]Handler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 *
 * @extends BaseOperationHandler
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { validateDependency, assertPresent } from '../utils/dependencyUtils.js';

/**
 * Handles [UPPER_SNAKE_CASE] operation execution
 *
 * TODO: Add detailed implementation description
 *
 * @class
 * @extends BaseOperationHandler
 */
class [PascalCase]Handler extends BaseOperationHandler {
  #componentMutationService;
  #entityStateQuerier;

  /**
   * @param {Object} dependencies
   * @param {IComponentMutationService} dependencies.componentMutationService
   * @param {IEntityStateQuerier} dependencies.entityStateQuerier
   * @param {ILogger} dependencies.logger
   * @param {IEventBus} dependencies.eventBus
   */
  constructor({ componentMutationService, entityStateQuerier, logger, eventBus }) {
    super({ logger, eventBus });

    validateDependency(componentMutationService, 'IComponentMutationService', logger, {
      requiredMethods: ['addComponent', 'removeComponent', 'updateComponent'],
    });
    validateDependency(entityStateQuerier, 'IEntityStateQuerier', logger, {
      requiredMethods: ['getEntity', 'hasComponent'],
    });

    this.#componentMutationService = componentMutationService;
    this.#entityStateQuerier = entityStateQuerier;
  }

  /**
   * Execute the [UPPER_SNAKE_CASE] operation
   *
   * @param {Object} context - Operation execution context
   * @param {Object} context.operation - Operation definition
   * @param {string} context.operation.type - Operation type ([UPPER_SNAKE_CASE])
   * @param {Object} context.operation.parameters - Operation parameters
   * @param {Object} context.ruleContext - Rule execution context
   * @returns {Promise<void>}
   * @throws {InvalidArgumentError} If parameters are invalid
   * @throws {OperationExecutionError} If operation fails
   */
  async execute(context) {
    const { parameters } = context.operation;

    try {
      // 1. Validate required parameters
      // TODO: Add parameter validation
      assertPresent(parameters, 'Parameters are required');

      // 2. Query current state
      // TODO: Query necessary entity state

      // 3. Execute business logic
      // TODO: Implement operation logic

      // 4. Mutate state
      // TODO: Apply state changes

      // 5. Dispatch success event
      this.dispatchOperationEvent('[UPPER_SNAKE_CASE]_COMPLETED', {
        // TODO: Add relevant event data
      });

    } catch (error) {
      this.handleOperationError(error, '[UPPER_SNAKE_CASE]', context);
      throw error;
    }
  }
}

export default [PascalCase]Handler;
```

#### Unit Test Template

Generate `tests/unit/logic/operationHandlers/[camelCase]Handler.test.js`

#### Integration Test Template

Generate `tests/integration/mods/items/[snake_case]RuleExecution.test.js`

### 4. Registration File Updates

The tool must automatically update:

1. **operation.schema.json** - Add $ref entry (alphabetically)
2. **tokens-core.js** - Add token definition (alphabetically)
3. **operationHandlerRegistrations.js** - Add import and registration (alphabetically)
4. **interpreterRegistrations.js** - Add mapping (alphabetically)
5. **preValidationUtils.js** - Add to KNOWN_OPERATION_TYPES (alphabetically)

**Implementation Strategy**:
- Parse existing file content
- Identify insertion points
- Insert new entries maintaining alphabetical order
- Preserve formatting and comments
- Validate syntax after modification

### 5. Validation After Generation

Run these checks automatically:

```javascript
// After file generation
execSync('npm run validate:schemas', { stdio: 'inherit' });
execSync('npm run typecheck', { stdio: 'inherit' });
execSync('npm run validate:operations', { stdio: 'inherit' });
```

### 6. User Output Format

```bash
$ npm run create-operation drink_from

🚀 Creating operation handler...
  Operation: drink_from
  Handler class: DrinkFromHandler
  Operation type: DRINK_FROM

📋 Step 1: Creating operation schema...
  ✅ Created data/schemas/operations/drinkFrom.schema.json

📋 Step 2: Adding schema reference to operation.schema.json...
  ✅ Updated data/schemas/operations/operation.schema.json

📋 Step 3: Creating handler class...
  ✅ Created src/logic/operationHandlers/drinkFromHandler.js

📋 Step 4: Adding DI token...
  ✅ Updated src/dependencyInjection/tokens/tokens-core.js

📋 Step 5: Registering handler factory...
  ✅ Updated src/dependencyInjection/registrations/operationHandlerRegistrations.js

📋 Step 6: Mapping operation to handler...
  ✅ Updated src/dependencyInjection/registrations/interpreterRegistrations.js

📋 Step 7: Adding to pre-validation whitelist...
  ✅ Updated src/utils/preValidationUtils.js

📋 Step 8: Creating test templates...
  ✅ Created tests/unit/logic/operationHandlers/drinkFromHandler.test.js
  ✅ Created tests/integration/mods/items/drinkFromRuleExecution.test.js

🔍 Step 9: Validating operation completeness...
  ✅ Schema validation passed
  ✅ Type checking passed
  ✅ Operation registration validated

✅ Operation handler scaffolding complete!

📝 Next steps:
  1. Review and update generated files with actual implementation
  2. Edit data/schemas/operations/drinkFrom.schema.json to define correct parameters
  3. Implement business logic in src/logic/operationHandlers/drinkFromHandler.js
  4. Complete test cases in tests/unit/logic/operationHandlers/drinkFromHandler.test.js
  5. Complete integration tests in tests/integration/mods/items/drinkFromRuleExecution.test.js
  6. Run tests: npm run test:unit && npm run test:integration
  7. Verify with: npm run test:ci

📚 See docs/adding-operations.md for detailed guidance.
```

## Implementation Details

### File Structure

```javascript
#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Main script structure:
// 1. Parse arguments
// 2. Convert naming conventions
// 3. Generate schema file
// 4. Update operation.schema.json
// 5. Generate handler file
// 6. Update tokens-core.js
// 7. Update operationHandlerRegistrations.js
// 8. Update interpreterRegistrations.js
// 9. Update preValidationUtils.js
// 10. Generate test files
// 11. Run validation
// 12. Display summary
```

### Helper Functions Needed

```javascript
// Naming conversion
function toPascalCase(snakeCase) { }
function toCamelCase(snakeCase) { }
function toUpperSnakeCase(snakeCase) { }

// File operations
function readFile(path) { }
function writeFile(path, content) { }
function ensureDirectoryExists(path) { }

// Template rendering
function renderTemplate(template, variables) { }

// Code modification
function addToJsonArray(jsonContent, arrayPath, newItem, sortFunction) { }
function addToJsArray(jsContent, arrayName, newItem, sortFunction) { }
function addImportStatement(jsContent, importStatement, sortFunction) { }
function addRegistration(jsContent, registrationStatement) { }

// Validation
function validateSchemaFile(path) { }
function validateJavaScriptFile(path) { }
```

### Error Handling

- Validate operation name format (lowercase, underscores only)
- Check if operation already exists
- Handle file write errors gracefully
- Rollback changes if validation fails
- Provide clear error messages

## Acceptance Criteria

- [ ] Script accepts operation name as argument
- [ ] All 9+ files are generated/updated correctly
- [ ] Files maintain alphabetical ordering
- [ ] Generated code follows project conventions
- [ ] All templates have TODO comments for customization
- [ ] Validation runs automatically after generation
- [ ] Clear success/error messages
- [ ] Script is executable via `npm run create-operation <name>`
- [ ] Works on Windows, macOS, and Linux
- [ ] Comprehensive error handling
- [ ] Unit tests for script functions
- [ ] Integration test that runs full scaffold

## Testing

### Unit Tests

**File**: `tests/unit/scripts/createOperation.test.js`

Test each helper function:
- Naming conventions
- Template rendering
- File operations
- Array insertion with sorting

### Integration Test

**File**: `tests/integration/scripts/createOperation.integration.test.js`

Test full scaffolding:
1. Run script with test operation name
2. Verify all files created/updated
3. Verify alphabetical ordering
4. Verify syntax is valid
5. Clean up generated files

### Manual Testing

1. Run `npm run create-operation test_operation`
2. Verify all files generated correctly
3. Implement TODOs in generated files
4. Run tests and verify they pass
5. Delete test operation

## Implementation Notes

- Use `fs.promises` for async file operations
- Use `execSync` for running validation commands
- Add to `.gitignore` any temporary files
- Document script in README.md
- Add helpful error messages for common mistakes

## Time Estimate

12-16 hours (including testing)

## Related Tickets

- OPEHANIMP-001: Update CLAUDE.md (will reference this tool)
- OPEHANIMP-006: Adding operations guide (will document this tool)
- OPEHANIMP-008: Build-time validation (integration point)

## Success Metrics

- Time to scaffold operation reduced from 30+ minutes to <5 minutes
- Zero manual registration mistakes
- 100% consistency across generated files
- Developer satisfaction increase
