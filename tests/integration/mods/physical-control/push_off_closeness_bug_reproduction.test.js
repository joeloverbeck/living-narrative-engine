/**
 * @file Reproduction tests for push_off closeness bug.
 * @description These tests document and reproduce the bug where pushing an actor
 * leaves the acting actor with an orphaned empty closeness component.
 *
 * **Expected Behavior After Fix**:
 * - When actor pushes their only partner, both should have NO closeness component
 * - When actor pushes one of multiple partners, actor keeps closeness with remaining partners
 * - Both actors should be able to use get_close immediately after push (if no other partners)
 *
 * **Current Bug** (before fix):
 * - Actor left with {partners: []} after pushing only partner
 * - Actor cannot use get_close (blocked by forbidden_components)
 * - Actor can use step_back (has closeness component, even if empty)
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import pushOffRule from '../../../../data/mods/physical-control/rules/handle_push_off.rule.json';
import eventIsActionPushOff from '../../../../data/mods/physical-control/conditions/event-is-action-push-off.condition.json';

describe('Push Off Closeness Bug Reproduction', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'physical-control',
      'physical-control:push_off',
      pushOffRule,
      eventIsActionPushOff
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Bug: Orphaned Empty Closeness Component', () => {
    it('FIXED: correctly removes closeness component when pushing only partner', async () => {
      // Setup: Actor A and B in closeness (only partners)
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Verify initial state
      const actorBefore = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      const targetBefore = testFixture.entityManager.getEntityInstance(
        scenario.target.id
      );
      expect(actorBefore.components['positioning:closeness'].partners).toEqual([
        scenario.target.id,
      ]);
      expect(targetBefore.components['positioning:closeness'].partners).toEqual(
        [scenario.actor.id]
      );

      // Execute: A pushes B
      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      // FIXED BEHAVIOR: Actor has NO closeness component (removed because no remaining partners)
      const actorAfter = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      const targetAfter = testFixture.entityManager.getEntityInstance(
        scenario.target.id
      );

      // Both should have no closeness component
      expect(actorAfter.components['positioning:closeness']).toBeUndefined();
      expect(targetAfter.components['positioning:closeness']).toBeUndefined();
    });

    it('FIXED: step_back not available after removing closeness', async () => {
      // Setup: Actor A and B in closeness (only partners)
      const scenario = testFixture.createCloseActors(['Maya', 'Noah']);

      // Execute: A pushes B
      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      // Verify closeness component is removed
      const actorAfter = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      expect(actorAfter.components['positioning:closeness']).toBeUndefined();

      // FIXED: step_back should not be available because closeness component
      // is removed when partners array becomes empty
      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      expect(availableActions).not.toContain('positioning:step_back');
    });
  });

  describe('Impact on Action Discovery', () => {
    it('FIXED: closeness component removed allows get_close (component-level verification)', async () => {
      // Setup: Actor A and B in closeness (only partners)
      const scenario = testFixture.createCloseActors(['Ivy', 'Liam']);

      // Execute: A pushes B
      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      // Verify closeness component is removed
      const actorAfter = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      expect(actorAfter.components['positioning:closeness']).toBeUndefined();

      // Component-level verification: No closeness component means get_close
      // would be available (if positioning mod was loaded)
      // The get_close action has forbidden_components: ["positioning:closeness"]
      // so removing this component unblocks the action
    });
  });

  describe('Correct Behavior: Multi-Partner Scenarios', () => {
    it('CORRECT: preserves actor closeness with remaining partners', async () => {
      // Setup: Actor A close to B and C
      const { ModEntityBuilder } = await import(
        '../../../common/mods/ModEntityBuilder.js'
      );

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .build();
      const target = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .build();
      const partner = new ModEntityBuilder('partner1')
        .withName('Charlie')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .build();

      // Set up actor with closeness to both target and partner
      actor.components['positioning:closeness'] = {
        partners: [target.id, partner.id],
      };
      target.components['positioning:closeness'] = {
        partners: [actor.id],
      };
      partner.components['positioning:closeness'] = {
        partners: [actor.id],
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, actor, target, partner]);

      // Execute: A pushes B
      await testFixture.executeAction(actor.id, target.id);

      // CORRECT: Actor still has closeness with partner C
      const actorAfter = testFixture.entityManager.getEntityInstance(actor.id);
      expect(actorAfter.components['positioning:closeness']).toBeDefined();
      expect(actorAfter.components['positioning:closeness'].partners).toEqual([
        partner.id,
      ]);

      // Target has no closeness (pushed away)
      const targetAfter = testFixture.entityManager.getEntityInstance(
        target.id
      );
      expect(targetAfter.components['positioning:closeness']).toBeUndefined();

      // Partner unchanged
      const partnerAfter = testFixture.entityManager.getEntityInstance(
        partner.id
      );
      expect(partnerAfter.components['positioning:closeness']).toBeDefined();
      expect(
        partnerAfter.components['positioning:closeness'].partners
      ).toEqual([actor.id]);

      // This test should PASS - it documents correct behavior that must be preserved
    });
  });

});
