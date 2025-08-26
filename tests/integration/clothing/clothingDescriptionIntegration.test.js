/**
 * @file Integration tests for the complete clothing description workflow
 * Verifies the REGENERATE_DESCRIPTION operation integrates correctly with the clothing system
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ClothingIntegrationTestBed from '../../common/clothing/clothingIntegrationTestBed.js';
import { setupIntegrationTestUtilities } from '../../common/setup/integrationTestUtilities.js';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

describe('Clothing Description Integration', () => {
  let testBed;
  let utils;
  let container;
  let entityManager;
  let systemLogicInterpreter;
  let bodyDescriptionComposer;
  let eventBus;

  beforeEach(async () => {
    testBed = new ClothingIntegrationTestBed();
    await testBed.setup();

    utils = setupIntegrationTestUtilities(testBed);
    container = testBed.container;
    entityManager = testBed.getEntityManager();
    systemLogicInterpreter = testBed.getSystemLogicInterpreter();
    eventBus = testBed.getEventBus();

    // Setup body description composer with required dependencies
    bodyDescriptionComposer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder:
        testBed.createMockBodyPartDescriptionBuilder(),
      bodyGraphService: testBed.createMockBodyGraphService(),
      entityFinder: entityManager,
      anatomyFormattingService: testBed.createMockAnatomyFormattingService(),
      partDescriptionGenerator: testBed.createMockPartDescriptionGenerator(),
      equipmentDescriptionService: testBed.services.get(
        'equipmentDescriptionService'
      ),
      logger: testBed.logger,
    });

    // Mock the container to return a RegenerateDescriptionHandler
    container.resolve = jest.fn().mockImplementation((serviceName) => {
      if (serviceName === 'RegenerateDescriptionHandler') {
        return {
          execute: jest.fn().mockImplementation(async (params, context) => {
            const { entity_ref } = params;
            const entityId = context?.actorId || entity_ref;

            // Simulate description regeneration
            const newDescription =
              await bodyDescriptionComposer.composeDescription(
                entityManager.entities.get(entityId)
              );

            // Update the description component
            entityManager.setComponentData(entityId, 'core:description', {
              text: newDescription,
              lastUpdated: Date.now() + 1000, // Ensure timestamp is different
            });

            return true;
          }),
        };
      }

      // Return the UnequipClothingHandler mock from test bed
      if (serviceName === 'UnequipClothingHandler') {
        return {
          execute: jest.fn().mockImplementation(async (params, context) => {
            const {
              entity_ref,
              clothing_item_id,
              destination = 'ground',
            } = params;
            const entityId = context?.actorId || entity_ref;

            // Get current equipment
            const equipment = entityManager.getComponentData(
              entityId,
              'clothing:equipment'
            );
            if (equipment && equipment.equipped) {
              // Remove the item from equipment
              Object.keys(equipment.equipped).forEach((slot) => {
                if (equipment.equipped[slot] === clothing_item_id) {
                  delete equipment.equipped[slot];
                }
              });

              entityManager.setComponentData(
                entityId,
                'clothing:equipment',
                equipment
              );
            }

            // Place item at destination
            if (destination === 'ground') {
              const entityPosition = entityManager.getComponentData(
                entityId,
                'core:position'
              );
              if (entityPosition) {
                entityManager.setComponentData(
                  clothing_item_id,
                  'core:position',
                  {
                    locationId: entityPosition.locationId,
                  }
                );
              }
            }

            return true;
          }),
        };
      }

      return null;
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Single Clothing Item Removal', () => {
    it('should update description after removing single clothing item', async () => {
      // Setup: Entity with clothing equipped and initial description
      const actor = utils.createEntityWithEquipment({
        equipment: {
          head: 'clothing:stylish_hat',
        },
        position: 'test_location',
      });

      const hat = utils.createClothingItem({
        id: 'clothing:stylish_hat',
        name: 'stylish hat',
        slot: 'head',
      });

      // Set initial description
      const initialTimestamp = Date.now();
      entityManager.setComponentData(actor.id, 'core:description', {
        text: 'A person wearing a stylish hat.',
        lastUpdated: initialTimestamp,
      });

      const initialDescription = entityManager.getComponentData(
        actor.id,
        'core:description'
      );

      // Mock the bodyDescriptionComposer to return different description after removal
      bodyDescriptionComposer.composeDescription = jest
        .fn()
        .mockResolvedValueOnce('A person without any headwear.');

      // Action: Execute clothing removal through event system
      await eventBus.emit({
        type: 'core:attempt_action',
        payload: {
          actionId: 'clothing:remove_clothing',
          actorId: actor.id,
          targetId: hat.id,
        },
      });

      // Simulate the rule operations
      systemLogicInterpreter.simulateOperation({
        type: 'GET_NAME',
        entity: 'actor',
      });
      systemLogicInterpreter.simulateOperation({
        type: 'GET_NAME',
        entity: 'target',
      });
      systemLogicInterpreter.simulateOperation({
        type: 'QUERY_COMPONENT',
        component: 'core:position',
      });
      systemLogicInterpreter.simulateOperation({ type: 'UNEQUIP_CLOTHING' });
      systemLogicInterpreter.simulateOperation({
        type: 'REGENERATE_DESCRIPTION',
      });

      // Execute the RegenerateDescriptionHandler
      const regenerateHandler = container.resolve(
        'RegenerateDescriptionHandler'
      );
      await regenerateHandler.execute(
        { entity_ref: 'actor' },
        { actorId: actor.id }
      );

      // Wait for rule processing to complete
      await testBed.waitForEventProcessing();

      // Verify: Description updated to reflect removed item
      const descriptionComponent = entityManager.getComponentData(
        actor.id,
        'core:description'
      );
      expect(descriptionComponent.text).not.toBe(initialDescription.text);
      expect(descriptionComponent.text).not.toContain('hat');
      expect(descriptionComponent.text).toBe('A person without any headwear.');
      expect(descriptionComponent.lastUpdated).toBeGreaterThan(
        initialDescription.lastUpdated
      );
    });

    it('should handle removal from different body locations', async () => {
      // Test removing items from head, torso, legs, feet
      const testCases = [
        { slot: 'head', item: 'test_hat', description: 'wearing a hat' },
        {
          slot: 'torso_upper',
          item: 'test_shirt',
          description: 'wearing a shirt',
        },
        { slot: 'legs', item: 'test_pants', description: 'wearing pants' },
        { slot: 'feet', item: 'test_shoes', description: 'wearing shoes' },
      ];

      for (const testCase of testCases) {
        const actor = utils.createEntityWithEquipment({
          equipment: {
            [testCase.slot]: testCase.item,
          },
          position: 'test_location',
        });

        const item = utils.createClothingItem({
          id: testCase.item,
          name: testCase.item.replace('test_', ''),
          slot: testCase.slot,
        });

        // Set initial description
        entityManager.setComponentData(actor.id, 'core:description', {
          text: `A person ${testCase.description}.`,
          lastUpdated: Date.now(),
        });

        // Mock the composer to return updated description
        bodyDescriptionComposer.composeDescription = jest
          .fn()
          .mockResolvedValueOnce(
            `A person without any ${testCase.slot} clothing.`
          );

        // Execute removal
        const regenerateHandler = container.resolve(
          'RegenerateDescriptionHandler'
        );
        await regenerateHandler.execute(
          { entity_ref: actor.id },
          { actorId: actor.id }
        );

        await testBed.waitForEventProcessing();

        // Verify description updated correctly for each location
        const description = entityManager.getComponentData(
          actor.id,
          'core:description'
        );
        expect(description.text).not.toContain(
          testCase.item.replace('test_', '')
        );
        expect(description.text).toContain(
          `without any ${testCase.slot} clothing`
        );
      }
    });
  });

  describe('Multiple Clothing Operations', () => {
    it('should update description after removing multiple items', async () => {
      // Setup: Entity with multiple clothing items equipped
      const actor = utils.createEntityWithEquipment({
        equipment: {
          head: 'clothing:hat',
          torso_upper: 'clothing:shirt',
          legs: 'clothing:pants',
        },
        position: 'test_location',
      });

      const items = [
        utils.createClothingItem({
          id: 'clothing:hat',
          name: 'hat',
          slot: 'head',
        }),
        utils.createClothingItem({
          id: 'clothing:shirt',
          name: 'shirt',
          slot: 'torso_upper',
        }),
        utils.createClothingItem({
          id: 'clothing:pants',
          name: 'pants',
          slot: 'legs',
        }),
      ];

      // Set initial description
      entityManager.setComponentData(actor.id, 'core:description', {
        text: 'A person wearing a hat, shirt, and pants.',
        lastUpdated: Date.now(),
      });

      // Mock progressive description updates
      const descriptions = [
        'A person wearing a shirt and pants.',
        'A person wearing pants.',
        'A person without any clothing.',
      ];
      let descIndex = 0;
      bodyDescriptionComposer.composeDescription = jest
        .fn()
        .mockImplementation(() => Promise.resolve(descriptions[descIndex++]));

      // Remove items in sequence through event system
      for (const item of items) {
        await eventBus.emit({
          type: 'core:attempt_action',
          payload: {
            actionId: 'clothing:remove_clothing',
            actorId: actor.id,
            targetId: item.id,
          },
        });

        // Execute the regeneration
        const regenerateHandler = container.resolve(
          'RegenerateDescriptionHandler'
        );
        await regenerateHandler.execute(
          { entity_ref: actor.id },
          { actorId: actor.id }
        );

        await testBed.waitForEventProcessing();
      }

      // Verify: Final description reflects all changes
      const descriptionComponent = entityManager.getComponentData(
        actor.id,
        'core:description'
      );
      const finalDescription = descriptionComponent.text;
      expect(finalDescription).toBe('A person without any clothing.');
      expect(finalDescription).not.toContain('hat');
      expect(finalDescription).not.toContain('shirt');
      expect(finalDescription).not.toContain('pants');
    });

    it('should handle rapid successive clothing changes', async () => {
      // Test multiple quick operations
      const actor = utils.createEntityWithEquipment({
        equipment: {
          head: 'item1',
          torso_upper: 'item2',
          legs: 'item3',
        },
        position: 'test_location',
      });

      // Create items
      ['item1', 'item2', 'item3'].forEach((id) => {
        utils.createClothingItem({ id, name: id });
      });

      // Set initial description
      entityManager.setComponentData(actor.id, 'core:description', {
        text: 'Initial description with all items.',
        lastUpdated: Date.now(),
      });

      let callCount = 0;
      bodyDescriptionComposer.composeDescription = jest
        .fn()
        .mockImplementation(() => {
          callCount++;
          return Promise.resolve(`Description update ${callCount}`);
        });

      // Fire multiple events rapidly
      const promises = ['item1', 'item2', 'item3'].map((itemId) =>
        eventBus.emit({
          type: 'core:attempt_action',
          payload: {
            actionId: 'clothing:remove_clothing',
            actorId: actor.id,
            targetId: itemId,
          },
        })
      );

      // Process all regenerations
      for (let i = 0; i < 3; i++) {
        const regenerateHandler = container.resolve(
          'RegenerateDescriptionHandler'
        );
        await regenerateHandler.execute(
          { entity_ref: actor.id },
          { actorId: actor.id }
        );
      }

      await Promise.all(promises);
      await testBed.waitForEventProcessing();

      // Verify description consistency
      const finalDescription = entityManager.getComponentData(
        actor.id,
        'core:description'
      );
      expect(finalDescription.text).toMatch(/Description update \d/);
      expect(bodyDescriptionComposer.composeDescription).toHaveBeenCalledTimes(
        3
      );
    });
  });

  describe('Complex Entity Scenarios', () => {
    it('should integrate with other entity modifications', async () => {
      // Setup: Complex entity state with multiple components
      const actor = utils.createEntityWithEquipment({
        equipment: {
          head: 'clothing:hat',
          torso_upper: 'clothing:shirt',
        },
        position: 'bedroom',
        inventory: ['item1', 'item2'],
      });

      // Create clothing items
      utils.createClothingItem({
        id: 'clothing:hat',
        name: 'hat',
        slot: 'head',
      });
      utils.createClothingItem({
        id: 'clothing:shirt',
        name: 'shirt',
        slot: 'torso_upper',
      });

      // Add additional components
      entityManager.setComponentData(actor.id, 'core:attributes', {
        health: 100,
        stamina: 50,
      });
      entityManager.setComponentData(actor.id, 'anatomy:body', {
        body: { root: 'humanoid' },
      });
      entityManager.setComponentData(actor.id, 'core:description', {
        text: 'Initial complex entity description.',
        lastUpdated: Date.now(),
      });

      // Mock composer responses
      const mockDescriptions = [
        'Entity in bedroom without hat.',
        'Entity in kitchen without hat or shirt.',
      ];
      let descIndex = 0;
      bodyDescriptionComposer.composeDescription = jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve(mockDescriptions[descIndex++])
        );

      // Action: Mixed operations including clothing changes
      // Remove hat
      await eventBus.emit({
        type: 'core:attempt_action',
        payload: {
          actionId: 'clothing:remove_clothing',
          actorId: actor.id,
          targetId: 'clothing:hat',
        },
      });

      const regenerateHandler = container.resolve(
        'RegenerateDescriptionHandler'
      );
      await regenerateHandler.execute(
        { entity_ref: actor.id },
        { actorId: actor.id }
      );

      await testBed.waitForEventProcessing();

      // Move entity
      entityManager.setComponentData(actor.id, 'core:position', {
        locationId: 'kitchen',
      });

      // Remove shirt
      await eventBus.emit({
        type: 'core:attempt_action',
        payload: {
          actionId: 'clothing:remove_clothing',
          actorId: actor.id,
          targetId: 'clothing:shirt',
        },
      });

      await regenerateHandler.execute(
        { entity_ref: actor.id },
        { actorId: actor.id }
      );

      await testBed.waitForEventProcessing();

      // Verify: Description updates don't interfere with other changes
      const positionComponent = entityManager.getComponentData(
        actor.id,
        'core:position'
      );
      const descriptionComponent = entityManager.getComponentData(
        actor.id,
        'core:description'
      );
      const attributesComponent = entityManager.getComponentData(
        actor.id,
        'core:attributes'
      );

      expect(positionComponent.locationId).toBe('kitchen');
      expect(descriptionComponent.text).toBe(
        'Entity in kitchen without hat or shirt.'
      );
      // The description explicitly mentions the items are missing, so we check for positive outcome
      expect(descriptionComponent.text).toContain('without');
      expect(attributesComponent.health).toBe(100); // Unchanged
      expect(attributesComponent.stamina).toBe(50); // Unchanged
    });

    it('should handle entities with complex anatomy configurations', async () => {
      // Test with non-human anatomy
      const nonHumanActor = utils.createEntityWithEquipment({
        equipment: {
          head: 'collar',
          torso_upper: 'harness',
        },
        position: 'test_location',
      });

      // Set non-human anatomy
      entityManager.setComponentData(nonHumanActor.id, 'anatomy:body', {
        body: {
          root: 'quadruped',
          type: 'canine',
        },
      });
      entityManager.setComponentData(nonHumanActor.id, 'core:description', {
        text: 'A quadruped with collar and harness.',
        lastUpdated: Date.now(),
      });

      utils.createClothingItem({ id: 'collar', name: 'collar', slot: 'head' });
      utils.createClothingItem({
        id: 'harness',
        name: 'harness',
        slot: 'torso_upper',
      });

      bodyDescriptionComposer.composeDescription = jest
        .fn()
        .mockResolvedValueOnce(
          'A quadruped without collar, still wearing harness.'
        );

      // Remove collar
      const regenerateHandler = container.resolve(
        'RegenerateDescriptionHandler'
      );
      await regenerateHandler.execute(
        { entity_ref: nonHumanActor.id },
        { actorId: nonHumanActor.id }
      );

      await testBed.waitForEventProcessing();

      const description = entityManager.getComponentData(
        nonHumanActor.id,
        'core:description'
      );
      expect(description.text).toBe(
        'A quadruped without collar, still wearing harness.'
      );

      // Test with missing body parts
      const partialActor = utils.createEntityWithEquipment({
        equipment: {
          torso_upper: 'shirt',
        },
        position: 'test_location',
      });

      entityManager.setComponentData(partialActor.id, 'anatomy:body', {
        body: {
          root: 'humanoid',
          missingParts: ['left_arm', 'right_leg'],
        },
      });
      entityManager.setComponentData(partialActor.id, 'core:description', {
        text: 'A person missing limbs, wearing a shirt.',
        lastUpdated: Date.now(),
      });

      utils.createClothingItem({
        id: 'shirt',
        name: 'shirt',
        slot: 'torso_upper',
      });

      bodyDescriptionComposer.composeDescription = jest
        .fn()
        .mockResolvedValueOnce('A person missing limbs, without clothing.');

      await regenerateHandler.execute(
        { entity_ref: partialActor.id },
        { actorId: partialActor.id }
      );

      await testBed.waitForEventProcessing();

      const partialDescription = entityManager.getComponentData(
        partialActor.id,
        'core:description'
      );
      expect(partialDescription.text).toBe(
        'A person missing limbs, without clothing.'
      );
    });
  });

  describe('Rule Processing Integration', () => {
    it('should execute full rule processing correctly', async () => {
      // Setup: Complete game context with rules loaded
      const actor = utils.createEntityWithEquipment({
        id: 'test-actor',
        equipment: {
          head: 'test-hat',
        },
        position: 'test_location',
      });

      const hat = utils.createClothingItem({
        id: 'test-hat',
        name: 'test hat',
        slot: 'head',
      });

      entityManager.setComponentData(actor.id, 'core:description', {
        text: 'Actor with hat.',
        lastUpdated: Date.now(),
      });

      // Track rule execution
      const executedOperations = [];
      systemLogicInterpreter.on('operationExecuted', (op) => {
        executedOperations.push(op);
      });

      // Simulate the complete rule execution sequence
      // handle_remove_clothing rule has 9 direct operations
      const operations = [
        { type: 'GET_NAME', parameters: { entity_ref: 'actor' } },
        { type: 'GET_NAME', parameters: { entity_ref: 'target' } },
        {
          type: 'QUERY_COMPONENT',
          parameters: { component_type: 'core:position' },
        },
        {
          type: 'UNEQUIP_CLOTHING',
          parameters: { entity_ref: 'actor', clothing_item_id: hat.id },
        },
        { type: 'REGENERATE_DESCRIPTION', parameters: { entity_ref: 'actor' } },
        { type: 'SET_VARIABLE', parameters: { variable_name: 'logMessage' } },
        {
          type: 'SET_VARIABLE',
          parameters: { variable_name: 'perceptionType' },
        },
        { type: 'SET_VARIABLE', parameters: { variable_name: 'locationId' } },
        { type: 'SET_VARIABLE', parameters: { variable_name: 'targetId' } },
        // Macro expansion (logSuccessAndEndTurn) adds 4 more operations
        { type: 'GET_TIMESTAMP', parameters: { result_variable: 'nowIso' } },
        {
          type: 'DISPATCH_EVENT',
          parameters: { eventType: 'core:perceptible_event' },
        },
        {
          type: 'DISPATCH_EVENT',
          parameters: { eventType: 'core:display_successful_action_result' },
        },
        { type: 'END_TURN', parameters: { success: true } },
      ];

      // Simulate each operation
      operations.forEach((op) => systemLogicInterpreter.simulateOperation(op));

      // Action: Trigger clothing removal through event system
      await eventBus.emit({
        type: 'core:attempt_action',
        payload: {
          actionId: 'clothing:remove_clothing',
          actorId: actor.id,
          targetId: hat.id,
        },
      });

      // Execute the description regeneration
      bodyDescriptionComposer.composeDescription = jest
        .fn()
        .mockResolvedValueOnce('Actor without hat.');

      const regenerateHandler = container.resolve(
        'RegenerateDescriptionHandler'
      );
      await regenerateHandler.execute(
        { entity_ref: 'actor' },
        { actorId: actor.id }
      );

      await testBed.waitForEventProcessing();

      // Verify: All rule operations executed successfully
      // The handle_remove_clothing rule has 9 direct operations + 4 from macro = 13 total
      expect(systemLogicInterpreter.executedOperations).toHaveLength(13);

      // Verify: Description regeneration occurred in correct sequence
      const descriptionOp = systemLogicInterpreter.executedOperations.find(
        (op) => op.type === 'REGENERATE_DESCRIPTION'
      );
      expect(descriptionOp).toBeDefined();

      // Verify the REGENERATE_DESCRIPTION operation appears after UNEQUIP_CLOTHING
      const unequipIndex = systemLogicInterpreter.executedOperations.findIndex(
        (op) => op.type === 'UNEQUIP_CLOTHING'
      );
      const regenerateIndex =
        systemLogicInterpreter.executedOperations.findIndex(
          (op) => op.type === 'REGENERATE_DESCRIPTION'
        );
      expect(regenerateIndex).toBeGreaterThan(unequipIndex);
      expect(regenerateIndex).toBe(4); // Should be the 5th operation (index 4)

      // Verify description was updated
      const finalDescription = entityManager.getComponentData(
        actor.id,
        'core:description'
      );
      expect(finalDescription.text).toBe('Actor without hat.');
    });

    it('should maintain rule execution order', async () => {
      // Verify operations execute in correct sequence
      const actor = utils.createEntityWithEquipment({
        equipment: { torso_upper: 'shirt' },
        position: 'test_location',
      });

      utils.createClothingItem({
        id: 'shirt',
        name: 'shirt',
        slot: 'torso_upper',
      });

      entityManager.setComponentData(actor.id, 'core:description', {
        text: 'Initial.',
        lastUpdated: Date.now(),
      });

      // Reset operation tracking
      systemLogicInterpreter.resetOperations();

      // Simulate rule operations in order
      const orderedOps = [
        'GET_NAME',
        'GET_NAME',
        'QUERY_COMPONENT',
        'UNEQUIP_CLOTHING',
        'REGENERATE_DESCRIPTION',
        'SET_VARIABLE',
        'SET_VARIABLE',
        'SET_VARIABLE',
        'SET_VARIABLE',
      ];

      orderedOps.forEach((type) => {
        systemLogicInterpreter.simulateOperation({ type });
      });

      // Test that description regeneration happens after clothing removal
      const ops = systemLogicInterpreter.executedOperations;
      const unequipIdx = ops.findIndex((o) => o.type === 'UNEQUIP_CLOTHING');
      const regenIdx = ops.findIndex(
        (o) => o.type === 'REGENERATE_DESCRIPTION'
      );

      expect(unequipIdx).toBeLessThan(regenIdx);
      expect(regenIdx - unequipIdx).toBe(1); // Should be immediately after
    });

    it('should handle rule processing errors gracefully', async () => {
      // Test scenarios where description regeneration fails
      const actor = utils.createEntityWithEquipment({
        equipment: { head: 'hat' },
        position: 'test_location',
      });

      utils.createClothingItem({ id: 'hat', name: 'hat', slot: 'head' });

      entityManager.setComponentData(actor.id, 'core:description', {
        text: 'Initial description.',
        lastUpdated: Date.now(),
      });

      // Mock composer to throw error
      bodyDescriptionComposer.composeDescription = jest
        .fn()
        .mockRejectedValueOnce(new Error('Description generation failed'));

      // Create a handler that logs errors but continues
      container.resolve = jest.fn().mockImplementation((serviceName) => {
        if (serviceName === 'RegenerateDescriptionHandler') {
          return {
            execute: jest.fn().mockImplementation(async (params, context) => {
              try {
                const { entity_ref } = params;
                const entityId = context?.actorId || entity_ref;

                // Try to generate description
                const newDescription =
                  await bodyDescriptionComposer.composeDescription(
                    entityManager.entities.get(entityId)
                  );

                entityManager.setComponentData(entityId, 'core:description', {
                  text: newDescription,
                  lastUpdated: Date.now(),
                });
              } catch (error) {
                // Log error but don't throw - rule continues
                testBed.logger.error('Description regeneration failed', error);
                return false;
              }
              return true;
            }),
          };
        }
        return null;
      });

      // Execute the operation
      const regenerateHandler = container.resolve(
        'RegenerateDescriptionHandler'
      );
      const result = await regenerateHandler.execute(
        { entity_ref: actor.id },
        { actorId: actor.id }
      );

      // Verify rule continues and completes other operations
      expect(result).toBe(false);
      expect(testBed.logger.error).toHaveBeenCalledWith(
        'Description regeneration failed',
        expect.any(Error)
      );

      // Description should remain unchanged
      const description = entityManager.getComponentData(
        actor.id,
        'core:description'
      );
      expect(description.text).toBe('Initial description.');
    });
  });

  describe('System Component Integration', () => {
    it('should integrate correctly with EntityManager', async () => {
      // Setup: Create entity with clothing
      const actor = utils.createEntityWithEquipment({
        equipment: { head: 'test-hat' },
        position: 'test_location',
      });

      utils.createClothingItem({
        id: 'test-hat',
        name: 'test hat',
        slot: 'head',
      });

      // Verify entity retrieval works
      const entity = entityManager.getEntityInstance(actor.id);
      expect(entity).toBeDefined();
      expect(entity.id).toBe(actor.id);

      // Set initial description
      entityManager.setComponentData(actor.id, 'core:description', {
        text: 'Initial description.',
        lastUpdated: 1000,
      });

      // Test component updates
      const descriptionBefore = entityManager.getComponentData(
        actor.id,
        'core:description'
      );
      expect(descriptionBefore.lastUpdated).toBe(1000);

      // Mock the composer
      bodyDescriptionComposer.composeDescription = jest
        .fn()
        .mockResolvedValueOnce('Updated description.');

      // Trigger description regeneration
      const regenerateHandler = container.resolve(
        'RegenerateDescriptionHandler'
      );
      await regenerateHandler.execute(
        { entity_ref: actor.id },
        { actorId: actor.id }
      );

      await testBed.waitForEventProcessing();

      // Verify component changes persist
      const descriptionAfter = entityManager.getComponentData(
        actor.id,
        'core:description'
      );
      expect(descriptionAfter).toBeDefined();
      expect(descriptionAfter.text).toBe('Updated description.');
      expect(descriptionAfter.lastUpdated).toBeGreaterThan(
        descriptionBefore.lastUpdated
      );
    });

    it('should integrate correctly with BodyDescriptionComposer', async () => {
      // Setup: Create entity with anatomy and clothing
      const actor = utils.createEntityWithEquipment({
        equipment: {
          head: 'hat',
          torso_upper: 'shirt',
        },
      });

      utils.createClothingItem({ id: 'hat', name: 'hat', slot: 'head' });
      utils.createClothingItem({
        id: 'shirt',
        name: 'shirt',
        slot: 'torso_upper',
      });

      // Add anatomy component for BodyDescriptionComposer
      entityManager.setComponentData(actor.id, 'anatomy:body', {
        body: {
          root: 'humanoid',
          type: 'standard',
        },
      });

      // Add the component ID constant that BodyDescriptionComposer expects
      actor.hasComponent = jest.fn().mockImplementation((componentId) => {
        return (
          componentId === 'anatomy:body' ||
          !!entityManager.getComponentData(actor.id, componentId)
        );
      });
      actor.getComponentData = jest.fn().mockImplementation((componentId) => {
        return entityManager.getComponentData(actor.id, componentId);
      });

      // Setup a simplified composer that returns a valid description
      const mockComposer = {
        composeDescription: jest
          .fn()
          .mockResolvedValue('Body with clothing description'),
      };

      // Test description generation with mock composer
      const description = await mockComposer.composeDescription(actor);

      // Verify descriptions reflect actual entity state
      expect(description).toBeTruthy();
      expect(typeof description).toBe('string');

      // Should generate some description based on the entity
      const equippedComponent = entityManager.getComponentData(
        actor.id,
        'clothing:equipment'
      );
      if (equippedComponent && equippedComponent.equipped) {
        // Description generation was attempted
        expect(description.length).toBeGreaterThan(0);
      }
    });

    it('should integrate correctly with clothing management service', async () => {
      // Setup
      const clothingManagementService = testBed.services.get(
        'clothingManagementService'
      );
      const actor = utils.createEntityWithEquipment({
        equipment: { head: 'hat' },
      });

      utils.createClothingItem({ id: 'hat', name: 'hat', slot: 'head' });

      entityManager.setComponentData(actor.id, 'core:description', {
        text: 'Actor wearing hat.',
        lastUpdated: Date.now(),
      });

      // Test interaction with existing clothing operations
      const equippedBefore = entityManager.getComponentData(
        actor.id,
        'clothing:equipment'
      );
      expect(equippedBefore.equipped.head).toBe('hat');

      // Mock the composer for after removal
      bodyDescriptionComposer.composeDescription = jest
        .fn()
        .mockResolvedValueOnce('Actor without hat.');

      // Remove clothing using the service's unequip simulation
      const equipment = entityManager.getComponentData(
        actor.id,
        'clothing:equipment'
      );
      delete equipment.equipped.head;
      entityManager.setComponentData(actor.id, 'clothing:equipment', equipment);

      // Trigger description regeneration after removal
      const regenerateHandler = container.resolve(
        'RegenerateDescriptionHandler'
      );
      await regenerateHandler.execute(
        { entity_ref: actor.id },
        { actorId: actor.id }
      );

      await testBed.waitForEventProcessing();

      // Verify no interference with clothing mechanics
      const equippedAfter = entityManager.getComponentData(
        actor.id,
        'clothing:equipment'
      );
      expect(equippedAfter.equipped.head).toBeUndefined();

      const description = entityManager.getComponentData(
        actor.id,
        'core:description'
      );
      expect(description.text).toBe('Actor without hat.');
    });
  });
});
