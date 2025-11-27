# OPEHANARCANA-013: BREAK_BIDIRECTIONAL_CLOSENESS Handler Implementation

**Status:** Ready
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
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Breaks bidirectional closeness relationships between actor and target
 * by removing the relationship components from both entities.
 *
 * Used by: release_hug, release_hand, and similar break relationship actions.
 */
class BreakBidirectionalClosenessHandler extends BaseOperationHandler {
  #entityManager;
  #descriptionRegenerator;
  #logger;

  constructor({ entityManager, descriptionRegenerator, logger }) {
    super();
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntityById', 'getComponentData', 'removeComponent'],
    });
    validateDependency(descriptionRegenerator, 'IDescriptionRegenerator', logger, {
      requiredMethods: ['regenerate'],
    });
    this.#entityManager = entityManager;
    this.#descriptionRegenerator = descriptionRegenerator;
    this.#logger = logger;
  }

  /**
   * @param {Object} context - Execution context
   * @returns {Object} Updated context
   */
  async execute(context) {
    const { event, parameters } = context;
    const {
      actor_component_type,
      target_component_type,
      additional_component_types_to_remove = [],
      regenerate_descriptions = true,
    } = parameters;

    const actorId = event.payload.actorId;
    const targetId = event.payload.targetId;

    // Build complete list of components to remove
    const componentsToRemove = [
      actor_component_type,
      target_component_type,
      ...additional_component_types_to_remove,
    ];

    // Remove components from both entities
    for (const componentType of componentsToRemove) {
      this.#safeRemoveComponent(actorId, componentType);
      this.#safeRemoveComponent(targetId, componentType);
    }

    // Regenerate descriptions if enabled
    if (regenerate_descriptions) {
      await this.#descriptionRegenerator.regenerate(actorId);
      await this.#descriptionRegenerator.regenerate(targetId);
    }

    this.#logger.debug(
      `BreakBidirectionalClosenessHandler: Removed ${actor_component_type} <-> ${target_component_type}`,
      {
        actorId,
        targetId,
        removedComponents: componentsToRemove,
      }
    );

    return context;
  }

  /**
   * Safely removes a component, ignoring errors if component doesn't exist.
   */
  #safeRemoveComponent(entityId, componentType) {
    try {
      if (this.#entityManager.getComponentData(entityId, componentType)) {
        this.#entityManager.removeComponent(entityId, componentType);
      }
    } catch (err) {
      this.#logger.debug(
        `Component ${componentType} not found on ${entityId}, skipping removal`
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
