/**
 * @file Integration tests for the caressing:fondle_ass action and rule.
 * @description Tests fondle_ass action including straddling constraints
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import fondleAssRule from '../../../../data/mods/caressing/rules/handle_fondle_ass.rule.json';
import eventIsActionFondleAss from '../../../../data/mods/caressing/conditions/event-is-action-fondle-ass.condition.json';
import fondleAssAction from '../../../../data/mods/caressing/actions/fondle_ass.action.json';

const ACTION_ID = 'caressing:fondle_ass';

describe('caressing:fondle_ass action integration', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'caressing',
      ACTION_ID,
      fondleAssRule,
      eventIsActionFondleAss
    );

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([fondleAssAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__fondleAssOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__fondleAssOriginalResolve = originalResolve;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (
          scopeName ===
          'caressing-states:actors_with_ass_cheeks_facing_each_other_or_behind_target'
        ) {
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
            actorEntity.components?.['facing-states:facing_away']
              ?.facing_away_from || [];

          const validTargets = closeness.reduce((acc, partnerId) => {
            const partner = entityManager.getEntityInstance(partnerId);
            if (!partner) {
              return acc;
            }

            // Check if partner has ass cheeks
            const hasAssAnatomy = partner.components?.[
              'anatomy:body_part_graph'
            ]?.parts?.some((part) => part.type === 'ass_cheek');
            if (!hasAssAnatomy) {
              return acc;
            }

            const partnerFacingAway =
              partner.components?.['facing-states:facing_away']
                ?.facing_away_from || [];
            const facingEachOther =
              !actorFacingAway.includes(partnerId) &&
              !partnerFacingAway.includes(actorId);
            const actorBehind = partnerFacingAway.includes(actorId);

            if (facingEachOther || actorBehind) {
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

  describe('Basic Execution', () => {
    it('successfully executes fondle ass action', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
        location: 'room1',
      });

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const successEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );
      expect(successEvent).toBeDefined();
    });

    it('validates perceptible event message matches action success message', async () => {
      const scenario = testFixture.createCloseActors(['Diana', 'Victor'], {
        location: 'library',
      });

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const successEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );
      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(successEvent).toBeDefined();
      expect(perceptibleEvent).toBeDefined();
      expect(successEvent.payload.message).toBe(
        perceptibleEvent.payload.descriptionText
      );
    });
  });

  describe('Straddling Constraints - Action Discovery', () => {
    it('should NOT be available when actor is straddling sitting target (facing)', () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const chair = new ModEntityBuilder('chair1')
        .withName('Chair')
        .atLocation('room1')
        .withComponent('furniture:seating', { seat_count: 1 })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('personal-space-states:closeness', { partners: ['target1'] })
        .withComponent('straddling-states:straddling_waist', {
          target_id: 'target1',
          facing_away: false,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('personal-space-states:closeness', { partners: ['actor1'] })
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .withComponent('anatomy:body_part_graph', {
          parts: [{ id: 'left_ass_cheek', type: 'ass_cheek' }],
        })
        .build();

      testFixture.reset([room, chair, actor, target]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor1');
      const actionIds = availableActions.map((action) => action.id);

      expect(actionIds).not.toContain(ACTION_ID);
    });

    it('should NOT be available when actor is straddling sitting target (facing away)', () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const chair = new ModEntityBuilder('chair1')
        .withName('Chair')
        .atLocation('room1')
        .withComponent('furniture:seating', { seat_count: 1 })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('personal-space-states:closeness', { partners: ['target1'] })
        .withComponent('straddling-states:straddling_waist', {
          target_id: 'target1',
          facing_away: true,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('personal-space-states:closeness', { partners: ['actor1'] })
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .withComponent('anatomy:body_part_graph', {
          parts: [{ id: 'left_ass_cheek', type: 'ass_cheek' }],
        })
        .build();

      testFixture.reset([room, chair, actor, target]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor1');
      const actionIds = availableActions.map((action) => action.id);

      expect(actionIds).not.toContain(ACTION_ID);
    });

    it('should succeed when actor is close but NOT straddling', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
        location: 'room1',
      });

      // Ensure no straddling component exists
      delete scenario.actor.components['straddling-states:straddling_waist'];

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const successEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );
      expect(successEvent).toBeDefined();
    });

    it('should succeed when actor was straddling but dismounted', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
        location: 'room1',
      });

      // Simulate that actor was straddling but has now dismounted
      // (no straddling component present)
      delete scenario.actor.components['straddling-states:straddling_waist'];

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const successEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );
      expect(successEvent).toBeDefined();
    });
  });

  describe('Straddling Constraints - Action Execution', () => {
    it('should throw validation error if action somehow attempted while straddling', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const chair = new ModEntityBuilder('chair1')
        .withName('Chair')
        .atLocation('room1')
        .withComponent('furniture:seating', { seat_count: 1 })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('personal-space-states:closeness', { partners: ['target1'] })
        .withComponent('straddling-states:straddling_waist', {
          target_id: 'target1',
          facing_away: false,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('personal-space-states:closeness', { partners: ['actor1'] })
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair, actor, target]);

      // Attempt to execute action (should throw validation error)
      await expect(async () => {
        await testFixture.executeAction('actor1', 'target1');
      }).rejects.toThrow(/forbidden component.*straddling-states:straddling_waist/i);
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
    });
  });

  describe('Multiple Actor Scenarios', () => {
    it('should NOT be available when actor straddles one of multiple close partners', () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const chair = new ModEntityBuilder('chair1')
        .withName('Chair')
        .atLocation('room1')
        .withComponent('furniture:seating', { seat_count: 1 })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('personal-space-states:closeness', {
          partners: ['target1', 'target2'],
        })
        .withComponent('straddling-states:straddling_waist', {
          target_id: 'target1',
          facing_away: false,
        })
        .build();

      const target1 = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('personal-space-states:closeness', { partners: ['actor1'] })
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .withComponent('anatomy:body_part_graph', {
          parts: [{ id: 'left_ass_cheek', type: 'ass_cheek' }],
        })
        .build();

      const target2 = new ModEntityBuilder('target2')
        .withName('Charlie')
        .atLocation('room1')
        .asActor()
        .withComponent('personal-space-states:closeness', { partners: ['actor1'] })
        .withComponent('anatomy:body_part_graph', {
          parts: [{ id: 'left_ass_cheek', type: 'ass_cheek' }],
        })
        .build();

      testFixture.reset([room, chair, actor, target1, target2]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor1');
      const actionIds = availableActions.map((action) => action.id);

      // Action should not be available for ANY target since actor is straddling
      expect(actionIds).not.toContain(ACTION_ID);
    });
  });
});
