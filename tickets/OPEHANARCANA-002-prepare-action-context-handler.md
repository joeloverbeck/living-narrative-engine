# OPEHANARCANA-002: PREPARE_ACTION_CONTEXT Handler Implementation

**Status:** Ready
**Priority:** Critical (Phase 1)
**Estimated Effort:** 1 day
**Dependencies:** OPEHANARCANA-001 (schema)

---

## Objective

Implement the `PrepareActionContextHandler` class that consolidates the common context setup pattern:
1. Resolve actor name → `context.actorName`
2. Resolve target name → `context.targetName`
3. Query actor position → `context.locationId`
4. Set `context.targetId` from `event.payload.targetId`
5. Set `context.perceptionType` from parameter (default: "action_target_general")
6. Optionally resolve secondary name if `include_secondary: true`

---

## Files to Touch

### New Files
- `src/logic/operationHandlers/prepareActionContextHandler.js`

### Files NOT to Touch
- DI registration files (OPEHANARCANA-003)
- Test files (OPEHANARCANA-004)
- preValidationUtils.js (OPEHANARCANA-003)

---

## Out of Scope

**DO NOT modify:**
- Any existing operation handlers
- Any rule files
- DI container or token files
- preValidationUtils.js
- Any test files (covered in OPEHANARCANA-004)
- operation.schema.json (already done in OPEHANARCANA-001)

---

## Implementation Details

### Handler Structure

```javascript
/**
 * @file PrepareActionContextHandler - Consolidates common action context setup
 * @see establishSittingClosenessHandler.js for closeness pattern reference
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Prepares common context variables for action rules:
 * - actorName, targetName, locationId, targetId, perceptionType
 * - Optionally: secondaryName if include_secondary is true
 */
class PrepareActionContextHandler extends BaseOperationHandler {
  #entityManager;
  #logger;

  constructor({ entityManager, logger }) {
    super();
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntityById', 'getComponentData'],
    });
    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * @param {Object} context - Execution context
   * @returns {Object} Updated context with prepared variables
   */
  async execute(context) {
    const { event, parameters = {} } = context;
    const {
      perception_type = 'action_target_general',
      include_secondary = false,
      secondary_name_variable = 'secondaryName',
    } = parameters;

    // 1. Resolve actor name
    const actorId = event.payload.actorId;
    const actorName = await this.#resolveEntityName(actorId);

    // 2. Resolve target name
    const targetId = event.payload.targetId;
    const targetName = await this.#resolveEntityName(targetId);

    // 3. Query actor position for locationId
    const actorPosition = this.#entityManager.getComponentData(
      actorId,
      'core:position'
    );
    const locationId = actorPosition?.locationId ?? null;

    // 4. Set context variables
    context.actorName = actorName;
    context.targetName = targetName;
    context.locationId = locationId;
    context.targetId = targetId;
    context.perceptionType = perception_type;

    // 5. Optionally resolve secondary name
    if (include_secondary && event.payload.secondaryId) {
      const secondaryName = await this.#resolveEntityName(
        event.payload.secondaryId
      );
      context[secondary_name_variable] = secondaryName;
    }

    this.#logger.debug(
      `PrepareActionContextHandler: Prepared context for action`,
      {
        actorId,
        targetId,
        locationId,
        perceptionType: perception_type,
        includeSecondary: include_secondary,
      }
    );

    return context;
  }

  /**
   * Resolves entity name using core:actor or core:item name component
   * @param {string} entityId
   * @returns {string} Entity name or fallback
   */
  #resolveEntityName(entityId) {
    if (!entityId) return 'Unknown';

    // Try core:actor first
    const actorComponent = this.#entityManager.getComponentData(
      entityId,
      'core:actor'
    );
    if (actorComponent?.name) {
      return actorComponent.name;
    }

    // Try core:item
    const itemComponent = this.#entityManager.getComponentData(
      entityId,
      'core:item'
    );
    if (itemComponent?.name) {
      return itemComponent.name;
    }

    // Fallback to entity ID
    return entityId;
  }
}

export default PrepareActionContextHandler;
```

### Key Design Decisions

1. **Synchronous name resolution**: Uses `getComponentData` directly (no async needed)
2. **Fallback chain**: `core:actor` → `core:item` → entityId
3. **Non-destructive**: Adds to context, doesn't remove existing values
4. **Parameter defaults**: All parameters have sensible defaults
5. **Logging**: Debug-level logging for traceability

---

## Acceptance Criteria

### Tests That Must Pass

1. **File compiles without errors:**
   ```bash
   npm run typecheck
   ```

2. **ESLint passes:**
   ```bash
   npx eslint src/logic/operationHandlers/prepareActionContextHandler.js
   ```

3. **No runtime import errors (manual check):**
   ```bash
   node -e "import('./src/logic/operationHandlers/prepareActionContextHandler.js').then(() => console.log('OK'))"
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
node --check src/logic/operationHandlers/prepareActionContextHandler.js

# 2. Run typecheck
npm run typecheck

# 3. Run ESLint on file
npx eslint src/logic/operationHandlers/prepareActionContextHandler.js

# 4. Verify no other files changed
git status --porcelain | grep -v prepareActionContextHandler
```

---

## Reference Files

- Base class: `src/logic/operationHandlers/baseOperationHandler.js`
- Similar handler: `src/logic/operationHandlers/getNameHandler.js`
- Complex example: `src/logic/operationHandlers/establishSittingClosenessHandler.js`
- Entity access pattern: `src/logic/operationHandlers/componentOperationHandler.js`
