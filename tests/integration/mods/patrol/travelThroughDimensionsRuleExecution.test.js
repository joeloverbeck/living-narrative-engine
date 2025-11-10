/**
 * @file Integration tests for travel_through_dimensions rule execution
 * @description Tests complete dimensional travel workflow including location changes and perceptions
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import '../../../common/mods/domainMatchers.js';

describe('travel_through_dimensions Rule Execution', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'patrol',
      'travel_through_dimensions'
    );
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('Successful Dimensional Travel', () => {
    it('should successfully execute dimensional travel', async () => {
      const scenario = createDimensionalScenario(fixture);

      await fixture.executeAction(
        scenario.observerId,
        scenario.dimensionId
      );

      // Verify location changed
      const position = fixture.getComponent(
        scenario.observerId,
        'core:position'
      );
      expect(position.locationId).toBe(scenario.dimensionId);
    });

    it('should dispatch departure perception at origin', async () => {
      const scenario = createDimensionalScenario(fixture);
      const events = [];

      fixture.eventBus.on('PERCEPTIBLE_EVENT', (event) => {
        events.push(event);
      });

      await fixture.executeAction(
        scenario.observerId,
        scenario.dimensionId
      );

      const departureEvent = events.find(
        (e) => e.payload.perceptionType === 'dimensional_departure'
      );
      expect(departureEvent).toBeDefined();
      expect(departureEvent.payload.locationId).toBe(scenario.perimeterId);
      expect(departureEvent.payload.message).toContain('ripples and distorts');
    });

    it('should dispatch arrival perception at destination', async () => {
      const scenario = createDimensionalScenario(fixture);
      const events = [];

      fixture.eventBus.on('PERCEPTIBLE_EVENT', (event) => {
        events.push(event);
      });

      await fixture.executeAction(
        scenario.observerId,
        scenario.dimensionId
      );

      const arrivalEvent = events.find(
        (e) => e.payload.perceptionType === 'dimensional_arrival'
      );
      expect(arrivalEvent).toBeDefined();
      expect(arrivalEvent.payload.locationId).toBe(scenario.dimensionId);
      expect(arrivalEvent.payload.message).toContain('materializes');
    });
  });

  describe('Round-Trip Travel', () => {
    it('should allow travel from reality to dimension and back', async () => {
      const scenario = createBidirectionalScenario(fixture);

      // Travel to dimension
      await fixture.executeAction(
        scenario.observerId,
        scenario.dimensionId
      );

      let position = fixture.getComponent(
        scenario.observerId,
        'core:position'
      );
      expect(position.locationId).toBe(scenario.dimensionId);

      // Travel back to reality
      await fixture.executeAction(
        scenario.observerId,
        scenario.perimeterId
      );

      position = fixture.getComponent(
        scenario.observerId,
        'core:position'
      );
      expect(position.locationId).toBe(scenario.perimeterId);
    });
  });

  describe('Validation Failures', () => {
    it('should fail when actor lacks dimensional travel component', async () => {
      const scenario = createDimensionalScenario(fixture, {
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
function createDimensionalScenario(fixture, options = {}) {
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
    components: [{ componentId: 'patrol:is_dimensional_portal', data: {} }],
  });

  fixture.modifyComponent(perimeterId, 'movement:exits', [
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
      componentId: 'patrol:can_travel_through_dimensions',
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
function createBidirectionalScenario(fixture) {
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
    components: [{ componentId: 'patrol:is_dimensional_portal', data: {} }],
  });

  // Perimeter exit to dimension
  fixture.modifyComponent(perimeterId, 'movement:exits', [
    {
      direction: 'through the dimensional rift',
      target: dimensionId,
      blocker: blockerId,
    },
  ]);

  // Dimension exit back to perimeter
  fixture.modifyComponent(dimensionId, 'movement:exits', [
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
      { componentId: 'patrol:can_travel_through_dimensions', data: {} },
      { componentId: 'core:name', data: { text: 'Writhing Observer' } },
    ],
  });

  return { perimeterId, dimensionId, blockerId, observerId };
}
