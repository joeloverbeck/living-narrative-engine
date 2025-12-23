/**
 * @file Integration tests verifying swim action is forbidden when actor is submerged.
 * @description Ensures action discovery blocks swim_to_connected_liquid_body for actors with liquids-states:submerged.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';

import swimAction from '../../../../data/mods/liquids/actions/swim_to_connected_liquid_body.action.json';

describe('swim_to_connected_liquid_body forbidden when submerged', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'liquids',
      'liquids:swim_to_connected_liquid_body'
    );
  });

  afterEach(() => {
    if (
      testFixture?.testEnv?.unifiedScopeResolver?.__submergedOriginalResolve
    ) {
      testFixture.testEnv.unifiedScopeResolver.resolveSync =
        testFixture.testEnv.unifiedScopeResolver.__submergedOriginalResolve;
    }

    if (testFixture) {
      testFixture.cleanup();
    }
  });

  const configureActionDiscovery = () => {
    const { testEnv } = testFixture;
    if (!testEnv) {
      return;
    }

    const scopeResolver = testEnv.unifiedScopeResolver;
    const originalResolve =
      scopeResolver.__submergedOriginalResolve ||
      scopeResolver.resolveSync.bind(scopeResolver);

    scopeResolver.__submergedOriginalResolve = originalResolve;
    scopeResolver.resolveSync = (scopeName, context) => {
      const { entityManager } = testEnv;

      // Mock connected liquid bodies scope
      if (scopeName === 'liquids:connected_liquid_bodies_for_actor') {
        const actorId = context?.actor?.id;
        if (!actorId) {
          return { success: true, value: new Set() };
        }

        const inLiquidBody = entityManager.getComponentData(
          actorId,
          'liquids-states:in_liquid_body'
        );

        if (!inLiquidBody?.liquid_body_id) {
          return { success: true, value: new Set() };
        }

        // Return mock connected liquid body
        const connectedBodies = new Set();
        for (const entityId of entityManager.getEntityIds()) {
          const isLiquidBody = entityManager.getComponentData(
            entityId,
            'liquids:liquid_body'
          );
          if (isLiquidBody && entityId !== inLiquidBody.liquid_body_id) {
            connectedBodies.add(entityId);
          }
        }

        return { success: true, value: connectedBodies };
      }

      // Mock connected liquid body location scope
      if (scopeName === 'liquids:connected_liquid_body_location') {
        const primaryId = context?.primary?.id || context?.primaryId;
        if (!primaryId) {
          return { success: true, value: new Set() };
        }

        const liquidBody = entityManager.getComponentData(
          primaryId,
          'liquids:liquid_body'
        );

        if (liquidBody?.locationId) {
          return { success: true, value: new Set([liquidBody.locationId]) };
        }

        return { success: true, value: new Set() };
      }

      return originalResolve(scopeName, context);
    };
  };

  const setupScenarioWithSubmerged = () => {
    const room1 = ModEntityScenarios.createRoom('room1', 'Lake Shore');
    const room2 = ModEntityScenarios.createRoom('room2', 'Deep Lake');

    const liquidBody1 = new ModEntityBuilder('liquid_body_1')
      .withName('Shallow Waters')
      .withComponent('liquids:liquid_body', {
        locationId: 'room1',
        connectedBodies: ['liquid_body_2'],
      })
      .build();

    const liquidBody2 = new ModEntityBuilder('liquid_body_2')
      .withName('Deep Waters')
      .withComponent('liquids:liquid_body', {
        locationId: 'room2',
        connectedBodies: ['liquid_body_1'],
      })
      .build();

    const actor = new ModEntityBuilder('actor1')
      .withName('Swimmer')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor()
      .build();

    // Actor is in liquid body AND submerged (fumbled a swim attempt)
    actor.components['liquids-states:in_liquid_body'] = {
      liquid_body_id: 'liquid_body_1',
    };
    actor.components['liquids-states:submerged'] = {};
    actor.components['skills:mobility_skill'] = { value: 10 };

    return {
      actor,
      entities: [room1, room2, actor, liquidBody1, liquidBody2],
    };
  };

  const setupScenarioWithoutSubmerged = () => {
    const room1 = ModEntityScenarios.createRoom('room1', 'Lake Shore');
    const room2 = ModEntityScenarios.createRoom('room2', 'Deep Lake');

    const liquidBody1 = new ModEntityBuilder('liquid_body_1')
      .withName('Shallow Waters')
      .withComponent('liquids:liquid_body', {
        locationId: 'room1',
        connectedBodies: ['liquid_body_2'],
      })
      .build();

    const liquidBody2 = new ModEntityBuilder('liquid_body_2')
      .withName('Deep Waters')
      .withComponent('liquids:liquid_body', {
        locationId: 'room2',
        connectedBodies: ['liquid_body_1'],
      })
      .build();

    const actor = new ModEntityBuilder('actor1')
      .withName('Swimmer')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor()
      .build();

    // Actor is in liquid body but NOT submerged (can swim normally)
    actor.components['liquids-states:in_liquid_body'] = {
      liquid_body_id: 'liquid_body_1',
    };
    actor.components['skills:mobility_skill'] = { value: 10 };

    return {
      actor,
      entities: [room1, room2, actor, liquidBody1, liquidBody2],
    };
  };

  describe('Action structure validation', () => {
    it('includes liquids-states:submerged as forbidden component', () => {
      expect(swimAction.forbidden_components?.actor).toContain(
        'liquids-states:submerged'
      );
    });

    it('includes all expected forbidden components for actor', () => {
      expect(swimAction.forbidden_components?.actor).toEqual(
        expect.arrayContaining([
          'physical-control-states:being_restrained',
          'physical-control-states:restraining',
          'recovery-states:fallen',
          'liquids-states:submerged',
        ])
      );
    });
  });

  describe('Action discovery when submerged', () => {
    it('swim_to_connected_liquid_body is not discoverable when actor is submerged', () => {
      const { actor, entities } = setupScenarioWithSubmerged();

      testFixture.reset(entities);
      configureActionDiscovery();
      testFixture.testEnv.actionIndex.buildIndex([swimAction]);

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((available) => available.id);

      expect(ids).not.toContain('liquids:swim_to_connected_liquid_body');
    });

    it('swim_to_connected_liquid_body IS discoverable when actor is NOT submerged', () => {
      const { actor, entities } = setupScenarioWithoutSubmerged();

      testFixture.reset(entities);
      configureActionDiscovery();
      testFixture.testEnv.actionIndex.buildIndex([swimAction]);

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((available) => available.id);

      // Should be discoverable when not submerged
      expect(ids).toContain('liquids:swim_to_connected_liquid_body');
    });
  });

  describe('Submerged state prevents swimming narrative logic', () => {
    it('verifies actor must surface before swimming again', () => {
      // This test documents the game design: when submerged, actor cannot swim
      // to connected liquid bodies. They must first surface (remove submerged component)
      // before they can attempt to swim again.
      const { actor, entities } = setupScenarioWithSubmerged();

      testFixture.reset(entities);
      configureActionDiscovery();
      testFixture.testEnv.actionIndex.buildIndex([swimAction]);

      // Verify submerged component is present
      const submergedComponent = testFixture.testEnv.entityManager.getComponentData(
        actor.id,
        'liquids-states:submerged'
      );
      expect(submergedComponent).toBeDefined();

      // Verify in_liquid_body component is present
      const inLiquidComponent = testFixture.testEnv.entityManager.getComponentData(
        actor.id,
        'liquids-states:in_liquid_body'
      );
      expect(inLiquidComponent).toBeDefined();
      expect(inLiquidComponent.liquid_body_id).toBe('liquid_body_1');

      // Action should be blocked
      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const swimActionAvailable = availableActions.find(
        (a) => a.id === 'liquids:swim_to_connected_liquid_body'
      );
      expect(swimActionAvailable).toBeUndefined();
    });
  });
});
