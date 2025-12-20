/**
 * @file Integration tests for travel_through_dimensions perceptible event validation
 * @description Tests that the perceptible events dispatched by the travel_through_dimensions
 * rule conform to the core:perceptible_event schema
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import '../../../common/mods/domainMatchers.js';
import handleTravelThroughDimensionsRule from '../../../../data/mods/movement/rules/handle_travel_through_dimensions.rule.json' assert { type: 'json' };
import eventIsActionTravelThroughDimensions from '../../../../data/mods/movement/conditions/event-is-action-travel-through-dimensions.condition.json' assert { type: 'json' };

describe('travel_through_dimensions Perceptible Event Schema Validation', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'movement',
      'travel_through_dimensions',
      handleTravelThroughDimensionsRule,
      eventIsActionTravelThroughDimensions
    );
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('Perceptible Event Payload Structure', () => {
    it('should dispatch departure perception with valid descriptionText field', async () => {
      const scenario = await createDimensionalScenario(fixture);

      await fixture.executeAction(scenario.observerId, scenario.dimensionId, {
        skipDiscovery: true,
      });

      const departureEvent = fixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.perceptionType === 'movement.departure'
      );

      expect(departureEvent).toBeDefined();
      expect(departureEvent.payload).toHaveProperty('descriptionText');
      expect(departureEvent.payload.descriptionText).toContain(
        'ripples and distorts'
      );
    });

    it('should dispatch arrival perception with valid descriptionText field', async () => {
      const scenario = await createDimensionalScenario(fixture);

      await fixture.executeAction(scenario.observerId, scenario.dimensionId, {
        skipDiscovery: true,
      });

      const arrivalEvent = fixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.perceptionType === 'movement.arrival'
      );

      expect(arrivalEvent).toBeDefined();
      expect(arrivalEvent.payload).toHaveProperty('descriptionText');
      expect(arrivalEvent.payload.descriptionText).toContain('materializes');
    });

    it('should not include "message" field in perceptible event payload', async () => {
      const scenario = await createDimensionalScenario(fixture);

      await fixture.executeAction(scenario.observerId, scenario.dimensionId, {
        skipDiscovery: true,
      });

      const perceptibleEvents = fixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);

      perceptibleEvents.forEach((event) => {
        expect(event.payload).not.toHaveProperty('message');
      });
    });

    it('should include all required fields in perceptible event payload', async () => {
      const scenario = await createDimensionalScenario(fixture);

      await fixture.executeAction(scenario.observerId, scenario.dimensionId, {
        skipDiscovery: true,
      });

      const perceptibleEvents = fixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);

      perceptibleEvents.forEach((event) => {
        // Required fields per schema
        expect(event.payload).toHaveProperty('eventName');
        expect(event.payload).toHaveProperty('locationId');
        expect(event.payload).toHaveProperty('descriptionText');
        expect(event.payload).toHaveProperty('timestamp');
        expect(event.payload).toHaveProperty('perceptionType');
        expect(event.payload).toHaveProperty('actorId');

        // Validate eventName
        expect(event.payload.eventName).toBe('core:perceptible_event');

        // Validate timestamp format (ISO 8601)
        expect(event.payload.timestamp).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
        );
      });
    });

    it('should only include allowed fields in perceptible event payload', async () => {
      const scenario = await createDimensionalScenario(fixture);

      await fixture.executeAction(scenario.observerId, scenario.dimensionId, {
        skipDiscovery: true,
      });

      const perceptibleEvents = fixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);

      const allowedFields = [
        'eventName',
        'locationId',
        'descriptionText',
        'timestamp',
        'perceptionType',
        'actorId',
        'targetId',
        'involvedEntities',
        'contextualData',
      ];

      perceptibleEvents.forEach((event) => {
        const payloadKeys = Object.keys(event.payload);
        payloadKeys.forEach((key) => {
          expect(allowedFields).toContain(key);
        });
      });
    });
  });
});

/**
 * Helper: Create basic dimensional travel scenario
 *
 * @param {object} fixture - Test fixture instance
 * @returns {object} Scenario with locations and actors
 */
async function createDimensionalScenario(fixture) {
  const perimeterId = fixture.createEntity({
    id: 'validation-perimeter',
    name: 'perimeter of rip in reality',
    components: [{ componentId: 'core:location', data: {} }],
  });

  const dimensionId = fixture.createEntity({
    id: 'validation-dimension',
    name: 'eldritch dimension',
    components: [{ componentId: 'core:location', data: {} }],
  });

  const blockerId = fixture.createEntity({
    id: 'validation-blocker',
    name: 'dimensional rift',
    components: [{ componentId: 'blockers:is_dimensional_portal', data: {} }],
  });

  await fixture.modifyComponent(perimeterId, 'movement:exits', [
    {
      direction: 'through the dimensional rift',
      target: dimensionId,
      blocker: blockerId,
    },
  ]);

  const observerId = fixture.createEntity({
    id: 'validation-observer',
    name: 'Test Observer',
    components: [
      { componentId: 'core:actor', data: {} },
      { componentId: 'core:position', data: { locationId: perimeterId } },
      { componentId: 'movement:can_travel_through_dimensions', data: {} },
      { componentId: 'core:name', data: { text: 'Test Observer' } },
    ],
  });

  return { perimeterId, dimensionId, blockerId, observerId };
}
