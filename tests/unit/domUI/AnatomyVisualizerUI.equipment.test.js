/**
 * @file AnatomyVisualizerUI.equipment.test.js
 * @description Unit tests for equipment handling functionality in AnatomyVisualizerUI
 */

import AnatomyVisualizerUI from '../../../src/domUI/AnatomyVisualizerUI.js';
import { jest } from '@jest/globals';

describe('AnatomyVisualizerUI - Equipment Handling', () => {
  let mockLogger;
  let mockRegistry;
  let mockEntityManager;
  let mockAnatomyDescriptionService;
  let mockEventDispatcher;
  let mockVisualizerStateController;
  let mockVisualizationComposer;
  let mockClothingManagementService;
  let mockDocument;
  let visualizerUI;

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock registry
    mockRegistry = {
      getAllEntityDefinitions: jest.fn(),
      getEntityDefinition: jest.fn(),
    };

    // Mock entity manager
    mockEntityManager = {
      createEntityInstance: jest.fn(),
      getEntityInstance: jest.fn(),
      removeEntityInstance: jest.fn(),
      hasComponent: jest.fn(),
    };

    // Mock anatomy description service
    mockAnatomyDescriptionService = {};

    // Mock clothing management service
    mockClothingManagementService = {
      getEquippedItems: jest.fn(),
    };

    // Mock event dispatcher
    mockEventDispatcher = {
      subscribe: jest.fn(),
    };

    // Mock visualizer state controller
    mockVisualizerStateController = {
      selectEntity: jest.fn(),
      handleError: jest.fn(),
      reset: jest.fn(),
      startRendering: jest.fn(),
      completeRendering: jest.fn(),
    };

    // Mock visualization composer
    mockVisualizationComposer = {
      initialize: jest.fn(),
      renderGraph: jest.fn(),
      clear: jest.fn(),
    };

    // Mock document
    mockDocument = {
      getElementById: jest.fn(),
      createElement: jest.fn(),
      createDocumentFragment: jest.fn(),
    };

    // Create instance
    visualizerUI = new AnatomyVisualizerUI({
      logger: mockLogger,
      registry: mockRegistry,
      entityManager: mockEntityManager,
      anatomyDescriptionService: mockAnatomyDescriptionService,
      eventDispatcher: mockEventDispatcher,
      documentContext: { document: mockDocument },
      visualizerStateController: mockVisualizerStateController,
      visualizationComposer: mockVisualizationComposer,
      clothingManagementService: mockClothingManagementService,
    });
  });

  describe('_subscribeToEquipmentEvents', () => {
    it('should subscribe to equipment events when clothing service is available', () => {
      // Arrange
      const unsubscribeMock = jest.fn();
      mockEventDispatcher.subscribe.mockReturnValue(unsubscribeMock);

      // Act
      visualizerUI._subscribeToEquipmentEvents();

      // Assert
      expect(mockEventDispatcher.subscribe).toHaveBeenCalledTimes(3);
      expect(mockEventDispatcher.subscribe).toHaveBeenCalledWith(
        'clothing:equipped',
        expect.any(Function)
      );
      expect(mockEventDispatcher.subscribe).toHaveBeenCalledWith(
        'clothing:unequipped',
        expect.any(Function)
      );
      expect(mockEventDispatcher.subscribe).toHaveBeenCalledWith(
        'clothing:equipment_updated',
        expect.any(Function)
      );
      expect(visualizerUI._equipmentUnsubscribes).toHaveLength(3);
    });
  });

  describe('_handleEquipmentChange', () => {
    it('should handle equipment change for current entity', async () => {
      // Arrange
      const entityId = 'test-entity-123';
      visualizerUI._currentEntityId = entityId;

      const mockEquipmentData = {
        success: true,
        hasEquipment: true,
        equipmentData: [],
      };

      jest
        .spyOn(visualizerUI, '_retrieveEquipmentData')
        .mockResolvedValue(mockEquipmentData);
      jest.spyOn(visualizerUI, '_updateEquipmentDisplay').mockImplementation();

      const event = {
        payload: { entityId },
      };

      // Act
      await visualizerUI._handleEquipmentChange(event);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `AnatomyVisualizerUI: Equipment changed for ${entityId}`,
        event
      );
      expect(visualizerUI._retrieveEquipmentData).toHaveBeenCalledWith(
        entityId
      );
      expect(visualizerUI._updateEquipmentDisplay).toHaveBeenCalledWith(
        mockEquipmentData
      );
    });

    it('should ignore equipment change for different entity', async () => {
      // Arrange
      visualizerUI._currentEntityId = 'current-entity';
      const event = {
        payload: { entityId: 'different-entity' },
      };

      // Act
      await visualizerUI._handleEquipmentChange(event);

      // Assert
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should clear equipment cache when handling equipment change', async () => {
      // Arrange
      const entityId = 'test-entity-123';
      visualizerUI._currentEntityId = entityId;
      visualizerUI._equipmentCache.set(entityId, { cached: true });

      jest
        .spyOn(visualizerUI, '_retrieveEquipmentData')
        .mockResolvedValue({ success: true });
      jest.spyOn(visualizerUI, '_updateEquipmentDisplay').mockImplementation();

      const event = {
        payload: { entityId },
      };

      // Act
      await visualizerUI._handleEquipmentChange(event);

      // Assert
      expect(visualizerUI._equipmentCache.has(entityId)).toBe(false);
    });
  });

  describe('_retrieveEquipmentData', () => {
    it('should return cached equipment data if available', async () => {
      // Arrange
      const entityId = 'test-entity';
      const cachedData = { success: true, cached: true };
      visualizerUI._equipmentCache.set(entityId, cachedData);

      // Act
      const result = await visualizerUI._retrieveEquipmentData(entityId);

      // Assert
      expect(result).toEqual(cachedData);
      expect(
        mockClothingManagementService.getEquippedItems
      ).not.toHaveBeenCalled();
    });

    it('should return error when clothing service is not available', async () => {
      // Arrange
      const entityId = 'test-entity';
      visualizerUI._clothingManagementService = null;

      // Act
      const result = await visualizerUI._retrieveEquipmentData(entityId);

      // Assert
      expect(result).toEqual({
        success: true,
        hasEquipment: false,
        message: 'Clothing service not available',
      });
    });

    it('should return hasEquipment false when entity has no equipment component', async () => {
      // Arrange
      const entityId = 'test-entity';
      mockEntityManager.hasComponent.mockReturnValue(false);

      // Act
      const result = await visualizerUI._retrieveEquipmentData(entityId);

      // Assert
      expect(result).toEqual({
        success: true,
        hasEquipment: false,
      });
      expect(visualizerUI._equipmentCache.get(entityId)).toEqual(result);
    });

    it('should return error when getEquippedItems fails', async () => {
      // Arrange
      const entityId = 'test-entity';
      mockEntityManager.hasComponent.mockReturnValue(true);
      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: false,
        errors: ['Equipment fetch failed'],
      });

      // Act
      const result = await visualizerUI._retrieveEquipmentData(entityId);

      // Assert
      expect(result).toEqual({
        success: false,
        errors: ['Equipment fetch failed'],
      });
    });

    it('should process and cache equipment data successfully', async () => {
      // Arrange
      const entityId = 'test-entity';
      const equipmentData = {
        head: { base: 'hat-123' },
      };

      mockEntityManager.hasComponent.mockReturnValue(true);
      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: equipmentData,
      });

      const processedData = [{ slotId: 'head', layers: [] }];
      jest
        .spyOn(visualizerUI, '_processEquipmentData')
        .mockResolvedValue(processedData);

      // Act
      const result = await visualizerUI._retrieveEquipmentData(entityId);

      // Assert
      expect(result).toEqual({
        success: true,
        hasEquipment: true,
        equipmentData: processedData,
      });
      expect(visualizerUI._equipmentCache.get(entityId)).toEqual(result);
    });

    it('should handle errors during equipment retrieval', async () => {
      // Arrange
      const entityId = 'test-entity';
      const error = new Error('Test error');
      mockEntityManager.hasComponent.mockImplementation(() => {
        throw error;
      });

      // Act
      const result = await visualizerUI._retrieveEquipmentData(entityId);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Test error',
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to retrieve equipment data',
        error
      );
    });
  });

  describe('_processEquipmentData', () => {
    it('should process equipment data correctly', async () => {
      // Arrange
      const equipped = {
        head: { base: 'hat-123' },
        torso: { base: 'shirt-456', outer: 'jacket-789' },
      };
      const ownerId = 'owner-123';

      jest
        .spyOn(visualizerUI, '_getClothingItemDetails')
        .mockResolvedValueOnce({ entityId: 'hat-123', name: 'Hat' })
        .mockResolvedValueOnce({ entityId: 'shirt-456', name: 'Shirt' })
        .mockResolvedValueOnce({ entityId: 'jacket-789', name: 'Jacket' });

      // Act
      const result = await visualizerUI._processEquipmentData(
        equipped,
        ownerId
      );

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        slotId: 'head',
        layers: [
          {
            layerName: 'base',
            items: [{ entityId: 'hat-123', name: 'Hat' }],
          },
        ],
      });
      expect(result[1]).toEqual({
        slotId: 'torso',
        layers: [
          {
            layerName: 'outer',
            items: [{ entityId: 'jacket-789', name: 'Jacket' }],
          },
          {
            layerName: 'base',
            items: [{ entityId: 'shirt-456', name: 'Shirt' }],
          },
        ],
      });
    });

    it('should handle array of clothing items in a layer', async () => {
      // Arrange
      const equipped = {
        hands: { base: ['glove-left', 'glove-right'] },
      };
      const ownerId = 'owner-123';

      jest
        .spyOn(visualizerUI, '_getClothingItemDetails')
        .mockResolvedValueOnce({ entityId: 'glove-left', name: 'Left Glove' })
        .mockResolvedValueOnce({
          entityId: 'glove-right',
          name: 'Right Glove',
        });

      // Act
      const result = await visualizerUI._processEquipmentData(
        equipped,
        ownerId
      );

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].layers[0].items).toHaveLength(2);
    });

    it('should skip empty layers and slots', async () => {
      // Arrange
      const equipped = {
        head: { base: 'hat-123' },
        torso: { base: 'invalid-item' },
      };
      const ownerId = 'owner-123';

      jest
        .spyOn(visualizerUI, '_getClothingItemDetails')
        .mockResolvedValueOnce({ entityId: 'hat-123', name: 'Hat' })
        .mockResolvedValueOnce(null); // Invalid item returns null

      // Act
      const result = await visualizerUI._processEquipmentData(
        equipped,
        ownerId
      );

      // Assert
      expect(result).toHaveLength(1); // Only head slot included
      expect(result[0].slotId).toBe('head');
    });
  });

  describe('_getClothingItemDetails', () => {
    it('should get clothing item details successfully', async () => {
      // Arrange
      const entityId = 'clothing-123';
      const mockEntity = {
        definitionId: 'test:hat',
        getComponentData: jest.fn((componentType) => {
          if (componentType === 'clothing:wearable') {
            return {};
          }
          if (componentType === 'core:material') {
            return { material: 'cotton' };
          }
          if (componentType === 'core:name') {
            return { text: 'Blue Hat' };
          }
          if (componentType === 'descriptors:color_basic') {
            return { color: 'blue' };
          }
          if (componentType === 'descriptors:texture') {
            return { texture: 'smooth' };
          }
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

      // Act
      const result = await visualizerUI._getClothingItemDetails(entityId);

      // Assert
      expect(result).toEqual({
        entityId: 'clothing-123',
        definitionId: 'test:hat',
        name: 'Blue Hat',
        material: 'cotton',
        color: 'blue',
        texture: 'smooth',
      });
    });

    it('should handle entity not found', async () => {
      // Arrange
      const entityId = 'missing-entity';
      mockEntityManager.getEntityInstance.mockResolvedValue(null);

      // Act
      const result = await visualizerUI._getClothingItemDetails(entityId);

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `Clothing entity not found: ${entityId}`
      );
    });

    it('should handle entity without wearable component', async () => {
      // Arrange
      const entityId = 'invalid-clothing';
      const mockEntity = {
        getComponentData: jest.fn(() => null),
      };
      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

      // Act
      const result = await visualizerUI._getClothingItemDetails(entityId);

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `No wearable data for entity: ${entityId}`
      );
    });

    it('should use default values for missing components', async () => {
      // Arrange
      const entityId = 'simple-clothing';
      const mockEntity = {
        definitionId: 'test:simple',
        getComponentData: jest.fn((componentType) => {
          if (componentType === 'clothing:wearable') {
            return {}; // No material
          }
          return null; // No name, color, texture
        }),
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

      // Act
      const result = await visualizerUI._getClothingItemDetails(entityId);

      // Assert
      expect(result).toEqual({
        entityId: 'simple-clothing',
        definitionId: 'test:simple',
        name: 'Unknown',
        material: 'unknown',
        color: 'unknown',
        texture: null,
      });
    });

    it('should handle errors during entity retrieval', async () => {
      // Arrange
      const entityId = 'error-entity';
      const error = new Error('Entity fetch failed');
      mockEntityManager.getEntityInstance.mockRejectedValue(error);

      // Act
      const result = await visualizerUI._getClothingItemDetails(entityId);

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to get clothing item details for ${entityId}`,
        error
      );
    });
  });
});
