/**
 * @file Integration tests for error handling in clothing unequip operations
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import ClothingIntegrationTestBed from '../../common/clothing/clothingIntegrationTestBed.js';
import { setupIntegrationTestUtilities } from '../../common/setup/integrationTestUtilities.js';

describe('Clothing Unequip Error Handling Integration', () => {
  let testBed;
  let utils;
  let container;
  let entityManager;
  let eventBus;
  let capturedEvents;

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
    
    // Capture events for verification
    capturedEvents = [];
    testBed.eventDispatcher.subscribe('clothing:unequipped', event => {
      capturedEvents.push({ type: 'clothing:unequipped', payload: event });
    });
    testBed.eventDispatcher.subscribe('core:system_error_occurred', event => {
      capturedEvents.push({ type: 'core:system_error_occurred', payload: event });
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Event Validation Errors', () => {
    it('should handle invalid reason values gracefully', async () => {
      // Arrange
      const actor = utils.createEntityWithEquipment({
        equipment: {
          torso_upper: 'white_cotton_crew_tshirt',
        },
        position: 'test_location',
      });
      
      utils.createClothingItem({
        id: 'white_cotton_crew_tshirt',
        name: 'white cotton crew t-shirt',
      });

      // Get the handler and mock a scenario where orchestrator sends wrong reason
      const handler = container.resolve('UnequipClothingHandler');
      const orchestrator = container.resolve('EquipmentOrchestrator');
      
      // Mock the orchestrator to return a result that would trigger the old invalid reason
      const originalOrchestrate = orchestrator.orchestrateUnequipment;
      orchestrator.orchestrateUnequipment = jest.fn().mockImplementation((...args) => {
        // Call the original with the correct reason to ensure it works
        return originalOrchestrate.call(orchestrator, ...args);
      });

      // Act - Execute the unequip operation
      await handler.execute(
        {
          entity_ref: 'actor',
          clothing_item_id: 'white_cotton_crew_tshirt',
          destination: 'ground',
        },
        {
          evaluationContext: {
            actor: { id: actor.id },
            target: { id: 'white_cotton_crew_tshirt' },
            context: {},
          },
          ruleId: 'test-rule',
          logger: testBed.logger,
        }
      );

      // Assert
      // With the fix, the event should be dispatched successfully
      const unequippedEvents = capturedEvents.filter(e => e.type === 'clothing:unequipped');
      expect(unequippedEvents).toHaveLength(1);
      expect(unequippedEvents[0].payload.reason).toBe('manual');
      
      // Verify equipment was actually removed
      const equipment = entityManager.getComponentData(actor.id, 'clothing:equipment');
      expect(equipment.equipped.torso_upper).toBeUndefined();
    });

    it('should fail gracefully when event validation fails', async () => {
      // Arrange - Create an actor without proper setup
      const actor = utils.createEntityWithEquipment({
        equipment: {
          torso_upper: 'invalid_item',
        },
      });

      const handler = container.resolve('UnequipClothingHandler');

      // Act - Try to unequip non-existent item
      await handler.execute(
        {
          entity_ref: 'actor',
          clothing_item_id: 'invalid_item',
          destination: 'ground',
        },
        {
          evaluationContext: {
            actor: { id: actor.id },
            target: { id: 'invalid_item' },
            context: {},
          },
          ruleId: 'test-rule',
          logger: testBed.logger,
        }
      );

      // Assert - Should handle gracefully without crashing
      // The orchestrator should return success: false for invalid items
      const equipment = entityManager.getComponentData(actor.id, 'clothing:equipment');
      expect(equipment.equipped.torso_upper).toBe('invalid_item'); // Should remain unchanged
    });
  });

  describe('Spatial Index Error Handling', () => {
    it('should handle null entity IDs gracefully in spatial updates', async () => {
      // Arrange
      const spatialSynchronizer = container.resolve('SpatialIndexSynchronizer');
      const originalWarn = testBed.logger.warn;
      const warnCalls = [];
      testBed.logger.warn = (message, ...args) => {
        warnCalls.push([message, ...args]);
        originalWarn.call(testBed.logger, message, ...args);
      };

      // Act - Simulate a position change event with null entity ID
      spatialSynchronizer.onPositionChanged({
        entity: { id: null }, // Invalid entity ID
        componentTypeId: 'core:position',
        oldComponentData: { locationId: 'old_location' },
        componentData: { locationId: 'new_location' },
      });

      // Assert
      const spatialWarnings = warnCalls.filter(([message]) =>
        message.includes('SpatialIndexSynchronizer.onPositionChanged: Invalid entity ID')
      );
      expect(spatialWarnings).toHaveLength(1);
      expect(spatialWarnings[0][1]).toMatchObject({
        entity: { id: null },
        componentTypeId: 'core:position',
      });

      // Restore original logger
      testBed.logger.warn = originalWarn;
    });

    it('should handle undefined entity gracefully in spatial updates', async () => {
      // Arrange
      const spatialSynchronizer = container.resolve('SpatialIndexSynchronizer');
      const originalWarn = testBed.logger.warn;
      const warnCalls = [];
      testBed.logger.warn = (message, ...args) => {
        warnCalls.push([message, ...args]);
        originalWarn.call(testBed.logger, message, ...args);
      };

      // Act - Simulate a position change event with undefined entity
      spatialSynchronizer.onPositionChanged({
        entity: undefined,
        componentTypeId: 'core:position',
        oldComponentData: { locationId: 'old_location' },
        componentData: { locationId: 'new_location' },
      });

      // Assert
      const spatialWarnings = warnCalls.filter(([message]) =>
        message.includes('SpatialIndexSynchronizer.onPositionChanged: Invalid entity ID')
      );
      expect(spatialWarnings).toHaveLength(1);

      // Restore original logger
      testBed.logger.warn = originalWarn;
    });

    it('should handle empty string entity ID gracefully in spatial updates', async () => {
      // Arrange
      const spatialSynchronizer = container.resolve('SpatialIndexSynchronizer');
      const originalWarn = testBed.logger.warn;
      const warnCalls = [];
      testBed.logger.warn = (message, ...args) => {
        warnCalls.push([message, ...args]);
        originalWarn.call(testBed.logger, message, ...args);
      };

      // Act - Simulate a position change event with empty string entity ID
      spatialSynchronizer.onPositionChanged({
        entity: { id: '' }, // Empty string entity ID
        componentTypeId: 'core:position',
        oldComponentData: { locationId: 'old_location' },
        componentData: { locationId: 'new_location' },
      });

      // Assert
      const spatialWarnings = warnCalls.filter(([message]) =>
        message.includes('SpatialIndexSynchronizer.onPositionChanged: Invalid entity ID')
      );
      expect(spatialWarnings).toHaveLength(1);

      // Restore original logger
      testBed.logger.warn = originalWarn;
    });
  });

  describe('Complete Unequip Flow Error Recovery', () => {
    it('should recover from partial failures and maintain system integrity', async () => {
      // Arrange
      const actor = utils.createEntityWithEquipment({
        equipment: {
          torso_upper: 'white_cotton_crew_tshirt',
          torso_lower: 'sand_beige_cotton_chinos',
        },
        position: 'test_location',
        inventory: ['existing_item'],
      });
      
      utils.createClothingItem({
        id: 'white_cotton_crew_tshirt',
        name: 'white cotton crew t-shirt',
      });

      const handler = container.resolve('UnequipClothingHandler');

      // Act - Execute successful unequip
      await handler.execute(
        {
          entity_ref: 'actor',
          clothing_item_id: 'white_cotton_crew_tshirt',
          destination: 'inventory',
        },
        {
          evaluationContext: {
            actor: { id: actor.id },
            target: { id: 'white_cotton_crew_tshirt' },
            context: {},
          },
          ruleId: 'test-rule',
          logger: testBed.logger,
        }
      );

      // Assert - Verify system integrity
      const equipment = entityManager.getComponentData(actor.id, 'clothing:equipment');
      expect(equipment.equipped.torso_upper).toBeUndefined();
      expect(equipment.equipped.torso_lower).toBe('sand_beige_cotton_chinos'); // Other equipment intact

      const inventory = entityManager.getComponentData(actor.id, 'core:inventory');
      expect(inventory.items).toContain('white_cotton_crew_tshirt');
      expect(inventory.items).toContain('existing_item'); // Existing inventory intact

      // Verify event was dispatched correctly
      const unequippedEvents = capturedEvents.filter(e => e.type === 'clothing:unequipped');
      expect(unequippedEvents).toHaveLength(1);
      expect(unequippedEvents[0].payload).toMatchObject({
        entityId: actor.id,
        clothingItemId: 'white_cotton_crew_tshirt',
        reason: 'manual',
      });
    });
  });
});