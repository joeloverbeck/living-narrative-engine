/**
 * @file AnatomyVisualizerUI.cleanup.test.js
 * @description Unit tests for cleanup and disposal functionality in AnatomyVisualizerUI
 */

import AnatomyVisualizerUI from '../../../src/domUI/AnatomyVisualizerUI.js';
import { jest } from '@jest/globals';

describe('AnatomyVisualizerUI - Cleanup and Disposal', () => {
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
      createElement: jest.fn().mockReturnValue({
        value: '',
        textContent: '',
        appendChild: jest.fn(),
      }),
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

  describe('dispose', () => {
    it('should dispose all resources and unsubscribe from events', async () => {
      // Arrange
      const mockStateUnsubscribe = jest.fn();
      const mockEquipmentUnsubscribe1 = jest.fn();
      const mockEquipmentUnsubscribe2 = jest.fn();

      visualizerUI._stateUnsubscribe = mockStateUnsubscribe;
      visualizerUI._equipmentUnsubscribes = [
        mockEquipmentUnsubscribe1,
        mockEquipmentUnsubscribe2,
      ];

      jest.spyOn(visualizerUI, '_clearPreviousEntities').mockResolvedValue();

      // Act
      visualizerUI.dispose();

      // Assert
      expect(mockStateUnsubscribe).toHaveBeenCalled();
      expect(visualizerUI._stateUnsubscribe).toBeNull();
      expect(mockEquipmentUnsubscribe1).toHaveBeenCalled();
      expect(mockEquipmentUnsubscribe2).toHaveBeenCalled();
      expect(visualizerUI._equipmentUnsubscribes).toEqual([]);
    });

    it('should handle disposal when no state subscription exists', async () => {
      // Arrange
      visualizerUI._stateUnsubscribe = null;
      visualizerUI._equipmentUnsubscribes = [];

      jest.spyOn(visualizerUI, '_clearPreviousEntities').mockResolvedValue();

      // Act
      visualizerUI.dispose();

      // Assert
      expect(visualizerUI._stateUnsubscribe).toBeNull();
      expect(visualizerUI._equipmentUnsubscribes).toEqual([]);
    });

    it('should handle disposal when no equipment subscriptions exist', async () => {
      // Arrange
      const mockStateUnsubscribe = jest.fn();
      visualizerUI._stateUnsubscribe = mockStateUnsubscribe;
      visualizerUI._equipmentUnsubscribes = null;

      jest.spyOn(visualizerUI, '_clearPreviousEntities').mockResolvedValue();

      // Act
      visualizerUI.dispose();

      // Assert
      expect(mockStateUnsubscribe).toHaveBeenCalled();
      expect(visualizerUI._stateUnsubscribe).toBeNull();
    });

    it('should handle error during entity cleanup', async () => {
      // Arrange
      const mockStateUnsubscribe = jest.fn();
      visualizerUI._stateUnsubscribe = mockStateUnsubscribe;
      visualizerUI._equipmentUnsubscribes = [];

      const cleanupError = new Error('Cleanup failed');
      jest
        .spyOn(visualizerUI, '_clearPreviousEntities')
        .mockRejectedValue(cleanupError);

      // Act
      visualizerUI.dispose();

      // Wait for the async cleanup to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Assert
      expect(mockStateUnsubscribe).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Error during cleanup:',
        cleanupError
      );
    });
  });

  describe('initialize with equipment service', () => {
    it('should subscribe to equipment events when clothing service is available', async () => {
      // Arrange
      const mockContainer = { innerHTML: '' };
      const mockSelector = {
        innerHTML: '',
        appendChild: jest.fn(),
        addEventListener: jest.fn(),
      };

      mockDocument.getElementById.mockImplementation((id) => {
        if (id === 'anatomy-graph-container') return mockContainer;
        if (id === 'entity-selector') return mockSelector;
        return null;
      });

      const mockEntityDefinitions = [
        {
          id: 'test:entity1',
          components: { 'anatomy:body': { templateId: 'humanoid' } },
        },
      ];
      mockRegistry.getAllEntityDefinitions.mockReturnValue(
        mockEntityDefinitions
      );

      const mockStateUnsubscribe = jest.fn();
      const mockEquipmentUnsubscribe = jest.fn();

      mockEventDispatcher.subscribe.mockReturnValue(mockStateUnsubscribe);
      jest
        .spyOn(visualizerUI, '_subscribeToEquipmentEvents')
        .mockImplementation(() => {
          visualizerUI._equipmentUnsubscribes = [mockEquipmentUnsubscribe];
        });

      // Act
      await visualizerUI.initialize();

      // Assert
      expect(visualizerUI._subscribeToEquipmentEvents).toHaveBeenCalled();
      expect(visualizerUI._equipmentUnsubscribes).toEqual([
        mockEquipmentUnsubscribe,
      ]);
    });

    it('should not subscribe to equipment events when clothing service is not available', async () => {
      // Arrange
      const visualizerUIWithoutClothing = new AnatomyVisualizerUI({
        logger: mockLogger,
        registry: mockRegistry,
        entityManager: mockEntityManager,
        anatomyDescriptionService: mockAnatomyDescriptionService,
        eventDispatcher: mockEventDispatcher,
        documentContext: { document: mockDocument },
        visualizerStateController: mockVisualizerStateController,
        visualizationComposer: mockVisualizationComposer,
        clothingManagementService: null, // No clothing service
      });

      const mockContainer = { innerHTML: '' };
      const mockSelector = {
        innerHTML: '',
        appendChild: jest.fn(),
        addEventListener: jest.fn(),
      };

      mockDocument.getElementById.mockImplementation((id) => {
        if (id === 'anatomy-graph-container') return mockContainer;
        if (id === 'entity-selector') return mockSelector;
        return null;
      });

      const mockEntityDefinitions = [
        {
          id: 'test:entity1',
          components: { 'anatomy:body': { templateId: 'humanoid' } },
        },
      ];
      mockRegistry.getAllEntityDefinitions.mockReturnValue(
        mockEntityDefinitions
      );

      const mockStateUnsubscribe = jest.fn();
      mockEventDispatcher.subscribe.mockReturnValue(mockStateUnsubscribe);

      jest.spyOn(visualizerUIWithoutClothing, '_subscribeToEquipmentEvents');

      // Act
      await visualizerUIWithoutClothing.initialize();

      // Assert
      expect(
        visualizerUIWithoutClothing._subscribeToEquipmentEvents
      ).not.toHaveBeenCalled();
    });
  });

  describe('initialization with visualization composer', () => {
    it('should initialize visualization composer when container is available', async () => {
      // Arrange
      const mockContainer = { innerHTML: '' };
      const mockSelector = {
        innerHTML: '',
        appendChild: jest.fn(),
        addEventListener: jest.fn(),
      };

      mockDocument.getElementById.mockImplementation((id) => {
        if (id === 'anatomy-graph-container') return mockContainer;
        if (id === 'entity-selector') return mockSelector;
        return null;
      });

      const mockEntityDefinitions = [];
      mockRegistry.getAllEntityDefinitions.mockReturnValue(
        mockEntityDefinitions
      );

      const mockStateUnsubscribe = jest.fn();
      mockEventDispatcher.subscribe.mockReturnValue(mockStateUnsubscribe);

      // Act
      await visualizerUI.initialize();

      // Assert
      expect(mockVisualizationComposer.initialize).toHaveBeenCalledWith(
        mockContainer
      );
    });

    it('should not initialize visualization composer when container is not available', async () => {
      // Arrange
      const mockSelector = {
        innerHTML: '',
        appendChild: jest.fn(),
        addEventListener: jest.fn(),
      };

      mockDocument.getElementById.mockImplementation((id) => {
        if (id === 'anatomy-graph-container') return null; // No container
        if (id === 'entity-selector') return mockSelector;
        return null;
      });

      const mockEntityDefinitions = [];
      mockRegistry.getAllEntityDefinitions.mockReturnValue(
        mockEntityDefinitions
      );

      const mockStateUnsubscribe = jest.fn();
      mockEventDispatcher.subscribe.mockReturnValue(mockStateUnsubscribe);

      // Act
      await visualizerUI.initialize();

      // Assert
      expect(mockVisualizationComposer.initialize).not.toHaveBeenCalled();
    });
  });

  describe('integration with cleanup', () => {
    it('should complete full lifecycle with initialization and disposal', async () => {
      // Arrange
      const mockContainer = { innerHTML: '' };
      const mockSelector = {
        innerHTML: '',
        appendChild: jest.fn(),
        addEventListener: jest.fn(),
      };

      mockDocument.getElementById.mockImplementation((id) => {
        if (id === 'anatomy-graph-container') return mockContainer;
        if (id === 'entity-selector') return mockSelector;
        return null;
      });

      const mockEntityDefinitions = [
        {
          id: 'test:entity1',
          components: { 'anatomy:body': { templateId: 'humanoid' } },
        },
      ];
      mockRegistry.getAllEntityDefinitions.mockReturnValue(
        mockEntityDefinitions
      );

      const mockStateUnsubscribe = jest.fn();
      const mockEquipmentUnsubscribe = jest.fn();

      mockEventDispatcher.subscribe.mockReturnValue(mockStateUnsubscribe);
      jest
        .spyOn(visualizerUI, '_subscribeToEquipmentEvents')
        .mockImplementation(() => {
          visualizerUI._equipmentUnsubscribes = [mockEquipmentUnsubscribe];
        });

      jest.spyOn(visualizerUI, '_clearPreviousEntities').mockResolvedValue();

      // Act
      await visualizerUI.initialize();
      visualizerUI.dispose();

      // Assert
      expect(mockVisualizationComposer.initialize).toHaveBeenCalledWith(
        mockContainer
      );
      expect(visualizerUI._subscribeToEquipmentEvents).toHaveBeenCalled();
      expect(mockStateUnsubscribe).toHaveBeenCalled();
      expect(mockEquipmentUnsubscribe).toHaveBeenCalled();
      expect(visualizerUI._stateUnsubscribe).toBeNull();
      expect(visualizerUI._equipmentUnsubscribes).toEqual([]);
    });
  });
});
