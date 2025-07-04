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

      mockEntityManager.createEntityInstance.mockResolvedValue(mockEntityInstance);
      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntityInstance);

      // Mock event subscription to trigger the anatomy check
      let eventCallback;
      mockEventDispatcher.subscribe.mockImplementation((eventId, callback) => {
        eventCallback = callback;
        return jest.fn(); // unsubscribe function
      });

      // Create a mock graph renderer
      visualizerUI._graphRenderer = {
        renderGraph: jest.fn(),
        clear: jest.fn(),
      };

      // Act
      const loadPromise = visualizerUI._loadEntity(entityDefId);

      // Simulate entity creation event - this triggers the code at line 188
      setTimeout(() => {
        eventCallback({
          payload: {
            definitionId: entityDefId,
            instanceId: 'instance-123',
            wasReconstructed: false,
          },
        });
      }, 50);

      await loadPromise;

      // Assert
      expect(mockEntityInstance.getComponentData).toHaveBeenCalledWith('anatomy:body');
      // getComponentData is called multiple times: in event handler, for description, and for body
      expect(mockEntityInstance.getComponentData).toHaveBeenCalledTimes(3);
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

      mockEntityManager.createEntityInstance.mockResolvedValue(mockEntityInstance);
      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntityInstance);

      // Mock event subscription
      let eventCallback;
      let unsubscribeCalled = false;
      const unsubscribeFn = jest.fn(() => {
        unsubscribeCalled = true;
      });
      mockEventDispatcher.subscribe.mockImplementation((eventId, callback) => {
        eventCallback = callback;
        return unsubscribeFn;
      });

      // Create a mock graph renderer
      visualizerUI._graphRenderer = {
        renderGraph: jest.fn(),
        clear: jest.fn(),
      };

      // Act
      const loadPromise = visualizerUI._loadEntity(entityDefId);

      // Simulate entity creation event
      setTimeout(() => {
        eventCallback({
          payload: {
            definitionId: entityDefId,
            instanceId: 'instance-123',
            wasReconstructed: false,
          },
        });
      }, 50);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 200));

      // Assert - should not throw error about getComponent not being a function
      expect(mockEntityInstance.getComponentData).toHaveBeenCalledWith('anatomy:body');
      // Since no body component, it should not resolve yet
      expect(unsubscribeCalled).toBe(false);
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
      mockEntityManager.createEntityInstance.mockResolvedValue(mockEntityInstance);
      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntityInstance);
      // Ensure getEntity doesn't exist
      mockEntityManager.getEntity = undefined;

      // Mock event subscription
      let eventCallback;
      mockEventDispatcher.subscribe.mockImplementation((eventId, callback) => {
        eventCallback = callback;
        return jest.fn();
      });

      visualizerUI._graphRenderer = {
        renderGraph: jest.fn(),
        clear: jest.fn(),
      };

      // Act
      const loadPromise = visualizerUI._loadEntity(entityDefId);

      // Simulate entity creation event
      setTimeout(() => {
        eventCallback({
          payload: {
            definitionId: entityDefId,
            instanceId: instanceId,
            wasReconstructed: false,
          },
        });
      }, 50);

      await loadPromise;

      // Assert - getEntityInstance is called in the event handler
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(instanceId);
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

      mockEntityManager.createEntityInstance.mockResolvedValue(mockEntityInstance);
      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntityInstance);

      let eventCallback;
      mockEventDispatcher.subscribe.mockImplementation((eventId, callback) => {
        eventCallback = callback;
        return jest.fn();
      });

      visualizerUI._graphRenderer = {
        renderGraph: jest.fn(),
        clear: jest.fn(),
      };

      // Act & Assert - should not throw
      const loadPromise = visualizerUI._loadEntity(entityDefId);
      
      setTimeout(() => {
        // This should not throw "entity.getComponent is not a function"
        expect(() => {
          eventCallback({
            payload: {
              definitionId: entityDefId,
              instanceId: 'instance-123',
              wasReconstructed: false,
            },
          });
        }).not.toThrow();
      }, 50);

      await loadPromise;

      // Verify the correct method was called
      expect(mockEntityInstance.getComponentData).toHaveBeenCalledWith('anatomy:body');
      expect(visualizerUI._graphRenderer.renderGraph).toHaveBeenCalled();
    });
  });
});