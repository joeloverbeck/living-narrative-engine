/**
 * @file AnatomyVisualizerUI.test.js
 * @description Unit tests for AnatomyVisualizerUI
 */

import AnatomyVisualizerUI from '../../../src/domUI/AnatomyVisualizerUI.js';
import { jest } from '@jest/globals';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';

describe('AnatomyVisualizerUI', () => {
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
      getCurrentState: jest.fn(),
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
      createElement: jest.fn((tag) => ({
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
    });
  });

  describe('initialize', () => {
    it('should initialize successfully and populate entity selector', async () => {
      // Arrange
      const mockEntityDefinitions = [
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
        {
          id: 'test:entity3',
          components: {
            'core:name': { text: 'No Anatomy' },
          },
        },
      ];
      mockRegistry.getAllEntityDefinitions.mockReturnValue(
        mockEntityDefinitions
      );

      // Act
      await visualizerUI.initialize();

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyVisualizerUI: Initializing...'
      );
      expect(mockRegistry.getAllEntityDefinitions).toHaveBeenCalled();
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

    it('should handle error when getAllEntityDefinitions fails', async () => {
      // Arrange
      const error = new Error('Registry error');
      mockRegistry.getAllEntityDefinitions.mockImplementation(() => {
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
    it('should filter only entities with anatomy:body component', async () => {
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

      const mockEntityDefinitions = [
        {
          id: 'test:with-anatomy',
          components: { 'anatomy:body': {} },
        },
        {
          id: 'test:without-anatomy',
          components: { 'core:name': { text: 'No Body' } },
        },
        {
          id: 'test:no-components',
        },
        {
          id: 'test:null-components',
          components: null,
        },
      ];
      mockRegistry.getAllEntityDefinitions.mockReturnValue(
        mockEntityDefinitions
      );

      // Act
      await visualizerUI._populateEntitySelector();

      // Assert
      // Should create options for: default + 1 entity with anatomy
      expect(mockSelector.appendChild).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'AnatomyVisualizerUI: Found 1 entities with anatomy:body'
      );
    });

    it('should handle null entity definitions gracefully', async () => {
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
      await visualizerUI._populateEntitySelector();

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
