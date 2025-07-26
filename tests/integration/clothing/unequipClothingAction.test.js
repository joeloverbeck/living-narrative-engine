/**
 * @file Integration tests for the complete clothing removal action flow
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ClothingIntegrationTestBed from '../../common/clothing/clothingIntegrationTestBed.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { setupIntegrationTestUtilities } from '../../common/setup/integrationTestUtilities.js';

describe('Clothing Remove Action Integration', () => {
  let testBed;
  let utils;
  let container;
  let actionService;
  let entityManager;
  let eventBus;
  let systemLogicInterpreter;
  let schemaValidator;

  beforeEach(async () => {
    // Setup test bed
    testBed = new ClothingIntegrationTestBed();
    await testBed.setup();

    // Get utilities
    utils = setupIntegrationTestUtilities(testBed);
    container = testBed.container;

    // Get services
    actionService = testBed.getActionService();
    entityManager = testBed.getEntityManager();
    eventBus = testBed.getEventBus();
    systemLogicInterpreter = testBed.getSystemLogicInterpreter();
    schemaValidator = new AjvSchemaValidator({ logger: testBed.logger });
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Remove Clothing Action Flow', () => {
    it('should generate remove clothing actions for equipped items', async () => {
      // Arrange
      const actor = utils.createEntityWithEquipment({
        equipment: {
          torso_upper: 'white_cotton_crew_tshirt',
          torso_lower: 'sand_beige_cotton_chinos',
          feet: 'white_leather_sneakers',
        },
      });

      // Act
      const actions = await actionService.getActionsForEntity(actor.id);

      // Assert
      const removeClothingActions = actions.filter(
        (action) => action.id === 'clothing:remove_clothing'
      );

      expect(removeClothingActions).toHaveLength(3);
      expect(removeClothingActions.map((a) => a.targetId)).toContain(
        'white_cotton_crew_tshirt'
      );
      expect(removeClothingActions.map((a) => a.targetId)).toContain(
        'sand_beige_cotton_chinos'
      );
      expect(removeClothingActions.map((a) => a.targetId)).toContain(
        'white_leather_sneakers'
      );
    });

    it('should successfully remove clothing and place it on ground', async () => {
      // Arrange
      const actor = utils.createEntityWithEquipment({
        equipment: {
          torso_upper: 'white_cotton_crew_tshirt',
        },
        position: 'test_location',
      });

      const shirtEntity = utils.createClothingItem({
        id: 'white_cotton_crew_tshirt',
        name: 'white cotton crew t-shirt',
      });

      // Subscribe to events
      const unequippedEvents = [];
      const movedEvents = [];
      testBed.eventDispatcher.subscribe('clothing:unequipped', (event) =>
        unequippedEvents.push(event)
      );
      testBed.eventDispatcher.subscribe('core:entity_moved', (event) =>
        movedEvents.push(event)
      );

      // Act - Trigger remove clothing action
      await eventBus.emit({
        type: 'core:attempt_action',
        payload: {
          actionId: 'clothing:remove_clothing',
          actorId: actor.id,
          targetId: 'white_cotton_crew_tshirt',
        },
      });

      // Use the UnequipClothingHandler directly for testing
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

      // Assert
      // Check equipment was removed
      const equipment = entityManager.getComponentData(
        actor.id,
        'clothing:equipment'
      );
      expect(equipment.equipped.torso_upper).toBeUndefined();

      // Check item was placed on ground
      const itemPosition = entityManager.getComponentData(
        'white_cotton_crew_tshirt',
        'core:position'
      );
      expect(itemPosition).toEqual({ locationId: 'test_location' });

      // Check events were dispatched
      expect(unequippedEvents).toHaveLength(1);
      expect(unequippedEvents[0]).toMatchObject({
        entityId: actor.id,
        clothingItemId: 'white_cotton_crew_tshirt',
      });
    });

    it('should place item in inventory when actor has inventory component', async () => {
      // Arrange
      const actor = utils.createEntityWithEquipment({
        equipment: {
          torso_upper: 'white_cotton_crew_tshirt',
        },
        inventory: ['existing_item'],
      });

      const shirtEntity = utils.createClothingItem({
        id: 'white_cotton_crew_tshirt',
        name: 'white cotton crew t-shirt',
      });

      // Modify the rule to use inventory destination
      const modifiedParams = {
        entity_ref: 'actor',
        clothing_item_id: 'white_cotton_crew_tshirt',
        destination: 'inventory',
      };

      // Act - Execute the operation directly
      const handler = container.resolve('UnequipClothingHandler');
      await handler.execute(modifiedParams, {
        actorId: actor.id,
        targetId: 'white_cotton_crew_tshirt',
        logger: testBed.logger,
      });

      // Assert
      const inventory = entityManager.getComponentData(
        actor.id,
        'core:inventory'
      );
      expect(inventory.items).toContain('white_cotton_crew_tshirt');
      expect(inventory.items).toContain('existing_item');
    });

    it('should only show topmost clothing items as removable', async () => {
      // Arrange - use array to represent layered clothing
      const actor = utils.createEntityWithEquipment({
        equipment: {
          torso_upper: [
            'white_cotton_crew_tshirt',
            'white_structured_linen_blazer',
          ], // base, then outer
        },
      });

      // Create clothing items with proper layer metadata
      utils.createClothingItem({
        id: 'white_structured_linen_blazer',
        layer: 'outer',
        slot: 'torso_upper',
      });

      utils.createClothingItem({
        id: 'white_cotton_crew_tshirt',
        layer: 'base',
        slot: 'torso_upper',
      });

      // Act
      const actions = await actionService.getActionsForEntity(actor.id);
      const removeActions = actions.filter(
        (a) => a.id === 'clothing:remove_clothing'
      );

      // Assert
      // Only the outer layer (blazer) should be removable
      expect(removeActions).toHaveLength(1);
      expect(removeActions[0].targetId).toBe('white_structured_linen_blazer');
    });

    it('should handle cascade unequip correctly', async () => {
      // Arrange
      const actor = utils.createEntityWithEquipment({
        equipment: {
          torso_upper: [
            'white_cotton_crew_tshirt',
            'indigo_denim_trucker_jacket',
          ],
        },
      });

      const shirtEntity = utils.createClothingItem({
        id: 'white_cotton_crew_tshirt',
        name: 'white cotton crew t-shirt',
      });

      const jacketEntity = utils.createClothingItem({
        id: 'indigo_denim_trucker_jacket',
        name: 'indigo denim trucker jacket',
      });

      // Act - Execute with cascade
      const handler = container.resolve('UnequipClothingHandler');
      await handler.execute(
        {
          entity_ref: 'actor',
          clothing_item_id: 'indigo_denim_trucker_jacket',
          cascade_unequip: true,
          destination: 'ground',
        },
        {
          actorId: actor.id,
          logger: testBed.logger,
        }
      );

      // Assert
      const equipment = entityManager.getComponentData(
        actor.id,
        'clothing:equipment'
      );
      // Both items should be removed with cascade
      expect(equipment.equipped.torso_upper).toBeUndefined();
    });

    it('should fail gracefully when trying to remove non-equipped item', async () => {
      // Arrange
      const actor = utils.createEntityWithEquipment({
        equipment: {
          torso_upper: 'white_cotton_crew_tshirt',
        },
      });

      // Act
      const handler = container.resolve('UnequipClothingHandler');
      await handler.execute(
        {
          entity_ref: 'actor',
          clothing_item_id: 'non_existent_item',
          destination: 'ground',
        },
        {
          actorId: actor.id,
          logger: testBed.logger,
        }
      );

      // Assert
      // Equipment should remain unchanged
      const equipment = entityManager.getComponentData(
        actor.id,
        'clothing:equipment'
      );
      expect(equipment.equipped.torso_upper).toBe('white_cotton_crew_tshirt');
    });
  });
});
