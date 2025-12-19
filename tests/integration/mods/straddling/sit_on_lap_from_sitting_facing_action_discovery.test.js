import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import sitOnLapFacingRule from '../../../../data/mods/straddling/rules/handle_sit_on_lap_from_sitting_facing.rule.json' assert { type: 'json' };
import eventIsActionSitOnLapFacing from '../../../../data/mods/straddling/conditions/event-is-action-sit-on-lap-from-sitting-facing.condition.json' assert { type: 'json' };
import sitOnLapFacingAction from '../../../../data/mods/straddling/actions/sit_on_lap_from_sitting_facing.action.json' assert { type: 'json' };
import mouthAvailableCondition from '../../../../data/mods/core/conditions/actor-mouth-available.condition.json' assert { type: 'json' };

describe('sit_on_lap_from_sitting_facing action discovery - Integration Tests', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'straddling',
      'straddling:sit_on_lap_from_sitting_facing',
      sitOnLapFacingRule,
      eventIsActionSitOnLapFacing
    );

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      // Build the action index with the sit_on_lap_from_sitting_facing action
      testEnv.actionIndex.buildIndex([sitOnLapFacingAction]);
    };

    /**
     * Test-specific scope resolver for actors_both_sitting_close.
     */
    const { testEnv } = testFixture;
    const originalResolveSync = testEnv.unifiedScopeResolver.resolveSync;
    testEnv.unifiedScopeResolver.resolveSync = (scopeName, context) => {
      if (scopeName === 'sitting:actors_both_sitting_close') {
        const actorId = context?.actor?.id;
        if (!actorId) {
          return { success: true, value: new Set() };
        }

        const actor = testFixture.entityManager.getEntityInstance(actorId);
        const closeness = actor?.components?.['personal-space-states:closeness'];

        if (!closeness || !Array.isArray(closeness.partners)) {
          return { success: true, value: new Set() };
        }

        // Filter partners where BOTH actor and partner have sitting_on
        const bothSittingPartners = closeness.partners.filter((partnerId) => {
          const partner =
            testFixture.entityManager.getEntityInstance(partnerId);
          const partnerHasSittingOn =
            !!partner?.components?.['sitting-states:sitting_on'];
          const actorHasSittingOn =
            !!actor?.components?.['sitting-states:sitting_on'];
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
      (conditionId) => {
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
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('actor1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'chair2',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair1, chair2, actor, target]);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions('actor1');

      expect(actions).toBeDefined();
      expect(actions.length).toBeGreaterThan(0);
      const sitOnLapAction = actions.find(
        (a) => a.id === 'straddling:sit_on_lap_from_sitting_facing'
      );
      expect(sitOnLapAction).toBeDefined();
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
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'couch1',
          spot_index: 0,
        })
        .build();

      const target1 = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('actor1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'couch1',
          spot_index: 1,
        })
        .build();

      const target2 = new ModEntityBuilder('target2')
        .withName('Charlie')
        .atLocation('room1')
        .closeToEntity('actor1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'couch1',
          spot_index: 2,
        })
        .build();

      testFixture.reset([room, couch, actor, target1, target2]);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions('actor1');

      const sitOnLapAction = actions.find(
        (a) => a.id === 'straddling:sit_on_lap_from_sitting_facing'
      );
      expect(sitOnLapAction).toBeDefined();
      // Note: Exact target verification would require inspecting resolved scope values
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
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair, actor, target]);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions('actor1');

      const sitOnLapAction = actions.find(
        (a) => a.id === 'straddling:sit_on_lap_from_sitting_facing'
      );
      expect(sitOnLapAction).toBeUndefined();
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
        .withComponent('sitting-states:sitting_on', {
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

      const sitOnLapAction = actions.find(
        (a) => a.id === 'straddling:sit_on_lap_from_sitting_facing'
      );
      expect(sitOnLapAction).toBeUndefined();
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
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'chair2',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair1, chair2, actor, target]);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions('actor1');

      const sitOnLapAction = actions.find(
        (a) => a.id === 'straddling:sit_on_lap_from_sitting_facing'
      );
      expect(sitOnLapAction).toBeUndefined();
    });
  });
});
