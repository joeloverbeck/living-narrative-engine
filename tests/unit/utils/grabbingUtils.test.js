/**
 * @file Unit tests for grabbingUtils
 * @see src/utils/grabbingUtils.js
 */

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
  hasEnoughFreeAppendages,
  __testing__,
} from '../../../src/utils/grabbingUtils.js';

describe('grabbingUtils', () => {
  let mockEntityManager;
  let componentStore;

  beforeEach(() => {
    // Store for component data to support mutation
    componentStore = {};

    mockEntityManager = {
      getComponentData: jest.fn((entityId, componentId) => {
        const key = `${entityId}:${componentId}`;
        return componentStore[key] ?? null;
      }),
      addComponent: jest.fn(async (entityId, componentId, data) => {
        const key = `${entityId}:${componentId}`;
        componentStore[key] = data;
      }),
    };
  });

  /**
   * Helper to set up body component with parts
   */
  function setupBodyWithParts(entityId, partsMap) {
    componentStore[`${entityId}:anatomy:body`] = {
      body: {
        root: 'root_entity',
        parts: partsMap,
      },
    };
  }

  /**
   * Helper to set up can_grab component for a part
   */
  function setupCanGrab(partId, locked, heldItemId = null, gripStrength = 1.0) {
    componentStore[`${partId}:anatomy:can_grab`] = {
      locked,
      heldItemId,
      gripStrength,
    };
  }

  describe('findGrabbingAppendages', () => {
    it('should return empty array when entity has no body component', () => {
      const result = findGrabbingAppendages(mockEntityManager, 'actor_1');
      expect(result).toEqual([]);
    });

    it('should return empty array when entityManager is null', () => {
      const result = findGrabbingAppendages(null, 'actor_1');
      expect(result).toEqual([]);
    });

    it('should return empty array when entityId is null', () => {
      const result = findGrabbingAppendages(mockEntityManager, null);
      expect(result).toEqual([]);
    });

    it('should return empty array when body has no parts with can_grab', () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
        right_hand: 'part_2',
      });
      // No can_grab components set up

      const result = findGrabbingAppendages(mockEntityManager, 'actor_1');
      expect(result).toEqual([]);
    });

    it('should return array of part IDs when parts have can_grab', () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
        right_hand: 'part_2',
        head: 'part_3',
      });
      setupCanGrab('part_1', false);
      setupCanGrab('part_2', false);
      // part_3 (head) has no can_grab

      const result = findGrabbingAppendages(mockEntityManager, 'actor_1');
      expect(result).toContain('part_1');
      expect(result).toContain('part_2');
      expect(result).not.toContain('part_3');
      expect(result).toHaveLength(2);
    });

    it('should handle entity with multiple grabbing appendages', () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
        right_hand: 'part_2',
        left_tentacle: 'part_3',
        right_tentacle: 'part_4',
      });
      setupCanGrab('part_1', false);
      setupCanGrab('part_2', false);
      setupCanGrab('part_3', true);
      setupCanGrab('part_4', false);

      const result = findGrabbingAppendages(mockEntityManager, 'actor_1');
      expect(result).toHaveLength(4);
    });
  });

  describe('countFreeGrabbingAppendages', () => {
    it('should return 0 when entity has no grabbing appendages', () => {
      const result = countFreeGrabbingAppendages(mockEntityManager, 'actor_1');
      expect(result).toBe(0);
    });

    it('should return correct count when all appendages are free', () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
        right_hand: 'part_2',
      });
      setupCanGrab('part_1', false);
      setupCanGrab('part_2', false);

      const result = countFreeGrabbingAppendages(mockEntityManager, 'actor_1');
      expect(result).toBe(2);
    });

    it('should return correct count when some appendages are locked', () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
        right_hand: 'part_2',
      });
      setupCanGrab('part_1', true, 'sword_1');
      setupCanGrab('part_2', false);

      const result = countFreeGrabbingAppendages(mockEntityManager, 'actor_1');
      expect(result).toBe(1);
    });

    it('should return 0 when all appendages are locked', () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
        right_hand: 'part_2',
      });
      setupCanGrab('part_1', true, 'sword_1');
      setupCanGrab('part_2', true, 'shield_1');

      const result = countFreeGrabbingAppendages(mockEntityManager, 'actor_1');
      expect(result).toBe(0);
    });
  });

  describe('countTotalGrabbingAppendages', () => {
    it('should return total count regardless of locked state', () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
        right_hand: 'part_2',
        tail: 'part_3',
      });
      setupCanGrab('part_1', true, 'sword_1');
      setupCanGrab('part_2', false);
      setupCanGrab('part_3', true, 'potion_1');

      const result = countTotalGrabbingAppendages(mockEntityManager, 'actor_1');
      expect(result).toBe(3);
    });

    it('should return 0 when entity has no appendages', () => {
      const result = countTotalGrabbingAppendages(mockEntityManager, 'actor_1');
      expect(result).toBe(0);
    });
  });

  describe('calculateFreeGripStrength', () => {
    it('should return 0 when no free appendages', () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
      });
      setupCanGrab('part_1', true, 'sword_1', 2.0);

      const result = calculateFreeGripStrength(mockEntityManager, 'actor_1');
      expect(result).toBe(0);
    });

    it('should return sum of gripStrength from free appendages only', () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
        right_hand: 'part_2',
        tail: 'part_3',
      });
      setupCanGrab('part_1', false, null, 2.0);
      setupCanGrab('part_2', true, 'sword_1', 1.5); // locked, not counted
      setupCanGrab('part_3', false, null, 0.5);

      const result = calculateFreeGripStrength(mockEntityManager, 'actor_1');
      expect(result).toBe(2.5); // 2.0 + 0.5
    });

    it('should use default gripStrength (1.0) when not specified', () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
        right_hand: 'part_2',
      });
      // Set up can_grab without gripStrength
      componentStore['part_1:anatomy:can_grab'] = { locked: false };
      componentStore['part_2:anatomy:can_grab'] = { locked: false };

      const result = calculateFreeGripStrength(mockEntityManager, 'actor_1');
      expect(result).toBe(2.0); // 1.0 + 1.0 default
    });
  });

  describe('lockGrabbingAppendages', () => {
    it('should successfully lock requested count of appendages', async () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
        right_hand: 'part_2',
      });
      setupCanGrab('part_1', false);
      setupCanGrab('part_2', false);

      const result = await lockGrabbingAppendages(
        mockEntityManager,
        'actor_1',
        1
      );

      expect(result.success).toBe(true);
      expect(result.lockedParts).toHaveLength(1);
      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
    });

    it('should set heldItemId when itemId provided', async () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
      });
      setupCanGrab('part_1', false);

      await lockGrabbingAppendages(
        mockEntityManager,
        'actor_1',
        1,
        'sword_1'
      );

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part_1',
        'anatomy:can_grab',
        expect.objectContaining({
          locked: true,
          heldItemId: 'sword_1',
        })
      );
    });

    it('should return lockedParts array with affected part IDs', async () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
        right_hand: 'part_2',
      });
      setupCanGrab('part_1', false);
      setupCanGrab('part_2', false);

      const result = await lockGrabbingAppendages(
        mockEntityManager,
        'actor_1',
        2
      );

      expect(result.lockedParts).toContain('part_1');
      expect(result.lockedParts).toContain('part_2');
    });

    it('should fail with error when not enough free appendages', async () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
      });
      setupCanGrab('part_1', true, 'existing_item');

      const result = await lockGrabbingAppendages(
        mockEntityManager,
        'actor_1',
        1
      );

      expect(result.success).toBe(false);
      expect(result.lockedParts).toHaveLength(0);
      expect(result.error).toContain('Not enough free appendages');
    });

    it('should lock first available (unlocked) appendages', async () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
        right_hand: 'part_2',
        tail: 'part_3',
      });
      setupCanGrab('part_1', true, 'sword_1'); // locked
      setupCanGrab('part_2', false);
      setupCanGrab('part_3', false);

      const result = await lockGrabbingAppendages(
        mockEntityManager,
        'actor_1',
        1
      );

      expect(result.success).toBe(true);
      expect(result.lockedParts).not.toContain('part_1');
    });

    it('should handle count of 0 gracefully', async () => {
      setupBodyWithParts('actor_1', { left_hand: 'part_1' });
      setupCanGrab('part_1', false);

      const result = await lockGrabbingAppendages(
        mockEntityManager,
        'actor_1',
        0
      );

      expect(result.success).toBe(true);
      expect(result.lockedParts).toHaveLength(0);
    });

    it('should return error for invalid arguments', async () => {
      const result = await lockGrabbingAppendages(null, 'actor_1', 1);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid arguments');
    });
  });

  describe('unlockGrabbingAppendages', () => {
    it('should successfully unlock requested count of appendages', async () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
        right_hand: 'part_2',
      });
      setupCanGrab('part_1', true, 'sword_1');
      setupCanGrab('part_2', true, 'shield_1');

      const result = await unlockGrabbingAppendages(
        mockEntityManager,
        'actor_1',
        1
      );

      expect(result.success).toBe(true);
      expect(result.unlockedParts).toHaveLength(1);
    });

    it('should clear heldItemId on unlocked appendages', async () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
      });
      setupCanGrab('part_1', true, 'sword_1');

      await unlockGrabbingAppendages(mockEntityManager, 'actor_1', 1);

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part_1',
        'anatomy:can_grab',
        expect.objectContaining({
          locked: false,
          heldItemId: null,
        })
      );
    });

    it('should filter by itemId when provided', async () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
        right_hand: 'part_2',
      });
      setupCanGrab('part_1', true, 'sword_1');
      setupCanGrab('part_2', true, 'shield_1');

      const result = await unlockGrabbingAppendages(
        mockEntityManager,
        'actor_1',
        1,
        'sword_1'
      );

      expect(result.unlockedParts).toContain('part_1');
      expect(result.unlockedParts).not.toContain('part_2');
    });

    it('should return unlockedParts array with affected part IDs', async () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
        right_hand: 'part_2',
      });
      setupCanGrab('part_1', true, 'sword_1');
      setupCanGrab('part_2', true, 'shield_1');

      const result = await unlockGrabbingAppendages(
        mockEntityManager,
        'actor_1',
        2
      );

      expect(result.unlockedParts).toHaveLength(2);
    });

    it('should fail gracefully when not enough locked appendages', async () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
      });
      setupCanGrab('part_1', true, 'sword_1');

      const result = await unlockGrabbingAppendages(
        mockEntityManager,
        'actor_1',
        5
      );

      // Should unlock what it can
      expect(result.success).toBe(true);
      expect(result.unlockedParts).toHaveLength(1);
    });

    it('should handle count of 0 gracefully', async () => {
      setupBodyWithParts('actor_1', { left_hand: 'part_1' });
      setupCanGrab('part_1', true, 'sword_1');

      const result = await unlockGrabbingAppendages(
        mockEntityManager,
        'actor_1',
        0
      );

      expect(result.success).toBe(true);
      expect(result.unlockedParts).toHaveLength(0);
    });
  });

  describe('unlockAppendagesHoldingItem', () => {
    it('should unlock all appendages holding the specified item', async () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
        right_hand: 'part_2',
        tail: 'part_3',
      });
      setupCanGrab('part_1', true, 'two_handed_sword');
      setupCanGrab('part_2', true, 'two_handed_sword'); // same item
      setupCanGrab('part_3', true, 'other_item');

      const result = await unlockAppendagesHoldingItem(
        mockEntityManager,
        'actor_1',
        'two_handed_sword'
      );

      expect(result.success).toBe(true);
      expect(result.unlockedParts).toContain('part_1');
      expect(result.unlockedParts).toContain('part_2');
      expect(result.unlockedParts).not.toContain('part_3');
    });

    it('should return empty array when item not held', async () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
      });
      setupCanGrab('part_1', true, 'sword_1');

      const result = await unlockAppendagesHoldingItem(
        mockEntityManager,
        'actor_1',
        'nonexistent_item'
      );

      expect(result.success).toBe(true);
      expect(result.unlockedParts).toHaveLength(0);
    });

    it('should clear heldItemId on unlocked appendages', async () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
      });
      setupCanGrab('part_1', true, 'sword_1');

      await unlockAppendagesHoldingItem(
        mockEntityManager,
        'actor_1',
        'sword_1'
      );

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part_1',
        'anatomy:can_grab',
        expect.objectContaining({
          locked: false,
          heldItemId: null,
        })
      );
    });

    it('should return failure for invalid arguments', async () => {
      const result = await unlockAppendagesHoldingItem(
        mockEntityManager,
        'actor_1',
        null
      );
      expect(result.success).toBe(false);
    });
  });

  describe('getHeldItems', () => {
    it('should return empty array when nothing held', () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
        right_hand: 'part_2',
      });
      setupCanGrab('part_1', false);
      setupCanGrab('part_2', false);

      const result = getHeldItems(mockEntityManager, 'actor_1');
      expect(result).toEqual([]);
    });

    it('should return array of { partId, itemId } for held items', () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
        right_hand: 'part_2',
      });
      setupCanGrab('part_1', true, 'sword_1');
      setupCanGrab('part_2', true, 'shield_1');

      const result = getHeldItems(mockEntityManager, 'actor_1');
      expect(result).toEqual([
        { partId: 'part_1', itemId: 'sword_1' },
        { partId: 'part_2', itemId: 'shield_1' },
      ]);
    });

    it('should exclude appendages with null heldItemId', () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
        right_hand: 'part_2',
      });
      setupCanGrab('part_1', true, 'sword_1');
      setupCanGrab('part_2', true, null); // locked but no item

      const result = getHeldItems(mockEntityManager, 'actor_1');
      expect(result).toHaveLength(1);
      expect(result[0].itemId).toBe('sword_1');
    });

    it('should return empty array for null entityManager', () => {
      const result = getHeldItems(null, 'actor_1');
      expect(result).toEqual([]);
    });
  });

  describe('hasEnoughFreeAppendages', () => {
    it('should return true when requirements met', () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
        right_hand: 'part_2',
      });
      setupCanGrab('part_1', false, null, 1.0);
      setupCanGrab('part_2', false, null, 1.0);

      const result = hasEnoughFreeAppendages(mockEntityManager, 'actor_1', 2);
      expect(result).toBe(true);
    });

    it('should return false when not enough free appendages', () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
        right_hand: 'part_2',
      });
      setupCanGrab('part_1', true, 'sword_1');
      setupCanGrab('part_2', false);

      const result = hasEnoughFreeAppendages(mockEntityManager, 'actor_1', 2);
      expect(result).toBe(false);
    });

    it('should check grip strength when requiredGripStrength > 0', () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
        right_hand: 'part_2',
      });
      setupCanGrab('part_1', false, null, 1.0);
      setupCanGrab('part_2', false, null, 1.0);

      const result = hasEnoughFreeAppendages(
        mockEntityManager,
        'actor_1',
        2,
        2.0
      );
      expect(result).toBe(true); // 1.0 + 1.0 = 2.0
    });

    it('should return false when grip strength insufficient', () => {
      setupBodyWithParts('actor_1', {
        left_hand: 'part_1',
        right_hand: 'part_2',
      });
      setupCanGrab('part_1', false, null, 0.5);
      setupCanGrab('part_2', false, null, 0.5);

      const result = hasEnoughFreeAppendages(
        mockEntityManager,
        'actor_1',
        2,
        3.0
      );
      expect(result).toBe(false); // 0.5 + 0.5 = 1.0 < 3.0
    });

    it('should return false for null entityManager', () => {
      const result = hasEnoughFreeAppendages(null, 'actor_1', 1);
      expect(result).toBe(false);
    });

    it('should return false for null entityId', () => {
      const result = hasEnoughFreeAppendages(mockEntityManager, null, 1);
      expect(result).toBe(false);
    });
  });

  describe('__testing__.cloneComponent', () => {
    it('should create deep copy of component', () => {
      const original = {
        locked: true,
        heldItemId: 'sword_1',
        gripStrength: 1.5,
      };

      const cloned = __testing__.cloneComponent(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);

      // Mutating clone should not affect original
      cloned.locked = false;
      expect(original.locked).toBe(true);
    });
  });
});
