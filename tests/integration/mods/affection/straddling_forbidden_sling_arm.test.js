/**
 * @file Integration tests verifying sling_arm_around_shoulders action is forbidden when actor is straddling
 * @description Tests anatomical constraint that prevents reaching around shoulders while straddling someone's waist
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import slingArmAction from '../../../../data/mods/affection/actions/sling_arm_around_shoulders.action.json';

const ACTION_ID = 'affection:sling_arm_around_shoulders';

describe('sling_arm_around_shoulders forbidden when straddling - Integration Tests', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('affection', ACTION_ID);

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([slingArmAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__slingArmOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__slingArmOriginalResolve = originalResolve;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (scopeName === 'affection:close_actors_facing_each_other') {
          const actorId = context?.actor?.id;
          if (!actorId) {
            return { success: true, value: new Set() };
          }

          const { entityManager } = testEnv;
          const actorEntity = entityManager.getEntityInstance(actorId);
          if (!actorEntity) {
            return { success: true, value: new Set() };
          }

          const closeness =
            actorEntity.components?.['personal-space-states:closeness']?.partners;
          if (!Array.isArray(closeness) || closeness.length === 0) {
            return { success: true, value: new Set() };
          }

          const actorFacingAway =
            actorEntity.components?.['positioning:facing_away']
              ?.facing_away_from || [];

          const validTargets = closeness.reduce((acc, partnerId) => {
            const partner = entityManager.getEntityInstance(partnerId);
            if (!partner) {
              return acc;
            }

            const partnerFacingAway =
              partner.components?.['positioning:facing_away']
                ?.facing_away_from || [];
            const facingEachOther =
              !actorFacingAway.includes(partnerId) &&
              !partnerFacingAway.includes(actorId);

            if (facingEachOther) {
              acc.add(partnerId);
            }

            return acc;
          }, new Set());

          return { success: true, value: validTargets };
        }

        return originalResolve(scopeName, context);
      };
    };
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Action Discovery - Straddling Constraints', () => {
    it('should NOT be available when actor is straddling target (facing)', () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('personal-space-states:closeness', { partners: ['target1'] })
        .withComponent('positioning:straddling_waist', {
          target_id: 'target1',
          facing_away: false,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('personal-space-states:closeness', { partners: ['actor1'] })
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, actor, target]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor1');
      const actionIds = availableActions.map((action) => action.id);

      expect(actionIds).not.toContain(ACTION_ID);
    });

    it('should NOT be available when actor is straddling target (facing away)', () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('personal-space-states:closeness', { partners: ['target1'] })
        .withComponent('positioning:straddling_waist', {
          target_id: 'target1',
          facing_away: true,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('personal-space-states:closeness', { partners: ['actor1'] })
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, actor, target]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor1');
      const actionIds = availableActions.map((action) => action.id);

      expect(actionIds).not.toContain(ACTION_ID);
    });

    it('should BE available when actor is close but NOT straddling', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
        location: 'room1',
      });

      // Ensure no straddling component exists
      delete scenario.actor.components['positioning:straddling_waist'];

      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      testFixture.reset([room, scenario.actor, scenario.target]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const actionIds = availableActions.map((action) => action.id);

      expect(actionIds).toContain(ACTION_ID);
    });

    it('should BE available when actor was straddling but dismounted', () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      // Actor who was straddling but has dismounted (no straddling component)
      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('personal-space-states:closeness', { partners: ['target1'] })
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('personal-space-states:closeness', { partners: ['actor1'] })
        .build();

      testFixture.reset([room, actor, target]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor1');
      const actionIds = availableActions.map((action) => action.id);

      expect(actionIds).toContain(ACTION_ID);
    });
  });

  describe('Action Execution - Straddling Prevention', () => {
    it('should throw validation error if action somehow attempted while straddling', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('personal-space-states:closeness', { partners: ['target1'] })
        .withComponent('positioning:straddling_waist', {
          target_id: 'target1',
          facing_away: false,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('personal-space-states:closeness', { partners: ['actor1'] })
        .build();

      testFixture.reset([room, actor, target]);

      // Attempt to execute action (should throw validation error)
      await expect(async () => {
        await testFixture.executeAction('actor1', 'target1');
      }).rejects.toThrow(/forbidden component.*positioning:straddling_waist/i);
    });

    it('should succeed when actor is NOT straddling', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
        location: 'room1',
      });

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const successEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );
      expect(successEvent).toBeDefined();
      expect(successEvent.payload.message).toContain('arm');
      expect(successEvent.payload.message).toContain('shoulder');
    });
  });

  describe('Multiple Actor Scenarios', () => {
    it('should NOT be available when actor straddles one of multiple close partners', () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('personal-space-states:closeness', {
          partners: ['target1', 'target2'],
        })
        .withComponent('positioning:straddling_waist', {
          target_id: 'target1',
          facing_away: false,
        })
        .build();

      const target1 = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('personal-space-states:closeness', { partners: ['actor1'] })
        .build();

      const target2 = new ModEntityBuilder('target2')
        .withName('Charlie')
        .atLocation('room1')
        .asActor()
        .withComponent('personal-space-states:closeness', { partners: ['actor1'] })
        .build();

      testFixture.reset([room, actor, target1, target2]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor1');
      const actionIds = availableActions.map((action) => action.id);

      // Action should not be available for ANY target since actor is straddling
      expect(actionIds).not.toContain(ACTION_ID);
    });
  });

  describe('Compatibility with Existing Forbidden Components', () => {
    it('should also be forbidden when actor is kissing', () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('personal-space-states:closeness', { partners: ['target1'] })
        .withComponent('kissing:kissing', { target_id: 'target1' })
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('personal-space-states:closeness', { partners: ['actor1'] })
        .build();

      testFixture.reset([room, actor, target]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor1');
      const actionIds = availableActions.map((action) => action.id);

      expect(actionIds).not.toContain(ACTION_ID);
    });
  });
});
