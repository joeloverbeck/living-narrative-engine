# DATDRIMODSYS-002: Create ModifierContextBuilder Service [COMPLETED]

## Summary

Create a new `ModifierContextBuilder` service that builds the evaluation context for JSON Logic modifier conditions. This service resolves all entity data (actor, primary/secondary/tertiary targets, location) into a structured context object that can be passed to the JSON Logic evaluator.

## File List

Files to create:

- `src/combat/services/ModifierContextBuilder.js`

Files to modify:

- `src/dependencyInjection/tokens/tokens-core.js` (add token)
- `src/dependencyInjection/registrations/combatRegistrations.js` (register service)

## Out of Scope

- **DO NOT** modify `ModifierCollectorService.js` (that's DATDRIMODSYS-003)
- **DO NOT** modify `ChanceCalculationService.js` (that's DATDRIMODSYS-004)
- **DO NOT** modify any schema files
- **DO NOT** modify any action JSON files
- **DO NOT** modify `contextAssembler.js` (use as reference only)
- **DO NOT** add integration tests (that's DATDRIMODSYS-007)

## Detailed Implementation

### 1. Create `ModifierContextBuilder.js`

Location: `src/combat/services/ModifierContextBuilder.js`

```javascript
/**
 * @file Builds evaluation context for modifier condition evaluation
 * @see specs/data-driven-modifier-system.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {Object} EntityContext
 * @property {string} id - Entity ID
 * @property {Object<string, Object>} components - Component data by ID
 */

/**
 * @typedef {Object} ModifierEvaluationContext
 * @property {Object} entity
 * @property {EntityContext|null} entity.actor - Actor entity data
 * @property {EntityContext|null} entity.primary - Primary target data
 * @property {EntityContext|null} entity.secondary - Secondary target data
 * @property {EntityContext|null} entity.tertiary - Tertiary target data
 * @property {EntityContext|null} entity.location - Location entity data
 */

/**
 * Builds the evaluation context for modifier JSON Logic conditions.
 * Resolves entity data including components for actor, targets, and location.
 */
class ModifierContextBuilder {
  #entityManager;
  #logger;

  /**
   * @param {Object} deps
   * @param {import('../../entities/entityManager.js').default} deps.entityManager
   * @param {import('../../interfaces/ILogger.js').ILogger} deps.logger
   */
  constructor({ entityManager, logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error', 'info'],
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getComponentData', 'hasComponent', 'getEntity'],
    });

    this.#entityManager = entityManager;
    this.#logger = logger;

    this.#logger.debug('ModifierContextBuilder: Initialized');
  }

  /**
   * Build evaluation context for modifier conditions
   *
   * @param {Object} params
   * @param {string} params.actorId - Actor entity ID
   * @param {string} [params.primaryTargetId] - Primary target entity ID
   * @param {string} [params.secondaryTargetId] - Secondary target entity ID
   * @param {string} [params.tertiaryTargetId] - Tertiary target entity ID
   * @returns {ModifierEvaluationContext}
   */
  buildContext({
    actorId,
    primaryTargetId,
    secondaryTargetId,
    tertiaryTargetId,
  }) {
    this.#logger.debug('ModifierContextBuilder: Building context', {
      actorId,
      primaryTargetId,
      secondaryTargetId,
      tertiaryTargetId,
    });

    // Build actor context
    const actorContext = this.#buildEntityContext(actorId);

    // Resolve location from actor's position
    const locationId = this.#resolveLocationId(actorId);
    const locationContext = locationId
      ? this.#buildEntityContext(locationId)
      : null;

    // Build target contexts
    const primaryContext = primaryTargetId
      ? this.#buildEntityContext(primaryTargetId)
      : null;
    const secondaryContext = secondaryTargetId
      ? this.#buildEntityContext(secondaryTargetId)
      : null;
    const tertiaryContext = tertiaryTargetId
      ? this.#buildEntityContext(tertiaryTargetId)
      : null;

    const context = {
      entity: {
        actor: actorContext,
        primary: primaryContext,
        secondary: secondaryContext,
        tertiary: tertiaryContext,
        location: locationContext,
      },
    };

    this.#logger.debug('ModifierContextBuilder: Context built', {
      hasActor: !!actorContext,
      hasPrimary: !!primaryContext,
      hasSecondary: !!secondaryContext,
      hasTertiary: !!tertiaryContext,
      hasLocation: !!locationContext,
    });

    return context;
  }

  /**
   * Build entity context with all component data
   *
   * @private
   * @param {string} entityId - Entity ID to build context for
   * @returns {EntityContext|null}
   */
  #buildEntityContext(entityId) {
    if (!entityId) {
      return null;
    }

    try {
      const entity = this.#entityManager.getEntity(entityId);
      if (!entity) {
        this.#logger.debug(
          `ModifierContextBuilder: Entity not found: ${entityId}`
        );
        return null;
      }

      // Build components map
      const components = {};

      // Get all component IDs for this entity
      const componentIds = this.#getEntityComponentIds(entityId);

      for (const componentId of componentIds) {
        const componentData = this.#entityManager.getComponentData(
          entityId,
          componentId
        );
        if (componentData !== null && componentData !== undefined) {
          components[componentId] = componentData;
        }
      }

      return {
        id: entityId,
        components,
      };
    } catch (error) {
      this.#logger.warn(
        `ModifierContextBuilder: Error building entity context for ${entityId}`,
        error
      );
      return null;
    }
  }

  /**
   * Get all component IDs for an entity
   *
   * @private
   * @param {string} entityId
   * @returns {string[]}
   */
  #getEntityComponentIds(entityId) {
    try {
      const entity = this.#entityManager.getEntity(entityId);
      if (!entity || !entity.components) {
        return [];
      }

      // Entity.components is a Map or object of componentId -> data
      if (entity.components instanceof Map) {
        return Array.from(entity.components.keys());
      }

      return Object.keys(entity.components);
    } catch (error) {
      this.#logger.debug(
        `ModifierContextBuilder: Could not get component IDs for ${entityId}`,
        error
      );
      return [];
    }
  }

  /**
   * Resolve location ID from actor's position component
   *
   * @private
   * @param {string} actorId
   * @returns {string|null}
   */
  #resolveLocationId(actorId) {
    try {
      const positionData = this.#entityManager.getComponentData(
        actorId,
        'core:position'
      );
      if (positionData?.locationId) {
        return positionData.locationId;
      }
      return null;
    } catch (error) {
      this.#logger.debug(
        `ModifierContextBuilder: Could not resolve location for ${actorId}`,
        error
      );
      return null;
    }
  }
}

export default ModifierContextBuilder;
```

### 2. Add Token to `tokens-core.js`

Add to the tokens object:

```javascript
ModifierContextBuilder: 'ModifierContextBuilder',
```

### 3. Update `combatRegistrations.js`

Add import:

```javascript
import ModifierContextBuilder from '../../combat/services/ModifierContextBuilder.js';
```

Add registration (before ModifierCollectorService):

```javascript
// Register ModifierContextBuilder
registrar.singletonFactory(
  tokens.ModifierContextBuilder,
  (c) =>
    new ModifierContextBuilder({
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
    })
);
```

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests** (create in this ticket):
   - File: `tests/unit/combat/services/ModifierContextBuilder.test.js`
   - Test cases:
     - `should initialize with valid dependencies`
     - `should build context with actor only`
     - `should build context with actor and primary target`
     - `should build context with all targets (primary, secondary, tertiary)`
     - `should resolve location from actor's core:position component`
     - `should return null location when actor has no position`
     - `should return null for non-existent entity IDs`
     - `should include all component data in entity context`
     - `should handle entity with no components gracefully`

2. **Existing Tests**:
   - `npm run test:unit -- --testPathPattern="combat" --silent` must pass
   - `npm run typecheck` must pass

### Invariants That Must Remain True

1. **Graceful Degradation**:
   - Missing entities return `null`, not errors
   - Missing location returns `null` in `entity.location`
   - Missing targets return `null` for their respective fields

2. **No Side Effects**:
   - Building context must NOT modify any entity data
   - Building context must NOT dispatch any events

3. **Dependency Injection**:
   - Service must validate its dependencies on construction
   - Service must be registered as singleton

## Verification Commands

```bash
# Run unit tests for combat services
npm run test:unit -- --testPathPattern="combat/services" --silent

# Check types
npm run typecheck

# Lint new file
npx eslint src/combat/services/ModifierContextBuilder.js
```

## Dependencies

- **Depends on**: DATDRIMODSYS-001 (schema must be in place conceptually)
- **Blocks**: DATDRIMODSYS-003 (ModifierCollectorService needs this)

## Notes

- The context structure matches the spec's Section 4.1
- Entity component access uses existing `entityManager.getComponentData()`
- Location resolution uses `core:position.locationId` per spec Section 4.2

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Implementation matched the plan exactly.** All ticket assumptions were validated against the codebase before implementation and found to be correct.

### Files Created

1. **`src/combat/services/ModifierContextBuilder.js`** (187 lines)
   - Implemented exactly as specified in the ticket
   - Minor refinement: simplified `#getEntityComponentIds()` to pass entity object directly (entity.components is always a plain object in this codebase, not a Map)

2. **`tests/unit/combat/services/ModifierContextBuilder.test.js`** (26 test cases)
   - All 9 required test cases from ticket
   - 17 additional tests covering:
     - Constructor validation edge cases (5 tests)
     - Empty/null/undefined component handling (3 tests)
     - Error handling scenarios (4 tests)
     - Invariant verification (3 tests: no side effects, no events, graceful degradation)
     - Additional context building scenarios (2 tests)

### Files Modified

1. **`src/dependencyInjection/tokens/tokens-core.js`**
   - Added `ModifierContextBuilder: 'ModifierContextBuilder'` token
   - Placed alphabetically before `ModifierCollectorService`

2. **`src/dependencyInjection/registrations/combatRegistrations.js`**
   - Added import for `ModifierContextBuilder`
   - Added singleton factory registration before `ModifierCollectorService`

### Verification Results

- ✅ **Unit tests**: 26 new tests pass (`tests/unit/combat/services/ModifierContextBuilder.test.js`)
- ✅ **All combat services tests**: 223 tests pass
- ✅ **TypeScript typecheck**: Pre-existing warnings only, new code matches existing patterns
- ✅ **ESLint**: No errors, only minor JSDoc style warnings (consistent with codebase)

### Test Rationale

| Test Category                  | Count | Rationale                                               |
| ------------------------------ | ----- | ------------------------------------------------------- |
| Constructor validation         | 5     | Ensures DI contract enforced with proper error messages |
| Context building (actor only)  | 3     | Minimum valid use case per spec                         |
| Context building (all targets) | 3     | Full context building verification                      |
| Location resolution            | 3     | Core spec requirement (Section 4.2)                     |
| Error handling                 | 4     | Graceful degradation on failures                        |
| Component inclusion            | 3     | Context completeness verification                       |
| Invariants                     | 5     | No side effects, no events, proper null handling        |

### Blockers Unblocked

- **DATDRIMODSYS-003** (ModifierCollectorService) can now proceed - it depends on this service
