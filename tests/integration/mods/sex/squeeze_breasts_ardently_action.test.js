/**
 * @file Integration tests for the sex-breastplay:squeeze_breasts_ardently action and rule.
 * @description Validates narration, perceptible event payload, and turn resolution for ardent breast squeezing.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import {
  SQUEEZE_BREASTS_ARDENTLY_ACTION_ID as ACTION_ID,
  SQUEEZE_BREASTS_ARDENTLY_ACTOR_ID as ACTOR_ID,
  SQUEEZE_BREASTS_ARDENTLY_TARGET_ID as TARGET_ID,
  buildSqueezeBreastsArdentlyScenario,
  installSqueezeBreastsArdentlyScopeOverride,
} from '../../../common/mods/sex/squeezeBreastsArdentlyFixtures.js';
import squeezeBreastsArdentlyAction from '../../../../data/mods/sex-breastplay/actions/squeeze_breasts_ardently.action.json';

const EXPECTED_MESSAGE =
  "Liora grabs Nerine's breasts and squeezes them ardently, feeling their flesh against the palms and fingers.";

/**
 * @description Registers the squeeze breasts ardently action with the action index.
 * @param {ModTestFixture} fixture - Active mod test fixture instance.
 * @returns {void}
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([squeezeBreastsArdentlyAction]);
}

describe('sex-breastplay:squeeze_breasts_ardently action integration', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad(
      'sex-breastplay',
      ACTION_ID,
      {
        autoRegisterScopes: true,
        scopeCategories: ['positioning', 'anatomy'],
      }
    );

    restoreScopeResolver =
      installSqueezeBreastsArdentlyScopeOverride(testFixture);
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

  it('dispatches the ardent breast squeezing narration and perceptible event', async () => {
    const { entities, actorId, targetId, roomId } =
      buildSqueezeBreastsArdentlyScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    await testFixture.executeAction(actorId, targetId);

    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      EXPECTED_MESSAGE,
      {
        shouldEndTurn: true,
        shouldHavePerceptibleEvent: true,
      }
    );

    ModAssertionHelpers.assertPerceptibleEvent(testFixture.events, {
      descriptionText: EXPECTED_MESSAGE,
      locationId: roomId,
      actorId: actorId,
      targetId: targetId,
      perceptionType: 'physical.target_action',
    });
  });

  it('does not fire the rule for a different action', async () => {
    const entities = [
      new ModEntityBuilder('room1').asRoom('Test Room').build(),
      new ModEntityBuilder(ACTOR_ID)
        .withName('Liora')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .build(),
    ];

    testFixture.reset(entities);

    const initialEventCount = testFixture.events.length;

    await testFixture.eventBus.dispatch('core:attempt_action', {
      actionId: 'core:wait',
      actorId: ACTOR_ID,
    });

    const newEventCount = testFixture.events.length;
    expect(newEventCount).toBe(initialEventCount + 1);
  });

  it('handles missing target gracefully', async () => {
    const entities = [
      new ModEntityBuilder('room1').asRoom('Room').build(),
      new ModEntityBuilder(ACTOR_ID)
        .withName('Liora')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .build(),
    ];

    testFixture.reset(entities);

    await expect(async () => {
      await testFixture.eventBus.dispatch('core:attempt_action', {
        actionId: ACTION_ID,
        actorId: ACTOR_ID,
        targetId: TARGET_ID,
      });
    }).not.toThrow();

    const eventTypes = testFixture.events.map((event) => event.eventType);
    expect(eventTypes).toEqual(['core:attempt_action']);
  });
});
