# OPEHANARCANA-010: ESTABLISH_BIDIRECTIONAL_CLOSENESS Handler Implementation

**Status:** Ready
**Priority:** High (Phase 2)
**Estimated Effort:** 2 days
**Dependencies:** OPEHANARCANA-009 (schema)

---

## Objective

Implement the `EstablishBidirectionalClosenessHandler` class that:
1. Cleans up existing third-party relationships (if `clean_existing: true`)
2. Removes old relationship components from actor and target
3. Adds new relationship components to both entities
4. Optionally regenerates entity descriptions

This handler will reduce hugging/hand-holding rules from ~200 lines to ~25 lines (88% reduction).

---

## Files to Touch

### New Files
- `src/logic/operationHandlers/establishBidirectionalClosenessHandler.js`

### Files NOT to Touch
- DI registration files (OPEHANARCANA-011)
- Test files (OPEHANARCANA-011)
- preValidationUtils.js (OPEHANARCANA-011)

---

## Out of Scope

**DO NOT modify:**
- Any existing operation handlers
- Any rule files
- DI container or token files
- preValidationUtils.js
- Any test files
- operation.schema.json (done in OPEHANARCANA-009)
- PREPARE_ACTION_CONTEXT files (Phase 1 complete)

---

## Implementation Details

### Handler Structure

```javascript
/**
 * @file EstablishBidirectionalClosenessHandler - Consolidates bidirectional relationship establishment
 * @see establishSittingClosenessHandler.js for similar pattern
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Establishes bidirectional closeness relationships between actor and target,
 * with automatic cleanup of existing third-party relationships.
 *
 * Used by: hugging, hand-holding, and similar mutual relationship systems.
 */
class EstablishBidirectionalClosenessHandler extends BaseOperationHandler {
  #entityManager;
  #descriptionRegenerator;
  #logger;

  constructor({ entityManager, descriptionRegenerator, logger }) {
    super();
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntityById', 'getComponentData', 'addComponent', 'removeComponent'],
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
      actor_data,
      target_data,
      clean_existing = true,
      existing_component_types_to_clean,
      regenerate_descriptions = true,
    } = parameters;

    const actorId = event.payload.actorId;
    const targetId = event.payload.targetId;

    // Resolve template variables in data objects
    const resolvedActorData = this.#resolveTemplateVariables(actor_data, context);
    const resolvedTargetData = this.#resolveTemplateVariables(target_data, context);

    // Determine which components to clean
    const typesToClean = existing_component_types_to_clean || [
      actor_component_type,
      target_component_type,
    ];

    // Step 1: Clean existing third-party relationships if enabled
    if (clean_existing) {
      await this.#cleanThirdPartyRelationships(actorId, typesToClean);
      await this.#cleanThirdPartyRelationships(targetId, typesToClean);
    }

    // Step 2: Remove old components from both entities
    for (const componentType of typesToClean) {
      this.#safeRemoveComponent(actorId, componentType);
      this.#safeRemoveComponent(targetId, componentType);
    }

    // Step 3: Add new components
    this.#entityManager.addComponent(actorId, actor_component_type, resolvedActorData);
    this.#entityManager.addComponent(targetId, target_component_type, resolvedTargetData);

    // Step 4: Regenerate descriptions if enabled
    if (regenerate_descriptions) {
      await this.#descriptionRegenerator.regenerate(actorId);
      await this.#descriptionRegenerator.regenerate(targetId);
    }

    this.#logger.debug(
      `EstablishBidirectionalClosenessHandler: Established ${actor_component_type} <-> ${target_component_type}`,
      { actorId, targetId, cleanedTypes: typesToClean }
    );

    return context;
  }

  /**
   * Cleans up third-party relationships for an entity.
   * If entity A has a relationship with entity B, this removes B's reciprocal component.
   */
  async #cleanThirdPartyRelationships(entityId, componentTypes) {
    for (const componentType of componentTypes) {
      const componentData = this.#entityManager.getComponentData(entityId, componentType);
      if (!componentData) continue;

      // Find reference to third party in component data
      const thirdPartyId = this.#extractThirdPartyId(componentData);
      if (thirdPartyId && thirdPartyId !== entityId) {
        // Remove reciprocal components from third party
        for (const typeToRemove of componentTypes) {
          this.#safeRemoveComponent(thirdPartyId, typeToRemove);
        }
        this.#logger.debug(
          `Cleaned third-party relationship: ${thirdPartyId}`,
          { entityId, componentType }
        );
      }
    }
  }

  /**
   * Extracts third-party entity ID from component data.
   * Looks for common reference fields.
   */
  #extractThirdPartyId(componentData) {
    // Common field names for referenced entities
    const referenceFields = [
      'embraced_entity_id',
      'hugging_entity_id',
      'holding_hand_of',
      'hand_held_by',
      'partner_id',
      'target_id',
      'actor_id',
    ];

    for (const field of referenceFields) {
      if (componentData[field]) {
        return componentData[field];
      }
    }
    return null;
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

  /**
   * Resolves template variables like {event.payload.targetId} in data objects.
   */
  #resolveTemplateVariables(data, context) {
    if (!data) return data;

    const json = JSON.stringify(data);
    const resolved = json.replace(/\{([^}]+)\}/g, (match, path) => {
      const value = this.#getNestedValue(context, path);
      return value !== undefined ? value : match;
    });

    return JSON.parse(resolved);
  }

  /**
   * Gets nested value from object using dot notation path.
   */
  #getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
}

export default EstablishBidirectionalClosenessHandler;
```

### Key Design Decisions

1. **Third-party cleanup**: Automatically finds and cleans reciprocal relationships
2. **Flexible component types**: Works with any namespaced component types
3. **Template resolution**: Supports `{event.payload.*}` and `{context.*}` templates
4. **Safe removal**: Gracefully handles missing components
5. **Description regeneration**: Optional for performance optimization
6. **Reference field detection**: Scans common field names for entity references

---

## Acceptance Criteria

### Tests That Must Pass

1. **File compiles without errors:**
   ```bash
   npm run typecheck
   ```

2. **ESLint passes:**
   ```bash
   npx eslint src/logic/operationHandlers/establishBidirectionalClosenessHandler.js
   ```

3. **No runtime import errors:**
   ```bash
   node -e "import('./src/logic/operationHandlers/establishBidirectionalClosenessHandler.js').then(() => console.log('OK'))"
   ```

### Invariants That Must Remain True

1. Handler extends `BaseOperationHandler`
2. Handler follows dependency injection pattern with `validateDependency`
3. Handler returns context (not void)
4. All existing operation handlers remain unchanged
5. No modifications to other files in codebase

---

## Verification Steps

```bash
# 1. Verify file syntax
node --check src/logic/operationHandlers/establishBidirectionalClosenessHandler.js

# 2. Run typecheck
npm run typecheck

# 3. Run ESLint on file
npx eslint src/logic/operationHandlers/establishBidirectionalClosenessHandler.js

# 4. Verify no other files changed
git status --porcelain | grep -v establishBidirectionalClosenessHandler
```

---

## Reference Files

- Base class: `src/logic/operationHandlers/baseOperationHandler.js`
- Similar handler: `src/logic/operationHandlers/establishSittingClosenessHandler.js` (500+ lines)
- Description regeneration: `src/logic/operationHandlers/regenerateDescriptionHandler.js`
- Component operations: `src/logic/operationHandlers/componentOperationHandler.js`
