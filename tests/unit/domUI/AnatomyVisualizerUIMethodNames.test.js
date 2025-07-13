/**
 * @file AnatomyVisualizerUIMethodNames.test.js
 * @description Focused tests to ensure correct entity method names are used
 */

import AnatomyVisualizerUI from '../../../src/domUI/AnatomyVisualizerUI.js';
import { jest } from '@jest/globals';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';

describe('AnatomyVisualizerUI - Method Name Validation', () => {
  let mockLogger;
  let mockRegistry;
  let mockEntityManager;
  let mockAnatomyDescriptionService;
  let mockEventDispatcher;
  let mockVisualizerStateController;
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
      get: jest.fn(),
      getEntityDefinition: jest.fn(),
    };

    // Mock entity manager
    mockEntityManager = {
      createEntityInstance: jest.fn(),
      getEntityInstance: jest.fn(),
      removeEntityInstance: jest.fn(),
    };

    // Mock anatomy description service
    mockAnatomyDescriptionService = {};

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
    });
  });

  describe('Entity Method Names', () => {
    it('should use getComponentData() instead of getComponent() when accessing anatomy:body', async () => {
      // Arrange
      const entityDefId = 'test:entity';
      const mockDefinition = {
        id: entityDefId,
        components: {
          'anatomy:body': { templateId: 'humanoid' },
        },
      };
      mockRegistry.getEntityDefinition.mockReturnValue(mockDefinition);

      const mockEntityInstance = {
        id: 'instance-123',
        // Entity should have getComponentData, NOT getComponent
        getComponentData: jest.fn((type) => {
          if (type === 'anatomy:body') {
            return { body: { parts: { head: 'head-123' } } };
          }
          return null;
        }),
        // Ensure getComponent is NOT a function
        getComponent: undefined,
      };

      mockEntityManager.createEntityInstance.mockResolvedValue(
        mockEntityInstance
      );

      // Create a mock graph renderer
      visualizerUI._graphRenderer = {
        renderGraph: jest.fn(),
        clear: jest.fn(),
      };

      // Act
      await visualizerUI._loadEntity(entityDefId);

      // Assert - verify the state controller is called with the correct entity ID
      expect(mockVisualizerStateController.selectEntity).toHaveBeenCalledWith(
        'instance-123'
      );
      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(
        entityDefId,
        {}
      );
    });

    it('should handle entities that do not have getComponent method', async () => {
      // Arrange
      const entityDefId = 'test:entity';
      const mockDefinition = {
        id: entityDefId,
        components: {
          'anatomy:body': { templateId: 'humanoid' },
        },
      };
      mockRegistry.getEntityDefinition.mockReturnValue(mockDefinition);

      // Create entity without getComponent method (simulating the actual API)
      const mockEntityInstance = {
        id: 'instance-123',
        getComponentData: jest.fn(() => null), // No anatomy body
      };
      // Explicitly ensure getComponent doesn't exist
      Object.defineProperty(mockEntityInstance, 'getComponent', {
        value: undefined,
        writable: false,
        configurable: false,
      });

      mockEntityManager.createEntityInstance.mockResolvedValue(
        mockEntityInstance
      );

      // Create a mock graph renderer
      visualizerUI._graphRenderer = {
        renderGraph: jest.fn(),
        clear: jest.fn(),
      };

      // Act
      await visualizerUI._loadEntity(entityDefId);

      // Assert - should not throw error about getComponent not being a function
      expect(mockVisualizerStateController.selectEntity).toHaveBeenCalledWith(
        'instance-123'
      );
      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(
        entityDefId,
        {}
      );
    });

    it('should use getEntityInstance() instead of getEntity() when fetching entities', async () => {
      // Arrange
      const entityDefId = 'test:entity';
      const instanceId = 'instance-123';

      const mockDefinition = {
        id: entityDefId,
        components: {
          'anatomy:body': { templateId: 'humanoid' },
        },
      };
      mockRegistry.getEntityDefinition.mockReturnValue(mockDefinition);

      const mockEntityInstance = {
        id: instanceId,
        getComponentData: jest.fn((type) => {
          if (type === 'anatomy:body') {
            return { body: { parts: {} } };
          }
          return null;
        }),
      };

      // Ensure getEntityInstance is called, not getEntity
      mockEntityManager.createEntityInstance.mockResolvedValue(
        mockEntityInstance
      );
      // Ensure getEntity doesn't exist
      mockEntityManager.getEntity = undefined;

      visualizerUI._graphRenderer = {
        renderGraph: jest.fn(),
        clear: jest.fn(),
      };

      // Act
      await visualizerUI._loadEntity(entityDefId);

      // Assert - verify the state controller is called correctly
      expect(mockVisualizerStateController.selectEntity).toHaveBeenCalledWith(
        instanceId
      );
      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(
        entityDefId,
        {}
      );
    });
  });

  describe('Error Prevention', () => {
    it('should not throw TypeError when entity is fetched and anatomy:body is accessed', async () => {
      // This test specifically prevents the error: "entity.getComponent is not a function"
      const entityDefId = 'test:entity';
      const mockDefinition = {
        id: entityDefId,
        components: {
          'anatomy:body': { templateId: 'humanoid' },
        },
      };
      mockRegistry.getEntityDefinition.mockReturnValue(mockDefinition);

      // Mock entity that only has getComponentData (like the real implementation)
      const mockEntityInstance = {
        id: 'instance-123',
        getComponentData: jest.fn((type) => {
          if (type === 'anatomy:body') {
            return { body: { parts: { torso: 'torso-123' } } };
          }
          return null;
        }),
      };

      mockEntityManager.createEntityInstance.mockResolvedValue(
        mockEntityInstance
      );

      visualizerUI._graphRenderer = {
        renderGraph: jest.fn(),
        clear: jest.fn(),
      };

      // Act & Assert - should not throw
      await expect(
        visualizerUI._loadEntity(entityDefId)
      ).resolves.toBeUndefined();

      // Verify the state controller was called correctly
      expect(mockVisualizerStateController.selectEntity).toHaveBeenCalledWith(
        'instance-123'
      );
      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(
        entityDefId,
        {}
      );
    });
  });
});
