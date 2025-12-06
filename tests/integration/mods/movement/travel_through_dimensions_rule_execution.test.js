/**
 * @file Integration tests for travel_through_dimensions rule execution
 * @description Tests complete dimensional travel workflow including location changes and perceptions
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import '../../../common/mods/domainMatchers.js';
import handleTravelThroughDimensionsRule from '../../../../data/mods/movement/rules/handle_travel_through_dimensions.rule.json' assert { type: 'json' };
import eventIsActionTravelThroughDimensions from '../../../../data/mods/movement/conditions/event-is-action-travel-through-dimensions.condition.json' assert { type: 'json' };

describe('travel_through_dimensions Rule Execution', () => {
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

  describe('Successful Dimensional Travel', () => {
    it('should successfully execute dimensional travel', async () => {
      const scenario = await createDimensionalScenario(fixture);

      await fixture.executeAction(scenario.observerId, scenario.dimensionId, {
        skipDiscovery: true,
      });

      // Verify location changed
      const position = fixture.getComponent(
        scenario.observerId,
        'core:position'
      );
      expect(position.locationId).toBe(scenario.dimensionId);
    });

    it('should dispatch departure perception at origin', async () => {
      const scenario = await createDimensionalScenario(fixture);

      await fixture.executeAction(scenario.observerId, scenario.dimensionId, {
        skipDiscovery: true,
      });

      const departureEvent = fixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.perceptionType === 'character_exit'
      );
      expect(departureEvent).toBeDefined();
      expect(departureEvent.payload.locationId).toBe(scenario.perimeterId);
      expect(departureEvent.payload.descriptionText).toContain(
        'ripples and distorts'
      );
    });

    it('should dispatch arrival perception at destination', async () => {
      const scenario = await createDimensionalScenario(fixture);

      await fixture.executeAction(scenario.observerId, scenario.dimensionId, {
        skipDiscovery: true,
      });

      const arrivalEvent = fixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.perceptionType === 'character_enter'
      );
      expect(arrivalEvent).toBeDefined();
      expect(arrivalEvent.payload.locationId).toBe(scenario.dimensionId);
      expect(arrivalEvent.payload.descriptionText).toContain('materializes');
    });
  });

  describe('Round-Trip Travel', () => {
    it('should allow travel from reality to dimension and back', async () => {
      const scenario = await createBidirectionalScenario(fixture);

      // Travel to dimension
      await fixture.executeAction(scenario.observerId, scenario.dimensionId, {
        skipDiscovery: true,
      });

      let position = fixture.getComponent(scenario.observerId, 'core:position');
      expect(position.locationId).toBe(scenario.dimensionId);

      // Travel back to reality
      await fixture.executeAction(scenario.observerId, scenario.perimeterId, {
        skipDiscovery: true,
      });

      position = fixture.getComponent(scenario.observerId, 'core:position');
      expect(position.locationId).toBe(scenario.perimeterId);
    });
  });

  describe('Validation Failures', () => {
    it('should fail when actor lacks dimensional travel component', async () => {
      const scenario = await createDimensionalScenario(fixture, {
        actorHasAffordance: false,
      });

      await expect(
        fixture.executeAction(scenario.humanId, scenario.dimensionId)
      ).rejects.toThrow();
    });
  });
});

/**
 * Helper: Create basic dimensional travel scenario
 *
 * @param {object} fixture - Test fixture instance
 * @param {object} options - Configuration options
 * @returns {object} Scenario with locations and actors
 */
async function createDimensionalScenario(fixture, options = {}) {
  const { actorHasAffordance = true } = options;

  const perimeterId = fixture.createEntity({
    id: 'rule-perimeter',
    name: 'perimeter of rip in reality',
    components: [{ componentId: 'core:location', data: {} }],
  });

  const dimensionId = fixture.createEntity({
    id: 'rule-dimension',
    name: 'eldritch dimension',
    components: [{ componentId: 'core:location', data: {} }],
  });

  const blockerId = fixture.createEntity({
    id: 'rule-blocker',
    name: 'dimensional rift',
    components: [{ componentId: 'movement:is_dimensional_portal', data: {} }],
  });

  await fixture.modifyComponent(perimeterId, 'movement:exits', [
    {
      direction: 'through the dimensional rift',
      target: dimensionId,
      blocker: blockerId,
    },
  ]);

  const actorComponents = [
    { componentId: 'core:actor', data: {} },
    { componentId: 'core:position', data: { locationId: perimeterId } },
    { componentId: 'core:name', data: { text: 'Test Actor' } },
  ];

  if (actorHasAffordance) {
    actorComponents.push({
      componentId: 'movement:can_travel_through_dimensions',
      data: {},
    });
  }

  const actorId = fixture.createEntity({
    id: 'rule-actor',
    name: 'Test Actor',
    components: actorComponents,
  });

  return {
    perimeterId,
    dimensionId,
    blockerId,
    [actorHasAffordance ? 'observerId' : 'humanId']: actorId,
  };
}

/**
 * Helper: Create bidirectional dimensional travel scenario
 *
 * @param {object} fixture - Test fixture instance
 * @returns {object} Scenario with bidirectional portals
 */
async function createBidirectionalScenario(fixture) {
  const perimeterId = fixture.createEntity({
    id: 'rule-bidir-perimeter',
    name: 'perimeter of rip in reality',
    components: [{ componentId: 'core:location', data: {} }],
  });

  const dimensionId = fixture.createEntity({
    id: 'rule-bidir-dimension',
    name: 'eldritch dimension',
    components: [{ componentId: 'core:location', data: {} }],
  });

  const blockerId = fixture.createEntity({
    id: 'rule-bidir-blocker',
    name: 'dimensional rift',
    components: [{ componentId: 'movement:is_dimensional_portal', data: {} }],
  });

  // Perimeter exit to dimension
  await fixture.modifyComponent(perimeterId, 'movement:exits', [
    {
      direction: 'through the dimensional rift',
      target: dimensionId,
      blocker: blockerId,
    },
  ]);

  // Dimension exit back to perimeter
  await fixture.modifyComponent(dimensionId, 'movement:exits', [
    {
      direction: 'through the dimensional tear back to reality',
      target: perimeterId,
      blocker: blockerId,
    },
  ]);

  const observerId = fixture.createEntity({
    id: 'rule-bidir-observer',
    name: 'Writhing Observer',
    components: [
      { componentId: 'core:actor', data: {} },
      { componentId: 'core:position', data: { locationId: perimeterId } },
      { componentId: 'movement:can_travel_through_dimensions', data: {} },
      { componentId: 'core:name', data: { text: 'Writhing Observer' } },
    ],
  });

  return { perimeterId, dimensionId, blockerId, observerId };
}
