# CLOREMBLO-002: Implement IsRemovalBlocked JSON Logic Operator

**Category**: Clothing System Enhancement
**Priority**: High
**Estimated Effort**: 3-4 hours
**Phase**: 2 - Core Logic

---

## Overview

Implement the `IsRemovalBlockedOperator` class that evaluates whether a target item's removal is blocked by any equipped items. This operator will be used in JSON Logic expressions within conditions to validate removal blocking constraints.

---

## Background

The blocking system needs a JSON Logic operator to evaluate removal blocking at runtime. This operator:
- Checks all equipped items for `clothing:blocks_removal` components
- Evaluates both slot-based and explicit item ID blocking rules
- Returns true if removal is blocked, false if allowed
- Provides detailed logging for debugging

This operator is used in:
1. Condition definitions (e.g., `can-remove-item` condition)
2. Scope resolution filtering (via SlotAccessResolver)
3. Action validation (prerequisite checks)

---

## Requirements

### Operator Implementation

**File**: `src/logic/operators/isRemovalBlockedOperator.js`

**Purpose**: Evaluates whether an item's removal is blocked by other equipped items.

**Full Implementation**:

```javascript
import { BaseOperator } from './baseOperator.js';
import { validateDependency, assertPresent } from '../utils/dependencyUtils.js';

/**
 * @file IsRemovalBlocked JSON Logic Operator
 * Evaluates whether an item's removal is blocked by other equipped items
 * @see src/scopeDsl/nodes/slotAccessResolver.js
 */

/**
 * IsRemovalBlocked operator evaluates removal blocking constraints
 *
 * Usage in JSON Logic:
 * {
 *   "isRemovalBlocked": [
 *     "{actorId}",      // Entity ID wearing the clothing
 *     "{targetItemId}"  // Item ID to check for removal blocking
 *   ]
 * }
 *
 * Returns: true if removal is blocked, false if allowed
 */
export class IsRemovalBlockedOperator extends BaseOperator {
  #entityManager;
  #logger;

  constructor({ entityManager, logger }) {
    super();
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getComponent', 'hasComponent'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Evaluates removal blocking for a target item
   * @param {Array} args - [actorId, targetItemId]
   * @param {Object} context - Evaluation context (unused)
   * @returns {boolean} - true if blocked, false if allowed
   */
  evaluate(args, context) {
    assertPresent(args, 'IsRemovalBlocked requires arguments');

    if (!Array.isArray(args) || args.length !== 2) {
      this.#logger.warn(
        'IsRemovalBlocked operator requires exactly 2 arguments: [actorId, targetItemId]',
        { args }
      );
      return false;
    }

    const [actorId, targetItemId] = args;

    if (!actorId || !targetItemId) {
      this.#logger.warn('IsRemovalBlocked received null or undefined arguments', {
        actorId,
        targetItemId,
      });
      return false;
    }

    try {
      // Get actor's equipment
      const equipment = this.#entityManager.getComponent(
        actorId,
        'clothing:equipment'
      );

      if (!equipment || !equipment.equipped) {
        this.#logger.debug('Actor has no equipment', { actorId });
        return false;
      }

      // Get target item's wearable data
      const targetWearable = this.#entityManager.getComponent(
        targetItemId,
        'clothing:wearable'
      );

      if (!targetWearable) {
        this.#logger.warn('Target item is not wearable', { targetItemId });
        return false;
      }

      // Check all equipped items for blocking components
      for (const [slot, layers] of Object.entries(equipment.equipped)) {
        for (const [layer, items] of Object.entries(layers)) {
          const equippedItems = Array.isArray(items) ? items : [items];

          for (const equippedItemId of equippedItems) {
            // Skip if checking the target item itself
            if (equippedItemId === targetItemId) {
              continue;
            }

            // Check if this equipped item has blocking component
            if (
              !this.#entityManager.hasComponent(
                equippedItemId,
                'clothing:blocks_removal'
              )
            ) {
              continue;
            }

            const blocking = this.#entityManager.getComponent(
              equippedItemId,
              'clothing:blocks_removal'
            );

            // Check slot-based blocking
            if (blocking.blockedSlots) {
              if (this.#itemIsBlockedBySlotRules(targetWearable, blocking.blockedSlots)) {
                this.#logger.debug('Item removal blocked by slot rules', {
                  targetItemId,
                  blockedBy: equippedItemId,
                });
                return true;
              }
            }

            // Check explicit item ID blocking
            if (
              blocking.blocksRemovalOf &&
              blocking.blocksRemovalOf.includes(targetItemId)
            ) {
              this.#logger.debug('Item removal blocked by explicit ID', {
                targetItemId,
                blockedBy: equippedItemId,
              });
              return true;
            }
          }
        }
      }

      return false;
    } catch (err) {
      this.#logger.error('Error evaluating IsRemovalBlocked operator', {
        error: err.message,
        actorId,
        targetItemId,
      });
      return false;
    }
  }

  /**
   * Checks if item matches any blocked slot rules
   * @private
   * @param {Object} targetWearable - Target item's wearable component
   * @param {Array} blockedSlots - Array of blocking rules
   * @returns {boolean} - true if blocked
   */
  #itemIsBlockedBySlotRules(targetWearable, blockedSlots) {
    const targetSlot = targetWearable.equipmentSlots?.primary;
    const targetLayer = targetWearable.layer;

    if (!targetSlot || !targetLayer) {
      return false;
    }

    for (const rule of blockedSlots) {
      if (rule.slot === targetSlot && rule.layers.includes(targetLayer)) {
        return true;
      }
    }

    return false;
  }
}

export default IsRemovalBlockedOperator;
```

### Design Rationale

1. **Fail-Safe Defaults**: Returns `false` (allow removal) on errors to avoid blocking valid actions
2. **Comprehensive Checks**: Validates both slot-based and explicit ID blocking
3. **Self-Exclusion**: Skips the target item itself when checking blockers
4. **Logging**: Detailed debug logging for troubleshooting blocking issues
5. **Error Handling**: Catches and logs errors without crashing evaluation

---

## Implementation Tasks

### 1. Create Operator Class

Create `src/logic/operators/isRemovalBlockedOperator.js` with the full implementation above.

### 2. Create Unit Tests

**File**: `tests/unit/logic/operators/isRemovalBlockedOperator.test.js`

**Test Coverage**:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import IsRemovalBlockedOperator from '../../../../src/logic/operators/isRemovalBlockedOperator.js';

describe('IsRemovalBlockedOperator', () => {
  let testBed;
  let operator;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockEntityManager = testBed.createMock('IEntityManager', [
      'getComponent',
      'hasComponent',
    ]);

    operator = new IsRemovalBlockedOperator({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  describe('Slot-Based Blocking', () => {
    it('should return true when belt blocks pants removal', () => {
      // Arrange: Belt in torso_lower blocks base layer in legs
      const actorId = 'actor1';
      const beltId = 'belt1';
      const pantsId = 'pants1';

      mockEntityManager.getComponent.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'clothing:equipment') {
          return {
            equipped: {
              torso_lower: {
                accessories: [beltId],
              },
              legs: {
                base: [pantsId],
              },
            },
          };
        }
        if (entityId === pantsId && componentId === 'clothing:wearable') {
          return {
            layer: 'base',
            equipmentSlots: { primary: 'legs' },
          };
        }
        if (entityId === beltId && componentId === 'clothing:blocks_removal') {
          return {
            blockedSlots: [
              {
                slot: 'legs',
                layers: ['base', 'outer'],
                blockType: 'must_remove_first',
              },
            ],
          };
        }
        return null;
      });

      mockEntityManager.hasComponent.mockImplementation((entityId, componentId) => {
        return entityId === beltId && componentId === 'clothing:blocks_removal';
      });

      // Act
      const result = operator.evaluate([actorId, pantsId], {});

      // Assert
      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Item removal blocked by slot rules',
        expect.objectContaining({
          targetItemId: pantsId,
          blockedBy: beltId,
        })
      );
    });

    it('should return false when no blocking component present', () => {
      // Arrange: Items without blocks_removal component don't block
      const actorId = 'actor1';
      const shirtId = 'shirt1';
      const pantsId = 'pants1';

      mockEntityManager.getComponent.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'clothing:equipment') {
          return {
            equipped: {
              torso_upper: {
                base: [shirtId],
              },
              legs: {
                base: [pantsId],
              },
            },
          };
        }
        if (entityId === pantsId && componentId === 'clothing:wearable') {
          return {
            layer: 'base',
            equipmentSlots: { primary: 'legs' },
          };
        }
        return null;
      });

      mockEntityManager.hasComponent.mockReturnValue(false);

      // Act
      const result = operator.evaluate([actorId, pantsId], {});

      // Assert
      expect(result).toBe(false);
    });

    it('should handle multiple blocking items', () => {
      // Arrange: Belt + suspenders both block pants
      const actorId = 'actor1';
      const beltId = 'belt1';
      const suspendersId = 'suspenders1';
      const pantsId = 'pants1';

      mockEntityManager.getComponent.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'clothing:equipment') {
          return {
            equipped: {
              torso_lower: {
                accessories: [beltId],
              },
              torso_upper: {
                accessories: [suspendersId],
              },
              legs: {
                base: [pantsId],
              },
            },
          };
        }
        if (entityId === pantsId && componentId === 'clothing:wearable') {
          return {
            layer: 'base',
            equipmentSlots: { primary: 'legs' },
          };
        }
        if (
          (entityId === beltId || entityId === suspendersId) &&
          componentId === 'clothing:blocks_removal'
        ) {
          return {
            blockedSlots: [
              {
                slot: 'legs',
                layers: ['base'],
                blockType: 'must_remove_first',
              },
            ],
          };
        }
        return null;
      });

      mockEntityManager.hasComponent.mockImplementation((entityId, componentId) => {
        return (
          (entityId === beltId || entityId === suspendersId) &&
          componentId === 'clothing:blocks_removal'
        );
      });

      // Act
      const result = operator.evaluate([actorId, pantsId], {});

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('Explicit ID Blocking', () => {
    it('should block specific item IDs', () => {
      // Arrange: Quest item blocks removal of specific artifact
      const actorId = 'actor1';
      const cursedRingId = 'cursed_ring';
      const artifactId = 'artifact1';

      mockEntityManager.getComponent.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'clothing:equipment') {
          return {
            equipped: {
              hands: {
                accessories: [cursedRingId],
                base: [artifactId],
              },
            },
          };
        }
        if (entityId === artifactId && componentId === 'clothing:wearable') {
          return {
            layer: 'base',
            equipmentSlots: { primary: 'hands' },
          };
        }
        if (entityId === cursedRingId && componentId === 'clothing:blocks_removal') {
          return {
            blocksRemovalOf: [artifactId],
          };
        }
        return null;
      });

      mockEntityManager.hasComponent.mockImplementation((entityId, componentId) => {
        return entityId === cursedRingId && componentId === 'clothing:blocks_removal';
      });

      // Act
      const result = operator.evaluate([actorId, artifactId], {});

      // Assert
      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Item removal blocked by explicit ID',
        expect.objectContaining({
          targetItemId: artifactId,
          blockedBy: cursedRingId,
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should not block item from blocking itself', () => {
      // Arrange: Self-referential check
      const actorId = 'actor1';
      const beltId = 'belt1';

      mockEntityManager.getComponent.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'clothing:equipment') {
          return {
            equipped: {
              torso_lower: {
                accessories: [beltId],
              },
            },
          };
        }
        if (entityId === beltId && componentId === 'clothing:wearable') {
          return {
            layer: 'accessories',
            equipmentSlots: { primary: 'torso_lower' },
          };
        }
        if (entityId === beltId && componentId === 'clothing:blocks_removal') {
          return {
            blockedSlots: [
              {
                slot: 'torso_lower',
                layers: ['accessories'],
                blockType: 'must_remove_first',
              },
            ],
          };
        }
        return null;
      });

      mockEntityManager.hasComponent.mockReturnValue(true);

      // Act
      const result = operator.evaluate([actorId, beltId], {});

      // Assert
      expect(result).toBe(false); // Item should not block itself
    });

    it('should handle missing equipment component', () => {
      // Arrange: Actor with no clothing:equipment
      const actorId = 'actor1';
      const itemId = 'item1';

      mockEntityManager.getComponent.mockReturnValue(null);

      // Act
      const result = operator.evaluate([actorId, itemId], {});

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith('Actor has no equipment', {
        actorId,
      });
    });

    it('should handle invalid arguments gracefully', () => {
      // Test null arguments
      expect(operator.evaluate([null, 'item1'], {})).toBe(false);
      expect(operator.evaluate(['actor1', null], {})).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();

      // Test wrong number of arguments
      expect(operator.evaluate(['actor1'], {})).toBe(false);
      expect(operator.evaluate(['actor1', 'item1', 'extra'], {})).toBe(false);

      // Test non-array arguments
      expect(operator.evaluate('not-an-array', {})).toBe(false);
    });
  });

  describe('Block Types', () => {
    it('should respect must_remove_first block type', () => {
      // Arrange: Standard blocking behavior
      const actorId = 'actor1';
      const beltId = 'belt1';
      const pantsId = 'pants1';

      mockEntityManager.getComponent.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'clothing:equipment') {
          return {
            equipped: {
              torso_lower: { accessories: [beltId] },
              legs: { base: [pantsId] },
            },
          };
        }
        if (entityId === pantsId && componentId === 'clothing:wearable') {
          return {
            layer: 'base',
            equipmentSlots: { primary: 'legs' },
          };
        }
        if (entityId === beltId && componentId === 'clothing:blocks_removal') {
          return {
            blockedSlots: [
              {
                slot: 'legs',
                layers: ['base'],
                blockType: 'must_remove_first',
                reason: 'Belt secures pants',
              },
            ],
          };
        }
        return null;
      });

      mockEntityManager.hasComponent.mockImplementation((entityId, componentId) => {
        return entityId === beltId && componentId === 'clothing:blocks_removal';
      });

      // Act
      const result = operator.evaluate([actorId, pantsId], {});

      // Assert
      expect(result).toBe(true);
    });

    it('should respect full_block type', () => {
      // Arrange: Armor completely blocking access
      const actorId = 'actor1';
      const armorId = 'plate_cuirass';
      const shirtId = 'shirt1';

      mockEntityManager.getComponent.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'clothing:equipment') {
          return {
            equipped: {
              torso_upper: {
                outer: [armorId],
                base: [shirtId],
              },
            },
          };
        }
        if (entityId === shirtId && componentId === 'clothing:wearable') {
          return {
            layer: 'base',
            equipmentSlots: { primary: 'torso_upper' },
          };
        }
        if (entityId === armorId && componentId === 'clothing:blocks_removal') {
          return {
            blockedSlots: [
              {
                slot: 'torso_upper',
                layers: ['base', 'underwear'],
                blockType: 'full_block',
                reason: 'Plate armor completely covers torso',
              },
            ],
          };
        }
        return null;
      });

      mockEntityManager.hasComponent.mockImplementation((entityId, componentId) => {
        return entityId === armorId && componentId === 'clothing:blocks_removal';
      });

      // Act
      const result = operator.evaluate([actorId, shirtId], {});

      // Assert
      expect(result).toBe(true);
    });
  });
});
```

### 3. Run Tests

```bash
NODE_ENV=test npm run test:unit -- tests/unit/logic/operators/isRemovalBlockedOperator.test.js
```

Target: 80%+ coverage, all tests pass.

---

## Validation

### Unit Tests

```bash
NODE_ENV=test npm run test:unit -- tests/unit/logic/operators/isRemovalBlockedOperator.test.js
```

Expected: All tests pass, coverage ≥ 80%.

### Type Checking

```bash
npm run typecheck
```

Expected: No errors.

### ESLint

```bash
npx eslint src/logic/operators/isRemovalBlockedOperator.js
```

Expected: No warnings or errors.

---

## Acceptance Criteria

- [ ] Operator class created at `src/logic/operators/isRemovalBlockedOperator.js`
- [ ] Operator extends `BaseOperator`
- [ ] Constructor validates dependencies (entityManager, logger)
- [ ] `evaluate()` method handles all edge cases
- [ ] Slot-based blocking logic implemented correctly
- [ ] Explicit item ID blocking logic implemented correctly
- [ ] Self-exclusion logic prevents items from blocking themselves
- [ ] Comprehensive unit tests created
- [ ] All unit tests pass
- [ ] Test coverage ≥ 80%
- [ ] ESLint passes
- [ ] Type checking passes
- [ ] Detailed logging for debugging

---

## Notes

- Operator returns `false` (allow removal) on errors to avoid blocking valid actions
- Logging uses `debug` level for normal blocking checks, `warn` for invalid inputs, `error` for exceptions
- The operator is stateless and can be called multiple times safely
- This operator will be used in both condition evaluation and scope resolution

---

## Related Tickets

- **CLOREMBLO-001**: Create blocks_removal component (prerequisite)
- **CLOREMBLO-003**: Register operator in DI container (next step)
- **CLOREMBLO-004**: Integrate blocking logic into slotAccessResolver (uses this)
- **CLOREMBLO-005**: Create can-remove-item condition (uses this)
