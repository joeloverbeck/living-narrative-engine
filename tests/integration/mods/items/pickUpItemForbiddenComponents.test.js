/**
 * @file Integration tests for items:pick_up_item forbidden components validation.
 * @description Tests that pick_up_item should NOT be available when actor has certain forbidden components.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityScenarios,
  ModEntityBuilder,
} from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import pickUpItemAction from '../../../../data/mods/items/actions/pick_up_item.action.json';

describe('items:pick_up_item - Forbidden components validation', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('items', 'items:pick_up_item');

    // Register inventory scopes needed for item discovery
    ScopeResolverHelpers.registerInventoryScopes(testFixture.testEnv);
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('should have forbidden_components defined for actor', () => {
      expect(pickUpItemAction.forbidden_components).toBeDefined();
      expect(pickUpItemAction.forbidden_components.actor).toBeInstanceOf(Array);
    });

    it('should include bending_over in forbidden components', () => {
      expect(pickUpItemAction.forbidden_components.actor).toContain(
        'positioning:bending_over'
      );
    });

    it('should include sitting_on in forbidden components', () => {
      expect(pickUpItemAction.forbidden_components.actor).toContain(
        'positioning:sitting_on'
      );
    });
  });

  describe('being_fucked_vaginally forbidden component', () => {
    it('should NOT appear when actor has being_fucked_vaginally component', () => {
      // Create basic scenario with actor and item
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Item']);

      // Add inventory to actor
      scenario.actor.components['items:inventory'] = {
        items: [],
        capacity: { maxWeight: 10, maxItems: 10 },
      };

      // Actor is being fucked vaginally
      scenario.actor.components['positioning:being_fucked_vaginally'] = {
        actorId: 'other_entity',
      };

      // Create room and item on ground
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      const item = new ModEntityBuilder('item1')
        .withName('Test Item')
        .atLocation(room.id)
        .withComponent('items:item', {})
        .withComponent('items:portable', { weight: 1.0 })
        .build();

      // Actor in same room
      scenario.actor.components['positioning:at_location'] = {
        location_id: room.id,
      };

      testFixture.reset([room, item, scenario.actor]);

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const actionIds = actions.map((action) => action.id);

      // Action should NOT appear when actor has being_fucked_vaginally component
      expect(actionIds).not.toContain('items:pick_up_item');
    });

    it('should appear when actor does NOT have being_fucked_vaginally component', () => {
      // Create basic scenario with actor and item
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Item']);

      // Add inventory to actor
      scenario.actor.components['items:inventory'] = {
        items: [],
        capacity: { maxWeight: 10, maxItems: 10 },
      };

      // Create room and item on ground
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      const item = new ModEntityBuilder('item1')
        .withName('Test Item')
        .atLocation(room.id)
        .withComponent('items:item', {})
        .withComponent('items:portable', { weight: 1.0 })
        .build();

      // Actor in same room (no being_fucked_vaginally component)
      scenario.actor.components['positioning:at_location'] = {
        location_id: room.id,
      };

      // Add grabbing appendages so the prerequisite passes
      const handEntity = new ModEntityBuilder('alice-hand-1')
        .withComponent('anatomy:can_grab', {
          gripStrength: 1.0,
          locked: false,
          heldItemId: null,
        })
        .build();
      scenario.actor.components['anatomy:body'] = {
        body: { parts: { rightHand: 'alice-hand-1' } },
      };

      testFixture.reset([room, item, scenario.actor, handEntity]);

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const actionIds = actions.map((action) => action.id);

      // Without the forbidden component, action should be available
      expect(actionIds).toContain('items:pick_up_item');
    });
  });

  describe('sitting_on forbidden component', () => {
    it('should NOT appear when actor has sitting_on component', () => {
      // Create basic scenario with actor and item
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Item']);

      // Add inventory to actor
      scenario.actor.components['items:inventory'] = {
        items: [],
        capacity: { maxWeight: 10, maxItems: 10 },
      };

      // Actor is sitting on furniture
      scenario.actor.components['positioning:sitting_on'] = {
        furnitureId: 'bench123',
      };

      // Create room and item on ground
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      const item = new ModEntityBuilder('item1')
        .withName('Test Item')
        .atLocation(room.id)
        .withComponent('items:item', {})
        .withComponent('items:portable', { weight: 1.0 })
        .build();

      // Actor in same room
      scenario.actor.components['positioning:at_location'] = {
        location_id: room.id,
      };

      testFixture.reset([room, item, scenario.actor]);

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const actionIds = actions.map((action) => action.id);

      // Action should NOT appear when actor has sitting_on component
      expect(actionIds).not.toContain('items:pick_up_item');
    });

    it('should appear when actor does NOT have sitting_on component', () => {
      // Create basic scenario with actor and item
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Item']);

      // Add inventory to actor
      scenario.actor.components['items:inventory'] = {
        items: [],
        capacity: { maxWeight: 10, maxItems: 10 },
      };

      // Create room and item on ground
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      const item = new ModEntityBuilder('item1')
        .withName('Test Item')
        .atLocation(room.id)
        .withComponent('items:item', {})
        .withComponent('items:portable', { weight: 1.0 })
        .build();

      // Actor in same room (no sitting_on component)
      scenario.actor.components['positioning:at_location'] = {
        location_id: room.id,
      };

      // Add grabbing appendages so the prerequisite passes
      const handEntity = new ModEntityBuilder('alice-hand-1')
        .withComponent('anatomy:can_grab', {
          gripStrength: 1.0,
          locked: false,
          heldItemId: null,
        })
        .build();
      scenario.actor.components['anatomy:body'] = {
        body: { parts: { rightHand: 'alice-hand-1' } },
      };

      testFixture.reset([room, item, scenario.actor, handEntity]);

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const actionIds = actions.map((action) => action.id);

      // Without the forbidden component, action should be available
      expect(actionIds).toContain('items:pick_up_item');
    });
  });
});
