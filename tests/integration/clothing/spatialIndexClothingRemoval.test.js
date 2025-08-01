/**
 * @file Integration tests for spatial index behavior during clothing removal
 * Reproduces and tests the fix for spatial index manager error when removing clothing
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ClothingIntegrationTestBed from '../../common/clothing/clothingIntegrationTestBed.js';
import { setupIntegrationTestUtilities } from '../../common/setup/integrationTestUtilities.js';

describe('Spatial Index Clothing Removal Integration', () => {
  let testBed;
  let utils;
  let container;
  let entityManager;
  let eventBus;
  let systemLogicInterpreter;
  let originalConsoleError;

  beforeEach(async () => {
    // Setup test bed
    testBed = new ClothingIntegrationTestBed();
    await testBed.setup();

    // Get utilities
    utils = setupIntegrationTestUtilities(testBed);
    container = testBed.container;

    // Get services
    entityManager = testBed.getEntityManager();
    eventBus = testBed.getEventBus();
    systemLogicInterpreter = testBed.getSystemLogicInterpreter();

    // Capture console.error to detect spatial index errors
    originalConsoleError = console.error;
    console.error = jest.fn();
  });

  afterEach(async () => {
    // Restore console.error
    if (originalConsoleError) {
      console.error = originalConsoleError;
    }
    await testBed.cleanup();
  });

  describe('Clothing Removal with Spatial Index Updates', () => {
    it('should handle removing clothing item without spatial index errors', async () => {
      // Arrange - Create actor with position and equipped clothing using the correct API
      const actor = utils.createEntityWithEquipment({
        equipment: {
          torso_upper: 'white_cotton_crew_tshirt',
        },
        position: 'test_location',
      });

      // Create the clothing item
      const clothingItem = utils.createClothingItem({
        id: 'white_cotton_crew_tshirt',
        name: 'white cotton crew t-shirt',
      });

      // Clear any previous error logs
      console.error.mockClear();

      // Act - Use the UnequipClothingHandler directly to test the spatial index behavior
      const handler = container.resolve('UnequipClothingHandler');
      await handler.execute(
        {
          entity_ref: 'actor',
          clothing_item_id: 'white_cotton_crew_tshirt',
          destination: 'ground',
        },
        {
          actorId: actor.id,
          logger: testBed.logger,
        }
      );

      // Assert - No spatial index errors should have been logged
      const spatialIndexErrors = console.error.mock.calls.filter((call) =>
        call.some(
          (arg) =>
            typeof arg === 'string' &&
            (arg.includes('SpatialIndexManager') || arg.includes('Invalid ID'))
        )
      );

      expect(spatialIndexErrors).toHaveLength(0);

      // Verify the clothing item was placed on ground (has position now)
      const itemPosition = entityManager.getComponentData(
        'white_cotton_crew_tshirt',
        'core:position'
      );
      expect(itemPosition).toEqual({ locationId: 'test_location' });
    });

    it('should reproduce the spatial index error before fix', async () => {
      // This test specifically creates a scenario that should reproduce the error
      // described in the original logs

      // Arrange - Create actor with position
      const actor = utils.createEntityWithEquipment({
        equipment: {
          torso_upper: 'test_clothing_item',
        },
        position: 'test_location',
      });

      // Create the clothing item
      const clothingItem = utils.createClothingItem({
        id: 'test_clothing_item',
        name: 'test clothing item',
      });

      // The clothing item should not have a position initially
      // This simulates the scenario from the logs where the clothing item
      // had no previous position component

      // Clear console errors
      console.error.mockClear();

      // Act - Unequip clothing, which should trigger spatial index update
      const handler = container.resolve('UnequipClothingHandler');
      await handler.execute(
        {
          entity_ref: 'actor',
          clothing_item_id: 'test_clothing_item',
          destination: 'ground',
        },
        {
          actorId: actor.id,
          logger: testBed.logger,
        }
      );

      // Assert - Check if any spatial index errors occurred
      const allErrors = console.error.mock.calls;
      const spatialIndexErrors = allErrors.filter((call) =>
        call.some(
          (arg) =>
            typeof arg === 'string' &&
            (arg.includes(
              'SpatialIndexManager.updateEntityLocation: Invalid ID'
            ) ||
              arg.includes("Invalid ID 'null'") ||
              arg.includes('SpatialIndexManager'))
        )
      );

      // Check for spatial index errors (should be none after the fix)

      // The test should pass after we fix the spatial index manager
      expect(spatialIndexErrors).toHaveLength(0);

      // Verify the operation completed successfully
      const itemPosition = entityManager.getComponentData(
        'test_clothing_item',
        'core:position'
      );
      expect(itemPosition.locationId).toBe('test_location');
    });
  });
});
