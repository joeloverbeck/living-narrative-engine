/**
 * @file Integration tests for travel_through_dimensions action discovery
 * @description Tests that the action appears only for entities with dimensional travel capability
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import '../../../common/mods/domainMatchers.js';

describe('travel_through_dimensions Action Discovery', () => {
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

  describe('Dimensional Traveler Availability', () => {
    it('should discover travel_through_dimensions for Writhing Observer at perimeter', async () => {
      // Create perimeter location with dimensional exit
      const perimeterId = fixture.createEntity({
        name: 'perimeter of rip in reality',
        components: [
          {
            componentId: 'core:location',
            data: {},
          },
        ],
      });

      // Create eldritch dimension
      const dimensionId = fixture.createEntity({
        name: 'eldritch dimension',
        components: [
          {
            componentId: 'core:location',
            data: {},
          },
        ],
      });

      // Create dimensional blocker
      const blockerId = fixture.createEntity({
        name: 'dimensional rift',
        components: [
          {
            componentId: 'patrol:is_dimensional_portal',
            data: {},
          },
        ],
      });

      // Add exit with blocker to perimeter
      fixture.modifyComponent(perimeterId, 'movement:exits', [
        {
          direction: 'through the dimensional rift',
          target: dimensionId,
          blocker: blockerId,
        },
      ]);

      // Create Writhing Observer at perimeter
      const observerId = fixture.createEntity({
        name: 'Writhing Observer',
        components: [
          {
            componentId: 'core:actor',
            data: {},
          },
          {
            componentId: 'core:position',
            data: { locationId: perimeterId },
          },
          {
            componentId: 'patrol:can_travel_through_dimensions',
            data: {},
          },
        ],
      });

      const actions = await fixture.discoverActions(observerId);

      expect(actions).toContainAction('patrol:travel_through_dimensions', {
        primaryTargetId: dimensionId,
      });
    });

    it('should NOT discover travel_through_dimensions for humans', async () => {
      const { perimeterId } = createDimensionalScenario(fixture);

      // Create human without dimensional travel component
      const humanId = fixture.createEntity({
        name: 'Human Sentinel',
        components: [
          {
            componentId: 'core:actor',
            data: {},
          },
          {
            componentId: 'core:position',
            data: { locationId: perimeterId },
          },
        ],
      });

      const actions = await fixture.discoverActions(humanId);

      expect(actions).not.toContainAction('patrol:travel_through_dimensions');
    });

    it('should NOT discover travel_through_dimensions for unblocked exits', async () => {
      // Create location with unblocked exit
      const locationId = fixture.createEntity({
        name: 'normal location',
        components: [
          {
            componentId: 'core:location',
            data: {},
          },
        ],
      });

      const targetId = fixture.createEntity({
        name: 'another location',
        components: [
          {
            componentId: 'core:location',
            data: {},
          },
        ],
      });

      // Add unblocked exit
      fixture.modifyComponent(locationId, 'movement:exits', [
        {
          direction: 'north',
          target: targetId,
          blocker: null,
        },
      ]);

      const observerId = fixture.createEntity({
        name: 'Writhing Observer',
        components: [
          {
            componentId: 'core:actor',
            data: {},
          },
          {
            componentId: 'core:position',
            data: { locationId },
          },
          {
            componentId: 'patrol:can_travel_through_dimensions',
            data: {},
          },
        ],
      });

      const actions = await fixture.discoverActions(observerId);

      // Should not appear because exits are unblocked (normal movement)
      expect(actions).not.toContainAction('patrol:travel_through_dimensions');
    });
  });

  describe('Go Action Exclusion', () => {
    it('should NOT discover go action for dimensional exits', async () => {
      const { perimeterId, dimensionId } = createDimensionalScenario(fixture);

      const humanId = fixture.createEntity({
        name: 'Human Sentinel',
        components: [
          {
            componentId: 'core:actor',
            data: {},
          },
          {
            componentId: 'core:position',
            data: { locationId: perimeterId },
          },
        ],
      });

      const actions = await fixture.discoverActions(humanId);

      // Humans should not be able to "go" through dimensional rift
      expect(actions).not.toContainAction('movement:go', {
        primaryTargetId: dimensionId,
      });
    });

    it('should still discover go action for unblocked exits', async () => {
      const scenario = createMixedExitScenario(fixture);

      const actions = await fixture.discoverActions(scenario.humanId);

      // Should discover go to normal room but not dimensional destination
      expect(actions).toContainAction('movement:go', {
        primaryTargetId: scenario.normalRoomId,
      });
      expect(actions).not.toContainAction('movement:go', {
        primaryTargetId: scenario.dimensionId,
      });
    });
  });
});

/**
 * Helper: Create scenario with dimensional portal
 *
 * @param {object} fixture - Test fixture instance
 * @returns {object} Scenario with perimeterId, dimensionId, and blockerId
 */
function createDimensionalScenario(fixture) {
  const perimeterId = fixture.createEntity({
    name: 'perimeter of rip in reality',
    components: [{ componentId: 'core:location', data: {} }],
  });

  const dimensionId = fixture.createEntity({
    name: 'eldritch dimension',
    components: [{ componentId: 'core:location', data: {} }],
  });

  const blockerId = fixture.createEntity({
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

  return { perimeterId, dimensionId, blockerId };
}

/**
 * Helper: Create location with both blocked and unblocked exits
 *
 * @param {object} fixture - Test fixture instance
 * @returns {object} Scenario with locations and actors
 */
function createMixedExitScenario(fixture) {
  const startLocationId = fixture.createEntity({
    name: 'start location',
    components: [{ componentId: 'core:location', data: {} }],
  });

  const normalRoomId = fixture.createEntity({
    name: 'normal room',
    components: [{ componentId: 'core:location', data: {} }],
  });

  const dimensionId = fixture.createEntity({
    name: 'eldritch dimension',
    components: [{ componentId: 'core:location', data: {} }],
  });

  const blockerId = fixture.createEntity({
    name: 'dimensional rift',
    components: [{ componentId: 'patrol:is_dimensional_portal', data: {} }],
  });

  fixture.modifyComponent(startLocationId, 'movement:exits', [
    {
      direction: 'north',
      target: normalRoomId,
      blocker: null,
    },
    {
      direction: 'through the dimensional rift',
      target: dimensionId,
      blocker: blockerId,
    },
  ]);

  const humanId = fixture.createEntity({
    name: 'Human Sentinel',
    components: [
      { componentId: 'core:actor', data: {} },
      { componentId: 'core:position', data: { locationId: startLocationId } },
    ],
  });

  return { startLocationId, normalRoomId, dimensionId, blockerId, humanId };
}
