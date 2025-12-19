/**
 * @file Integration tests for lighting:extinguish_light_source rule execution.
 * @description Validates rule side effects and perceptible event payloads.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import extinguishLightRule from '../../../../data/mods/lighting/rules/handle_extinguish_light_source.rule.json' assert { type: 'json' };
import eventIsActionExtinguishLightSource from '../../../../data/mods/lighting/conditions/event-is-action-extinguish-light-source.condition.json' assert { type: 'json' };
import {
  createActorWithLightSource,
  createCandle,
  createLitOilLamp,
  createLocationWithLightSources,
} from '../../../common/mods/lighting/lightingFixtures.js';

describe('lighting:extinguish_light_source rule execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'lighting',
      'lighting:extinguish_light_source',
      extinguishLightRule,
      eventIsActionExtinguishLightSource
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('removes lighting:is_lit and updates location light sources', async () => {
    const locationId = 'archives';
    const lightSource = createLitOilLamp('lighting:oil_lamp');
    const otherLight = createCandle('lighting:candle');
    const actor = createActorWithLightSource('test:actor1', lightSource.id, {
      name: 'Avery',
      locationId,
    });
    const room = createLocationWithLightSources(locationId, [
      lightSource.id,
      otherLight.id,
    ]);

    testFixture.reset([room, actor, lightSource, otherLight]);

    await testFixture.executeAction(actor.id, lightSource.id);

    const updatedLight = testFixture.entityManager.getEntityInstance(
      lightSource.id
    );
    expect(updatedLight).toNotHaveComponent('lighting:is_lit');

    const location = testFixture.entityManager.getEntityInstance(room.id);
    expect(location).toHaveComponentData('locations:light_sources', {
      sources: [otherLight.id],
    });

    const perceptibleEvent = testFixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent?.payload.descriptionText).toBe(
      'Avery extinguishes oil lamp. The area grows darker.'
    );
    expect(perceptibleEvent?.payload.actorDescription).toBe(
      'I extinguish oil lamp, watching the flame die out.'
    );
    expect(perceptibleEvent?.payload.perceptionType).toBe(
      'state.observable_change'
    );
    expect(perceptibleEvent?.payload.alternateDescriptions).toEqual({
      auditory: 'You hear a soft puff as a nearby light source is extinguished.',
      tactile: 'You feel the warmth fade as a nearby light source goes out.',
      olfactory: 'The acrid smell of a recently extinguished flame wafts toward you.',
    });

    expect(testFixture.events).toHaveActionSuccess(
      'Avery extinguishes oil lamp.'
    );

    const turnEndedEvent = testFixture.events.find(
      (event) => event.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent?.payload.entityId).toBe(actor.id);
    expect(turnEndedEvent?.payload.success).toBe(true);
  });

  it('handles missing location light sources component gracefully', async () => {
    const locationId = 'cabin';
    const lightSource = createLitOilLamp('lighting:oil_lamp');
    const actor = createActorWithLightSource('test:actor1', lightSource.id, {
      name: 'Rowan',
      locationId,
    });
    const room = new ModEntityBuilder(locationId).asRoom('Cabin').build();

    testFixture.reset([room, actor, lightSource]);

    await testFixture.executeAction(actor.id, lightSource.id);

    const updatedLight = testFixture.entityManager.getEntityInstance(
      lightSource.id
    );
    expect(updatedLight).toNotHaveComponent('lighting:is_lit');

    const location = testFixture.entityManager.getEntityInstance(room.id);
    expect(location).toNotHaveComponent('locations:light_sources');

    expect(testFixture.events).toHaveActionSuccess(
      'Rowan extinguishes oil lamp.'
    );
  });
});
