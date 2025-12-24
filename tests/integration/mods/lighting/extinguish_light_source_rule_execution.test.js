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
  createCandle,
  createLitOilLamp,
} from '../../../common/mods/lighting/lightingFixtures.js';
import { LightingStateService } from '../../../../src/locations/services/lightingStateService.js';

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

  it('removes lighting:is_lit and leaves naturally dark locations unlit', async () => {
    const locationId = 'archives';
    const lightSource = createLitOilLamp('lighting:oil_lamp');
    const actor = new ModEntityBuilder('test:actor1')
      .withName('Avery')
      .asActor()
      .atLocation(locationId)
      .withComponent('inventory:inventory', {
        items: [lightSource.id],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();
    const room = new ModEntityBuilder(locationId)
      .asRoom('Archives')
      .withComponent('locations:naturally_dark', {})
      .build();

    testFixture.reset([room, actor, lightSource]);

    await testFixture.executeAction(actor.id, lightSource.id);

    const updatedLight = testFixture.entityManager.getEntityInstance(
      lightSource.id
    );
    expect(updatedLight).toNotHaveComponent('lighting:is_lit');

    const location = testFixture.entityManager.getEntityInstance(room.id);
    expect(location).toNotHaveComponent('locations:light_sources');

    const lightingStateService = new LightingStateService({
      entityManager: testFixture.entityManager,
      logger: testFixture.logger,
    });
    expect(lightingStateService.isLocationLit(locationId)).toBe(false);

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

  it('keeps a location lit when another lit item remains in inventory', async () => {
    const locationId = 'cabin';
    const lightSource = createLitOilLamp('lighting:oil_lamp');
    const otherLight = createCandle('lighting:candle', { isLit: true });
    const actor = new ModEntityBuilder('test:actor1')
      .withName('Rowan')
      .asActor()
      .atLocation(locationId)
      .withComponent('inventory:inventory', {
        items: [lightSource.id, otherLight.id],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();
    const room = new ModEntityBuilder(locationId)
      .asRoom('Cabin')
      .withComponent('locations:naturally_dark', {})
      .build();

    testFixture.reset([room, actor, lightSource, otherLight]);

    await testFixture.executeAction(actor.id, lightSource.id);

    const updatedLight = testFixture.entityManager.getEntityInstance(
      lightSource.id
    );
    expect(updatedLight).toNotHaveComponent('lighting:is_lit');

    const lightingStateService = new LightingStateService({
      entityManager: testFixture.entityManager,
      logger: testFixture.logger,
    });
    expect(lightingStateService.isLocationLit(locationId)).toBe(true);

    expect(testFixture.events).toHaveActionSuccess(
      'Rowan extinguishes oil lamp.'
    );
  });
});
