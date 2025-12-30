/**
 * @file AnatomyVisualizerUI.test.js
 * @description Unit tests for AnatomyVisualizerUI
 */

import AnatomyVisualizerUI from '../../../src/domUI/AnatomyVisualizerUI.js';
import { jest } from '@jest/globals';

describe('AnatomyVisualizerUI', () => {
  let mockLogger;
  let mockRegistry;
  let mockEntityManager;
  let mockAnatomyDescriptionService;
  let mockEventDispatcher;
  let mockVisualizerStateController;
  let mockVisualizationComposer;
  let mockClothingManagementService;
  let mockRecipeSelectorService;
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

    // Mock registry with getAllEntityDefinitions method
    mockRegistry = {
      getAllEntityDefinitions: jest.fn(),
      get: jest.fn(),
      getEntityDefinition: jest.fn(),
    };

    // Mock entity manager
    mockEntityManager = {
      createEntityInstance: jest.fn(),
      getEntityInstance: jest.fn(),
      removeEntityInstance: jest.fn(),
      hasComponent: jest.fn().mockReturnValue(false),
    };

    // Mock anatomy description service
    mockAnatomyDescriptionService = {};

    // Mock clothing management service
    mockClothingManagementService = {
      getEquippedItems: jest
        .fn()
        .mockResolvedValue({ success: true, equipped: {} }),
    };

    // Mock recipe selector service
    mockRecipeSelectorService = {
      populateWithComponent: jest.fn().mockReturnValue([]),
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
      getCurrentState: jest.fn().mockReturnValue('IDLE'),
      getSelectedEntity: jest.fn(),
      getAnatomyData: jest.fn(),
    };

    // Mock visualization composer
    mockVisualizationComposer = {
      initialize: jest.fn(),
      renderGraph: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn(),
      setLayout: jest.fn(),
      setTheme: jest.fn(),
      dispose: jest.fn(),
    };

    // Mock document with elements
    const mockSelector = {
      innerHTML: '',
      appendChild: jest.fn(),
      addEventListener: jest.fn(),
      value: '',
    };

    const mockDescriptionContent = {
      innerHTML: '',
    };

    const mockGraphContainer = {
      innerHTML: '',
      querySelector: jest.fn(() => null),
    };

    mockDocument = {
      getElementById: jest.fn((id) => {
        if (id === 'entity-selector') return mockSelector;
        if (id === 'entity-description-content') return mockDescriptionContent;
        if (id === 'anatomy-graph-container') return mockGraphContainer;
        return null;
      }),
      createElement: jest.fn(() => ({
        value: '',
        textContent: '',
      })),
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
      recipeSelectorService: mockRecipeSelectorService,
    });
  });

  describe('initialize', () => {
    it('should initialize successfully and populate entity selector via service', async () => {
      // Arrange
      const mockFilteredDefinitions = [
        {
          id: 'test:entity1',
          components: {
            'anatomy:body': { templateId: 'humanoid' },
            'core:name': { text: 'Test Entity 1' },
          },
        },
        {
          id: 'test:entity2',
          components: {
            'anatomy:body': { templateId: 'humanoid' },
          },
        },
      ];
      mockRecipeSelectorService.populateWithComponent.mockReturnValue(
        mockFilteredDefinitions
      );

      // Act
      await visualizerUI.initialize();

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyVisualizerUI: Initializing...'
      );
      expect(mockRecipeSelectorService.populateWithComponent).toHaveBeenCalledWith(
        expect.anything(),
        'anatomy:body',
        { placeholderText: 'Select an entity...' }
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'AnatomyVisualizerUI: Found 2 entities with anatomy:body'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyVisualizerUI: Initialization complete'
      );
    });

    it('should handle error when entity selector element is not found', async () => {
      // Arrange
      mockDocument.getElementById.mockImplementation((id) => {
        if (id === 'entity-selector') return null;
        return null;
      });

      // Act
      await visualizerUI.initialize();

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Entity selector element not found'
      );
    });

    it('should handle error when recipeSelectorService fails', async () => {
      // Arrange
      const error = new Error('Service error');
      mockRecipeSelectorService.populateWithComponent.mockImplementation(() => {
        throw error;
      });

      const mockSelector = {
        innerHTML: '',
        appendChild: jest.fn(),
        addEventListener: jest.fn(),
      };
      mockDocument.getElementById.mockImplementation((id) => {
        if (id === 'entity-selector') return mockSelector;
        return null;
      });

      // Act
      await visualizerUI.initialize();

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to populate entity selector:',
        error
      );
      expect(mockSelector.innerHTML).toBe(
        '<option value="">Error loading entities</option>'
      );
    });
  });

  describe('_populateEntitySelector', () => {
    it('should call recipeSelectorService to populate selector', async () => {
      // Arrange
      const mockSelector = {
        innerHTML: '',
        appendChild: jest.fn(),
        addEventListener: jest.fn(),
      };
      mockDocument.getElementById.mockImplementation((id) => {
        if (id === 'entity-selector') return mockSelector;
        return null;
      });

      const mockFilteredDefinitions = [
        {
          id: 'test:with-anatomy',
          components: { 'anatomy:body': {} },
        },
      ];
      mockRecipeSelectorService.populateWithComponent.mockReturnValue(
        mockFilteredDefinitions
      );

      // Act
      await visualizerUI._populateEntitySelector();

      // Assert
      expect(mockRecipeSelectorService.populateWithComponent).toHaveBeenCalledWith(
        mockSelector,
        'anatomy:body',
        { placeholderText: 'Select an entity...' }
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'AnatomyVisualizerUI: Found 1 entities with anatomy:body'
      );
    });

    it('should use fallback logic when recipeSelectorService is not available', async () => {
      // Arrange - create instance without recipeSelectorService
      const visualizerUIWithoutService = new AnatomyVisualizerUI({
        logger: mockLogger,
        registry: mockRegistry,
        entityManager: mockEntityManager,
        anatomyDescriptionService: mockAnatomyDescriptionService,
        eventDispatcher: mockEventDispatcher,
        documentContext: { document: mockDocument },
        visualizerStateController: mockVisualizerStateController,
        visualizationComposer: mockVisualizationComposer,
        clothingManagementService: mockClothingManagementService,
        // No recipeSelectorService provided
      });

      const mockSelector = {
        innerHTML: '',
        appendChild: jest.fn(),
        addEventListener: jest.fn(),
      };
      mockDocument.getElementById.mockImplementation((id) => {
        if (id === 'entity-selector') return mockSelector;
        return null;
      });

      const mockEntityDefinitions = [
        {
          id: 'test:with-anatomy',
          components: { 'anatomy:body': {} },
        },
        {
          id: 'test:without-anatomy',
          components: { 'core:name': { text: 'No Body' } },
        },
      ];
      mockRegistry.getAllEntityDefinitions.mockReturnValue(
        mockEntityDefinitions
      );

      // Act
      await visualizerUIWithoutService._populateEntitySelector();

      // Assert - should use inline logic, not the service
      expect(mockRecipeSelectorService.populateWithComponent).not.toHaveBeenCalled();
      expect(mockRegistry.getAllEntityDefinitions).toHaveBeenCalled();
      // Should create options for: default + 1 entity with anatomy
      expect(mockSelector.appendChild).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'AnatomyVisualizerUI: Found 1 entities with anatomy:body'
      );
    });

    it('should handle null entity definitions gracefully in fallback path', async () => {
      // Arrange - create instance without recipeSelectorService
      const visualizerUIWithoutService = new AnatomyVisualizerUI({
        logger: mockLogger,
        registry: mockRegistry,
        entityManager: mockEntityManager,
        anatomyDescriptionService: mockAnatomyDescriptionService,
        eventDispatcher: mockEventDispatcher,
        documentContext: { document: mockDocument },
        visualizerStateController: mockVisualizerStateController,
        visualizationComposer: mockVisualizationComposer,
        clothingManagementService: mockClothingManagementService,
        // No recipeSelectorService provided
      });

      const mockSelector = {
        innerHTML: '',
        appendChild: jest.fn(),
        addEventListener: jest.fn(),
      };
      mockDocument.getElementById.mockImplementation((id) => {
        if (id === 'entity-selector') return mockSelector;
        return null;
      });

      const mockEntityDefinitions = [
        null,
        undefined,
        {
          id: 'test:valid',
          components: { 'anatomy:body': {} },
        },
      ];
      mockRegistry.getAllEntityDefinitions.mockReturnValue(
        mockEntityDefinitions
      );

      // Act
      await visualizerUIWithoutService._populateEntitySelector();

      // Assert
      expect(mockSelector.appendChild).toHaveBeenCalledTimes(2); // default + 1 valid
      expect(mockLogger.info).toHaveBeenCalledWith(
        'AnatomyVisualizerUI: Found 1 entities with anatomy:body'
      );
    });
  });

  describe('_loadEntity', () => {
    it('should successfully load entity with anatomy', async () => {
      // Arrange
      const entityDefId = 'test:entity';
      const mockDefinition = {
        id: entityDefId,
        components: {
          'anatomy:body': { templateId: 'humanoid' },
          'core:description': { text: 'Test description' },
        },
      };
      mockRegistry.getEntityDefinition.mockReturnValue(mockDefinition);

      const mockEntityInstance = {
        id: 'instance-123',
        getComponentData: jest.fn((type) => {
          if (type === 'anatomy:body') {
            return {
              body: { parts: { head: 'head-123', torso: 'torso-123' } },
            };
          }
          if (type === 'core:description') {
            return { text: 'Test description' };
          }
          return null;
        }),
      };

      mockEntityManager.createEntityInstance.mockResolvedValue(
        mockEntityInstance
      );
      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntityInstance);

      // Mock the selectEntity method to resolve successfully
      mockVisualizerStateController.selectEntity.mockResolvedValue();

      // Mock event subscription for state changes before initialization
      let stateChangeCallback;
      mockEventDispatcher.subscribe.mockImplementation((eventId, callback) => {
        if (eventId === 'anatomy:visualizer_state_changed') {
          stateChangeCallback = callback;
        }
        return jest.fn(); // unsubscribe function
      });

      // Initialize to set up event subscriptions
      await visualizerUI.initialize();

      // Update the mock to track calls after initialization
      mockVisualizationComposer.renderGraph.mockClear();

      // Act
      await visualizerUI._loadEntity(entityDefId);

      // Simulate the state change to LOADED
      mockVisualizerStateController.getCurrentState.mockReturnValue('LOADED');
      if (stateChangeCallback) {
        await stateChangeCallback({
          payload: {
            currentState: 'LOADED',
            selectedEntity: 'instance-123',
            anatomyData: { parts: { head: 'head-123', torso: 'torso-123' } },
          },
        });
      }

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        `AnatomyVisualizerUI: Loading entity ${entityDefId}`
      );
      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(
        entityDefId,
        {}
      );
      expect(mockVisualizerStateController.selectEntity).toHaveBeenCalledWith(
        'instance-123'
      );
      // The renderGraph is now called through the state change handler
      expect(mockVisualizationComposer.renderGraph).toHaveBeenCalledWith(
        'instance-123',
        { parts: { head: 'head-123', torso: 'torso-123' } }
      );
    });

    it('should handle entity definition not found', async () => {
      // Arrange
      const entityDefId = 'test:missing';
      mockRegistry.getEntityDefinition.mockReturnValue(null);

      // Act
      await visualizerUI._loadEntity(entityDefId);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to load entity ${entityDefId}:`,
        expect.any(Error)
      );
    });

    it('should handle entity without anatomy:body component', async () => {
      // Arrange
      const entityDefId = 'test:no-anatomy';
      const mockDefinition = {
        id: entityDefId,
        components: {
          'core:name': { text: 'No Anatomy' },
        },
      };
      mockRegistry.getEntityDefinition.mockReturnValue(mockDefinition);

      // Act
      await visualizerUI._loadEntity(entityDefId);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to load entity ${entityDefId}:`,
        expect.any(Error)
      );
    });
  });

  describe('_loadEntity with EntityLoadingService', () => {
    let mockEntityLoadingService;
    let visualizerUIWithService;

    beforeEach(() => {
      mockEntityLoadingService = {
        loadEntityWithAnatomy: jest.fn(),
        clearCurrentEntity: jest.fn(),
        getCurrentEntityId: jest.fn(),
        getCreatedEntities: jest.fn(() => []),
      };

      visualizerUIWithService = new AnatomyVisualizerUI({
        logger: mockLogger,
        registry: mockRegistry,
        entityManager: mockEntityManager,
        anatomyDescriptionService: mockAnatomyDescriptionService,
        eventDispatcher: mockEventDispatcher,
        documentContext: { document: mockDocument },
        visualizerStateController: mockVisualizerStateController,
        visualizationComposer: mockVisualizationComposer,
        clothingManagementService: mockClothingManagementService,
        recipeSelectorService: mockRecipeSelectorService,
        entityLoadingService: mockEntityLoadingService,
      });
    });

    it('should delegate to EntityLoadingService when available', async () => {
      // Arrange
      const entityDefId = 'test:entity';
      mockEntityLoadingService.loadEntityWithAnatomy.mockResolvedValue(
        'instance-123'
      );

      // Act
      await visualizerUIWithService._loadEntity(entityDefId);

      // Assert
      expect(mockEntityLoadingService.loadEntityWithAnatomy).toHaveBeenCalledWith(
        entityDefId
      );
      expect(visualizerUIWithService._currentEntityId).toBe('instance-123');
      // Should NOT call inline methods
      expect(mockRegistry.getEntityDefinition).not.toHaveBeenCalled();
      expect(mockEntityManager.createEntityInstance).not.toHaveBeenCalled();
    });

    it('should handle EntityLoadingService errors gracefully', async () => {
      // Arrange
      const entityDefId = 'test:entity';
      const error = new Error('Service error');
      mockEntityLoadingService.loadEntityWithAnatomy.mockRejectedValue(error);

      // Act - should not throw
      await visualizerUIWithService._loadEntity(entityDefId);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to load entity ${entityDefId}:`,
        error
      );
    });

    it('should set currentEntityId from service result', async () => {
      // Arrange
      mockEntityLoadingService.loadEntityWithAnatomy.mockResolvedValue(
        'custom-instance-id'
      );

      // Act
      await visualizerUIWithService._loadEntity('test:entity');

      // Assert
      expect(visualizerUIWithService._currentEntityId).toBe('custom-instance-id');
    });
  });

  describe('_clearPreviousEntities', () => {
    it('should remove all created entities in reverse order', async () => {
      // Arrange
      visualizerUI._createdEntities = ['entity1', 'entity2', 'entity3'];

      // Act
      await visualizerUI._clearPreviousEntities();

      // Assert
      expect(mockEntityManager.removeEntityInstance).toHaveBeenCalledTimes(3);
      expect(mockEntityManager.removeEntityInstance).toHaveBeenNthCalledWith(
        1,
        'entity3'
      );
      expect(mockEntityManager.removeEntityInstance).toHaveBeenNthCalledWith(
        2,
        'entity2'
      );
      expect(mockEntityManager.removeEntityInstance).toHaveBeenNthCalledWith(
        3,
        'entity1'
      );
      expect(visualizerUI._createdEntities).toEqual([]);
      expect(visualizerUI._currentEntityId).toBeNull();
    });

    it('should handle removal errors gracefully', async () => {
      // Arrange
      visualizerUI._createdEntities = ['entity1', 'entity2'];
      mockEntityManager.removeEntityInstance.mockRejectedValueOnce(
        new Error('Removal failed')
      );

      // Act
      await visualizerUI._clearPreviousEntities();

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to destroy entity entity2:',
        expect.any(Error)
      );
      expect(visualizerUI._createdEntities).toEqual([]);
    });
  });
});
