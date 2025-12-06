/**
 * @file Integration tests for the sex-breastplay:suck_on_nipples action and rule.
 * @description Validates narration, perceptible event payload, and rule gating for nipple sucking.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import {
  buildNuzzleBareBreastsScenario as buildSuckOnNipplesScenario,
  installBareBreastsScopeOverride,
  NUZZLE_BARE_BREASTS_ACTION_ID as NUZZLE_ACTION_ID,
  NUZZLE_BARE_BREASTS_ACTOR_ID as BASE_ACTOR_ID,
  NUZZLE_BARE_BREASTS_TARGET_ID as BASE_TARGET_ID,
} from '../../../common/mods/sex/nuzzleBareBreastsFixtures.js';
import suckOnNipplesAction from '../../../../data/mods/sex-breastplay/actions/suck_on_nipples.action.json';

const ACTION_ID = 'sex-breastplay:suck_on_nipples';
const ACTOR_ID = BASE_ACTOR_ID;
const TARGET_ID = BASE_TARGET_ID;
const EXPECTED_MESSAGE =
  "Selene sucks eagerly on Mira's hard nipples, Selene's tongue swirling around the sensitive, hardened flesh.";

/**
 * @description Registers the suck on nipples action with the action index for execution.
 * @param {ModTestFixture} fixture - Active mod test fixture instance.
 * @returns {void}
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([suckOnNipplesAction]);
}

describe('sex-breastplay:suck_on_nipples action integration', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad(
      'sex-breastplay',
      ACTION_ID,
      { autoRegisterScopes: true, scopeCategories: ['positioning', 'anatomy'] }
    );

    restoreScopeResolver = installBareBreastsScopeOverride(testFixture);
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

  it('dispatches the nipple sucking narration and perceptible event metadata', async () => {
    const { entities, actorId, targetId, roomId } =
      buildSuckOnNipplesScenario();
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
      perceptionType: 'action_target_general',
    });
  });

  it('does not fire rule for a different action', async () => {
    const entities = [
      new ModEntityBuilder('room1').asRoom('Test Room').build(),
      new ModEntityBuilder(ACTOR_ID)
        .withName('Selene')
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
        .withName('Selene')
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

  it('does not emit the suck on nipples narration for other actions', async () => {
    const { entities } = buildSuckOnNipplesScenario();
    testFixture.reset(entities);

    await testFixture.eventBus.dispatch('core:attempt_action', {
      actionId: NUZZLE_ACTION_ID,
      actorId: ACTOR_ID,
      targetId: TARGET_ID,
    });

    const messages = testFixture.events
      .map((event) => event.payload?.descriptionText || event.payload?.message)
      .filter(Boolean);

    expect(messages).not.toContain(EXPECTED_MESSAGE);
  });
});
