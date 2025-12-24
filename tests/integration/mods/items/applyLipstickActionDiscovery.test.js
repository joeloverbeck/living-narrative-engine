/**
 * @file Integration tests for the items:apply_lipstick action definition.
 * @description Validates structure and discovery rules for applying lipstick from inventory items.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import applyLipstickAction from '../../../../data/mods/items/actions/apply_lipstick.action.json' assert { type: 'json' };

const ACTION_ID = 'items:apply_lipstick';

describe('items:apply_lipstick action definition', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('items', ACTION_ID);

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([applyLipstickAction]);
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should define the apply lipstick action with expected metadata', () => {
    expect(applyLipstickAction).toBeDefined();
    expect(applyLipstickAction.id).toBe(ACTION_ID);
    expect(applyLipstickAction.name).toBe('Apply Lipstick');
    expect(applyLipstickAction.description).toBe(
      'Coat your lips evenly with a lipstick item from your inventory.'
    );
    expect(applyLipstickAction.template).toBe(
      'coat your lips evenly with {item}'
    );
    expect(applyLipstickAction.generateCombinations).toBe(true);
  });

  it('should scope targets to actor inventory lipstick items', () => {
    expect(applyLipstickAction.targets).toBeDefined();
    expect(applyLipstickAction.targets.primary).toEqual(
      expect.objectContaining({
        scope: 'items:actor_inventory_items',
        placeholder: 'item',
        description: 'Lipstick to apply',
      })
    );
  });

  it('should enforce actor inventory and lipstick marker requirements', () => {
    expect(applyLipstickAction.required_components).toBeDefined();
    expect(applyLipstickAction.required_components.actor).toEqual([
      'items:inventory',
    ]);
    expect(applyLipstickAction.required_components.primary).toEqual([
      'items-core:item',
      'items:can_apply_lipstick',
    ]);
    expect(Array.isArray(applyLipstickAction.prerequisites)).toBe(true);
    expect(applyLipstickAction.prerequisites).toHaveLength(0);
  });

  describe('Action discovery behavior', () => {
    it('is available when the actor carries a lipstick item', () => {
      const room = ModEntityScenarios.createRoom('boudoir', 'Boudoir');

      const actor = new ModEntityBuilder('actor1')
        .withName('Sera')
        .atLocation('boudoir')
        .asActor()
        .withComponent('items:inventory', {
          items: ['lipstick1'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .build();

      const lipstick = new ModEntityBuilder('lipstick1')
        .withName('red lipstick')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('items:can_apply_lipstick', {})
        .build();

      testFixture.reset([room, actor, lipstick]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor1');
      const lipstickActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(lipstickActions.length).toBeGreaterThan(0);
    });

    it('is not available when the actor lacks an inventory component', () => {
      const room = ModEntityScenarios.createRoom('studio', 'Studio');

      const actor = new ModEntityBuilder('actor_no_inventory')
        .withName('Iris')
        .atLocation('studio')
        .asActor()
        .build();

      const lipstick = new ModEntityBuilder('lipstick_unreachable')
        .withName('red lipstick')
        .atLocation('studio')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('items:can_apply_lipstick', {})
        .build();

      testFixture.reset([room, actor, lipstick]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor_no_inventory');
      const hasLipstickAction = availableActions.some(
        (action) => action.id === ACTION_ID
      );

      expect(hasLipstickAction).toBe(false);
    });

    it('is not available when inventory items lack the lipstick marker', () => {
      const room = ModEntityScenarios.createRoom('vanity', 'Vanity Corner');

      const actor = new ModEntityBuilder('actor_no_lipstick')
        .withName('Rowan')
        .atLocation('vanity')
        .asActor()
        .withComponent('items:inventory', {
          items: ['plain-balm'],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .build();

      const plainBalm = new ModEntityBuilder('plain-balm')
        .withName('plain balm')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .build();

      testFixture.reset([room, actor, plainBalm]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor_no_lipstick');
      const hasLipstickAction = availableActions.some(
        (action) => action.id === ACTION_ID
      );

      expect(hasLipstickAction).toBe(false);
    });
  });
});
