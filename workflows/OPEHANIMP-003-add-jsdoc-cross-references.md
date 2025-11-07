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
 * @see src/dependencyInjection/tokens/tokens-core.js - [OperationName]Handler token (NO "I" prefix)
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
 * @see src/dependencyInjection/tokens/tokens-core.js - DrinkFromHandler token (NO "I" prefix)
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 *
 * @extends BaseOperationHandler
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/staticErrorDispatcher.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';

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

**NOTE**: Schema files use a different structure than originally assumed. The actual schema structure does not support top-level `description` fields for handler references. Schemas use:
- `$id` format: `schema://living-narrative-engine/operations/[operationName].schema.json`
- Descriptions are within the `$defs/Parameters` section
- No mechanism exists for cross-referencing handlers in schemas

**Actual schema structure** (from `drinkFrom.schema.json`):

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/drinkFrom.schema.json",
  "title": "DRINK_FROM Operation",
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
          "$ref": "#/$defs/Parameters"
        }
      }
    }
  ],
  "$defs": {
    "Parameters": {
      "type": "object",
      "description": "Parameters for the DRINK_FROM operation. [Description goes here]",
      "properties": {
        "actorEntity": {
          "type": "string",
          "minLength": 1,
          "pattern": "^\\S(.*\\S)?$",
          "description": "Entity ID of the actor drinking from the container"
        },
        "containerEntity": {
          "type": "string",
          "minLength": 1,
          "pattern": "^\\S(.*\\S)?$",
          "description": "Entity ID of the liquid container being consumed from"
        }
      },
      "required": ["actorEntity", "containerEntity"],
      "additionalProperties": false
    }
  }
}
```

**Recommendation**: Skip schema modification since there's no standard place to add handler cross-references. Focus JSDoc efforts on handler files only.

## Files to Update

Update all existing operation handlers with comprehensive JSDoc (52 total handlers):

**Container/Inventory Operations:**
- `src/logic/operationHandlers/dropItemAtLocationHandler.js`
- `src/logic/operationHandlers/openContainerHandler.js`
- `src/logic/operationHandlers/pickUpItemFromLocationHandler.js`
- `src/logic/operationHandlers/putInContainerHandler.js`
- `src/logic/operationHandlers/takeFromContainerHandler.js`
- `src/logic/operationHandlers/transferItemHandler.js`
- `src/logic/operationHandlers/validateContainerCapacityHandler.js`
- `src/logic/operationHandlers/validateInventoryCapacityHandler.js`

**Liquid/Consumption Operations:**
- `src/logic/operationHandlers/drinkEntirelyHandler.js`
- `src/logic/operationHandlers/drinkFromHandler.js`

**Component Operations:**
- `src/logic/operationHandlers/addComponentHandler.js`
- `src/logic/operationHandlers/atomicModifyComponentHandler.js`
- `src/logic/operationHandlers/hasComponentHandler.js`
- `src/logic/operationHandlers/modifyArrayFieldHandler.js`
- `src/logic/operationHandlers/modifyComponentHandler.js`
- `src/logic/operationHandlers/queryComponentHandler.js`
- `src/logic/operationHandlers/queryComponentsHandler.js`
- `src/logic/operationHandlers/removeComponentHandler.js`

**Event Dispatch Operations:**
- `src/logic/operationHandlers/dispatchEventHandler.js`
- `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js`
- `src/logic/operationHandlers/dispatchSpeechHandler.js`
- `src/logic/operationHandlers/dispatchThoughtHandler.js`

**Movement/Location Operations:**
- `src/logic/operationHandlers/autoMoveClosenessPartnersHandler.js`
- `src/logic/operationHandlers/autoMoveFollowersHandler.js`
- `src/logic/operationHandlers/ifCoLocatedHandler.js`
- `src/logic/operationHandlers/lockMovementHandler.js`
- `src/logic/operationHandlers/systemMoveEntityHandler.js`
- `src/logic/operationHandlers/unlockMovementHandler.js`

**Closeness/Relationship Operations:**
- `src/logic/operationHandlers/breakClosenessWithTargetHandler.js`
- `src/logic/operationHandlers/establishSittingClosenessHandler.js`
- `src/logic/operationHandlers/mergeClosenessCircleHandler.js`
- `src/logic/operationHandlers/removeFromClosenessCircleHandler.js`
- `src/logic/operationHandlers/removeSittingClosenessHandler.js`

**Follow Relation Operations:**
- `src/logic/operationHandlers/breakFollowRelationHandler.js`
- `src/logic/operationHandlers/checkFollowCycleHandler.js`
- `src/logic/operationHandlers/establishFollowRelationHandler.js`
- `src/logic/operationHandlers/rebuildLeaderListCacheHandler.js`

**Query/Lookup Operations:**
- `src/logic/operationHandlers/getNameHandler.js`
- `src/logic/operationHandlers/getTimestampHandler.js`
- `src/logic/operationHandlers/queryEntitiesHandler.js`
- `src/logic/operationHandlers/queryLookupHandler.js`

**Utility/Control Flow Operations:**
- `src/logic/operationHandlers/endTurnHandler.js`
- `src/logic/operationHandlers/logHandler.js`
- `src/logic/operationHandlers/mathHandler.js`
- `src/logic/operationHandlers/modifyContextArrayHandler.js`
- `src/logic/operationHandlers/sequenceHandler.js` (⚠️ NO SCHEMA)
- `src/logic/operationHandlers/setVariableHandler.js`

**Equipment/Clothing Operations:**
- `src/logic/operationHandlers/unequipClothingHandler.js`

**Body/Anatomy Operations:**
- `src/logic/operationHandlers/hasBodyPartWithComponentValueHandler.js` (⚠️ NO SCHEMA)
- `src/logic/operationHandlers/regenerateDescriptionHandler.js`

**Engagement Operations:**
- `src/logic/operationHandlers/lockMouthEngagementHandler.js`
- `src/logic/operationHandlers/unlockMouthEngagementHandler.js`

**Perception Operations:**
- `src/logic/operationHandlers/addPerceptionLogEntryHandler.js`

**⚠️ IMPORTANT NOTES:**
- **baseOperationHandler.js** and **componentOperationHandler.js** are base classes, not operations - skip these
- Two handlers lack schemas: `sequenceHandler.js` and `hasBodyPartWithComponentValueHandler.js` - still document them
- Three schemas lack handlers: `if.schema.json`, `forEach.schema.json`, `resolveDirection.schema.json` - these are handled differently by the interpreter

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
- [ ] ~~All schema files reference their handler implementation~~ (SKIPPED - schema structure doesn't support this)
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

12-15 hours (updating 52 operation handlers with comprehensive JSDoc)

## Related Tickets

- OPEHANIMP-001: Update CLAUDE.md with enhanced checklist
- OPEHANIMP-002: Add inline documentation to registration files

## Success Metrics

- Improved IDE navigation between related files
- Reduced time to understand handler context
- Better code discoverability for new developers
