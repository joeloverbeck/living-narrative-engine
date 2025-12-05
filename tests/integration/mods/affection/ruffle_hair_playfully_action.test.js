/**
 * @file Integration tests for the affection:ruffle_hair_playfully action and rule.
 * @description Verifies the playful hair ruffle action produces the expected narrative output.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import handleRuffleHairPlayfullyRule from '../../../../data/mods/affection/rules/handle_ruffle_hair_playfully.rule.json';
import eventIsActionRuffleHairPlayfully from '../../../../data/mods/affection/conditions/event-is-action-ruffle-hair-playfully.condition.json';

const ACTION_ID = 'affection:ruffle_hair_playfully';

describe('affection:ruffle_hair_playfully action integration', () => {
  let testFixture;
  let addHairAnatomy;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'affection',
      ACTION_ID,
      handleRuffleHairPlayfullyRule,
      eventIsActionRuffleHairPlayfully
    );

    addHairAnatomy = (entityId) => {
      const entityManager = testFixture?.testEnv?.entityManager;
      if (!entityManager) return;

      const headId = `${entityId}_head`;
      const hairId = `${entityId}_hair`;

      entityManager.createEntity(headId);
      entityManager.addComponent(headId, 'anatomy:part', {
        parent: null,
        children: [hairId],
        subType: 'head',
      });

      entityManager.createEntity(hairId);
      entityManager.addComponent(hairId, 'anatomy:part', {
        parent: headId,
        children: [],
        subType: 'hair',
      });
      entityManager.addComponent(hairId, 'anatomy:joint', {
        parentId: headId,
        socketId: 'head-hair',
      });

      entityManager.addComponent(entityId, 'anatomy:body', { root: headId });
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('emits matching success and perceptible messages when executed', async () => {
    const scenario = testFixture.createCloseActors(['Amelia', 'Jonah'], {
      location: 'garden',
    });
    addHairAnatomy(scenario.actor.id);
    addHairAnatomy(scenario.target.id);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );
    const perceptibleEvent = testFixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );

    expect(successEvent).toBeDefined();
    expect(perceptibleEvent).toBeDefined();

    const expectedMessage = "Amelia ruffles Jonah's hair playfully.";
    expect(successEvent.payload.message).toBe(expectedMessage);
    expect(perceptibleEvent.payload.descriptionText).toBe(expectedMessage);
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'action_target_general'
    );
    expect(perceptibleEvent.payload.locationId).toBe('garden');
    expect(perceptibleEvent.payload.targetId).toBe(scenario.target.id);
  });
});
