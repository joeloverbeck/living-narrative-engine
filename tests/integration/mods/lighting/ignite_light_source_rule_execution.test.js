/**
 * @file Integration tests for lighting:ignite_light_source rule execution.
 * @description Validates rule side effects and perceptible event payloads.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import igniteLightRule from '../../../../data/mods/lighting/rules/handle_ignite_light_source.rule.json' assert { type: 'json' };
import eventIsActionIgniteLightSource from '../../../../data/mods/lighting/conditions/event-is-action-ignite-light-source.condition.json' assert { type: 'json' };
import {
  createActorWithLightSource,
  createCandle,
  createLocationWithLightSources,
  createOilLamp,
} from '../../../common/mods/lighting/lightingFixtures.js';
import { LightingStateService } from '../../../../src/locations/services/lightingStateService.js';

describe('lighting:ignite_light_source rule execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'lighting',
      'lighting:ignite_light_source',
      igniteLightRule,
      eventIsActionIgniteLightSource
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('adds lighting:is_lit and initializes location light sources', async () => {
    const locationId = 'lamp_room';
    const lightSource = createOilLamp('lighting:oil_lamp');
    const actor = createActorWithLightSource('test:actor1', lightSource.id, {
      name: 'Avery',
      locationId,
    });
    const room = new ModEntityBuilder(locationId).asRoom('Lamp Room').build();

    testFixture.reset([room, actor, lightSource]);

    await testFixture.executeAction(actor.id, lightSource.id);

    const updatedLight = testFixture.entityManager.getEntityInstance(
      lightSource.id
    );
    expect(updatedLight).toHaveComponent('lighting:is_lit');

    const location = testFixture.entityManager.getEntityInstance(room.id);
    expect(location).toHaveComponentData('locations:light_sources', {
      sources: [lightSource.id],
    });

    const perceptibleEvent = testFixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent?.payload.descriptionText).toBe(
      'Avery ignites oil lamp. A warm glow spreads through the area.'
    );
    expect(perceptibleEvent?.payload.actorDescription).toBe(
      'I ignite oil lamp, watching the flame catch and spread its warmth.'
    );
    expect(perceptibleEvent?.payload.perceptionType).toBe(
      'state.observable_change'
    );
    expect(perceptibleEvent?.payload.alternateDescriptions).toEqual({
      auditory: 'You hear the soft hiss of a light source being ignited nearby.',
      tactile: 'You feel a subtle warmth as a nearby light source flickers to life.',
      olfactory: 'The faint scent of burning oil or wax reaches your nose.',
    });

    expect(testFixture.events).toHaveActionSuccess(
      'Avery ignites oil lamp.'
    );

    const turnEndedEvent = testFixture.events.find(
      (event) => event.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent?.payload.entityId).toBe(actor.id);
    expect(turnEndedEvent?.payload.success).toBe(true);
  });

  it('uses push_unique to avoid duplicating active light sources', async () => {
    const locationId = 'gallery';
    const lightSource = createOilLamp('lighting:oil_lamp');
    const otherLight = createCandle('lighting:candle');
    const actor = createActorWithLightSource('test:actor1', lightSource.id, {
      name: 'Morgan',
      locationId,
    });
    const room = createLocationWithLightSources(locationId, [
      otherLight.id,
      lightSource.id,
    ]);

    testFixture.reset([room, actor, lightSource, otherLight]);

    await testFixture.executeAction(actor.id, lightSource.id);

    const location = testFixture.entityManager.getEntityInstance(room.id);
    expect(location).toHaveComponentData('locations:light_sources', {
      sources: [otherLight.id, lightSource.id],
    });
  });

  it('lights a naturally dark location after ignition', async () => {
    const locationId = 'lower_gallery';
    const lightSource = createOilLamp('lighting:hooded_oil_lantern', {
      name: 'hooded oil lantern',
    });
    const actor = createActorWithLightSource('test:saffi', lightSource.id, {
      name: 'Saffi',
      locationId,
    });
    const room = new ModEntityBuilder(locationId)
      .asRoom('Lower Gallery')
      .withComponent('locations:naturally_dark', {})
      .withComponent('locations:light_sources', { sources: [] })
      .build();

    testFixture.reset([room, actor, lightSource]);

    await testFixture.executeAction(actor.id, lightSource.id);

    const location = testFixture.entityManager.getEntityInstance(room.id);
    expect(location).toHaveComponentData('locations:light_sources', {
      sources: [lightSource.id],
    });

    const lightingStateService = new LightingStateService({
      entityManager: testFixture.entityManager,
      logger: testFixture.logger,
    });
    expect(lightingStateService.isLocationLit(locationId)).toBe(true);
  });
});
