# OPEHANARCANA-013: BREAK_BIDIRECTIONAL_CLOSENESS Handler Implementation

**Status:** Completed
**Priority:** High (Phase 2)
**Estimated Effort:** 1 day
**Dependencies:** OPEHANARCANA-012 (schema)

---

## Objective

Implement the `BreakBidirectionalClosenessHandler` class that:

1. Removes relationship components from actor
2. Removes relationship components from target
3. Optionally regenerates entity descriptions

This handler will reduce release/break rules from ~200 lines to ~20 lines (85% reduction).

---

## Files to Touch

### New Files

- `src/logic/operationHandlers/breakBidirectionalClosenessHandler.js`

### Files NOT to Touch

- DI registration files (OPEHANARCANA-014)
- Test files (OPEHANARCANA-014)
- preValidationUtils.js (OPEHANARCANA-014)

---

## Out of Scope

**DO NOT modify:**

- Any existing operation handlers
- Any rule files
- DI container or token files
- preValidationUtils.js
- Any test files
- Schema files (done in OPEHANARCANA-012)
- ESTABLISH_BIDIRECTIONAL_CLOSENESS files

---

## Implementation Details

### Handler Structure

```javascript
/**
 * @file BreakBidirectionalClosenessHandler - Consolidates bidirectional relationship removal
 * @see establishBidirectionalClosenessHandler.js for establishment counterpart
 */

import BaseOperationHandler from './baseOperationHandler.js';
import {
  assertParamsObject,
  validateStringParam,
} from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

/**
 * Breaks bidirectional closeness relationships between actor and target
 * by removing the relationship components from both entities.
 *
 * Used by: release_hug, release_hand, and similar break relationship actions.
 */
class BreakBidirectionalClosenessHandler extends BaseOperationHandler {
  #entityManager;
  #regenerateDescriptionHandler;
  #dispatcher;

  constructor({
    entityManager,
    regenerateDescriptionHandler,
    safeEventDispatcher,
    logger,
  }) {
    const depSpec = {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'removeComponent'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    };

    if (regenerateDescriptionHandler) {
      depSpec.regenerateDescriptionHandler = {
        value: regenerateDescriptionHandler,
        requiredMethods: ['execute'],
      };
    }

    super('BreakBidirectionalClosenessHandler', depSpec);
    this.#entityManager = entityManager;
    this.#regenerateDescriptionHandler = regenerateDescriptionHandler;
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Updated context
   */
  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    if (
      !assertParamsObject(
        params,
        this.#dispatcher,
        'BREAK_BIDIRECTIONAL_CLOSENESS'
      )
    ) {
      return executionContext;
    }

    const validation = this.#validateParams(params, log);
    if (!validation) {
      return executionContext;
    }

    const { actorId, targetId } = this.#getPayloadIds(executionContext);

    if (!actorId || !targetId) {
      await safeDispatchError(
        this.#dispatcher,
        'BREAK_BIDIRECTIONAL_CLOSENESS: actorId or targetId missing from event payload',
        {
          actorId,
          targetId,
          payload: executionContext?.evaluationContext?.event?.payload,
        },
        log
      );
      return executionContext;
    }

    // Build complete list of components to remove
    const componentsToRemove = [
      validation.actorComponentType,
      validation.targetComponentType,
      ...validation.additionalComponentTypes,
    ];

    // Remove components from both entities
    for (const componentType of componentsToRemove) {
      await this.#safeRemoveComponent(actorId, componentType, log);
      await this.#safeRemoveComponent(targetId, componentType, log);
    }

    // Regenerate descriptions if enabled
    if (validation.regenerateDescriptions) {
      await this.#regenerateIfPossible(actorId, executionContext, log);
      await this.#regenerateIfPossible(targetId, executionContext, log);
    }

    log.debug(
      `BreakBidirectionalClosenessHandler: Removed ${validation.actorComponentType} <-> ${validation.targetComponentType}`,
      {
        actorId,
        targetId,
        removedComponents: componentsToRemove,
      }
    );

    return executionContext;
  }

  #validateParams(params, logger) {
    const actorComponentType = validateStringParam(
      params.actor_component_type,
      'actor_component_type',
      logger,
      this.#dispatcher
    );
    const targetComponentType = validateStringParam(
      params.target_component_type,
      'target_component_type',
      logger,
      this.#dispatcher
    );

    if (!actorComponentType || !targetComponentType) {
      return null;
    }

    return {
      actorComponentType,
      targetComponentType,
      additionalComponentTypes: Array.isArray(
        params.additional_component_types_to_remove
      )
        ? params.additional_component_types_to_remove
        : [],
      regenerateDescriptions: params.regenerate_descriptions !== false,
    };
  }

  #getPayloadIds(executionContext) {
    return {
      actorId: executionContext?.evaluationContext?.event?.payload?.actorId,
      targetId: executionContext?.evaluationContext?.event?.payload?.targetId,
    };
  }

  /**
   * Safely removes a component, ignoring errors if component doesn't exist.
   */
  async #safeRemoveComponent(entityId, componentType, logger) {
    try {
      if (this.#entityManager.getComponentData(entityId, componentType)) {
        await this.#entityManager.removeComponent(entityId, componentType);
      }
    } catch (err) {
      logger.debug(
        `Component ${componentType} not found on ${entityId}, skipping removal`
      );
    }
  }

  async #regenerateIfPossible(entityId, executionContext, logger) {
    if (!this.#regenerateDescriptionHandler) {
      logger?.debug?.(
        `BREAK_BIDIRECTIONAL_CLOSENESS: regenerate_descriptions requested but handler not available`,
        { entityId }
      );
      return;
    }

    try {
      await this.#regenerateDescriptionHandler.execute(
        { entity_ref: entityId },
        executionContext
      );
    } catch (error) {
      logger?.warn?.(
        `BREAK_BIDIRECTIONAL_CLOSENESS: description regeneration failed for ${entityId}`,
        { error: error?.message }
      );
    }
  }
}

export default BreakBidirectionalClosenessHandler;
```

### Key Design Decisions

1. **Simpler than ESTABLISH**: No third-party cleanup needed (relationships already broken)
2. **Safe removal**: Gracefully handles missing components
3. **Batch removal**: Removes all specified components from both entities
4. **Description regeneration**: Optional for performance optimization
5. **Symmetric operation**: Same components removed from both entities

---

## Acceptance Criteria

### Tests That Must Pass

1. **File compiles without errors:**

   ```bash
   npm run typecheck
   ```

2. **ESLint passes:**

   ```bash
   npx eslint src/logic/operationHandlers/breakBidirectionalClosenessHandler.js
   ```

3. **No runtime import errors:**
   ```bash
   node -e "import('./src/logic/operationHandlers/breakBidirectionalClosenessHandler.js').then(() => console.log('OK'))"
   ```

### Invariants That Must Remain True

1. Handler extends `BaseOperationHandler`
2. Handler follows dependency injection pattern
3. Handler returns context (not void)
4. All existing operation handlers remain unchanged

---

## Verification Steps

```bash
# 1. Verify file syntax
node --check src/logic/operationHandlers/breakBidirectionalClosenessHandler.js

# 2. Run typecheck
npm run typecheck

# 3. Run ESLint on file
npx eslint src/logic/operationHandlers/breakBidirectionalClosenessHandler.js

# 4. Verify no other files changed
git status --porcelain | grep -v breakBidirectionalClosenessHandler
```

---

## Reference Files

- Base class: `src/logic/operationHandlers/baseOperationHandler.js`
- Counterpart: `src/logic/operationHandlers/establishBidirectionalClosenessHandler.js`
- Similar pattern: `src/logic/operationHandlers/removeComponentHandler.js`

## Outcome

Implemented `BreakBidirectionalClosenessHandler` with the following adjustments from the initial proposal:

1.  **Dependency Injection**: Used `RegenerateDescriptionHandler` (via `execute`) instead of non-existent `IDescriptionRegenerator`.
2.  **Base Class Usage**: Correctly passed name and dependency spec to `super()` in `BaseOperationHandler` constructor.
3.  **Robustness**: Added `assertParamsObject` and `validateStringParam` for stricter parameter validation, matching the pattern in `EstablishBidirectionalClosenessHandler`.
4.  **Testing**: Created `tests/unit/logic/operationHandlers/breakBidirectionalClosenessHandler.test.js` and verified full coverage of the new handler logic.
