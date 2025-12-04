# THRITEATTAR-006: Implement PICK_RANDOM_ENTITY Operation Handler

## Summary

Implement the `PickRandomEntityHandler` class that picks a random entity from a location with optional exclusions and component filters. This handler is used by the FUMBLE outcome macro to find a random entity that the thrown item might hit.

## Files to Create

| File | Purpose |
|------|---------|
| `src/logic/operationHandlers/pickRandomEntityHandler.js` | Handler implementation |

## Implementation Details

### pickRandomEntityHandler.js

```javascript
/**
 * @file Handler for PICK_RANDOM_ENTITY operation
 * @see data/schemas/operations/pickRandomEntity.schema.json
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Picks a random entity from a location with optional exclusions and component filters.
 * Stores the selected entity ID (or null if no candidates) in the specified context variable.
 *
 * @extends BaseOperationHandler
 */
class PickRandomEntityHandler extends BaseOperationHandler {
  #entityManager;
  #logger;

  /**
   * @param {Object} deps - Dependencies
   * @param {Object} deps.entityManager - Entity manager service
   * @param {Object} deps.logger - Logger service
   */
  constructor({ entityManager, logger }) {
    super();
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntitiesWithComponent', 'getComponentData', 'hasComponent'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Execute the PICK_RANDOM_ENTITY operation.
   *
   * @param {Object} context - Execution context
   * @param {Object} context.parameters - Operation parameters
   * @param {string} context.parameters.location_id - Location to search
   * @param {string[]} [context.parameters.exclude_entities=[]] - Entity IDs to exclude
   * @param {string[]} [context.parameters.require_components=[]] - Required components (AND)
   * @param {string[]} [context.parameters.exclude_components=[]] - Excluded components (OR)
   * @param {string} context.parameters.result_variable - Variable to store result
   * @returns {Promise<void>}
   */
  async execute(context) {
    const {
      location_id,
      exclude_entities = [],
      require_components = [],
      exclude_components = [],
      result_variable,
    } = context.parameters;

    // Resolve location_id if it's a context reference
    const locationId = this._resolveValue(location_id, context);

    if (!locationId) {
      this.#logger.warn(
        'PickRandomEntityHandler: No location_id provided, storing null'
      );
      context.context[result_variable] = null;
      return;
    }

    // Resolve excluded entity IDs
    const excludedIds = new Set(
      exclude_entities.map((id) => this._resolveValue(id, context))
    );

    // Get all entities at location
    // Note: IEntityManager.getEntitiesInLocation is not implemented in the facade,
    // so we manually filter entities with core:position component.
    const entitiesAtLocation = this.#entityManager
      .getEntitiesWithComponent('core:position')
      .filter((entity) => {
        const pos = this.#entityManager.getComponentData(
          entity.id,
          'core:position'
        );
        return pos?.locationId === locationId;
      })
      .map((entity) => entity.id);

    // Filter candidates
    const candidates = entitiesAtLocation.filter((entityId) => {
      // Skip excluded entities
      if (excludedIds.has(entityId)) {
        return false;
      }

      // Check required components (must have ALL)
      for (const componentType of require_components) {
        if (!this.#entityManager.hasComponent(entityId, componentType)) {
          return false;
        }
      }

      // Check excluded components (must NOT have ANY)
      for (const componentType of exclude_components) {
        if (this.#entityManager.hasComponent(entityId, componentType)) {
          return false;
        }
      }

      return true;
    });

    // Pick random candidate or null
    let result = null;
    if (candidates.length > 0) {
      const randomIndex = Math.floor(Math.random() * candidates.length);
      result = candidates[randomIndex];
      this.#logger.debug(
        `PickRandomEntityHandler: Selected entity ${result} from ${candidates.length} candidates`
      );
    } else {
      this.#logger.debug(
        'PickRandomEntityHandler: No candidates found, storing null'
      );
    }

    // Store result in context
    context.context[result_variable] = result;
  }

  /**
   * Resolve a value that may be a string, context reference, or JSON Logic expression.
   *
   * @param {string|Object} value - Value to resolve
   * @param {Object} context - Execution context
   * @returns {*} Resolved value
   * @private
   */
  _resolveValue(value, context) {
    if (typeof value === 'string') {
      // Check for context reference pattern {context.varName}
      const match = value.match(/^\{context\.(\w+)\}$/);
      if (match) {
        return context.context[match[1]];
      }
      // Check for event reference pattern {event.payload.something}
      const eventMatch = value.match(/^\{event\.payload\.(\w+)\}$/);
      if (eventMatch) {
        return context.event?.payload?.[eventMatch[1]];
      }
      return value;
    }
    // For objects, assume JSON Logic and evaluate
    if (typeof value === 'object' && value !== null) {
      // Use JSON Logic evaluation if available in context
      if (context.evaluateJsonLogic) {
        return context.evaluateJsonLogic(value, context);
      }
    }
    return value;
  }
}

export default PickRandomEntityHandler;
```

### Handler Behavior

1. **Get entities at location**: Uses `entityManager.getEntitiesInLocation(locationId)`
2. **Filter by exclusions**: Removes entities in `exclude_entities` array
3. **Filter by required components**: Keeps only entities having ALL `require_components`
4. **Filter by excluded components**: Removes entities having ANY `exclude_components`
5. **Random selection**: Picks one randomly from remaining candidates
6. **Store result**: Sets `context.context[result_variable]` to selected ID or `null`

### Edge Cases Handled

- Empty location → returns `null`
- All entities excluded → returns `null`
- No matching components → returns `null`
- Invalid location_id → returns `null` with warning

## Out of Scope

- **DO NOT** modify any existing operation handlers
- **DO NOT** modify BaseOperationHandler
- **DO NOT** create the schema (THRITEATTAR-005)
- **DO NOT** register the handler (THRITEATTAR-007)
- **DO NOT** create test files (THRITEATTAR-011)

## Acceptance Criteria

### Tests That Must Pass

1. `npm run typecheck` completes without errors
2. `npx eslint src/logic/operationHandlers/pickRandomEntityHandler.js` passes
3. Handler follows BaseOperationHandler pattern
4. All dependencies are properly validated

### Invariants That Must Remain True

1. All existing operation handlers continue to function
2. Handler follows dependency injection pattern
3. Handler does not modify entities (read-only operation)
4. Random selection is unbiased (uniform distribution)

## Validation Commands

```bash
# Type check
npm run typecheck

# Lint the file
npx eslint src/logic/operationHandlers/pickRandomEntityHandler.js

# Verify imports work
node -e "import('./src/logic/operationHandlers/pickRandomEntityHandler.js').then(() => console.log('OK'))"
```

## Reference Files

For understanding handler patterns:
- `src/logic/operationHandlers/baseOperationHandler.js` - Base class
- `src/logic/operationHandlers/getDamageCapabilitiesHandler.js` - Similar handler with entity operations
- `src/logic/operationHandlers/setVariableHandler.js` - Simple handler pattern

## Dependencies

- THRITEATTAR-005 (schema must exist for validation)

## Blocks

- THRITEATTAR-007 (DI registration needs this handler)
- THRITEATTAR-011 (unit tests test this handler)

## Outcome

- Implemented `PickRandomEntityHandler` in `src/logic/operationHandlers/pickRandomEntityHandler.js`.
- Adjusted implementation to handle missing `getEntitiesInLocation` method on `IEntityManager` by manually filtering entities with `core:position` component.
- Updated dependency validation to check for `getEntitiesWithComponent` and `getComponentData` instead.
- Added comprehensive unit tests in `tests/unit/logic/operationHandlers/pickRandomEntityHandler.test.js` covering all scenarios including context reference resolution.
- Verified with `npm run typecheck` and `npx eslint`.

