import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import sitOnLapFacingAwayRule from '../../../../data/mods/positioning/rules/handle_sit_on_lap_from_sitting_facing_away.rule.json' assert { type: 'json' };
import eventIsActionSitOnLapFacingAway from '../../../../data/mods/positioning/conditions/event-is-action-sit-on-lap-from-sitting-facing-away.condition.json' assert { type: 'json' };
import sitOnLapFacingAwayAction from '../../../../data/mods/positioning/actions/sit_on_lap_from_sitting_facing_away.action.json' assert { type: 'json' };
import actorMouthAvailableCondition from '../../../../data/mods/core/conditions/actor-mouth-available.condition.json' assert { type: 'json' };

/**
 * @description Creates anatomy entities and body component data for an actor with an available mouth.
 * @param {string} actorId - Identifier of the actor entity.
 * @param {string} locationId - Identifier of the location containing the anatomy entities.
 * @returns {{bodyEntity: object, mouthEntity: object, bodyComponent: object}} Anatomy entities and component data.
 */
function createActorMouthAnatomy(actorId, locationId) {
  const bodyId = `${actorId}_body`;
  const mouthId = `${actorId}_mouth`;

  const bodyEntity = new ModEntityBuilder(bodyId)
    .asBodyPart({
      parent: null,
      children: [mouthId],
      subType: 'torso',
    })
    .atLocation(locationId)
    .build();

  const mouthEntity = new ModEntityBuilder(mouthId)
    .asBodyPart({
      parent: bodyId,
      children: [],
      subType: 'mouth',
    })
    .withComponent('core:mouth_engagement', {
      locked: false,
      forcedOverride: false,
    })
    .atLocation(locationId)
    .build();

  return {
    bodyEntity,
    mouthEntity,
    bodyComponent: {
      body: {
        root: bodyId,
        parts: {
          mouth: mouthId,
        },
      },
    },
  };
}

describe('sit_on_lap_from_sitting_facing_away action discovery - Integration Tests', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_on_lap_from_sitting_facing_away',
      sitOnLapFacingAwayRule,
      eventIsActionSitOnLapFacingAway
    );

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      // Build the action index with the sit_on_lap_from_sitting_facing_away action
      testEnv.actionIndex.buildIndex([sitOnLapFacingAwayAction]);
    };

    const conditionLookup = {
      'positioning:event-is-action-sit-on-lap-from-sitting-facing-away':
        eventIsActionSitOnLapFacingAway,
      [eventIsActionSitOnLapFacingAway.id]: eventIsActionSitOnLapFacingAway,
      'core:actor-mouth-available': actorMouthAvailableCondition,
    };

    const conditionDefinitionMock =
      testFixture.testEnv.dataRegistry.getConditionDefinition;
    if (conditionDefinitionMock && conditionDefinitionMock.mock) {
      conditionDefinitionMock.mockImplementation((conditionId) => {
        if (conditionLookup[conditionId]) {
          return conditionLookup[conditionId];
        }
        return undefined;
      });
    }

    /**
     * Test-specific scope resolver for actors_both_sitting_close.
     *
     * NOTE: ModTestFixture.forAction doesn't load scope definition files (.scope files).
     * This resolver implements the logic from:
     * data/mods/positioning/scopes/actors_both_sitting_close.scope
     *
     * Scope DSL:
     *   positioning:actors_both_sitting_close := actor.components.positioning:closeness.partners[][{
     *     "and": [
     *       {"!!": {"var": "entity.components.positioning:sitting_on"}},
     *       {"!!": {"var": "actor.components.positioning:sitting_on"}}
     *     ]
     *   }]
     *
     * Translation: Filter the actor's closeness partners to only those where BOTH
     * the actor AND the partner have the sitting_on component.
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
        const bothSittingPartners = closeness.partners.filter((partnerId) => {
          const partner =
            testFixture.entityManager.getEntityInstance(partnerId);
          const partnerHasSittingOn =
            !!partner?.components?.['positioning:sitting_on'];
          const actorHasSittingOn =
            !!actor?.components?.['positioning:sitting_on'];
          return partnerHasSittingOn && actorHasSittingOn;
        });

        return { success: true, value: new Set(bothSittingPartners) };
      }

      // Fall back to original resolution for other scopes
      return originalResolveSync.call(
        testEnv.unifiedScopeResolver,
        scopeName,
        context
      );
    };
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Valid Discovery Scenarios', () => {
    it('should discover action when both actor and target are sitting and close', async () => {
      // Setup: Actor sitting, target sitting, both close
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const chair1 = new ModEntityBuilder('chair1')
        .withName('Chair 1')
        .atLocation('room1')
        .build();

      const chair2 = new ModEntityBuilder('chair2')
        .withName('Chair 2')
        .atLocation('room1')
        .build();

      const actorAnatomy = createActorMouthAnatomy('actor1', 'room1');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .withComponent('anatomy:body', actorAnatomy.bodyComponent)
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

      testFixture.reset([
        room,
        chair1,
        chair2,
        actor,
        target,
        actorAnatomy.bodyEntity,
        actorAnatomy.mouthEntity,
      ]);
      configureActionDiscovery();

      // Execute: Get available actions
      const actions = await testFixture.discoverActions('actor1');

      // Assert: Action is discovered
      expect(actions).toBeDefined();
      expect(actions.length).toBeGreaterThan(0);
      const sitOnLapAction = actions.find(
        (a) => a.id === 'positioning:sit_on_lap_from_sitting_facing_away'
      );
      expect(sitOnLapAction).toBeDefined();
    });

    it('should discover action when multiple sitting close targets exist', async () => {
      // Setup: Actor sitting, multiple sitting close targets
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const couch = new ModEntityBuilder('couch1')
        .withName('Couch')
        .atLocation('room1')
        .build();

      const actorAnatomy = createActorMouthAnatomy('actor1', 'room1');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .closeToEntity('target2')
        .asActor()
        .withComponent('anatomy:body', actorAnatomy.bodyComponent)
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

      testFixture.reset([
        room,
        couch,
        actor,
        target1,
        target2,
        actorAnatomy.bodyEntity,
        actorAnatomy.mouthEntity,
      ]);
      configureActionDiscovery();

      // Execute: Get available actions
      const actions = await testFixture.discoverActions('actor1');

      // Assert: Action is available (both target1 and target2 should be in scope)
      const sitOnLapAction = actions.find(
        (a) => a.id === 'positioning:sit_on_lap_from_sitting_facing_away'
      );
      expect(sitOnLapAction).toBeDefined();
      // Note: Exact target verification would require inspecting resolved scope values
    });
  });

  describe('Invalid Discovery Scenarios', () => {
    it('should NOT discover action when actor is standing', async () => {
      // Setup: Actor standing (no sitting_on), target sitting and close
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

      // Execute: Get available actions
      const actions = await testFixture.discoverActions('actor1');

      // Assert: Action does NOT appear
      const sitOnLapAction = actions.find(
        (a) => a.id === 'positioning:sit_on_lap_from_sitting_facing_away'
      );
      expect(sitOnLapAction).toBeUndefined();
    });

    it('should NOT discover action when target is standing', async () => {
      // Setup: Actor sitting, target standing (no sitting_on)
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

      // Execute: Get available actions
      const actions = await testFixture.discoverActions('actor1');

      // Assert: Action does NOT appear
      const sitOnLapAction = actions.find(
        (a) => a.id === 'positioning:sit_on_lap_from_sitting_facing_away'
      );
      expect(sitOnLapAction).toBeUndefined();
    });

    it('should NOT discover action when actors are not close', async () => {
      // Setup: Actor sitting, target sitting, NOT close (no closeness relationship)
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

      // Execute: Get available actions
      const actions = await testFixture.discoverActions('actor1');

      // Assert: Action does NOT appear
      const sitOnLapAction = actions.find(
        (a) => a.id === 'positioning:sit_on_lap_from_sitting_facing_away'
      );
      expect(sitOnLapAction).toBeUndefined();
    });
  });
});
