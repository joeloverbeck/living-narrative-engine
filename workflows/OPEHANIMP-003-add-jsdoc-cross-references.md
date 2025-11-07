# OPEHANIMP-003: Add JSDoc Cross-References to Operation Handlers

**Priority**: Medium
**Effort**: Low
**Phase**: 1 (Day 1)
**Dependencies**: None

## Objective

Add comprehensive JSDoc comments with cross-references to all operation handler files, linking them to their related schemas, tokens, and registration points.

## Background

Operation handlers exist in isolation without documentation pointing to their related files. This makes it difficult to:
- Find the schema that defines the operation
- Locate where the handler is registered
- Understand the operation's place in the system

## Requirements

### 1. Standard JSDoc Template for All Handlers

Every operation handler should include this JSDoc structure:

```javascript
/**
 * @file Handler for [OPERATION_TYPE] operation
 *
 * [Brief description of what this operation does]
 *
 * Related files:
 * @see data/schemas/operations/[operationName].schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - I[OperationName]Handler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 *
 * @extends BaseOperationHandler
 */
```

### 2. Example Implementation

**File**: `src/logic/operationHandlers/drinkFromHandler.js`

```javascript
/**
 * @file Handler for DRINK_FROM operation
 *
 * Processes drinking from a container or drinkable item.
 * Reduces the quantity of liquid in the item and updates the actor's state.
 *
 * Operation flow:
 * 1. Validates drinkableItemId parameter exists
 * 2. Queries current item state (drinkable component)
 * 3. Calculates consumption quantity (default: 1 unit)
 * 4. Updates item quantity via component mutation
 * 5. Dispatches DRINK_FROM_COMPLETED event
 *
 * Related files:
 * @see data/schemas/operations/drinkFrom.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - IDrinkFromHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 *
 * @extends BaseOperationHandler
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { validateDependency, assertPresent } from '../utils/dependencyUtils.js';

/**
 * Handles DRINK_FROM operation execution
 *
 * @class
 * @extends BaseOperationHandler
 */
class DrinkFromHandler extends BaseOperationHandler {
  #componentMutationService;
  #entityStateQuerier;

  /**
   * Creates a new DrinkFromHandler instance
   *
   * @param {Object} dependencies
   * @param {IComponentMutationService} dependencies.componentMutationService - Service for mutating entity components
   * @param {IEntityStateQuerier} dependencies.entityStateQuerier - Service for querying entity state
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {IEventBus} dependencies.eventBus - Event bus for dispatching events
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
   * Execute the DRINK_FROM operation
   *
   * @param {Object} context - Operation execution context
   * @param {Object} context.operation - Operation definition from rule
   * @param {string} context.operation.type - Operation type (DRINK_FROM)
   * @param {Object} context.operation.parameters - Operation parameters
   * @param {string} context.operation.parameters.drinkableItemId - ID of item to drink from
   * @param {number} [context.operation.parameters.consumptionQuantity=1] - Amount to consume
   * @param {Object} context.ruleContext - Rule execution context
   * @returns {Promise<void>}
   * @throws {InvalidArgumentError} If drinkableItemId is missing
   * @throws {OperationExecutionError} If operation fails
   */
  async execute(context) {
    // ... implementation
  }
}

export default DrinkFromHandler;
```

### 3. Schema Documentation Enhancement

Add related code reference to schema files:

**File**: `data/schemas/operations/drinkFrom.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://living-narrative-engine/schemas/operations/drinkFrom.schema.json",
  "description": "Schema for DRINK_FROM operation. Handler implementation: src/logic/operationHandlers/drinkFromHandler.js",
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
              "description": "ID of the drinkable item to consume from"
            },
            "consumptionQuantity": {
              "type": "number",
              "minimum": 0,
              "description": "Amount to consume (optional, defaults to 1)"
            }
          },
          "required": ["drinkableItemId"]
        }
      }
    }
  ]
}
```

## Files to Update

Update all existing operation handlers with comprehensive JSDoc:

- `src/logic/operationHandlers/addComponentHandler.js`
- `src/logic/operationHandlers/removeComponentHandler.js`
- `src/logic/operationHandlers/drinkFromHandler.js`
- `src/logic/operationHandlers/drinkEntirelyHandler.js`
- `src/logic/operationHandlers/dropItemAtLocationHandler.js`
- `src/logic/operationHandlers/openContainerHandler.js`
- `src/logic/operationHandlers/pickUpItemFromLocationHandler.js`
- `src/logic/operationHandlers/putInContainerHandler.js`
- `src/logic/operationHandlers/takeFromContainerHandler.js`
- `src/logic/operationHandlers/transferItemHandler.js`
- `src/logic/operationHandlers/validateInventoryCapacityHandler.js`
- Any other operation handlers in the directory

## Acceptance Criteria

- [ ] All operation handler files have comprehensive @file JSDoc
- [ ] All handlers include @see links to:
  - Operation schema
  - DI token definition
  - Handler registration
  - Operation mapping
  - Pre-validation whitelist
- [ ] All handlers have operation flow description
- [ ] Constructor and execute methods have complete @param documentation
- [ ] All schema files reference their handler implementation
- [ ] JSDoc is correctly formatted and renders in IDEs

## Testing

1. Open each handler file in VS Code or WebStorm
2. Verify JSDoc hover tooltips show complete documentation
3. Verify @see links are clickable and navigate correctly
4. Test that IDE "Go to Definition" works for cross-references
5. Run `npm run typecheck` to verify JSDoc syntax

## Implementation Notes

- Use consistent formatting across all handlers
- Keep operation flow descriptions concise (3-5 steps)
- Ensure all file paths are relative and correct
- Follow JSDoc best practices for @param and @returns

## Time Estimate

3-4 hours (updating ~11 handlers + schemas)

## Related Tickets

- OPEHANIMP-001: Update CLAUDE.md with enhanced checklist
- OPEHANIMP-002: Add inline documentation to registration files

## Success Metrics

- Improved IDE navigation between related files
- Reduced time to understand handler context
- Better code discoverability for new developers
