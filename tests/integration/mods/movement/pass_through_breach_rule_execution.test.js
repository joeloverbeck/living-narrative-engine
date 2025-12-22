/**
 * @file Integration tests for movement:pass_through_breach rule execution.
 * @description Ensures movement, perception, and UI results are correct.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import '../../../common/mods/domainMatchers.js';
import passThroughBreachRule from '../../../../data/mods/movement/rules/pass_through_breach.rule.json' assert { type: 'json' };
import passThroughBreachCondition from '../../../../data/mods/movement/conditions/event-is-action-pass-through-breach.condition.json' assert { type: 'json' };

const ACTION_ID = 'movement:pass_through_breach';

describe('movement:pass_through_breach rule execution', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'movement',
      'pass_through_breach',
      passThroughBreachRule,
      passThroughBreachCondition
    );
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  it('moves the actor through the breached blocker and reports success', async () => {
    const originId = fixture.createEntity({
      id: 'breach-origin',
      name: 'Breach Hall',
      components: [{ componentId: 'core:location', data: {} }],
    });

    const destinationId = fixture.createEntity({
      id: 'breach-destination',
      name: 'Safe Room',
      components: [{ componentId: 'core:location', data: {} }],
    });

    const blockerId = fixture.createEntity({
      id: 'breach-blocker',
      name: 'Splintered Door',
      components: [
        { componentId: 'core:name', data: { text: 'Splintered Door' } },
        { componentId: 'breaching:breached', data: {} },
      ],
    });

    const actorId = fixture.createEntity({
      id: 'breach-actor',
      name: 'Runner',
      components: [
        { componentId: 'core:actor', data: {} },
        { componentId: 'core:name', data: { text: 'Runner' } },
        { componentId: 'core:position', data: { locationId: originId } },
        { componentId: 'core:movement', data: { locked: false } },
      ],
    });

    await fixture.modifyComponent(originId, 'locations:exits', [
      {
        direction: 'through the breach',
        target: destinationId,
        blocker: blockerId,
      },
    ]);

    await fixture.executeAction(actorId, blockerId, {
      skipDiscovery: true,
      additionalPayload: {
        primaryId: blockerId,
        secondaryId: destinationId,
      },
    });

    const updatedPosition = fixture.getComponent(actorId, 'core:position');
    expect(updatedPosition.locationId).toBe(destinationId);

    expect(fixture.events).toDispatchEvent('core:entity_moved');
    expect(fixture.events).toHaveActionSuccess(
      'Runner passes through the breach in Splintered Door into Safe Room.'
    );

    const departureEvent = fixture.events.find(
      (event) =>
        event.eventType === 'core:perceptible_event' &&
        event.payload.perceptionType === 'movement.departure'
    );
    expect(departureEvent).toBeDefined();
    expect(departureEvent.payload.locationId).toBe(originId);
    expect(departureEvent.payload.alternateDescriptions).toEqual(
      expect.objectContaining({
        auditory: expect.any(String),
        tactile: expect.any(String),
      })
    );

    const arrivalEvent = fixture.events.find(
      (event) =>
        event.eventType === 'core:perceptible_event' &&
        event.payload.perceptionType === 'movement.arrival'
    );
    expect(arrivalEvent).toBeDefined();
    expect(arrivalEvent.payload.locationId).toBe(destinationId);
    expect(arrivalEvent.payload.alternateDescriptions).toEqual(
      expect.objectContaining({
        auditory: expect.any(String),
        tactile: expect.any(String),
      })
    );
  });
});
