/**
 * @file E2E tests for patrol dimensional travel scenario
 * @description Tests complete patrol scenario with dimensional restrictions
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import '../../common/mods/domainMatchers.js';

describe('Patrol Dimensional Travel Scenario', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forMod('patrol');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('Complete Scenario', () => {
    it('should prevent humans from crossing dimensional boundary', async () => {
      // Create human character
      const lenId = fixture.createEntity({
        name: 'Len Amezua',
        components: [
          { componentId: 'core:actor', data: {} },
          { componentId: 'core:name', data: { text: 'Len Amezua' } },
        ],
      });

      // Create locations and blocker
      const { perimeterId, dimensionId } = createDimensionalLocations(fixture);

      // Place Len at perimeter
      fixture.modifyComponent(lenId, 'core:position', {
        locationId: perimeterId,
      });

      // Discover actions
      const actions = await fixture.discoverActions(lenId);

      // Should not have dimensional travel action (lacks component)
      expect(actions).not.toContainAction('patrol:travel_through_dimensions');

      // Should not have go action to eldritch dimension (blocked exit)
      expect(actions).not.toContainAction('movement:go', {
        primaryTargetId: dimensionId,
      });
    });

    it('should allow Writhing Observer to cross dimensional boundary', async () => {
      // Create Writhing Observer
      const observerId = fixture.createEntity({
        name: 'Writhing Observer',
        components: [
          { componentId: 'core:actor', data: {} },
          { componentId: 'core:name', data: { text: 'Writhing Observer' } },
          { componentId: 'patrol:can_travel_through_dimensions', data: {} },
        ],
      });

      // Create locations and blocker
      const { perimeterId, dimensionId } = createDimensionalLocations(fixture);

      // Place Observer at perimeter
      fixture.modifyComponent(observerId, 'core:position', {
        locationId: perimeterId,
      });

      // Discover actions
      const actions = await fixture.discoverActions(observerId);

      // Should have dimensional travel action (has component)
      expect(actions).toContainAction('patrol:travel_through_dimensions');

      // Execute travel
      await fixture.executeAction(observerId, dimensionId);

      // Verify successful travel
      const position = fixture.getComponent(observerId, 'core:position');
      expect(position.locationId).toBe(dimensionId);
    });

    it('should allow Observer to travel back and forth', async () => {
      const observerId = fixture.createEntity({
        name: 'Writhing Observer',
        components: [
          { componentId: 'core:actor', data: {} },
          { componentId: 'core:name', data: { text: 'Writhing Observer' } },
          { componentId: 'patrol:can_travel_through_dimensions', data: {} },
        ],
      });

      const { perimeterId, dimensionId } =
        createBidirectionalDimensionalLocations(fixture);

      // Start at perimeter
      fixture.modifyComponent(observerId, 'core:position', {
        locationId: perimeterId,
      });

      // Travel to dimension
      await fixture.executeAction(observerId, dimensionId);
      let position = fixture.getComponent(observerId, 'core:position');
      expect(position.locationId).toBe(dimensionId);

      // Travel back to perimeter
      await fixture.executeAction(observerId, perimeterId);
      position = fixture.getComponent(observerId, 'core:position');
      expect(position.locationId).toBe(perimeterId);
    });
  });
});

/**
 * Helper: Create dimensional locations with one-way exit
 *
 * @param {object} fixture - Test fixture instance
 * @returns {object} Created locations and blocker
 */
function createDimensionalLocations(fixture) {
  const perimeterId = fixture.createEntity({
    name: 'perimeter of rip in reality',
    components: [
      { componentId: 'core:location', data: {} },
      { componentId: 'core:name', data: { text: 'perimeter of rip in reality' } },
    ],
  });

  const dimensionId = fixture.createEntity({
    name: 'eldritch dimension',
    components: [
      { componentId: 'core:location', data: {} },
      { componentId: 'core:name', data: { text: 'eldritch dimension' } },
    ],
  });

  const blockerId = fixture.createEntity({
    name: 'dimensional rift',
    components: [
      { componentId: 'patrol:is_dimensional_portal', data: {} },
      { componentId: 'core:name', data: { text: 'dimensional rift' } },
    ],
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
 * Helper: Create dimensional locations with bidirectional exits
 *
 * @param {object} fixture - Test fixture instance
 * @returns {object} Created locations with bidirectional portals
 */
function createBidirectionalDimensionalLocations(fixture) {
  const perimeterId = fixture.createEntity({
    name: 'perimeter of rip in reality',
    components: [
      { componentId: 'core:location', data: {} },
      { componentId: 'core:name', data: { text: 'perimeter of rip in reality' } },
    ],
  });

  const dimensionId = fixture.createEntity({
    name: 'eldritch dimension',
    components: [
      { componentId: 'core:location', data: {} },
      { componentId: 'core:name', data: { text: 'eldritch dimension' } },
    ],
  });

  const blockerId = fixture.createEntity({
    name: 'dimensional rift',
    components: [
      { componentId: 'patrol:is_dimensional_portal', data: {} },
      { componentId: 'core:name', data: { text: 'dimensional rift' } },
    ],
  });

  // Exit from perimeter to dimension
  fixture.modifyComponent(perimeterId, 'movement:exits', [
    {
      direction: 'through the dimensional rift',
      target: dimensionId,
      blocker: blockerId,
    },
  ]);

  // Exit from dimension to perimeter
  fixture.modifyComponent(dimensionId, 'movement:exits', [
    {
      direction: 'through the dimensional tear back to reality',
      target: perimeterId,
      blocker: blockerId,
    },
  ]);

  return { perimeterId, dimensionId, blockerId };
}
