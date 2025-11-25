# APPGRAOCCSYS-003: Create grabbingUtils Utility Functions

**Originating Document**: `brainstorming/appendage-grabbing-occupation-system.md`

## Summary

Create utility functions for managing grabbing appendage locks. These functions provide a clean API for counting free appendages, locking/unlocking appendages, and querying held items. The utilities will be used by operation handlers and operators.

## Dependencies

- APPGRAOCCSYS-001 (anatomy:can_grab component schema must exist)

## Files to Create

| File | Purpose |
|------|---------|
| `src/utils/grabbingUtils.js` | Utility functions for grabbing appendage management |
| `tests/unit/utils/grabbingUtils.test.js` | Unit tests for utility functions |

## Files to Modify

None - this is a new standalone utility module.

## Out of Scope

- DO NOT create operation handlers (handled in APPGRAOCCSYS-004/005)
- DO NOT create operators (handled in APPGRAOCCSYS-006)
- DO NOT modify any entity files
- DO NOT modify any action files
- DO NOT register anything in DI (utilities are imported directly)

## Implementation Details

### Utility Functions (`src/utils/grabbingUtils.js`)

```javascript
/**
 * @file Utility functions for managing grabbing appendage locks
 *
 * Provides functions to count, lock, and unlock grabbing appendages
 * on entities that have anatomy:body components with parts containing
 * anatomy:can_grab components.
 *
 * @see data/mods/anatomy/components/can_grab.component.json
 * @see brainstorming/appendage-grabbing-occupation-system.md
 */

/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Finds all body part IDs that have the anatomy:can_grab component
 *
 * @param {EntityManager} entityManager - Entity manager instance
 * @param {string} entityId - The entity ID to check
 * @returns {string[]} Array of body part entity IDs with can_grab component
 */
export function findGrabbingAppendages(entityManager, entityId) { ... }

/**
 * Count free (unlocked) grabbing appendages for an entity
 *
 * @param {EntityManager} entityManager - Entity manager instance
 * @param {string} entityId - The entity ID to check
 * @returns {number} Count of free grabbing appendages
 */
export function countFreeGrabbingAppendages(entityManager, entityId) { ... }

/**
 * Count total grabbing appendages for an entity (locked + unlocked)
 *
 * @param {EntityManager} entityManager - Entity manager instance
 * @param {string} entityId - The entity ID to check
 * @returns {number} Total count of grabbing appendages
 */
export function countTotalGrabbingAppendages(entityManager, entityId) { ... }

/**
 * Calculate total grip strength of free appendages
 *
 * @param {EntityManager} entityManager - Entity manager instance
 * @param {string} entityId - The entity ID to check
 * @returns {number} Sum of gripStrength from all free appendages
 */
export function calculateFreeGripStrength(entityManager, entityId) { ... }

/**
 * Lock N grabbing appendages, optionally associating with an item
 *
 * @param {EntityManager} entityManager - Entity manager instance
 * @param {string} entityId - The entity ID whose appendages to lock
 * @param {number} count - Number of appendages to lock
 * @param {string|null} [itemId=null] - Optional item ID to associate with locked appendages
 * @returns {{ success: boolean, lockedParts: string[], error?: string }}
 * @throws {Error} If not enough free appendages available
 */
export function lockGrabbingAppendages(entityManager, entityId, count, itemId = null) { ... }

/**
 * Unlock N grabbing appendages, optionally filtering by held item
 *
 * @param {EntityManager} entityManager - Entity manager instance
 * @param {string} entityId - The entity ID whose appendages to unlock
 * @param {number} count - Number of appendages to unlock
 * @param {string|null} [itemId=null] - Optional: only unlock appendages holding this item
 * @returns {{ success: boolean, unlockedParts: string[], error?: string }}
 */
export function unlockGrabbingAppendages(entityManager, entityId, count, itemId = null) { ... }

/**
 * Unlock all appendages holding a specific item
 *
 * @param {EntityManager} entityManager - Entity manager instance
 * @param {string} entityId - The entity ID whose appendages to check
 * @param {string} itemId - The item ID to search for
 * @returns {{ success: boolean, unlockedParts: string[] }}
 */
export function unlockAppendagesHoldingItem(entityManager, entityId, itemId) { ... }

/**
 * Get list of items currently held by an entity's appendages
 *
 * @param {EntityManager} entityManager - Entity manager instance
 * @param {string} entityId - The entity ID to check
 * @returns {Array<{ partId: string, itemId: string }>} Array of held items with their holding part
 */
export function getHeldItems(entityManager, entityId) { ... }

/**
 * Check if entity has enough free appendages with sufficient grip strength
 *
 * @param {EntityManager} entityManager - Entity manager instance
 * @param {string} entityId - The entity ID to check
 * @param {number} requiredCount - Number of free appendages required
 * @param {number} [requiredGripStrength=0] - Optional minimum grip strength required
 * @returns {boolean} True if requirements are met
 */
export function hasEnoughFreeAppendages(entityManager, entityId, requiredCount, requiredGripStrength = 0) { ... }
```

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests**: `tests/unit/utils/grabbingUtils.test.js`

   #### findGrabbingAppendages
   - [ ] Returns empty array when entity has no body component
   - [ ] Returns empty array when body has no parts with can_grab
   - [ ] Returns array of part IDs when parts have can_grab
   - [ ] Handles entity with multiple grabbing appendages

   #### countFreeGrabbingAppendages
   - [ ] Returns 0 when entity has no grabbing appendages
   - [ ] Returns correct count when all appendages are free
   - [ ] Returns correct count when some appendages are locked
   - [ ] Returns 0 when all appendages are locked

   #### countTotalGrabbingAppendages
   - [ ] Returns total count regardless of locked state

   #### calculateFreeGripStrength
   - [ ] Returns 0 when no free appendages
   - [ ] Returns sum of gripStrength from free appendages only
   - [ ] Uses default gripStrength (1.0) when not specified

   #### lockGrabbingAppendages
   - [ ] Successfully locks requested count of appendages
   - [ ] Sets heldItemId when itemId provided
   - [ ] Returns lockedParts array with affected part IDs
   - [ ] Fails with error when not enough free appendages
   - [ ] Locks first available (unlocked) appendages

   #### unlockGrabbingAppendages
   - [ ] Successfully unlocks requested count of appendages
   - [ ] Clears heldItemId on unlocked appendages
   - [ ] Filters by itemId when provided
   - [ ] Returns unlockedParts array with affected part IDs
   - [ ] Fails gracefully when not enough locked appendages

   #### unlockAppendagesHoldingItem
   - [ ] Unlocks all appendages holding the specified item
   - [ ] Returns empty array when item not held
   - [ ] Clears heldItemId on unlocked appendages

   #### getHeldItems
   - [ ] Returns empty array when nothing held
   - [ ] Returns array of { partId, itemId } for held items
   - [ ] Excludes appendages with null heldItemId

   #### hasEnoughFreeAppendages
   - [ ] Returns true when requirements met
   - [ ] Returns false when not enough free appendages
   - [ ] Checks grip strength when requiredGripStrength > 0
   - [ ] Returns false when grip strength insufficient

2. **Existing Tests**: `npm run test:unit` should pass

### Invariants That Must Remain True

1. Functions are pure - no side effects except explicit lock/unlock mutations
2. All functions handle missing body component gracefully (return empty/0/false)
3. Lock functions are atomic - all or nothing
4. Unlock functions don't throw when nothing to unlock
5. No DI dependencies - utilities use EntityManager directly
6. No event dispatching from utilities (caller's responsibility)

## Test File Template

```javascript
// tests/unit/utils/grabbingUtils.test.js
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  findGrabbingAppendages,
  countFreeGrabbingAppendages,
  countTotalGrabbingAppendages,
  calculateFreeGripStrength,
  lockGrabbingAppendages,
  unlockGrabbingAppendages,
  unlockAppendagesHoldingItem,
  getHeldItems,
  hasEnoughFreeAppendages
} from '../../../src/utils/grabbingUtils.js';

describe('grabbingUtils', () => {
  let mockEntityManager;

  beforeEach(() => {
    mockEntityManager = {
      getComponentData: jest.fn(),
      addComponent: jest.fn(),
      hasComponent: jest.fn()
    };
  });

  describe('countFreeGrabbingAppendages', () => {
    it('should return 0 when entity has no body component', () => {
      mockEntityManager.getComponentData.mockReturnValue(null);
      const result = countFreeGrabbingAppendages(mockEntityManager, 'actor_1');
      expect(result).toBe(0);
    });

    it('should count only unlocked appendages', () => {
      // Setup mock with 2 hands, 1 locked, 1 free
      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === 'anatomy:body') {
          return { body: { parts: { left_hand: 'part_1', right_hand: 'part_2' } } };
        }
        if (entityId === 'part_1' && componentId === 'anatomy:can_grab') {
          return { locked: true, heldItemId: 'sword_1', gripStrength: 1.0 };
        }
        if (entityId === 'part_2' && componentId === 'anatomy:can_grab') {
          return { locked: false, heldItemId: null, gripStrength: 1.0 };
        }
        return null;
      });

      const result = countFreeGrabbingAppendages(mockEntityManager, 'actor_1');
      expect(result).toBe(1);
    });
  });

  // ... additional tests for each function
});
```

## Verification Commands

```bash
# Run utility tests
npm run test:unit -- tests/unit/utils/grabbingUtils.test.js

# Check for type errors
npm run typecheck

# Lint the new file
npx eslint src/utils/grabbingUtils.js
```
