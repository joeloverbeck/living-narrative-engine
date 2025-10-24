import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import liftOntoLapRule from '../../../../data/mods/positioning/rules/handle_lift_onto_lap_facing_away.rule.json' assert { type: 'json' };
import eventIsActionLiftOntoLap from '../../../../data/mods/positioning/conditions/event-is-action-lift-onto-lap-facing-away.condition.json' assert { type: 'json' };
import liftOntoLapAction from '../../../../data/mods/positioning/actions/lift_onto_lap_facing_away.action.json' assert { type: 'json' };
import mouthAvailableCondition from '../../../../data/mods/core/conditions/actor-mouth-available.condition.json' assert { type: 'json' };

describe('lift_onto_lap_facing_away action discovery - Integration Tests', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:lift_onto_lap_facing_away',
      liftOntoLapRule,
      eventIsActionLiftOntoLap
    );

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) return;

      // Build action index
      testEnv.actionIndex.buildIndex([liftOntoLapAction]);
    };

    // Set up scope resolver for actors_both_sitting_close
    const { testEnv } = testFixture;
    const originalResolveSync = testEnv.unifiedScopeResolver.resolveSync;
    testEnv.unifiedScopeResolver.resolveSync = (scopeName, context) => {
      if (scopeName === 'positioning:actors_both_sitting_close') {
        const actorId = context?.actor?.id;
        if (!actorId) return { success: true, value: new Set() };

        const actor = testFixture.entityManager.getEntityInstance(actorId);
        const closeness = actor?.components?.['positioning:closeness'];

        if (!closeness || !Array.isArray(closeness.partners)) {
          return { success: true, value: new Set() };
        }

        // Filter partners where BOTH have sitting_on
        const bothSittingPartners = closeness.partners.filter(partnerId => {
          const partner = testFixture.entityManager.getEntityInstance(partnerId);
          return (
            !!partner?.components?.['positioning:sitting_on'] &&
            !!actor?.components?.['positioning:sitting_on']
          );
        });

        return { success: true, value: new Set(bothSittingPartners) };
      }

      return originalResolveSync.call(
        testEnv.unifiedScopeResolver,
        scopeName,
        context
      );
    };

    // Mock condition retrieval
    const originalGetCondition =
      testEnv.dataRegistry.getConditionDefinition.getMockImplementation?.();
    testEnv.dataRegistry.getConditionDefinition.mockImplementation(
      conditionId => {
        if (conditionId === 'core:actor-mouth-available') {
          return mouthAvailableCondition;
        }
        return originalGetCondition
          ? originalGetCondition(conditionId)
          : undefined;
      }
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Valid Discovery Scenarios', () => {
    it('should discover action when both actor and target are sitting and close', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const chair1 = new ModEntityBuilder('chair1')
        .withName('Chair 1')
        .atLocation('room1')
        .build();

      const chair2 = new ModEntityBuilder('chair2')
        .withName('Chair 2')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .closeToEntity('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair2',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair1, chair2, actor, target]);

      configureActionDiscovery();

      const actions = await testFixture.discoverActions('actor1');

      const liftAction = actions.find(
        a => a.id === 'positioning:lift_onto_lap_facing_away'
      );

      expect(liftAction).toBeDefined();
    });

    it('should discover action with multiple sitting close targets', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const chair1 = new ModEntityBuilder('chair1')
        .withName('Chair 1')
        .atLocation('room1')
        .build();

      const chair2 = new ModEntityBuilder('chair2')
        .withName('Chair 2')
        .atLocation('room1')
        .build();

      const chair3 = new ModEntityBuilder('chair3')
        .withName('Chair 3')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .closeToEntity('target2')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      const target1 = new ModEntityBuilder('target1')
        .closeToEntity('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair2',
          spot_index: 0,
        })
        .build();

      const target2 = new ModEntityBuilder('target2')
        .closeToEntity('actor1')
        .withName('Charlie')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair3',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair1, chair2, chair3, actor, target1, target2]);

      configureActionDiscovery();

      const actions = await testFixture.discoverActions('actor1');

      const liftAction = actions.find(
        a => a.id === 'positioning:lift_onto_lap_facing_away'
      );

      expect(liftAction).toBeDefined();
    });

    it('should discover action when both on same furniture', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const couch = new ModEntityBuilder('couch1')
        .withName('Couch')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'couch1',
          spot_index: 0,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .closeToEntity('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'couch1',
          spot_index: 1,
        })
        .build();

      testFixture.reset([room, couch, actor, target]);

      configureActionDiscovery();

      const actions = await testFixture.discoverActions('actor1');

      const liftAction = actions.find(
        a => a.id === 'positioning:lift_onto_lap_facing_away'
      );

      expect(liftAction).toBeDefined();
    });
  });

  describe('Invalid Discovery Scenarios', () => {
    it('should NOT discover action when actor is standing', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const chair = new ModEntityBuilder('chair1')
        .withName('Chair')
        .atLocation('room1')
        .build();

      // Actor is standing (no sitting_on component)
      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .build();

      const target = new ModEntityBuilder('target1')
        .closeToEntity('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair, actor, target]);

      configureActionDiscovery();

      const actions = await testFixture.discoverActions('actor1');

      const liftAction = actions.find(
        a => a.id === 'positioning:lift_onto_lap_facing_away'
      );

      expect(liftAction).toBeUndefined();
    });

    it('should NOT discover action when target is standing', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const chair = new ModEntityBuilder('chair1')
        .withName('Chair')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      // Target is standing (no sitting_on component)
      const target = new ModEntityBuilder('target1')
        .closeToEntity('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .build();

      testFixture.reset([room, chair, actor, target]);

      configureActionDiscovery();

      const actions = await testFixture.discoverActions('actor1');

      const liftAction = actions.find(
        a => a.id === 'positioning:lift_onto_lap_facing_away'
      );

      expect(liftAction).toBeUndefined();
    });

    it('should NOT discover action when actors are not close', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const chair1 = new ModEntityBuilder('chair1')
        .withName('Chair 1')
        .atLocation('room1')
        .build();

      const chair2 = new ModEntityBuilder('chair2')
        .withName('Chair 2')
        .atLocation('room1')
        .build();

      // No closeness between actor and target
      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair2',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair1, chair2, actor, target]);

      configureActionDiscovery();

      const actions = await testFixture.discoverActions('actor1');

      const liftAction = actions.find(
        a => a.id === 'positioning:lift_onto_lap_facing_away'
      );

      expect(liftAction).toBeUndefined();
    });

    it('should NOT discover action when target is already straddling', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const chair1 = new ModEntityBuilder('chair1')
        .withName('Chair 1')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      // Target is already straddling someone else (forbidden component)
      const target = new ModEntityBuilder('target1')
        .closeToEntity('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 1,
        })
        .withComponent('positioning:straddling_waist', {
          target_id: 'other_actor',
          facing_away: false,
        })
        .build();

      testFixture.reset([room, chair1, actor, target]);

      configureActionDiscovery();

      const actions = await testFixture.discoverActions('actor1');

      const liftAction = actions.find(
        a => a.id === 'positioning:lift_onto_lap_facing_away'
      );

      expect(liftAction).toBeUndefined();
    });

    it('should discover action when actor is being straddled by someone else', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const chair1 = new ModEntityBuilder('chair1')
        .withName('Chair 1')
        .atLocation('room1')
        .build();

      const chair2 = new ModEntityBuilder('chair2')
        .withName('Chair 2')
        .atLocation('room1')
        .build();

      // Actor is being straddled (valid scenario - no forbidden component on actor)
      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .closeToEntity('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair2',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair1, chair2, actor, target]);

      configureActionDiscovery();

      const actions = await testFixture.discoverActions('actor1');

      const liftAction = actions.find(
        a => a.id === 'positioning:lift_onto_lap_facing_away'
      );

      // Actor being straddled should still be able to lift someone else
      expect(liftAction).toBeDefined();
    });
  });
});
