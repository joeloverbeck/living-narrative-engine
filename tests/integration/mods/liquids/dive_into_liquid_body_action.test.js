/**
 * @file Integration tests for liquids:dive_into_liquid_body action execution.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';

const ACTION_ID = 'liquids:dive_into_liquid_body';
const ROOM_ID = 'canal-a';

describe('liquids:dive_into_liquid_body action integration', () => {
  let fixture;

  const loadScenario = (visibility = 'opaque') => {
    const room = ModEntityScenarios.createRoom(ROOM_ID, 'Canal Edge');

    const actor = new ModEntityBuilder('liquids:actor')
      .withName('Edda')
      .asActor()
      .atLocation(ROOM_ID)
      .build();

    const liquidBody = new ModEntityBuilder('liquids:canal_run')
      .withName('Canal Run')
      .withComponent('liquids:liquid_body', { visibility })
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

  describe('Component state changes', () => {
    it('adds in_liquid_body component with correct liquid_body_id', async () => {
      const { actorId, liquidBodyId } = loadScenario();

      await fixture.executeAction(actorId, liquidBodyId);

      fixture.assertComponentAdded(actorId, 'liquids-states:in_liquid_body', {
        liquid_body_id: liquidBodyId,
      });
    });

    it('adds submerged component', async () => {
      const { actorId, liquidBodyId } = loadScenario();

      await fixture.executeAction(actorId, liquidBodyId);

      fixture.assertComponentAdded(actorId, 'liquids-states:submerged', {});
    });

    it('dispatches sense-aware success events', async () => {
      const { actorId, liquidBodyId } = loadScenario();

      await fixture.executeAction(actorId, liquidBodyId);

      const message = 'Edda dives into the opaque liquid of Canal Run.';
      fixture.assertActionSuccess(message);

      fixture.assertPerceptibleEvent({
        descriptionText: message,
        locationId: ROOM_ID,
        actorId,
        targetId: liquidBodyId,
        perceptionType: 'physical.self_action',
      });
    });
  });

  describe('Event payload validation', () => {
    it('description_text includes visibility', async () => {
      const { actorId, liquidBodyId } = loadScenario('murky');

      await fixture.executeAction(actorId, liquidBodyId);

      const perceptibleEvent = fixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent?.payload.descriptionText).toContain('murky');
    });

    it('description_text includes liquid body name', async () => {
      const { actorId, liquidBodyId } = loadScenario();

      await fixture.executeAction(actorId, liquidBodyId);

      const perceptibleEvent = fixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent?.payload.descriptionText).toContain('Canal Run');
    });

    it('actor_description uses first-person', async () => {
      const { actorId, liquidBodyId } = loadScenario();

      await fixture.executeAction(actorId, liquidBodyId);

      const perceptibleEvent = fixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent?.payload.actorDescription).toBe(
        'I dive into the opaque liquid of Canal Run.'
      );
    });

    it('alternate_descriptions includes auditory fallback', async () => {
      const { actorId, liquidBodyId } = loadScenario();

      await fixture.executeAction(actorId, liquidBodyId);

      const perceptibleEvent = fixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent?.payload.alternateDescriptions?.auditory).toBe(
        'I hear a loud splash as someone dives into a body of liquid.'
      );
    });

    it('alternate_descriptions includes tactile fallback', async () => {
      const { actorId, liquidBodyId } = loadScenario();

      await fixture.executeAction(actorId, liquidBodyId);

      const perceptibleEvent = fixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent?.payload.alternateDescriptions?.tactile).toBe(
        'I feel a rush of liquid displacement as someone dives nearby.'
      );
    });

    it('perception_type is physical.self_action', async () => {
      const { actorId, liquidBodyId } = loadScenario();

      await fixture.executeAction(actorId, liquidBodyId);

      const perceptibleEvent = fixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent?.payload.perceptionType).toBe('physical.self_action');
    });
  });

  describe('Turn ending', () => {
    it('ends turn with success', async () => {
      const { actorId, liquidBodyId } = loadScenario();

      await fixture.executeAction(actorId, liquidBodyId);

      const endTurnEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );

      expect(endTurnEvent).toBeDefined();
      expect(endTurnEvent?.payload.entityId).toBe(actorId);
      expect(endTurnEvent?.payload.success).toBe(true);
    });
  });

  describe('Visibility variants', () => {
    it('works with pristine visibility', async () => {
      const { actorId, liquidBodyId } = loadScenario('pristine');

      await fixture.executeAction(actorId, liquidBodyId);

      const perceptibleEvent = fixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent?.payload.descriptionText).toContain('pristine');
    });

    it('works with clear visibility', async () => {
      const { actorId, liquidBodyId } = loadScenario('clear');

      await fixture.executeAction(actorId, liquidBodyId);

      const perceptibleEvent = fixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent?.payload.descriptionText).toContain('clear');
    });

    it('works with murky visibility', async () => {
      const { actorId, liquidBodyId } = loadScenario('murky');

      await fixture.executeAction(actorId, liquidBodyId);

      const perceptibleEvent = fixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent?.payload.descriptionText).toContain('murky');
    });

    it('works with opaque visibility', async () => {
      const { actorId, liquidBodyId } = loadScenario('opaque');

      await fixture.executeAction(actorId, liquidBodyId);

      const perceptibleEvent = fixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent?.payload.descriptionText).toContain('opaque');
    });
  });
});
