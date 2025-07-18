/**
 * @file AnatomyVisualizerUI.stateHandlers.test.js
 * @description Unit tests for state change handlers in AnatomyVisualizerUI
 */

import AnatomyVisualizerUI from '../../../src/domUI/AnatomyVisualizerUI.js';
import { jest } from '@jest/globals';

describe('AnatomyVisualizerUI - State Handlers', () => {
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

  describe('_handleStateChange', () => {
    it('should handle LOADING state', async () => {
      // Arrange
      jest.spyOn(visualizerUI, '_showMessage').mockImplementation();
      const event = {
        payload: {
          currentState: 'LOADING',
          selectedEntity: 'test-entity',
          anatomyData: null,
          error: null,
        },
      };

      // Act
      await visualizerUI._handleStateChange(event);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyVisualizerUI: State changed to LOADING',
        {
          selectedEntity: 'test-entity',
          hasAnatomyData: false,
          hasError: false,
        }
      );
      expect(visualizerUI._showMessage).toHaveBeenCalledWith(
        'Loading anatomy...'
      );
    });

    it('should handle LOADED state with anatomy data', async () => {
      // Arrange
      const anatomyData = { parts: { head: 'head-123' } };
      const selectedEntity = 'test-entity';

      jest.spyOn(visualizerUI, '_handleAnatomyLoaded').mockResolvedValue();

      const event = {
        payload: {
          currentState: 'LOADED',
          selectedEntity,
          anatomyData,
          error: null,
        },
      };

      // Act
      await visualizerUI._handleStateChange(event);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyVisualizerUI: State changed to LOADED',
        {
          selectedEntity,
          hasAnatomyData: true,
          hasError: false,
        }
      );
      expect(visualizerUI._handleAnatomyLoaded).toHaveBeenCalledWith(
        selectedEntity,
        anatomyData
      );
    });

    it('should handle LOADED state without anatomy data', async () => {
      // Arrange
      jest.spyOn(visualizerUI, '_handleAnatomyLoaded').mockResolvedValue();

      const event = {
        payload: {
          currentState: 'LOADED',
          selectedEntity: null,
          anatomyData: null,
          error: null,
        },
      };

      // Act
      await visualizerUI._handleStateChange(event);

      // Assert
      expect(visualizerUI._handleAnatomyLoaded).not.toHaveBeenCalled();
    });

    it('should handle READY state', async () => {
      // Arrange
      const event = {
        payload: {
          currentState: 'READY',
          selectedEntity: 'test-entity',
          anatomyData: null,
          error: null,
        },
      };

      // Act
      await visualizerUI._handleStateChange(event);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        'AnatomyVisualizerUI: Visualization ready'
      );
    });

    it('should handle ERROR state', async () => {
      // Arrange
      const error = new Error('Test error');
      jest.spyOn(visualizerUI, '_showMessage').mockImplementation();

      const event = {
        payload: {
          currentState: 'ERROR',
          selectedEntity: 'test-entity',
          anatomyData: null,
          error,
        },
      };

      // Act
      await visualizerUI._handleStateChange(event);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'AnatomyVisualizerUI: State error:',
        error
      );
      expect(visualizerUI._showMessage).toHaveBeenCalledWith(
        'Error: Test error'
      );
    });

    it('should handle ERROR state without error object', async () => {
      // Arrange
      const event = {
        payload: {
          currentState: 'ERROR',
          selectedEntity: 'test-entity',
          anatomyData: null,
          error: null,
        },
      };

      // Act
      await visualizerUI._handleStateChange(event);

      // Assert
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('_handleAnatomyLoaded', () => {
    it('should handle anatomy loaded successfully', async () => {
      // Arrange
      const entityId = 'test-entity';
      const anatomyData = { parts: { head: 'head-123' } };

      const mockEntity = {
        getComponentData: jest.fn((type) => {
          if (type === 'core:description') {
            return { text: 'Test description' };
          }
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

      const mockEquipmentResult = { success: true, hasEquipment: false };
      jest
        .spyOn(visualizerUI, '_retrieveEquipmentData')
        .mockResolvedValue(mockEquipmentResult);
      jest.spyOn(visualizerUI, '_updateEntityDescription').mockImplementation();
      jest.spyOn(visualizerUI, '_updateEquipmentDisplay').mockImplementation();

      // Act
      await visualizerUI._handleAnatomyLoaded(entityId, anatomyData);

      // Assert
      expect(visualizerUI._currentEntityId).toBe(entityId);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        entityId
      );
      expect(visualizerUI._updateEntityDescription).toHaveBeenCalledWith(
        mockEntity
      );
      expect(visualizerUI._retrieveEquipmentData).toHaveBeenCalledWith(
        entityId
      );
      expect(visualizerUI._updateEquipmentDisplay).toHaveBeenCalledWith(
        mockEquipmentResult
      );
      expect(mockVisualizerStateController.startRendering).toHaveBeenCalled();
      expect(mockVisualizationComposer.renderGraph).toHaveBeenCalledWith(
        entityId,
        anatomyData
      );
      expect(
        mockVisualizerStateController.completeRendering
      ).toHaveBeenCalled();
    });

    it('should handle error during anatomy loading', async () => {
      // Arrange
      const entityId = 'test-entity';
      const anatomyData = { parts: { head: 'head-123' } };
      const error = new Error('Entity not found');

      mockEntityManager.getEntityInstance.mockRejectedValue(error);

      // Act
      await visualizerUI._handleAnatomyLoaded(entityId, anatomyData);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to handle anatomy loaded state:',
        error
      );
      expect(mockVisualizerStateController.handleError).toHaveBeenCalledWith(
        error
      );
    });

    it('should handle error during equipment retrieval', async () => {
      // Arrange
      const entityId = 'test-entity';
      const anatomyData = { parts: { head: 'head-123' } };

      const mockEntity = {
        getComponentData: jest.fn(() => null),
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

      const equipmentError = new Error('Equipment fetch failed');
      jest
        .spyOn(visualizerUI, '_retrieveEquipmentData')
        .mockRejectedValue(equipmentError);
      jest.spyOn(visualizerUI, '_updateEntityDescription').mockImplementation();

      // Act
      await visualizerUI._handleAnatomyLoaded(entityId, anatomyData);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to handle anatomy loaded state:',
        equipmentError
      );
      expect(mockVisualizerStateController.handleError).toHaveBeenCalledWith(
        equipmentError
      );
    });

    it('should handle error during graph rendering', async () => {
      // Arrange
      const entityId = 'test-entity';
      const anatomyData = { parts: { head: 'head-123' } };

      const mockEntity = {
        getComponentData: jest.fn(() => null),
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

      const mockEquipmentResult = { success: true, hasEquipment: false };
      jest
        .spyOn(visualizerUI, '_retrieveEquipmentData')
        .mockResolvedValue(mockEquipmentResult);
      jest.spyOn(visualizerUI, '_updateEntityDescription').mockImplementation();
      jest.spyOn(visualizerUI, '_updateEquipmentDisplay').mockImplementation();

      const renderError = new Error('Render failed');
      mockVisualizationComposer.renderGraph.mockRejectedValue(renderError);

      // Act
      await visualizerUI._handleAnatomyLoaded(entityId, anatomyData);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to handle anatomy loaded state:',
        renderError
      );
      expect(mockVisualizerStateController.handleError).toHaveBeenCalledWith(
        renderError
      );
    });
  });

  describe('_subscribeToStateChanges', () => {
    it('should subscribe to state changes', () => {
      // Arrange
      const unsubscribeMock = jest.fn();
      mockEventDispatcher.subscribe.mockReturnValue(unsubscribeMock);

      // Act
      visualizerUI._subscribeToStateChanges();

      // Assert
      expect(mockEventDispatcher.subscribe).toHaveBeenCalledWith(
        'anatomy:visualizer_state_changed',
        expect.any(Function)
      );
      expect(visualizerUI._stateUnsubscribe).toBe(unsubscribeMock);
    });

    it('should bind the handler correctly', () => {
      // Arrange
      let capturedHandler;
      mockEventDispatcher.subscribe.mockImplementation((eventType, handler) => {
        capturedHandler = handler;
        return jest.fn();
      });

      jest.spyOn(visualizerUI, '_handleStateChange').mockImplementation();

      // Act
      visualizerUI._subscribeToStateChanges();

      // Assert
      expect(capturedHandler).toBeDefined();

      // Test the bound handler
      const testEvent = { payload: { currentState: 'LOADING' } };
      capturedHandler(testEvent);

      expect(visualizerUI._handleStateChange).toHaveBeenCalledWith(testEvent);
    });
  });
});
