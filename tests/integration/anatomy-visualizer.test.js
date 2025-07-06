/**
 * @file tests/integration/anatomy-visualizer.test.js
 * @description Integration tests for the complete anatomy visualizer flow
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AnatomyVisualizerUI from '../../src/domUI/AnatomyVisualizerUI.js';
import AnatomyGraphRenderer from '../../src/domUI/AnatomyGraphRenderer.js';
import { ENTITY_CREATED_ID } from '../../src/constants/eventIds.js';

describe('Anatomy Visualizer Integration', () => {
  let visualizerUI;
  let mockLogger;
  let mockRegistry;
  let mockEntityManager;
  let mockAnatomyDescriptionService;
  let mockEventDispatcher;
  let mockDocument;
  let mockEntitySelector;
  let mockGraphContainer;
  let mockDescriptionContent;

  beforeEach(() => {
    // Setup DOM elements
    mockEntitySelector = {
      innerHTML: '',
      appendChild: jest.fn(),
      addEventListener: jest.fn(),
      value: '',
    };

    mockGraphContainer = {
      innerHTML: '',
      appendChild: jest.fn(),
      querySelector: jest.fn(),
      getBoundingClientRect: jest.fn().mockReturnValue({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
      }),
    };

    mockDescriptionContent = {
      innerHTML: '',
    };

    mockDocument = {
      getElementById: jest.fn((id) => {
        switch (id) {
          case 'entity-selector':
            return mockEntitySelector;
          case 'anatomy-graph-container':
            return mockGraphContainer;
          case 'entity-description-content':
            return mockDescriptionContent;
          default:
            return null;
        }
      }),
      createElement: jest.fn((tag) => ({
        value: '',
        textContent: '',
        appendChild: jest.fn(),
      })),
      createElementNS: jest.fn(() => ({
        setAttribute: jest.fn(),
        appendChild: jest.fn(),
        querySelectorAll: jest.fn().mockReturnValue([]),
      })),
    };

    // Setup service mocks
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockRegistry = {
      getAllEntityDefinitions: jest.fn(),
      getEntityDefinition: jest.fn(),
    };

    mockEntityManager = {
      createEntityInstance: jest.fn(),
      getEntityInstance: jest.fn(),
      removeEntityInstance: jest.fn(),
    };

    mockAnatomyDescriptionService = {};

    mockEventDispatcher = {
      subscribe: jest.fn(),
    };

    visualizerUI = new AnatomyVisualizerUI({
      logger: mockLogger,
      registry: mockRegistry,
      entityManager: mockEntityManager,
      anatomyDescriptionService: mockAnatomyDescriptionService,
      eventDispatcher: mockEventDispatcher,
      documentContext: { document: mockDocument },
    });
  });

  describe('initialization', () => {
    it('should populate entity selector with entities that have anatomy:body', async () => {
      // Arrange
      const mockDefinitions = [
        {
          id: 'human',
          components: {
            'anatomy:body': { torsoDefinition: 'human:torso' },
            'core:name': { text: 'Human' },
          },
        },
        {
          id: 'robot',
          components: {
            'anatomy:body': { torsoDefinition: 'robot:torso' },
            'core:name': { text: 'Robot' },
          },
        },
        {
          id: 'ghost',
          components: {
            'core:name': { text: 'Ghost' },
            // No anatomy:body component
          },
        },
      ];

      mockRegistry.getAllEntityDefinitions.mockReturnValue(mockDefinitions);

      // Act
      await visualizerUI.initialize();

      // Assert
      expect(mockRegistry.getAllEntityDefinitions).toHaveBeenCalled();
      expect(mockDocument.createElement).toHaveBeenCalledTimes(3); // default + 2 anatomy entities
      expect(mockEntitySelector.appendChild).toHaveBeenCalledTimes(3);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'AnatomyVisualizerUI: Found 2 entities with anatomy:body'
      );
    });

    it('should handle errors when populating entity selector', async () => {
      // Arrange
      const error = new Error('Registry error');
      mockRegistry.getAllEntityDefinitions.mockImplementation(() => {
        throw error;
      });

      // Act
      await visualizerUI.initialize();

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to populate entity selector:',
        error
      );
      expect(mockEntitySelector.innerHTML).toBe(
        '<option value="">Error loading entities</option>'
      );
    });
  });

  describe('entity loading', () => {
    it('should create entity and render anatomy graph when entity is selected', async () => {
      // Arrange
      const entityDefId = 'human';
      const entityInstanceId = 'human-instance-1';

      const mockDefinition = {
        id: entityDefId,
        components: {
          'anatomy:body': { torsoDefinition: 'human:torso' },
        },
      };

      const mockEntityInstance = {
        id: entityInstanceId,
        getComponentData: jest.fn((component) => {
          if (component === 'anatomy:body') {
            return {
              body: {
                root: 'torso-1',
                parts: { torso: 'torso-1' },
              },
            };
          }
          if (component === 'core:description') {
            return { text: 'A human being' };
          }
          return null;
        }),
      };

      const mockTorsoEntity = {
        getComponentData: jest.fn(() => ({ text: 'Torso' })),
      };

      mockRegistry.getEntityDefinition.mockReturnValue(mockDefinition);
      mockEntityManager.createEntityInstance.mockResolvedValue(
        mockEntityInstance
      );
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === entityInstanceId) return Promise.resolve(mockEntityInstance);
        if (id === 'torso-1') return Promise.resolve(mockTorsoEntity);
        return Promise.resolve(null);
      });

      // Setup event subscription to simulate anatomy generation completion
      let entityCreatedCallback;
      mockEventDispatcher.subscribe.mockImplementation((eventId, callback) => {
        if (eventId === ENTITY_CREATED_ID) {
          entityCreatedCallback = callback;
        }
        return jest.fn(); // unsubscribe function
      });

      // Initialize first
      await visualizerUI.initialize();

      // Act - Start loading entity
      const loadPromise = visualizerUI._loadEntity(entityDefId);

      // Simulate entity created event after a delay
      setTimeout(() => {
        entityCreatedCallback({
          payload: {
            definitionId: entityDefId,
            instanceId: entityInstanceId,
            wasReconstructed: false,
          },
        });
      }, 50);

      await loadPromise;

      // Assert
      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(
        entityDefId,
        {}
      );
      expect(mockDescriptionContent.innerHTML).toBe('<p>A human being</p>');
      expect(visualizerUI._currentEntityId).toBe(entityInstanceId);
      expect(visualizerUI._createdEntities).toContain(entityInstanceId);
    });

    it('should handle entity without anatomy:body component', async () => {
      // Arrange
      const entityDefId = 'ghost';
      const mockDefinition = {
        id: entityDefId,
        components: {}, // No anatomy:body
      };

      mockRegistry.getEntityDefinition.mockReturnValue(mockDefinition);

      // Act
      await visualizerUI._loadEntity(entityDefId);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to load entity ${entityDefId}:`,
        expect.any(Error)
      );
      expect(mockGraphContainer.innerHTML).toContain('Failed to load entity');
    });

    it('should clean up previous entities before loading new one', async () => {
      // Arrange
      visualizerUI._createdEntities = [
        'old-entity-1',
        'old-part-1',
        'old-part-2',
      ];
      visualizerUI._currentEntityId = 'old-entity-1';

      const mockDefinition = {
        id: 'new-entity',
        components: {
          'anatomy:body': {},
        },
      };

      mockRegistry.getEntityDefinition.mockReturnValue(mockDefinition);
      mockEntityManager.createEntityInstance.mockResolvedValue({
        id: 'new-instance',
      });
      mockEventDispatcher.subscribe.mockReturnValue(jest.fn());

      // Act - Call _clearPreviousEntities directly to test cleanup logic
      await visualizerUI._clearPreviousEntities();

      // Assert - entities are removed in reverse order (children first)
      expect(mockEntityManager.removeEntityInstance).toHaveBeenCalledTimes(3);
      expect(mockEntityManager.removeEntityInstance).toHaveBeenNthCalledWith(
        1,
        'old-part-2'
      );
      expect(mockEntityManager.removeEntityInstance).toHaveBeenNthCalledWith(
        2,
        'old-part-1'
      );
      expect(mockEntityManager.removeEntityInstance).toHaveBeenNthCalledWith(
        3,
        'old-entity-1'
      );
    });
  });

  describe('event handling', () => {
    it('should load entity when selector changes', async () => {
      // Arrange
      let changeHandler;
      mockEntitySelector.addEventListener.mockImplementation(
        (event, handler) => {
          if (event === 'change') changeHandler = handler;
        }
      );

      const mockDefinition = {
        id: 'human',
        components: { 'anatomy:body': {} },
      };

      mockRegistry.getEntityDefinition.mockReturnValue(mockDefinition);
      mockEntityManager.createEntityInstance.mockResolvedValue({
        id: 'instance-1',
      });
      mockEventDispatcher.subscribe.mockReturnValue(jest.fn());

      await visualizerUI.initialize();

      // Act
      changeHandler({ target: { value: 'human' } });

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        'AnatomyVisualizerUI: Loading entity human'
      );
    });

    it('should clear visualization when empty value is selected', async () => {
      // Arrange
      let changeHandler;
      mockEntitySelector.addEventListener.mockImplementation(
        (event, handler) => {
          if (event === 'change') changeHandler = handler;
        }
      );

      visualizerUI._createdEntities = ['entity-1'];

      await visualizerUI.initialize();

      // Mock the clear method on the graph renderer
      visualizerUI._graphRenderer.clear = jest.fn();

      // Act
      await changeHandler({ target: { value: '' } });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Assert
      expect(visualizerUI._graphRenderer.clear).toHaveBeenCalled();
      expect(mockDescriptionContent.innerHTML).toBe(
        '<p>Select an entity to view its description.</p>'
      );
    });
  });

  describe('SVG rendering issues', () => {
    it('should ensure SVG is properly sized and positioned', async () => {
      // Arrange
      const mockDefinition = {
        id: 'human',
        components: { 'anatomy:body': {} },
      };

      const mockEntity = {
        id: 'human-1',
        getComponentData: jest.fn((comp) => {
          if (comp === 'anatomy:body') {
            return {
              body: {
                root: 'torso-1',
                parts: { torso: 'torso-1' },
              },
            };
          }
          return null;
        }),
      };

      mockRegistry.getEntityDefinition.mockReturnValue(mockDefinition);
      mockEntityManager.createEntityInstance.mockResolvedValue(mockEntity);
      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);
      mockEventDispatcher.subscribe.mockImplementation((eventId, callback) => {
        // Immediately trigger the callback
        setTimeout(() => {
          callback({
            payload: {
              definitionId: 'human',
              instanceId: 'human-1',
              wasReconstructed: false,
            },
          });
        }, 0);
        return jest.fn();
      });

      const mockSvg = {
        setAttribute: jest.fn(),
        appendChild: jest.fn(),
        id: '',
        parentElement: mockGraphContainer,
        querySelectorAll: jest.fn().mockReturnValue([]),
      };

      mockDocument.createElementNS.mockImplementation((ns, tag) => {
        if (tag === 'svg') return mockSvg;
        return {
          setAttribute: jest.fn(),
          appendChild: jest.fn(),
          textContent: '',
        };
      });

      await visualizerUI.initialize();

      // Act
      await visualizerUI._loadEntity('human');

      // Assert
      // Check that SVG is created with responsive sizing
      expect(mockSvg.setAttribute).toHaveBeenCalledWith('width', '100%');
      expect(mockSvg.setAttribute).toHaveBeenCalledWith('height', '100%');
      expect(mockSvg.setAttribute).toHaveBeenCalledWith(
        'preserveAspectRatio',
        'xMidYMid meet'
      );
      expect(mockSvg.setAttribute).toHaveBeenCalledWith(
        'viewBox',
        expect.stringMatching(/-?\d+ -?\d+ \d+ \d+/)
      );
    });

    it('should prevent node cut-off with proper Y offset', async () => {
      // This test verifies that nodes are positioned with Y offset
      // The actual offset is tested in the unit tests for AnatomyGraphRenderer
      // Here we just ensure the graph renderer is called properly

      const mockDefinition = {
        id: 'human',
        components: { 'anatomy:body': {} },
      };

      const mockEntity = {
        id: 'human-1',
        getComponentData: jest.fn((comp) => {
          if (comp === 'anatomy:body') {
            return {
              body: {
                root: 'torso-1',
                parts: { torso: 'torso-1' },
              },
            };
          }
          return null;
        }),
      };

      mockRegistry.getEntityDefinition.mockReturnValue(mockDefinition);
      mockEntityManager.createEntityInstance.mockResolvedValue(mockEntity);
      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);
      mockEventDispatcher.subscribe.mockImplementation((eventId, callback) => {
        setTimeout(() => {
          callback({
            payload: {
              definitionId: 'human',
              instanceId: 'human-1',
              wasReconstructed: false,
            },
          });
        }, 0);
        return jest.fn();
      });

      await visualizerUI.initialize();

      // Act
      await visualizerUI._loadEntity('human');

      // Assert - The graph renderer should have been called with body data
      expect(visualizerUI._graphRenderer).toBeDefined();
      expect(mockEntity.getComponentData).toHaveBeenCalledWith('anatomy:body');
    });
  });
});
