import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import liftOntoLapRule from '../../../../data/mods/positioning/rules/handle_lift_onto_lap_face_to_face.rule.json' assert { type: 'json' };
import eventIsActionLiftOntoLap from '../../../../data/mods/positioning/conditions/event-is-action-lift-onto-lap-face-to-face.condition.json' assert { type: 'json' };
import liftOntoLapAction from '../../../../data/mods/positioning/actions/lift_onto_lap_face_to_face.action.json' assert { type: 'json' };
import mouthAvailableCondition from '../../../../data/mods/core/conditions/actor-mouth-available.condition.json' assert { type: 'json' };

describe('lift_onto_lap_face_to_face action discovery - Integration Tests', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:lift_onto_lap_face_to_face',
      liftOntoLapRule,
      eventIsActionLiftOntoLap
    );

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      // Build the action index with the lift_onto_lap_face_to_face action
      testEnv.actionIndex.buildIndex([liftOntoLapAction]);
    };

    /**
     * Test-specific scope resolver for actors_both_sitting_close.
     */
    const { testEnv } = testFixture;
    const originalResolveSync = testEnv.unifiedScopeResolver.resolveSync;
    testEnv.unifiedScopeResolver.resolveSync = (scopeName, context) => {
      if (scopeName === 'positioning:actors_both_sitting_close') {
        const actorId = context?.actor?.id;
        if (!actorId) {
          return { success: true, value: new Set() };
        }

        const actor = testFixture.entityManager.getEntityInstance(actorId);
        const closeness = actor?.components?.['positioning:closeness'];

        if (!closeness || !Array.isArray(closeness.partners)) {
          return { success: true, value: new Set() };
        }

        // Filter partners where BOTH actor and partner have sitting_on
        const bothSittingPartners = closeness.partners.filter(partnerId => {
          const partner = testFixture.entityManager.getEntityInstance(partnerId);
          const partnerHasSittingOn =
            !!partner?.components?.['positioning:sitting_on'];
          const actorHasSittingOn =
            !!actor?.components?.['positioning:sitting_on'];
          return partnerHasSittingOn && actorHasSittingOn;
        });

        return { success: true, value: new Set(bothSittingPartners) };
      }

      return originalResolveSync.call(
        testEnv.unifiedScopeResolver,
        scopeName,
        context
      );
    };

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
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('actor1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair2',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair1, chair2, actor, target]);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions('actor1');

      expect(actions).toBeDefined();
      expect(actions.length).toBeGreaterThan(0);
      const liftAction = actions.find(
        a => a.id === 'positioning:lift_onto_lap_face_to_face'
      );
      expect(liftAction).toBeDefined();
    });

    it('should discover action when multiple sitting close targets exist', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const couch = new ModEntityBuilder('couch1')
        .withName('Couch')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .closeToEntity('target2')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'couch1',
          spot_index: 0,
        })
        .build();

      const target1 = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('actor1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'couch1',
          spot_index: 1,
        })
        .build();

      const target2 = new ModEntityBuilder('target2')
        .withName('Charlie')
        .atLocation('room1')
        .closeToEntity('actor1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'couch1',
          spot_index: 2,
        })
        .build();

      testFixture.reset([room, couch, actor, target1, target2]);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions('actor1');

      const liftAction = actions.find(
        a => a.id === 'positioning:lift_onto_lap_face_to_face'
      );
      expect(liftAction).toBeDefined();
    });

    it('should discover action when both are on same furniture', async () => {
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
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('actor1')
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
        a => a.id === 'positioning:lift_onto_lap_face_to_face'
      );
      expect(liftAction).toBeDefined();
    });

    it('should discover action even when actor is already being straddled', async () => {
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
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('actor1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair2',
          spot_index: 0,
        })
        .build();

      // Someone else is straddling the actor - actor can still lift others
      const straddler = new ModEntityBuilder('straddler1')
        .withName('Straddler')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:straddling_waist', {
          target_id: 'actor1',
          facing_away: false,
        })
        .build();

      testFixture.reset([room, chair1, chair2, actor, target, straddler]);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions('actor1');

      const liftAction = actions.find(
        a => a.id === 'positioning:lift_onto_lap_face_to_face'
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

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('actor1')
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
        a => a.id === 'positioning:lift_onto_lap_face_to_face'
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

      const target = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('actor1')
        .asActor()
        .build();

      testFixture.reset([room, chair, actor, target]);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions('actor1');

      const liftAction = actions.find(
        a => a.id === 'positioning:lift_onto_lap_face_to_face'
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
        a => a.id === 'positioning:lift_onto_lap_face_to_face'
      );
      expect(liftAction).toBeUndefined();
    });

    it('should NOT discover action when target is already straddling (forbidden component)', async () => {
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

      // Target is already straddling someone else's lap
      const target = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('actor1')
        .asActor()
        .withComponent('positioning:straddling_waist', {
          target_id: 'chair2',
          facing_away: false,
        })
        .build();

      testFixture.reset([room, chair1, chair2, actor, target]);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions('actor1');

      const liftAction = actions.find(
        a => a.id === 'positioning:lift_onto_lap_face_to_face'
      );
      expect(liftAction).toBeUndefined();
    });
  });
});
