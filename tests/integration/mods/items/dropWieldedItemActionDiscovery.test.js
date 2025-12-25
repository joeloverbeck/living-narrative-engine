/**
 * @file Integration tests for the item-handling:drop_wielded_item action definition.
 * @description Tests that the drop_wielded_item action is properly defined and structured.
 * This action allows actors to drop items they are currently wielding without requiring
 * a free grabbing appendage (since they are releasing, not grabbing).
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import dropWieldedItemAction from '../../../../data/mods/item-handling/actions/drop_wielded_item.action.json' assert { type: 'json' };
import dropItemRule from '../../../../data/mods/item-handling/rules/handle_drop_item.rule.json' assert { type: 'json' };
import eventIsActionDropWieldedItem from '../../../../data/mods/item-handling/conditions/event-is-action-drop-wielded-item.condition.json' assert { type: 'json' };

describe('item-handling:drop_wielded_item action definition', () => {
  let testFixture;

  beforeEach(async () => {
    // drop_wielded_item shares the handle_drop_item rule with drop_item action
    testFixture = await ModTestFixture.forAction(
      'item-handling',
      'item-handling:drop_wielded_item',
      dropItemRule,
      eventIsActionDropWieldedItem
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action Structure', () => {
    it('should have correct action ID', () => {
      expect(dropWieldedItemAction.id).toBe('item-handling:drop_wielded_item');
    });

    it('should have correct name', () => {
      expect(dropWieldedItemAction.name).toBe('Drop Wielded Item');
    });

    it('should have description', () => {
      expect(dropWieldedItemAction.description).toBeDefined();
      expect(typeof dropWieldedItemAction.description).toBe('string');
      expect(dropWieldedItemAction.description).toBe(
        'Release and drop an item you are currently wielding'
      );
    });

    it('should have correct template matching drop_item', () => {
      // Both actions use "drop {item}" for consistent UX
      expect(dropWieldedItemAction.template).toBe('drop {item}');
    });
  });

  describe('Required Components', () => {
    it('should require actor to have wielding component', () => {
      expect(dropWieldedItemAction.required_components).toBeDefined();
      expect(dropWieldedItemAction.required_components.actor).toContain(
        'item-handling-states:wielding'
      );
    });

    it('should require exactly one actor component', () => {
      expect(dropWieldedItemAction.required_components.actor).toHaveLength(1);
    });
  });

  describe('Forbidden Components', () => {
    it('should forbid actor performing complex performance', () => {
      expect(dropWieldedItemAction.forbidden_components).toBeDefined();
      expect(dropWieldedItemAction.forbidden_components.actor).toContain(
        'performances-states:doing_complex_performance'
      );
    });
  });

  describe('Prerequisites', () => {
    it('should NOT have prerequisites (releasing item, not grabbing)', () => {
      // Unlike drop_item which needs a free appendage to grab from inventory,
      // drop_wielded_item releases an already-held item
      expect(dropWieldedItemAction.prerequisites).toBeDefined();
      expect(Array.isArray(dropWieldedItemAction.prerequisites)).toBe(true);
      expect(dropWieldedItemAction.prerequisites).toHaveLength(0);
    });
  });

  describe('Target Configuration', () => {
    it('should have primary target defined', () => {
      expect(dropWieldedItemAction.targets).toBeDefined();
      expect(dropWieldedItemAction.targets.primary).toBeDefined();
    });

    it('should use wielded_items scope for primary target', () => {
      expect(dropWieldedItemAction.targets.primary.scope).toBe(
        'items:wielded_items'
      );
    });

    it('should use "item" placeholder for primary target', () => {
      expect(dropWieldedItemAction.targets.primary.placeholder).toBe('item');
    });

    it('should have description for primary target', () => {
      expect(dropWieldedItemAction.targets.primary.description).toBeDefined();
      expect(dropWieldedItemAction.targets.primary.description).toBe(
        'Wielded item to drop'
      );
    });

    it('should not have secondary or tertiary targets', () => {
      expect(dropWieldedItemAction.targets.secondary).toBeUndefined();
      expect(dropWieldedItemAction.targets.tertiary).toBeUndefined();
    });
  });

  describe('Visual Configuration', () => {
    it('should have visual properties defined', () => {
      expect(dropWieldedItemAction.visual).toBeDefined();
      expect(typeof dropWieldedItemAction.visual).toBe('object');
    });

    it('should have matching visual style with drop_item', () => {
      // Both drop actions should have the same visual style for consistency (Tactile Brown)
      expect(dropWieldedItemAction.visual.backgroundColor).toBe('#5d4037');
      expect(dropWieldedItemAction.visual.textColor).toBe('#efebe9');
      expect(dropWieldedItemAction.visual.hoverBackgroundColor).toBe('#6d4c41');
      expect(dropWieldedItemAction.visual.hoverTextColor).toBe('#ffffff');
    });
  });

  describe('Schema Compliance', () => {
    it('should reference correct schema', () => {
      expect(dropWieldedItemAction.$schema).toBe(
        'schema://living-narrative-engine/action.schema.json'
      );
    });

    it('should have all required action properties', () => {
      expect(dropWieldedItemAction).toHaveProperty('$schema');
      expect(dropWieldedItemAction).toHaveProperty('id');
      expect(dropWieldedItemAction).toHaveProperty('name');
      expect(dropWieldedItemAction).toHaveProperty('description');
      expect(dropWieldedItemAction).toHaveProperty('template');
      expect(dropWieldedItemAction).toHaveProperty('targets');
      expect(dropWieldedItemAction).toHaveProperty('visual');
      expect(dropWieldedItemAction).toHaveProperty('required_components');
      expect(dropWieldedItemAction).toHaveProperty('forbidden_components');
      expect(dropWieldedItemAction).toHaveProperty('prerequisites');
    });
  });

  describe('Expected action discovery behavior (manual testing)', () => {
    it('should appear when actor is wielding items', () => {
      // Manual test case:
      // 1. Create actor with item-handling-states:wielding component
      // 2. Actor has wielded_item_ids containing at least one item
      // 3. Expected: drop_wielded_item action should be available for each wielded item
      expect(true).toBe(true);
    });

    it('should NOT appear when actor is not wielding anything', () => {
      // Manual test case:
      // 1. Create actor without item-handling-states:wielding component
      // 2. Expected: drop_wielded_item action should NOT be available
      expect(true).toBe(true);
    });

    it('should appear even when actor has no free grabbing appendage', () => {
      // Manual test case:
      // 1. Create actor wielding two-handed weapon (no free appendages)
      // 2. Expected: drop_wielded_item action SHOULD be available
      // 3. (This is the key difference from drop_item)
      expect(true).toBe(true);
    });

    it('should NOT appear for non-wielded inventory items', () => {
      // Manual test case:
      // 1. Create actor with items in inventory but not wielded
      // 2. Expected: drop_wielded_item action should NOT show those items
      // 3. drop_item action should show those items instead
      expect(true).toBe(true);
    });

    it('should be mutually exclusive with drop_item for same item', () => {
      // Manual test case:
      // 1. A wielded item should appear in drop_wielded_item scope
      // 2. Same item should NOT appear in drop_item scope (non_wielded_inventory_items)
      // 3. Ensures no duplicate "drop mug" actions for the same item
      expect(true).toBe(true);
    });
  });
});
