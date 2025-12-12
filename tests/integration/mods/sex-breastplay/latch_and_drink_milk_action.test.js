/**
 * @file Integration tests for the sex-breastplay:latch_and_drink_milk action execution.
 * @description Validates narration, perceptible event payload, and rule gating for the nursing interaction.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  buildLatchAndDrinkMilkScenario,
  LATCH_AND_DRINK_MILK_ACTION_ID as ACTION_ID,
  LATCH_AND_DRINK_MILK_NARRATION as EXPECTED_MESSAGE,
  installLatchAndDrinkMilkScopeOverride,
} from '../../../common/mods/sex/latchAndDrinkMilkFixtures.js';
import latchAndDrinkMilkAction from '../../../../data/mods/sex-breastplay/actions/latch_and_drink_milk.action.json';

/**
 * @description Registers the latch and drink milk action so execution mirrors engine indexing.
 * @param {ModTestFixture} fixture - Active mod test fixture instance.
 * @returns {void}
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([latchAndDrinkMilkAction]);
}

describe('sex-breastplay:latch_and_drink_milk action integration', () => {
  let testFixture;
  let restoreScopeResolver;
  let scenario;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('sex-breastplay', ACTION_ID);
    restoreScopeResolver = installLatchAndDrinkMilkScopeOverride(testFixture);
    scenario = buildLatchAndDrinkMilkScenario();
    testFixture.reset(scenario.entities);
    configureActionDiscovery(testFixture);
  });

  afterEach(() => {
    if (restoreScopeResolver) {
      restoreScopeResolver();
      restoreScopeResolver = null;
    }

    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  it('narrates the milk drinking beat and ends the turn', async () => {
    await testFixture.executeAction(scenario.actorId, scenario.targetId);

    testFixture.assertActionSuccess(EXPECTED_MESSAGE, {
      shouldEndTurn: true,
      shouldHavePerceptibleEvent: true,
    });
  });

  it('emits the correct perceptible event payload', async () => {
    await testFixture.executeAction(scenario.actorId, scenario.targetId);

    testFixture.assertPerceptibleEvent({
      descriptionText: EXPECTED_MESSAGE,
      locationId: scenario.roomId,
      actorId: scenario.actorId,
      targetId: scenario.targetId,
      perceptionType: 'physical.target_action',
    });
  });

  it('does not trigger the rule for different actions', async () => {
    testFixture.clearEvents();

    await testFixture.eventBus.dispatch('core:attempt_action', {
      actorId: scenario.actorId,
      targetId: scenario.targetId,
      actionId: 'core:wait',
    });

    testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
  });

  it('records the shared narration in the success log', async () => {
    await testFixture.executeAction(scenario.actorId, scenario.targetId);

    const successEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );

    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(EXPECTED_MESSAGE);
  });
});
