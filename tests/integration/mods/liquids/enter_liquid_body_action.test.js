/**
 * @file Integration tests for liquids:enter_liquid_body action execution.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';

const ACTION_ID = 'liquids:enter_liquid_body';
const ROOM_ID = 'canal-a';

describe('liquids:enter_liquid_body action integration', () => {
  let fixture;

  const loadScenario = () => {
    const room = ModEntityScenarios.createRoom(ROOM_ID, 'Canal Edge');

    const actor = new ModEntityBuilder('liquids:actor')
      .withName('Edda')
      .asActor()
      .atLocation(ROOM_ID)
      .build();

    const liquidBody = new ModEntityBuilder('liquids:canal_run')
      .withName('Canal Run')
      .withComponent('liquids:liquid_body', {})
      .atLocation(ROOM_ID)
      .build();

    fixture.reset([room, actor, liquidBody]);
    fixture.clearEvents();

    return { actorId: actor.id, liquidBodyId: liquidBody.id };
  };

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('liquids', ACTION_ID);
  });

  afterEach(() => {
    fixture?.cleanup();
  });

  it('adds in_liquid_body and dispatches sense-aware success events', async () => {
    const { actorId, liquidBodyId } = loadScenario();

    await fixture.executeAction(actorId, liquidBodyId);

    const message = 'Edda enters the Canal Run.';
    fixture.assertActionSuccess(message);
    fixture.assertComponentAdded(actorId, 'liquids-states:in_liquid_body', {
      liquid_body_id: liquidBodyId,
    });

    fixture.assertPerceptibleEvent({
      descriptionText: message,
      locationId: ROOM_ID,
      actorId,
      targetId: liquidBodyId,
      perceptionType: 'physical.self_action',
    });

    const perceptibleEvent = fixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );

    expect(perceptibleEvent?.payload.actorDescription).toBe(
      'I enter the Canal Run.'
    );
    expect(perceptibleEvent?.payload.alternateDescriptions).toEqual({
      auditory: 'I hear a splash as someone enters the water.',
    });
  });
});
