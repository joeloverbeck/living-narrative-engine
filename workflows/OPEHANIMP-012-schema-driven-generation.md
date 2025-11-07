# OPEHANIMP-012: Research and Evaluate Schema-Driven Code Generation

**Priority**: Low
**Effort**: High
**Phase**: 3 (Month 2)
**Dependencies**: OPEHANIMP-011

## Objective

Research and evaluate schema-driven code generation approaches where enhanced JSON schemas serve as the single source of truth, and handler boilerplate, registrations, tests, and documentation are automatically generated.

## Background

JSON schemas already define operation structure. If we enhance schemas with metadata, we could generate:
- Handler boilerplate with dependency injection
- All registration files
- Unit and integration test templates
- API documentation
- Type definitions

This approach leverages existing schemas and provides extensive automation.

## Requirements

### 1. Research Phase

#### Schema Enhancement Patterns

**Enhanced Schema Example**:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://living-narrative-engine/schemas/operations/drinkFrom.schema.json",
  "description": "Drink a specified quantity from a drinkable item",

  "meta": {
    "handler": {
      "class": "DrinkFromHandler",
      "file": "src/logic/operationHandlers/drinkFromHandler.js"
    },
    "category": "items",
    "tags": ["inventory", "consumption", "items"],
    "dependencies": {
      "required": [
        {
          "token": "IComponentMutationService",
          "methods": ["updateComponent", "removeComponent"]
        },
        {
          "token": "IEntityStateQuerier",
          "methods": ["getEntity", "hasComponent"]
        }
      ],
      "optional": []
    },
    "events": {
      "success": "DRINK_FROM_COMPLETED",
      "failure": "DRINK_FROM_FAILED",
      "emits": [
        {
          "type": "ITEM_CONSUMED",
          "when": "Partial consumption",
          "payload": ["itemId", "quantity", "remaining"]
        },
        {
          "type": "ITEM_DEPLETED",
          "when": "Item fully consumed",
          "payload": ["itemId"]
        }
      ]
    },
    "stateAccess": {
      "queries": [
        "items:drinkable",
        "items:quantity"
      ],
      "mutations": [
        "items:quantity"
      ]
    },
    "businessLogic": {
      "description": "Reduces the quantity of liquid in an item by the specified consumption amount",
      "steps": [
        "Validate drinkableItemId exists",
        "Check item has drinkable component",
        "Calculate consumption quantity (default 1)",
        "Update item quantity via mutation",
        "Dispatch appropriate events based on remaining quantity"
      ]
    },
    "validation": {
      "custom": [
        {
          "rule": "Item must have drinkable component",
          "error": "Item is not drinkable"
        },
        {
          "rule": "Consumption quantity must not exceed available quantity",
          "error": "Not enough liquid remaining"
        }
      ]
    },
    "testing": {
      "unitTests": [
        "Should successfully drink from item with sufficient quantity",
        "Should throw error if item is not drinkable",
        "Should throw error if quantity is insufficient",
        "Should dispatch ITEM_DEPLETED when fully consumed",
        "Should dispatch ITEM_CONSUMED when partially consumed"
      ],
      "integrationTests": [
        "Should execute rule with DRINK_FROM operation",
        "Should update item quantity in component",
        "Should remove item when depleted"
      ]
    }
  },

  "allOf": [
    {
      "$ref": "../base-operation.schema.json"
    },
    {
      "properties": {
        "type": {
          "const": "DRINK_FROM"
        },
        "parameters": {
          "type": "object",
          "properties": {
            "drinkableItemId": {
              "type": "string",
              "description": "ID of the drinkable item entity"
            },
            "consumptionQuantity": {
              "type": "number",
              "minimum": 0,
              "description": "Amount to consume (optional, defaults to 1)"
            }
          },
          "required": ["drinkableItemId"],
          "additionalProperties": false
        }
      }
    }
  ]
}
```

#### Generation Targets

1. **Handler Boilerplate** (`generateHandler.js`)
   - Class structure with BaseOperationHandler
   - Constructor with dependency validation
   - Execute method skeleton
   - Error handling
   - Event dispatching
   - JSDoc comments

2. **Registration Files** (`generateRegistrations.js`)
   - Token definitions
   - Handler registrations
   - Operation mappings
   - Pre-validation whitelist

3. **Unit Test Template** (`generateUnitTests.js`)
   - Test suite structure
   - Constructor validation tests
   - Success case tests
   - Error case tests
   - Mock setup

4. **Integration Test Template** (`generateIntegrationTests.js`)
   - ModTestFixture setup
   - Scenario creation
   - Rule execution tests
   - State verification

5. **Type Definitions** (`generateTypes.js`)
   - TypeScript interfaces for parameters
   - Context types
   - Event payload types

6. **Documentation** (`generateDocs.js`)
   - Operation reference docs
   - Usage examples
   - Parameter documentation

#### Tools and Libraries

Research these code generation approaches:

1. **JSON Schema to Code**
   - json-schema-to-typescript
   - quicktype
   - Custom templating with Handlebars/Nunjucks

2. **Template Engines**
   - Handlebars
   - EJS
   - Nunjucks
   - Custom string templates

3. **Code AST Manipulation**
   - jscodeshift
   - recast
   - babel

### 2. Prototype Implementation

Create prototype generators for one operation:

**Generator Architecture**:

```
scripts/generators/
├── index.js              # Main entry point
├── schemaParser.js       # Parse enhanced schemas
├── handlerGenerator.js   # Generate handler classes
├── testGenerator.js      # Generate test files
├── registrationGenerator.js  # Generate registrations
├── typeGenerator.js      # Generate TypeScript types
├── docGenerator.js       # Generate documentation
└── templates/
    ├── handler.hbs       # Handler template
    ├── unitTest.hbs      # Unit test template
    ├── integrationTest.hbs  # Integration test template
    └── docs.hbs          # Documentation template
```

**Main Generator Script**:

```javascript
#!/usr/bin/env node

/**
 * Schema-Driven Code Generator
 *
 * Generates handler boilerplate, registrations, tests, and docs from schemas
 *
 * Usage: npm run generate:from-schema <operation-name>
 */

import { parseEnhancedSchema } from './schemaParser.js';
import { generateHandler } from './handlerGenerator.js';
import { generateUnitTests } from './testGenerator.js';
import { generateIntegrationTests } from './testGenerator.js';
import { generateRegistrations } from './registrationGenerator.js';
import { generateTypes } from './typeGenerator.js';
import { generateDocs } from './docGenerator.js';

const operationName = process.argv[2];

if (!operationName) {
  console.error('Usage: npm run generate:from-schema <operation-name>');
  process.exit(1);
}

console.log(`🚀 Generating code from schema for: ${operationName}\n`);

// Step 1: Parse enhanced schema
console.log('📋 Step 1: Parsing enhanced schema...');
const schemaPath = `data/schemas/operations/${operationName}.schema.json`;
const metadata = parseEnhancedSchema(schemaPath);
console.log(`  ✅ Parsed schema metadata`);

// Step 2: Generate handler class
console.log('\n📋 Step 2: Generating handler class...');
const handlerCode = generateHandler(metadata);
const handlerPath = `src/logic/operationHandlers/${metadata.handler.file}`;
fs.writeFileSync(handlerPath, handlerCode);
console.log(`  ✅ Generated ${handlerPath}`);

// Step 3: Generate unit tests
console.log('\n📋 Step 3: Generating unit tests...');
const unitTestCode = generateUnitTests(metadata);
const unitTestPath = `tests/unit/logic/operationHandlers/${operationName}Handler.test.js`;
fs.writeFileSync(unitTestPath, unitTestCode);
console.log(`  ✅ Generated ${unitTestPath}`);

// Step 4: Generate integration tests
console.log('\n📋 Step 4: Generating integration tests...');
const integrationTestCode = generateIntegrationTests(metadata);
const integrationTestPath = `tests/integration/mods/${metadata.category}/${operationName}RuleExecution.test.js`;
fs.writeFileSync(integrationTestPath, integrationTestCode);
console.log(`  ✅ Generated ${integrationTestPath}`);

// Step 5: Update registrations
console.log('\n📋 Step 5: Updating registrations...');
generateRegistrations(metadata);
console.log(`  ✅ Updated all registration files`);

// Step 6: Generate TypeScript types (optional)
if (options.generateTypes) {
  console.log('\n📋 Step 6: Generating TypeScript types...');
  const typesCode = generateTypes(metadata);
  const typesPath = `src/types/operations/${operationName}.d.ts`;
  fs.writeFileSync(typesPath, typesCode);
  console.log(`  ✅ Generated ${typesPath}`);
}

// Step 7: Generate documentation
console.log('\n📋 Step 7: Generating documentation...');
const docsCode = generateDocs(metadata);
const docsPath = `docs/operations/${operationName}.md`;
fs.writeFileSync(docsPath, docsCode);
console.log(`  ✅ Generated ${docsPath}`);

console.log('\n✅ Code generation complete!');
console.log('\n📝 Next steps:');
console.log('  1. Review generated files');
console.log('  2. Implement TODOs in handler');
console.log('  3. Run tests: npm run test:unit && npm run test:integration');
console.log('  4. Verify with: npm run test:ci');
```

### 3. Template Examples

**Handler Template** (`templates/handler.hbs`):

```handlebars
/**
 * @file Handler for {{operationType}} operation
 *
 * {{description}}
 *
 * Generated from: {{schemaPath}}
 * Generated at: {{timestamp}}
 *
 * @see {{schemaPath}}
 * @see src/dependencyInjection/tokens/tokens-core.js - {{handlerToken}}
 *
 * @extends BaseOperationHandler
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { validateDependency, assertPresent } from '../utils/dependencyUtils.js';

/**
 * {{description}}
 *
 * Business Logic:
 {{#each businessLogic.steps}}
 * {{@index}}. {{this}}
 {{/each}}
 *
 * @class
 * @extends BaseOperationHandler
 */
class {{handlerClass}} extends BaseOperationHandler {
  {{#each dependencies.required}}
  #{{camelCase token}};
  {{/each}}

  constructor({ {{#each dependencies.required}}{{camelCase token}}, {{/each}}logger, eventBus }) {
    super({ logger, eventBus });

    {{#each dependencies.required}}
    validateDependency({{camelCase token}}, '{{token}}', logger, {
      requiredMethods: [{{#each methods}}'{{this}}'{{#unless @last}}, {{/unless}}{{/each}}],
    });
    {{/each}}

    {{#each dependencies.required}}
    this.#{{camelCase token}} = {{camelCase token}};
    {{/each}}
  }

  async execute(context) {
    const { parameters } = context.operation;

    try {
      // 1. Validate required parameters
      {{#each parameters}}
      {{#if required}}
      assertPresent(parameters.{{name}}, '{{name}} is required');
      {{/if}}
      {{/each}}

      // 2. Query current state
      // TODO: Implement state queries
      {{#each stateAccess.queries}}
      // Query: {{this}}
      {{/each}}

      // 3. Execute business logic
      // TODO: Implement business logic
      {{#each businessLogic.steps}}
      // Step {{@index}}: {{this}}
      {{/each}}

      // 4. Mutate state
      {{#each stateAccess.mutations}}
      // Mutate: {{this}}
      {{/each}}

      // 5. Dispatch success event
      this.dispatchOperationEvent('{{events.success}}', {
        // TODO: Add event payload
      });

    } catch (error) {
      this.handleOperationError(error, '{{operationType}}', context);
      throw error;
    }
  }
}

export default {{handlerClass}};
```

### 4. Evaluation Criteria

Evaluate the approach against:

1. **Code Quality**
   - Is generated code maintainable?
   - Does it follow project conventions?
   - Is it readable and documented?

2. **Coverage**
   - What percentage can be generated?
   - What still requires manual work?
   - Are generated tests comprehensive?

3. **Flexibility**
   - Can it handle different operation types?
   - Can templates be customized?
   - Can generation be extended?

4. **Developer Experience**
   - Is it easy to use?
   - Are errors clear?
   - Does it speed up development?

5. **Maintenance**
   - Who maintains templates?
   - How do we update generated code?
   - What's the versioning strategy?

## Deliverables

- [ ] Research document on schema-driven generation approaches
- [ ] Enhanced schema format specification
- [ ] Prototype generator implementation
- [ ] Template library for all code types
- [ ] Generated vs. manual code comparison
- [ ] Evaluation report
- [ ] Documentation on using generators
- [ ] Team presentation and feedback

## Acceptance Criteria

- [ ] Enhanced schema format is well-defined
- [ ] Generators produce valid, working code
- [ ] Generated code matches quality of manual code
- [ ] Templates are customizable
- [ ] Documentation explains usage
- [ ] Evaluation provides clear recommendation
- [ ] Team feedback is gathered

## Testing

### Generator Tests

1. Test schema parser with various schemas
2. Test each generator produces valid code
3. Test generated code compiles and runs
4. Test generated tests pass
5. Compare generated vs. manual code quality

### Integration Tests

1. Generate complete operation from schema
2. Run all tests
3. Verify functionality matches specification
4. Measure time savings

## Time Estimate

3-4 weeks (research, prototype, evaluation, documentation)

## Related Tickets

- OPEHANIMP-011: Single source of truth (related approach)
- OPEHANIMP-007: CLI scaffolding (could be replaced by this)

## Success Metrics

- Generated code is production-ready
- Time to add operation reduced to <5 minutes
- Developer satisfaction with generated code
- Template maintenance is manageable
- Clear decision on adoption
