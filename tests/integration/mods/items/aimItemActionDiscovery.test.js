/**
 * @file Integration tests for the items:aim_item action definition.
 * @description Tests that the aim_item action is properly defined and structured.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import aimItemAction from '../../../../data/mods/items/actions/aim_item.action.json' assert { type: 'json' };

describe('items:aim_item action definition', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('items', 'items:aim_item');
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should have correct action structure', () => {
    expect(aimItemAction).toBeDefined();
    expect(aimItemAction.id).toBe('items:aim_item');
    expect(aimItemAction.name).toBe('Aim Item');
    expect(aimItemAction.description).toBe(
      'Aim an aimable item at a target entity. The item must have items:aimable component and be in actor\'s inventory.'
    );
    expect(aimItemAction.template).toBe('aim {item} at {target}');
  });

  it('should use correct scope for primary targets', () => {
    expect(aimItemAction.targets).toBeDefined();
    expect(aimItemAction.targets.primary).toBeDefined();
    expect(aimItemAction.targets.primary.scope).toBe('items:aimable_targets');
    expect(aimItemAction.targets.primary.placeholder).toBe('target');
    expect(aimItemAction.targets.primary.description).toBe('Entity to aim at');
  });

  it('should use correct scope for secondary targets (aimable items)', () => {
    expect(aimItemAction.targets).toBeDefined();
    expect(aimItemAction.targets.secondary).toBeDefined();
    expect(aimItemAction.targets.secondary.scope).toBe(
      'items:aimable_items_in_inventory'
    );
    expect(aimItemAction.targets.secondary.placeholder).toBe('item');
    expect(aimItemAction.targets.secondary.description).toBe(
      'Aimable item to use (weapon, flashlight, camera, etc.)'
    );
  });

  it('should generate combinations for multiple targets', () => {
    expect(aimItemAction.generateCombinations).toBe(true);
  });

  it('should require actor to have inventory', () => {
    expect(aimItemAction.required_components).toBeDefined();
    expect(aimItemAction.required_components.actor).toEqual(['items:inventory']);
  });
});
