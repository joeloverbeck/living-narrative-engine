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
      'movement',
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
        id: 'test-perimeter',
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
        id: 'test-dimension',
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
        id: 'test-blocker',
        name: 'dimensional rift',
        components: [
          {
            componentId: 'blockers:is_dimensional_portal',
            data: {},
          },
        ],
      });

      // Add exit with blocker to perimeter
      await await fixture.modifyComponent(perimeterId, 'locations:exits', [
        {
          direction: 'through the dimensional rift',
          target: dimensionId,
          blocker: blockerId,
        },
      ]);

      // Create Writhing Observer at perimeter
      const observerId = fixture.createEntity({
        id: 'test-observer',
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
            componentId: 'movement:can_travel_through_dimensions',
            data: {},
          },
        ],
      });

      const actions = await fixture.discoverActions(observerId);

      // Note: Test environment doesn't populate primaryTargetId/secondaryTargetId
      // The action being in the list means scopes were successfully resolved
      expect(actions).toContainAction('movement:travel_through_dimensions');
    });

    it('should NOT discover travel_through_dimensions for humans', async () => {
      const { perimeterId } = await createDimensionalScenario(fixture);

      // Create human without dimensional travel component
      const humanId = fixture.createEntity({
        id: 'test-human',
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

      expect(actions).not.toContainAction('movement:travel_through_dimensions');
    });

    it('should NOT discover travel_through_dimensions for unblocked exits', async () => {
      // Create location with unblocked exit
      const locationId = fixture.createEntity({
        id: 'test-location',
        name: 'normal location',
        components: [
          {
            componentId: 'core:location',
            data: {},
          },
        ],
      });

      const targetId = fixture.createEntity({
        id: 'test-target',
        name: 'another location',
        components: [
          {
            componentId: 'core:location',
            data: {},
          },
        ],
      });

      // Add unblocked exit
      await fixture.modifyComponent(locationId, 'locations:exits', [
        {
          direction: 'north',
          target: targetId,
          blocker: null,
        },
      ]);

      const observerId = fixture.createEntity({
        id: 'test-observer2',
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
            componentId: 'movement:can_travel_through_dimensions',
            data: {},
          },
        ],
      });

      const actions = await fixture.discoverActions(observerId);

      // Should not appear because exits are unblocked (normal movement)
      expect(actions).not.toContainAction('movement:travel_through_dimensions');
    });
  });

  describe('Action Filtering', () => {
    it('should NOT discover dimensional travel for actors without required component at dimensional portal', async () => {
      const { perimeterId } = await createDimensionalScenario(fixture);

      const humanId = fixture.createEntity({
        id: 'test-human-filtering',
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

      // Humans without dimensional travel component should not see the action
      expect(actions).not.toContainAction('movement:travel_through_dimensions');
    });
  });
});

/**
 * Helper: Create scenario with dimensional portal
 *
 * @param {object} fixture - Test fixture instance
 * @returns {object} Scenario with perimeterId, dimensionId, and blockerId
 */
async function createDimensionalScenario(fixture) {
  const perimeterId = fixture.createEntity({
    id: 'helper-perimeter',
    name: 'perimeter of rip in reality',
    components: [{ componentId: 'core:location', data: {} }],
  });

  const dimensionId = fixture.createEntity({
    id: 'helper-dimension',
    name: 'eldritch dimension',
    components: [{ componentId: 'core:location', data: {} }],
  });

  const blockerId = fixture.createEntity({
    id: 'helper-blocker',
    name: 'dimensional rift',
    components: [{ componentId: 'blockers:is_dimensional_portal', data: {} }],
  });

  await fixture.modifyComponent(perimeterId, 'locations:exits', [
    {
      direction: 'through the dimensional rift',
      target: dimensionId,
      blocker: blockerId,
    },
  ]);

  return { perimeterId, dimensionId, blockerId };
}
