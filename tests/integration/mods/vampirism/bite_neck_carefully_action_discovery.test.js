/**
 * @file Action discovery tests for vampirism:bite_neck_carefully
 * @description Validates action availability under various component and positioning configurations
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import biteNeckCarefullyAction from '../../../../data/mods/vampirism/actions/bite_neck_carefully.action.json';

const ACTION_ID = 'vampirism:bite_neck_carefully';

describe('vampirism:bite_neck_carefully - Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('vampirism', ACTION_ID);

    // Build action index for discovery
    testFixture.testEnv.actionIndex.buildIndex([biteNeckCarefullyAction]);

    // Register positioning scopes
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

    // Override scope with kneeling checks (matches production .scope file behavior)
    const closeFacingOrBehindResolver =
      ScopeResolverHelpers.createArrayFilterResolver(
        'positioning:close_actors_facing_each_other_or_behind_target',
        {
          getArray: (actor, context, em) => {
            const closeness = em.getComponentData(
              actor.id,
              'positioning:closeness'
            );
            return closeness?.partners || [];
          },
          filterFn: (partnerId, actor, context, em) => {
            // Check kneeling before filters
            const actorKneeling = em.getComponentData(
              actor.id,
              'positioning:kneeling_before'
            );
            if (actorKneeling?.entity_id === partnerId) {
              return false; // Actor kneeling before partner
            }

            const partnerKneeling = em.getComponentData(
              partnerId,
              'positioning:kneeling_before'
            );
            if (partnerKneeling?.entity_id === actor.id) {
              return false; // Partner kneeling before actor
            }

            // Check facing direction
            const actorFacingAway =
              em.getComponentData(actor.id, 'positioning:facing_away')
                ?.facing_away_from || [];
            const partnerFacingAway =
              em.getComponentData(partnerId, 'positioning:facing_away')
                ?.facing_away_from || [];

            const facingEachOther =
              !actorFacingAway.includes(partnerId) &&
              !partnerFacingAway.includes(actor.id);
            const actorBehind = partnerFacingAway.includes(actor.id);

            return facingEachOther || actorBehind;
          },
        }
      );

    ScopeResolverHelpers._registerResolvers(
      testFixture.testEnv,
      testFixture.testEnv.entityManager,
      {
        'positioning:close_actors_facing_each_other_or_behind_target':
          closeFacingOrBehindResolver,
      }
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Positive Discovery Cases', () => {
    it('discovers action when actor is a vampire with closeness and facing target', () => {
      const scenario = testFixture.createStandardActorTarget(['Vampire', 'Victim']);

      // Add vampire marker to actor
      scenario.actor.components['vampirism:is_vampire'] = {};

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const availableActions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('discovers action when vampire actor is behind target', () => {
      const scenario = testFixture.createStandardActorTarget(['Dracula', 'Jonathan']);

      // Add vampire marker and standing_behind component
      scenario.actor.components['vampirism:is_vampire'] = {};
      scenario.actor.components['positioning:standing_behind'] = {
        target_id: scenario.target.id,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const availableActions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });
  });

  describe('Negative Discovery Cases', () => {
    it('does not discover when actor is not a vampire', () => {
      const scenario = testFixture.createStandardActorTarget(['Human', 'Victim']);

      // Actor has closeness but NOT vampirism:is_vampire
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const availableActions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('does not discover when closeness component is missing', () => {
      const scenario = testFixture.createStandardActorTarget(['Vampire', 'Victim']);

      // Remove closeness
      delete scenario.actor.components['positioning:closeness'];
      delete scenario.target.components['positioning:closeness'];

      // Add vampire marker but no closeness
      scenario.actor.components['vampirism:is_vampire'] = {};

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const availableActions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('does not discover when vampire actor already has biting_neck component', () => {
      const scenario = testFixture.createStandardActorTarget(['Vampire', 'Victim']);

      scenario.actor.components['vampirism:is_vampire'] = {};
      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: 'other_entity',
        initiated: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const availableActions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('does not discover when vampire actor has giving_blowjob component', () => {
      const scenario = testFixture.createStandardActorTarget(['Vampire', 'Victim']);

      scenario.actor.components['vampirism:is_vampire'] = {};
      scenario.actor.components['positioning:giving_blowjob'] = {
        target_id: scenario.target.id,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const availableActions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('does not discover when target has being_bitten_in_neck component', () => {
      const scenario = testFixture.createStandardActorTarget(['Vampire', 'Victim']);

      scenario.actor.components['vampirism:is_vampire'] = {};
      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: 'other_vampire',
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const availableActions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('does not discover when vampire actors are not in proximity', () => {
      const actor = testFixture.createEntity({
        id: 'actor1',
        name: 'Dracula',
        components: {
          'core:position': { locationId: 'room1' },
          'vampirism:is_vampire': {},
        },
      });

      const target = testFixture.createEntity({
        id: 'target1',
        name: 'Jonathan',
        components: {
          'core:position': { locationId: 'room2' }, // Different location
        },
      });

      const room1 = ModEntityScenarios.createRoom('room1', 'Vampire Lair');
      const room2 = ModEntityScenarios.createRoom('room2', 'Guest Room');
      testFixture.reset([room1, room2, actor, target]);

      const availableActions = testFixture.testEnv.getAvailableActions(actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('does not discover when vampire actor is kneeling before target', () => {
      const scenario = testFixture.createStandardActorTarget(['Vampire', 'Master']);

      scenario.actor.components['vampirism:is_vampire'] = {};
      scenario.actor.components['positioning:kneeling_before'] = {
        entity_id: scenario.target.id,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const availableActions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('does not discover when target is kneeling before vampire actor', () => {
      const scenario = testFixture.createStandardActorTarget(['Vampire', 'Servant']);

      scenario.actor.components['vampirism:is_vampire'] = {};
      scenario.target.components['positioning:kneeling_before'] = {
        entity_id: scenario.actor.id,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const availableActions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });
  });
});
