import { beforeEach, describe, it, expect, jest } from '@jest/globals';
import { EquipmentOrchestrator } from '../../../../src/clothing/orchestration/equipmentOrchestrator.js';

/**
 * @file Test suite focused on clothing:equipped event payload validation
 * Tests ensure the event payload exactly matches the schema definition
 */

describe('clothing:equipped Event Validation', () => {
  let orchestrator;
  let mocks;

  beforeEach(() => {
    mocks = {
      entityManager: {
        getEntityInstance: jest.fn(),
        getComponentData: jest.fn(),
        addComponent: jest.fn(),
      },
      logger: {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      eventDispatcher: {
        dispatch: jest.fn(),
      },
      layerCompatibilityService: {
        checkLayerConflicts: jest.fn(),
        findDependentItems: jest.fn(),
      },
    };

    orchestrator = new EquipmentOrchestrator(mocks);
  });

  /**
   *
   * @param hasConflicts
   */
  function setupSuccessfulEquipmentMocks(hasConflicts = false) {
    // Setup entity and component data
    mocks.entityManager.getEntityInstance.mockReturnValue({
      entityId: 'actor123',
      components: ['clothing:equipment'],
    });

    mocks.entityManager.getComponentData.mockImplementation(
      (entityId, componentType) => {
        if (componentType === 'clothing:wearable') {
          return {
            layer: 'base',
            equipmentSlots: {
              primary: 'torso_clothing',
            },
          };
        } else if (componentType === 'clothing:equipment') {
          return {
            equipped: {
              torso_clothing: hasConflicts ? { base: 'conflict1' } : {},
            },
          };
        }
        return null;
      }
    );

    // Setup conflict resolution
    mocks.layerCompatibilityService.checkLayerConflicts.mockResolvedValue({
      hasConflicts,
      conflicts: hasConflicts ? [{ conflictingItemId: 'conflict1' }] : [],
    });

    // Setup successful equipment operation
    mocks.entityManager.addComponent.mockResolvedValue(true);
    mocks.eventDispatcher.dispatch.mockResolvedValue(true);
  }

  describe('Event Payload Schema Compliance', () => {
    it('should dispatch clothing:equipped with correct payload when no conflicts', async () => {
      setupSuccessfulEquipmentMocks(false);

      await orchestrator.orchestrateEquipment({
        entityId: 'actor123',
        clothingItemId: 'shirt456',
        layer: 'base',
      });

      expect(mocks.eventDispatcher.dispatch).toHaveBeenCalledWith(
        'clothing:equipped',
        {
          entityId: 'actor123',
          clothingItemId: 'shirt456',
          slotId: 'torso_clothing',
          layer: 'base',
          previousItem: null,
          conflictResolution: null,
          timestamp: expect.any(Number),
        }
      );
    });

    it('should dispatch clothing:equipped with conflictResolution "auto_remove" when conflicts exist', async () => {
      setupSuccessfulEquipmentMocks(true);

      await orchestrator.orchestrateEquipment({
        entityId: 'actor123',
        clothingItemId: 'shirt456',
        layer: 'base',
      });

      expect(mocks.eventDispatcher.dispatch).toHaveBeenCalledWith(
        'clothing:equipped',
        {
          entityId: 'actor123',
          clothingItemId: 'shirt456',
          slotId: 'torso_clothing',
          layer: 'base',
          previousItem: 'conflict1',
          conflictResolution: 'auto_remove',
          timestamp: expect.any(Number),
        }
      );
    });

    it('should include previousItem when replacing existing equipment', async () => {
      setupSuccessfulEquipmentMocks(false);

      // Mock existing equipment
      mocks.entityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'clothing:wearable') {
            return {
              layer: 'base',
              equipmentSlots: {
                primary: 'torso_clothing',
              },
            };
          } else if (componentType === 'clothing:equipment') {
            return {
              equipped: {
                torso_clothing: {
                  base: 'oldShirt789',
                },
              },
            };
          }
          return null;
        }
      );

      await orchestrator.orchestrateEquipment({
        entityId: 'actor123',
        clothingItemId: 'shirt456',
        layer: 'base',
      });

      expect(mocks.eventDispatcher.dispatch).toHaveBeenCalledWith(
        'clothing:equipped',
        expect.objectContaining({
          previousItem: 'oldShirt789',
        })
      );
    });

    it('should validate all required fields are present', async () => {
      setupSuccessfulEquipmentMocks(false);

      await orchestrator.orchestrateEquipment({
        entityId: 'actor123',
        clothingItemId: 'shirt456',
        layer: 'base',
      });

      const eventCall = mocks.eventDispatcher.dispatch.mock.calls.find(
        (call) => call[0] === 'clothing:equipped'
      );

      expect(eventCall).toBeDefined();
      const payload = eventCall[1];

      // Validate all required fields from schema
      expect(payload).toHaveProperty('entityId');
      expect(payload).toHaveProperty('clothingItemId');
      expect(payload).toHaveProperty('slotId');
      expect(payload).toHaveProperty('layer');
      expect(payload).toHaveProperty('timestamp');

      // Validate types
      expect(typeof payload.entityId).toBe('string');
      expect(typeof payload.clothingItemId).toBe('string');
      expect(typeof payload.slotId).toBe('string');
      expect(typeof payload.layer).toBe('string');
      expect(typeof payload.timestamp).toBe('number');

      // Validate layer enum
      expect(['underwear', 'base', 'outer', 'accessories', 'armor']).toContain(
        payload.layer
      );

      // Validate conflictResolution enum or null
      expect(
        payload.conflictResolution === null ||
          ['auto_remove', 'prompt_user', 'block_equip', 'layer_swap'].includes(
            payload.conflictResolution
          )
      ).toBe(true);

      // Validate previousItem is string or null
      expect(
        payload.previousItem === null ||
          typeof payload.previousItem === 'string'
      ).toBe(true);
    });

    it('should not include any additional properties beyond schema', async () => {
      setupSuccessfulEquipmentMocks(false);

      await orchestrator.orchestrateEquipment({
        entityId: 'actor123',
        clothingItemId: 'shirt456',
        layer: 'base',
      });

      const eventCall = mocks.eventDispatcher.dispatch.mock.calls.find(
        (call) => call[0] === 'clothing:equipped'
      );

      const payload = eventCall[1];
      const allowedProperties = [
        'entityId',
        'clothingItemId',
        'slotId',
        'layer',
        'previousItem',
        'conflictResolution',
        'timestamp',
      ];

      const actualProperties = Object.keys(payload);
      const extraProperties = actualProperties.filter(
        (prop) => !allowedProperties.includes(prop)
      );

      expect(extraProperties).toHaveLength(0);
    });
  });

  describe('Regression Tests', () => {
    it('should not send conflictsResolved property (regression test)', async () => {
      setupSuccessfulEquipmentMocks(true);

      await orchestrator.orchestrateEquipment({
        entityId: 'actor123',
        clothingItemId: 'shirt456',
        layer: 'base',
      });

      const eventCall = mocks.eventDispatcher.dispatch.mock.calls.find(
        (call) => call[0] === 'clothing:equipped'
      );

      expect(eventCall[1]).not.toHaveProperty('conflictsResolved');
    });

    it('should not send boolean conflictResolution (regression test)', async () => {
      setupSuccessfulEquipmentMocks(true);

      await orchestrator.orchestrateEquipment({
        entityId: 'actor123',
        clothingItemId: 'shirt456',
        layer: 'base',
      });

      const eventCall = mocks.eventDispatcher.dispatch.mock.calls.find(
        (call) => call[0] === 'clothing:equipped'
      );

      const payload = eventCall[1];
      expect(typeof payload.conflictResolution).not.toBe('boolean');
    });
  });
});
