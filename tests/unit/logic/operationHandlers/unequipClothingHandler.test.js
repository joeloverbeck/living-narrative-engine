/**
 * @file Unit tests for UnequipClothingHandler
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import UnequipClothingHandler from '../../../../src/logic/operationHandlers/unequipClothingHandler.js';

describe('UnequipClothingHandler', () => {
  let handler;
  let mockEntityManager;
  let mockEquipmentOrchestrator;
  let mockLogger;
  let mockDispatcher;
  let executionContext;

  beforeEach(() => {
    // Mock dependencies
    mockEntityManager = {
      hasComponent: jest.fn(),
      getComponentData: jest.fn(),
      addComponent: jest.fn(),
    };
    
    mockEquipmentOrchestrator = {
      orchestrateUnequipment: jest.fn(),
    };
    
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    
    mockDispatcher = { dispatch: jest.fn() };
    
    // Create handler
    handler = new UnequipClothingHandler({
      entityManager: mockEntityManager,
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
      equipmentOrchestrator: mockEquipmentOrchestrator,
    });
    
    // Create execution context
    executionContext = {
      evaluationContext: {
        actor: { id: 'player' },
        target: { id: 'shirt' },
        context: {},
      },
      ruleId: 'test-rule',
      logger: mockLogger,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should unequip clothing and place it in inventory by default', async () => {
      // Arrange
      const params = {
        entity_ref: 'actor',
        clothing_item_id: 'shirt_001',
      };
      
      mockEntityManager.hasComponent.mockReturnValueOnce(true); // has equipment
      mockEntityManager.hasComponent.mockReturnValueOnce(true); // has inventory
      mockEntityManager.getComponentData.mockReturnValue({
        items: ['item1', 'item2'],
      });
      mockEntityManager.addComponent.mockResolvedValue(true);
      
      mockEquipmentOrchestrator.orchestrateUnequipment.mockResolvedValue({
        success: true,
        unequipped: true,
      });

      // Act
      await handler.execute(params, executionContext);

      // Assert
      expect(mockEquipmentOrchestrator.orchestrateUnequipment).toHaveBeenCalledWith({
        entityId: 'player',
        clothingItemId: 'shirt_001',
        cascadeUnequip: false,
        reason: 'manual',
      });
      
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'player',
        'core:inventory',
        { items: ['item1', 'item2', 'shirt_001'] }
      );
    });

    it('should place item on ground when destination is ground', async () => {
      // Arrange
      const params = {
        entity_ref: 'actor',
        clothing_item_id: 'shirt_001',
        destination: 'ground',
      };
      
      mockEntityManager.hasComponent.mockReturnValue(true);
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'room_001',
      });
      mockEntityManager.addComponent.mockResolvedValue(true);
      
      mockEquipmentOrchestrator.orchestrateUnequipment.mockResolvedValue({
        success: true,
      });

      // Act
      await handler.execute(params, executionContext);

      // Assert
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'shirt_001',
        'core:position',
        { locationId: 'room_001' }
      );
    });

    it('should handle cascade unequip when specified', async () => {
      // Arrange
      const params = {
        entity_ref: 'target',
        clothing_item_id: 'jacket_001',
        cascade_unequip: true,
      };
      
      mockEntityManager.hasComponent.mockReturnValue(true);
      mockEquipmentOrchestrator.orchestrateUnequipment.mockResolvedValue({
        success: true,
        cascadeItems: ['shirt_001', 'tie_001'],
      });
      mockEntityManager.addComponent.mockResolvedValue(true);

      // Act
      await handler.execute(params, executionContext);

      // Assert
      expect(mockEquipmentOrchestrator.orchestrateUnequipment).toHaveBeenCalledWith({
        entityId: 'shirt',
        clothingItemId: 'jacket_001',
        cascadeUnequip: true,
        reason: 'manual',
      });
    });

    it('should return early if params are invalid', async () => {
      // Act
      await handler.execute(null, executionContext);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'UNEQUIP_CLOTHING: params missing or invalid.',
        { params: null }
      );
      expect(mockEquipmentOrchestrator.orchestrateUnequipment).not.toHaveBeenCalled();
    });

    it('should return early if entity_ref is invalid', async () => {
      // Arrange
      const params = {
        entity_ref: null,
        clothing_item_id: 'shirt_001',
      };

      // Act
      await handler.execute(params, executionContext);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockEquipmentOrchestrator.orchestrateUnequipment).not.toHaveBeenCalled();
    });

    it('should return early if clothing_item_id is invalid', async () => {
      // Arrange
      const params = {
        entity_ref: 'actor',
        clothing_item_id: '',
      };

      // Act
      await handler.execute(params, executionContext);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'UNEQUIP_CLOTHING: clothing_item_id must be a non-empty string'
      );
      expect(mockEquipmentOrchestrator.orchestrateUnequipment).not.toHaveBeenCalled();
    });

    it('should return early if destination is invalid', async () => {
      // Arrange
      const params = {
        entity_ref: 'actor',
        clothing_item_id: 'shirt_001',
        destination: 'invalid',
      };

      // Act
      await handler.execute(params, executionContext);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'UNEQUIP_CLOTHING: Invalid destination "invalid". Must be "inventory" or "ground"'
      );
      expect(mockEquipmentOrchestrator.orchestrateUnequipment).not.toHaveBeenCalled();
    });

    it('should return early if entity has no equipment component', async () => {
      // Arrange
      const params = {
        entity_ref: 'actor',
        clothing_item_id: 'shirt_001',
      };
      
      mockEntityManager.hasComponent.mockReturnValue(false);

      // Act
      await handler.execute(params, executionContext);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'UNEQUIP_CLOTHING: Entity "player" does not have clothing:equipment component'
      );
      expect(mockEquipmentOrchestrator.orchestrateUnequipment).not.toHaveBeenCalled();
    });

    it('should handle unequipment failure', async () => {
      // Arrange
      const params = {
        entity_ref: 'actor',
        clothing_item_id: 'shirt_001',
      };
      
      mockEntityManager.hasComponent.mockReturnValue(true);
      mockEquipmentOrchestrator.orchestrateUnequipment.mockResolvedValue({
        success: false,
        errors: ['Item not equipped'],
      });

      // Act
      await handler.execute(params, executionContext);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'UNEQUIP_CLOTHING: Failed to unequip "shirt_001" from "player"',
        { errors: ['Item not equipped'] }
      );
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    it('should fallback to ground if entity has no inventory', async () => {
      // Arrange
      const params = {
        entity_ref: 'actor',
        clothing_item_id: 'shirt_001',
        destination: 'inventory',
      };
      
      mockEntityManager.hasComponent.mockReturnValueOnce(true); // has equipment
      mockEntityManager.hasComponent.mockReturnValueOnce(false); // no inventory
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'room_001',
      });
      mockEntityManager.addComponent.mockResolvedValue(true);
      
      mockEquipmentOrchestrator.orchestrateUnequipment.mockResolvedValue({
        success: true,
      });

      // Act
      await handler.execute(params, executionContext);

      // Assert
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'shirt_001',
        'core:position',
        { locationId: 'room_001' }
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Entity has no inventory, placing "shirt_001" on ground'
      );
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const params = {
        entity_ref: 'actor',
        clothing_item_id: 'shirt_001',
      };
      
      mockEntityManager.hasComponent.mockReturnValue(true);
      mockEquipmentOrchestrator.orchestrateUnequipment.mockRejectedValue(
        new Error('Orchestration failed')
      );

      // Act
      await handler.execute(params, executionContext);

      // Assert
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        {
          message: 'UNEQUIP_CLOTHING: Error during unequipment operation',
          details: expect.objectContaining({
            error: 'Orchestration failed',
            entityId: 'player',
            clothingItemId: 'shirt_001',
          })
        }
      );
    });
  });
});