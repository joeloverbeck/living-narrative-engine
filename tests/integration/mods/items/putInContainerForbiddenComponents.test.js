/**
 * @file Integration tests for containers:put_in_container forbidden components validation.
 * @description Tests that put_in_container should NOT be available when actor has certain forbidden components.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import putInContainerAction from '../../../../data/mods/containers/actions/put_in_container.action.json';

describe('containers:put_in_container - Forbidden components validation', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'containers',
      'containers:put_in_container'
    );

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
      expect(putInContainerAction.forbidden_components).toBeDefined();
      expect(putInContainerAction.forbidden_components.actor).toBeInstanceOf(
        Array
      );
    });

    it('should include bending_over in forbidden components', () => {
      expect(putInContainerAction.forbidden_components.actor).toContain(
        'positioning:bending_over'
      );
    });

    it('should include sitting_on in forbidden components', () => {
      expect(putInContainerAction.forbidden_components.actor).toContain(
        'positioning:sitting_on'
      );
    });
  });

  describe('sitting_on forbidden component', () => {
    it('should NOT appear when actor has sitting_on component', () => {
      // Create location
      const location = new ModEntityBuilder('room1')
        .asRoom('Test Room')
        .build();

      // Create actor with inventory
      const actorBuilder = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['item1'],
          capacity: { maxWeight: 10, maxItems: 10 },
        })
        .withComponent('positioning:sitting_on', {
          furnitureId: 'bench123',
        });
      const actor = actorBuilder.build();

      // Create item in actor's inventory
      const item = new ModEntityBuilder('item1')
        .withName('Test Item')
        .withComponent('items:item', {})
        .withComponent('items:portable', { weight: 1.0 })
        .build();

      // Create open container at location
      const chest = new ModEntityBuilder('chest1')
        .withName('Chest')
        .atLocation('room1')
        .withComponent('containers-core:container', {
          contents: [],
          capacity: { maxItems: 5, maxWeight: 100 },
          isOpen: true,
        })
        .withComponent('items:openable', {})
        .build();

      testFixture.reset([location, actor, item, chest]);

      const actions = testFixture.testEnv.getAvailableActions('actor1');
      const actionIds = actions.map((action) => action.id);

      // Action should NOT appear when actor has sitting_on component
      expect(actionIds).not.toContain('containers:put_in_container');
    });

    it('should appear when actor does NOT have sitting_on component', () => {
      // Create location
      const location = new ModEntityBuilder('room1')
        .asRoom('Test Room')
        .build();

      // Create actor with inventory and free grabbing appendages (for prerequisite)
      const actorBuilder = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['item1'],
          capacity: { maxWeight: 10, maxItems: 10 },
        })
        .withGrabbingHands(2);
      const actor = actorBuilder.build();
      const handEntities = actorBuilder.getHandEntities();

      // Create item in actor's inventory
      const item = new ModEntityBuilder('item1')
        .withName('Test Item')
        .withComponent('items:item', {})
        .withComponent('items:portable', { weight: 1.0 })
        .build();

      // Create open container at location
      const chest = new ModEntityBuilder('chest1')
        .withName('Chest')
        .atLocation('room1')
        .withComponent('containers-core:container', {
          contents: [],
          capacity: { maxItems: 5, maxWeight: 100 },
          isOpen: true,
        })
        .withComponent('items:openable', {})
        .build();

      testFixture.reset([location, actor, ...handEntities, item, chest]);

      const actions = testFixture.testEnv.getAvailableActions('actor1');
      const actionIds = actions.map((action) => action.id);

      // Without the forbidden component, action should be available
      expect(actionIds).toContain('containers:put_in_container');
    });
  });

  describe('bending_over forbidden component', () => {
    it('should NOT appear when actor has bending_over component', () => {
      // Create location
      const location = new ModEntityBuilder('room1')
        .asRoom('Test Room')
        .build();

      // Create actor with inventory and bending_over component
      const actorBuilder = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['item1'],
          capacity: { maxWeight: 10, maxItems: 10 },
        })
        .withComponent('positioning:bending_over', {});
      const actor = actorBuilder.build();

      // Create item in actor's inventory
      const item = new ModEntityBuilder('item1')
        .withName('Test Item')
        .withComponent('items:item', {})
        .withComponent('items:portable', { weight: 1.0 })
        .build();

      // Create open container at location
      const chest = new ModEntityBuilder('chest1')
        .withName('Chest')
        .atLocation('room1')
        .withComponent('containers-core:container', {
          contents: [],
          capacity: { maxItems: 5, maxWeight: 100 },
          isOpen: true,
        })
        .withComponent('items:openable', {})
        .build();

      testFixture.reset([location, actor, item, chest]);

      const actions = testFixture.testEnv.getAvailableActions('actor1');
      const actionIds = actions.map((action) => action.id);

      // Action should NOT appear when actor has bending_over component
      expect(actionIds).not.toContain('containers:put_in_container');
    });
  });
});
