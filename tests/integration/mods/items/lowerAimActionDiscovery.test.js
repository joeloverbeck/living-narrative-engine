/**
 * @file Integration tests for the items:lower_aim action definition.
 * @description Tests that the lower_aim action is properly defined and structured.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import lowerAimAction from '../../../../data/mods/items/actions/lower_aim.action.json' assert { type: 'json' };

describe('items:lower_aim action definition', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('items', 'items:lower_aim');
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should have correct action structure', () => {
    expect(lowerAimAction).toBeDefined();
    expect(lowerAimAction.id).toBe('items:lower_aim');
    expect(lowerAimAction.name).toBe('Lower Aim');
    expect(lowerAimAction.description).toBe(
      'Stop aiming an item. Removes the items:aimed_at component from the item, ending the aimed state.'
    );
    expect(lowerAimAction.template).toBe('lower {item}');
  });

  it('should use correct scope for primary targets (aimed items)', () => {
    expect(lowerAimAction.targets).toBeDefined();
    expect(lowerAimAction.targets.primary).toBeDefined();
    expect(lowerAimAction.targets.primary.scope).toBe(
      'items:aimed_items_in_inventory'
    );
    expect(lowerAimAction.targets.primary.placeholder).toBe('item');
    expect(lowerAimAction.targets.primary.description).toBe(
      'Item currently being aimed (has items:aimed_at component)'
    );
  });

  it('should generate combinations for multiple targets', () => {
    expect(lowerAimAction.generateCombinations).toBe(true);
  });

  it('should require actor to have inventory', () => {
    expect(lowerAimAction.required_components).toBeDefined();
    expect(lowerAimAction.required_components.actor).toEqual([
      'inventory:inventory',
    ]);
  });
});
