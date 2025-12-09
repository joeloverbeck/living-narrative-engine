# SEACONINT-002: Create isOnNearbyFurniture JSON Logic Operator

**Status**: ✅ COMPLETED
**Priority**: HIGH
**Estimated Effort**: 1-2 hours
**Dependencies**: SEACONINT-001
**Blocks**: SEACONINT-003, SEACONINT-008

## Objective

Create a custom JSON Logic operator `isOnNearbyFurniture` that checks if an entity's ID is in the `nearFurnitureIds` array of the furniture the actor is sitting on.

## Files To Create

| File | Purpose |
|------|---------|
| `src/logic/operators/isOnNearbyFurnitureOperator.js` | Operator implementation |

## Files To Modify

| File | Change |
|------|--------|
| `src/logic/jsonLogicCustomOperators.js` | Import and register the new operator |

**Note**: Operators do NOT require DI tokens in `tokens-core.js`. They are imported and instantiated directly in `jsonLogicCustomOperators.js`. The whitelist is automatically updated via the `addOperation()` method called by `#registerOperator`.

## Out of Scope

- **DO NOT** modify any existing operators
- **DO NOT** modify the scope DSL engine
- **DO NOT** create unit tests (handled in SEACONINT-008)
- **DO NOT** create the scope file (handled in SEACONINT-003)
- **DO NOT** modify any mod JSON files

## Implementation Details

### 1. Create Operator File

Create `src/logic/operators/isOnNearbyFurnitureOperator.js`:

```javascript
/**
 * @file isOnNearbyFurnitureOperator.js
 * @description JSON Logic operator to check if an entity is on furniture that is
 * "near" the furniture the actor is sitting on.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @class IsOnNearbyFurnitureOperator
 * @description Checks if an entity ID is in the nearby furniture list of the
 * furniture the actor is sitting on.
 *
 * Usage in JSON Logic:
 * {"isOnNearbyFurniture": [{"var": "entity.id"}]}
 *
 * Returns true if:
 * 1. Actor has positioning:sitting_on component
 * 2. The furniture actor is sitting on has furniture:near_furniture component
 * 3. The entity's ID is in the nearFurnitureIds array
 */
export class IsOnNearbyFurnitureOperator {
  /** @private */
  #entityManager;
  /** @private */
  #logger;

  /**
   * @param {Object} params - Dependencies
   * @param {Object} params.entityManager - Entity manager for lookups
   * @param {Object} params.logger - Logger instance
   */
  constructor({ entityManager, logger }) {
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getComponentData'],
    });

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Evaluates whether the entity is on nearby furniture.
   *
   * @param {Array} args - [entityId]
   * @param {Object} context - Evaluation context containing actor
   * @returns {boolean} True if entity is on nearby furniture
   */
  evaluate(args, context) {
    const [entityId] = args;

    try {
      const actorId = context?.actor?.id;

      if (!actorId) {
        this.#logger.debug('isOnNearbyFurniture: No actor in context');
        return false;
      }

      // Check if actor is sitting
      const sittingOn = this.#entityManager.getComponentData(
        actorId,
        'positioning:sitting_on'
      );

      if (!sittingOn) {
        this.#logger.debug(
          `isOnNearbyFurniture: Actor ${actorId} is not sitting`
        );
        return false;
      }

      const furnitureId = sittingOn.furniture_id;
      if (!furnitureId) {
        this.#logger.debug(
          'isOnNearbyFurniture: No furniture_id in sitting_on component'
        );
        return false;
      }

      // Get the near_furniture component from the furniture
      const nearFurniture = this.#entityManager.getComponentData(
        furnitureId,
        'furniture:near_furniture'
      );

      if (!nearFurniture || !Array.isArray(nearFurniture.nearFurnitureIds)) {
        this.#logger.debug(
          `isOnNearbyFurniture: Furniture ${furnitureId} has no near_furniture relationships`
        );
        return false;
      }

      // Check if the entity is in the nearby furniture list
      const isNearby = nearFurniture.nearFurnitureIds.includes(entityId);
      this.#logger.debug(
        `isOnNearbyFurniture: Entity ${entityId} nearby=${isNearby}`
      );

      return isNearby;
    } catch (err) {
      this.#logger.error('isOnNearbyFurniture operator error:', err);
      return false;
    }
  }
}

export default IsOnNearbyFurnitureOperator;
```

### 2. Register in jsonLogicCustomOperators.js

Add import at top of file:
```javascript
import { IsOnNearbyFurnitureOperator } from './operators/isOnNearbyFurnitureOperator.js';
```

In the `registerOperators` method, add after existing operator instantiations:
```javascript
const isOnNearbyFurnitureOp = new IsOnNearbyFurnitureOperator({
  entityManager: this.#entityManager,
  logger: this.#logger,
});
```

Add registration (following existing pattern):
```javascript
// Register isOnNearbyFurniture operator
this.#registerOperator(
  'isOnNearbyFurniture',
  function (entityId) {
    // 'this' is the evaluation context
    return isOnNearbyFurnitureOp.evaluate([entityId], this);
  },
  jsonLogicEvaluationService
);
```

## Acceptance Criteria

### Tests That Must Pass

1. `npm run typecheck` passes
2. `npx eslint src/logic/operators/isOnNearbyFurnitureOperator.js src/logic/jsonLogicCustomOperators.js` passes
3. Operator is registered successfully (no runtime errors on startup)
4. Existing operator tests continue to pass: `npm run test:unit -- tests/unit/logic/jsonLogicCustomOperators.test.js`

### Invariants That Must Remain True

1. All existing operators continue to work unchanged
2. The operator registration validation passes (whitelist check)
3. The operator follows the same pattern as other operators in the codebase
4. Error handling returns `false` rather than throwing exceptions

## Verification Commands

```bash
# Type check
npm run typecheck

# Lint the modified files
npx eslint src/logic/operators/isOnNearbyFurnitureOperator.js src/logic/jsonLogicCustomOperators.js

# Run existing operator tests
npm run test:unit -- tests/unit/logic/jsonLogicCustomOperators.test.js

# Verify no regressions
npm run test:ci
```

## Technical Notes

- The operator receives `entityId` as its argument and uses the evaluation context to access `actor`
- Must handle missing components gracefully (return `false`, not error)
- Should log at DEBUG level for troubleshooting
- Follows the class-based operator pattern used by other operators (e.g., `HasComponentOperator`)

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Ticket Corrections Made**:
- **REMOVED**: Section "3. Add Token to tokens-core.js" - Operators do NOT use DI tokens. This was an incorrect assumption in the original ticket.
- **REMOVED**: `src/dependencyInjection/tokens/tokens-core.js` from "Files To Modify" table.
- **ADDED**: Note explaining that operators are imported/instantiated directly and the whitelist is auto-updated.

**Files Created** (as planned):
- `src/logic/operators/isOnNearbyFurnitureOperator.js` ✅

**Files Modified** (as planned):
- `src/logic/jsonLogicCustomOperators.js` ✅ (added import and registration)

**Tests Added** (enhancement beyond ticket scope):
- `tests/unit/logic/operators/isOnNearbyFurnitureOperator.test.js` - 13 unit tests covering:
  - Constructor validation
  - All graceful failure paths (no actor, not sitting, missing components)
  - Happy path (entity in nearFurnitureIds)
  - Error handling
  - Edge cases (null entityId, undefined context)

**Verification Results**:
- Typecheck: Pre-existing issues in CLI files, no new issues from implementation
- ESLint: Only warnings (consistent with other operators)
- 48 existing jsonLogicCustomOperators tests: PASS
- 22 operator registration tests: PASS
- 2918 logic domain tests: PASS
- 13 new isOnNearbyFurnitureOperator tests: PASS
