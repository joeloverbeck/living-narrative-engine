/**
 * @file Tests for VisualizerStateController - Bridges state management with UI and event integration
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

describe('VisualizerStateController - Initialization', () => {
  let visualizerStateController;
  let mockVisualizerState;
  let mockAnatomyLoadingDetector;
  let mockEventDispatcher;
  let mockLogger;

  beforeEach(() => {
    // Mock dependencies
    mockVisualizerState = {
      getCurrentState: jest.fn(),
      getSelectedEntity: jest.fn(),
      getAnatomyData: jest.fn(),
      getError: jest.fn(),
      selectEntity: jest.fn(),
      setAnatomyData: jest.fn(),
      startRendering: jest.fn(),
      completeRendering: jest.fn(),
      setError: jest.fn(),
      reset: jest.fn(),
      retry: jest.fn(),
      subscribe: jest.fn(),
      dispose: jest.fn(),
    };

    mockAnatomyLoadingDetector = {
      waitForAnatomyReady: jest.fn(),
      waitForEntityCreation: jest.fn(),
      waitForEntityWithAnatomy: jest.fn(),
      dispose: jest.fn(),
    };

    mockEventDispatcher = {
      subscribe: jest.fn(),
      dispatch: jest.fn(),
    };

    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // This will fail initially - we haven't implemented VisualizerStateController yet
    const {
      VisualizerStateController,
    } = require('../../../../src/domUI/visualizer/VisualizerStateController.js');
    visualizerStateController = new VisualizerStateController({
      visualizerState: mockVisualizerState,
      anatomyLoadingDetector: mockAnatomyLoadingDetector,
      eventDispatcher: mockEventDispatcher,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    // Only dispose if not already disposed (prevent double disposal)
    if (
      visualizerStateController &&
      typeof visualizerStateController.dispose === 'function' &&
      !visualizerStateController.isDisposed()
    ) {
      try {
        visualizerStateController.dispose();
      } catch (error) {
        // Ignore disposal errors in tests
      }
    }
    // Clear mocks immediately without async delay
    jest.clearAllMocks();
  });

  describe('Constructor and Dependencies', () => {
    it('should require visualizerState dependency', () => {
      const {
        VisualizerStateController,
      } = require('../../../../src/domUI/visualizer/VisualizerStateController.js');

      expect(() => {
        new VisualizerStateController({
          anatomyLoadingDetector: mockAnatomyLoadingDetector,
          eventDispatcher: mockEventDispatcher,
          logger: mockLogger,
        });
      }).toThrow('Missing required dependency: visualizerState.');
    });

    it('should require anatomyLoadingDetector dependency', () => {
      const {
        VisualizerStateController,
      } = require('../../../../src/domUI/visualizer/VisualizerStateController.js');

      expect(() => {
        new VisualizerStateController({
          visualizerState: mockVisualizerState,
          eventDispatcher: mockEventDispatcher,
          logger: mockLogger,
        });
      }).toThrow('Missing required dependency: anatomyLoadingDetector.');
    });

    it('should require eventDispatcher dependency', () => {
      const {
        VisualizerStateController,
      } = require('../../../../src/domUI/visualizer/VisualizerStateController.js');

      expect(() => {
        new VisualizerStateController({
          visualizerState: mockVisualizerState,
          anatomyLoadingDetector: mockAnatomyLoadingDetector,
          logger: mockLogger,
        });
      }).toThrow('Missing required dependency: eventDispatcher.');
    });

    it('should initialize with proper dependencies', () => {
      expect(visualizerStateController).toBeDefined();
      expect(mockVisualizerState.subscribe).toHaveBeenCalled();
    });
  });

  describe('State Subscription', () => {
    it('should subscribe to visualizer state changes on initialization', () => {
      expect(mockVisualizerState.subscribe).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it('should dispatch events when state changes', () => {
      const stateChangeHandler = mockVisualizerState.subscribe.mock.calls[0][0];

      stateChangeHandler({
        previousState: 'IDLE',
        currentState: 'LOADING',
        selectedEntity: 'test:entity',
        anatomyData: null,
        error: null,
      });

      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        'VISUALIZER_STATE_CHANGED',
        {
          previousState: 'IDLE',
          currentState: 'LOADING',
          selectedEntity: 'test:entity',
          anatomyData: null,
          error: null,
        }
      );
    });
  });
});

describe('VisualizerStateController - Entity Selection Workflow', () => {
  let visualizerStateController;
  let mockVisualizerState;
  let mockAnatomyLoadingDetector;
  let mockEventDispatcher;
  let mockLogger;

  beforeEach(() => {
    mockVisualizerState = {
      getCurrentState: jest.fn().mockReturnValue('IDLE'),
      getSelectedEntity: jest.fn(),
      getAnatomyData: jest.fn(),
      getError: jest.fn(),
      selectEntity: jest.fn(),
      setAnatomyData: jest.fn(),
      startRendering: jest.fn(),
      completeRendering: jest.fn(),
      setError: jest.fn(),
      reset: jest.fn(),
      retry: jest.fn(),
      subscribe: jest.fn(),
      dispose: jest.fn(),
    };

    mockAnatomyLoadingDetector = {
      waitForAnatomyReady: jest.fn(),
      waitForEntityCreation: jest.fn(),
      waitForEntityWithAnatomy: jest.fn(),
      dispose: jest.fn(),
    };

    mockEventDispatcher = {
      subscribe: jest.fn(),
      dispatch: jest.fn(),
    };

    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const {
      VisualizerStateController,
    } = require('../../../../src/domUI/visualizer/VisualizerStateController.js');
    visualizerStateController = new VisualizerStateController({
      visualizerState: mockVisualizerState,
      anatomyLoadingDetector: mockAnatomyLoadingDetector,
      eventDispatcher: mockEventDispatcher,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    // Only dispose if not already disposed (prevent double disposal)
    if (
      visualizerStateController &&
      typeof visualizerStateController.dispose === 'function' &&
      !visualizerStateController.isDisposed()
    ) {
      try {
        visualizerStateController.dispose();
      } catch (error) {
        // Ignore disposal errors in tests
      }
    }
    // Clear mocks immediately without async delay
    jest.clearAllMocks();
  });

  describe('Entity Selection', () => {
    it('should handle entity selection and start anatomy loading workflow', async () => {
      const entityId = 'test:entity:123';
      const mockAnatomyData = { root: 'test:root', parts: ['part1', 'part2'] };

      mockAnatomyLoadingDetector.waitForEntityWithAnatomy.mockResolvedValue(
        true
      );
      mockVisualizerState.getCurrentState.mockReturnValue('IDLE'); // Should start in IDLE state

      await visualizerStateController.selectEntity(entityId);

      expect(mockVisualizerState.selectEntity).toHaveBeenCalledWith(entityId);
      expect(
        mockAnatomyLoadingDetector.waitForEntityWithAnatomy
      ).toHaveBeenCalledWith(entityId, expect.any(Object));
    });

    it('should handle entity selection failure gracefully', async () => {
      const entityId = 'test:entity:invalid';

      mockAnatomyLoadingDetector.waitForEntityWithAnatomy.mockResolvedValue(
        false
      );

      await visualizerStateController.selectEntity(entityId);

      expect(mockVisualizerState.selectEntity).toHaveBeenCalledWith(entityId);
      expect(mockVisualizerState.setError).toHaveBeenCalledWith(
        expect.any(Error)
      );
    });

    it('should validate entity ID before selection', async () => {
      await expect(visualizerStateController.selectEntity('')).rejects.toThrow(
        'Entity ID must be a non-empty string'
      );
      await expect(
        visualizerStateController.selectEntity(null)
      ).rejects.toThrow('Entity ID must be a non-empty string');
      await expect(visualizerStateController.selectEntity(123)).rejects.toThrow(
        'Entity ID must be a non-empty string'
      );
    });

    it('should not allow selection when already processing', async () => {
      mockVisualizerState.getCurrentState.mockReturnValue('LOADING');

      await expect(
        visualizerStateController.selectEntity('test:entity')
      ).rejects.toThrow('Cannot select entity while in LOADING state');
    });
  });

  describe('Anatomy Data Processing', () => {
    it('should process anatomy data when available', async () => {
      const entityId = 'test:entity:123';
      const mockAnatomyData = { root: 'test:root', parts: ['part1', 'part2'] };

      mockAnatomyLoadingDetector.waitForEntityWithAnatomy.mockResolvedValue(
        true
      );

      // Mock getting anatomy data from entity manager
      const mockEntityManager = {
        getEntityInstance: jest.fn().mockResolvedValue({
          getComponentData: jest
            .fn()
            .mockReturnValue({ body: mockAnatomyData }),
        }),
      };

      // Inject entity manager mock
      visualizerStateController._setEntityManager(mockEntityManager);

      await visualizerStateController.selectEntity(entityId);

      expect(mockVisualizerState.setAnatomyData).toHaveBeenCalledWith(
        mockAnatomyData
      );
    });

    it('should handle missing anatomy data gracefully', async () => {
      const entityId = 'test:entity:123';

      mockAnatomyLoadingDetector.waitForEntityWithAnatomy.mockResolvedValue(
        true
      );

      // Mock entity with no anatomy data
      const mockEntityManager = {
        getEntityInstance: jest.fn().mockResolvedValue({
          getComponentData: jest.fn().mockReturnValue(null),
        }),
      };

      visualizerStateController._setEntityManager(mockEntityManager);

      await visualizerStateController.selectEntity(entityId);

      expect(mockVisualizerState.setError).toHaveBeenCalledWith(
        expect.any(Error)
      );
    });
  });
});

describe('VisualizerStateController - Rendering Workflow', () => {
  let visualizerStateController;
  let mockVisualizerState;
  let mockAnatomyLoadingDetector;
  let mockEventDispatcher;
  let mockLogger;

  beforeEach(() => {
    mockVisualizerState = {
      getCurrentState: jest.fn(),
      getSelectedEntity: jest.fn(),
      getAnatomyData: jest.fn(),
      getError: jest.fn(),
      selectEntity: jest.fn(),
      setAnatomyData: jest.fn(),
      startRendering: jest.fn(),
      completeRendering: jest.fn(),
      setError: jest.fn(),
      reset: jest.fn(),
      retry: jest.fn(),
      subscribe: jest.fn(),
      dispose: jest.fn(),
    };

    mockAnatomyLoadingDetector = {
      waitForAnatomyReady: jest.fn(),
      waitForEntityCreation: jest.fn(),
      waitForEntityWithAnatomy: jest.fn(),
      dispose: jest.fn(),
    };

    mockEventDispatcher = {
      subscribe: jest.fn(),
      dispatch: jest.fn(),
    };

    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const {
      VisualizerStateController,
    } = require('../../../../src/domUI/visualizer/VisualizerStateController.js');
    visualizerStateController = new VisualizerStateController({
      visualizerState: mockVisualizerState,
      anatomyLoadingDetector: mockAnatomyLoadingDetector,
      eventDispatcher: mockEventDispatcher,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    // Only dispose if not already disposed (prevent double disposal)
    if (
      visualizerStateController &&
      typeof visualizerStateController.dispose === 'function' &&
      !visualizerStateController.isDisposed()
    ) {
      try {
        visualizerStateController.dispose();
      } catch (error) {
        // Ignore disposal errors in tests
      }
    }
    // Clear mocks immediately without async delay
    jest.clearAllMocks();
  });

  describe('Rendering Control', () => {
    it('should start rendering when anatomy data is ready', () => {
      mockVisualizerState.getCurrentState.mockReturnValue('LOADED');

      visualizerStateController.startRendering();

      expect(mockVisualizerState.startRendering).toHaveBeenCalled();
    });

    it('should complete rendering successfully', () => {
      mockVisualizerState.getCurrentState.mockReturnValue('RENDERING');

      visualizerStateController.completeRendering();

      expect(mockVisualizerState.completeRendering).toHaveBeenCalled();
    });

    it('should not allow rendering when not in LOADED state', () => {
      mockVisualizerState.getCurrentState.mockReturnValue('IDLE');

      expect(() => {
        visualizerStateController.startRendering();
      }).toThrow('Cannot start rendering from IDLE state');
    });

    it('should not allow completing rendering when not in RENDERING state', () => {
      mockVisualizerState.getCurrentState.mockReturnValue('LOADED');

      expect(() => {
        visualizerStateController.completeRendering();
      }).toThrow('Cannot complete rendering from LOADED state');
    });
  });
});

describe('VisualizerStateController - Error Handling', () => {
  let visualizerStateController;
  let mockVisualizerState;
  let mockAnatomyLoadingDetector;
  let mockEventDispatcher;
  let mockLogger;

  beforeEach(() => {
    mockVisualizerState = {
      getCurrentState: jest.fn(),
      getSelectedEntity: jest.fn(),
      getAnatomyData: jest.fn(),
      getError: jest.fn(),
      selectEntity: jest.fn(),
      setAnatomyData: jest.fn(),
      startRendering: jest.fn(),
      completeRendering: jest.fn(),
      setError: jest.fn(),
      reset: jest.fn(),
      retry: jest.fn(),
      subscribe: jest.fn(),
      dispose: jest.fn(),
    };

    mockAnatomyLoadingDetector = {
      waitForAnatomyReady: jest.fn(),
      waitForEntityCreation: jest.fn(),
      waitForEntityWithAnatomy: jest.fn(),
      dispose: jest.fn(),
    };

    mockEventDispatcher = {
      subscribe: jest.fn(),
      dispatch: jest.fn(),
    };

    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const {
      VisualizerStateController,
    } = require('../../../../src/domUI/visualizer/VisualizerStateController.js');
    visualizerStateController = new VisualizerStateController({
      visualizerState: mockVisualizerState,
      anatomyLoadingDetector: mockAnatomyLoadingDetector,
      eventDispatcher: mockEventDispatcher,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    // Only dispose if not already disposed (prevent double disposal)
    if (
      visualizerStateController &&
      typeof visualizerStateController.dispose === 'function' &&
      !visualizerStateController.isDisposed()
    ) {
      try {
        visualizerStateController.dispose();
      } catch (error) {
        // Ignore disposal errors in tests
      }
    }
    // Clear mocks immediately without async delay
    jest.clearAllMocks();
  });

  describe('Error Management', () => {
    it('should handle errors and update state', () => {
      const error = new Error('Test error');

      visualizerStateController.handleError(error);

      expect(mockVisualizerState.setError).toHaveBeenCalledWith(error);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'VisualizerStateController error:',
        error
      );
    });

    it('should handle retry from error state', () => {
      mockVisualizerState.getCurrentState.mockReturnValue('ERROR');
      mockVisualizerState.getSelectedEntity.mockReturnValue('test:entity');

      visualizerStateController.retry();

      expect(mockVisualizerState.retry).toHaveBeenCalled();
    });

    it('should not allow retry when not in error state', () => {
      mockVisualizerState.getCurrentState.mockReturnValue('IDLE');

      expect(() => {
        visualizerStateController.retry();
      }).toThrow('Cannot retry when not in ERROR state');
    });

    it('should reset state and clear errors', () => {
      visualizerStateController.reset();

      expect(mockVisualizerState.reset).toHaveBeenCalled();
    });
  });
});

describe('VisualizerStateController - State Access', () => {
  let visualizerStateController;
  let mockVisualizerState;
  let mockAnatomyLoadingDetector;
  let mockEventDispatcher;
  let mockLogger;

  beforeEach(() => {
    mockVisualizerState = {
      getCurrentState: jest.fn(),
      getSelectedEntity: jest.fn(),
      getAnatomyData: jest.fn(),
      getError: jest.fn(),
      selectEntity: jest.fn(),
      setAnatomyData: jest.fn(),
      startRendering: jest.fn(),
      completeRendering: jest.fn(),
      setError: jest.fn(),
      reset: jest.fn(),
      retry: jest.fn(),
      subscribe: jest.fn(),
      dispose: jest.fn(),
    };

    mockAnatomyLoadingDetector = {
      waitForAnatomyReady: jest.fn(),
      waitForEntityCreation: jest.fn(),
      waitForEntityWithAnatomy: jest.fn(),
      dispose: jest.fn(),
    };

    mockEventDispatcher = {
      subscribe: jest.fn(),
      dispatch: jest.fn(),
    };

    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const {
      VisualizerStateController,
    } = require('../../../../src/domUI/visualizer/VisualizerStateController.js');
    visualizerStateController = new VisualizerStateController({
      visualizerState: mockVisualizerState,
      anatomyLoadingDetector: mockAnatomyLoadingDetector,
      eventDispatcher: mockEventDispatcher,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    // Only dispose if not already disposed (prevent double disposal)
    if (
      visualizerStateController &&
      typeof visualizerStateController.dispose === 'function' &&
      !visualizerStateController.isDisposed()
    ) {
      try {
        visualizerStateController.dispose();
      } catch (error) {
        // Ignore disposal errors in tests
      }
    }
    // Clear mocks immediately without async delay
    jest.clearAllMocks();
  });

  describe('State Getters', () => {
    it('should provide access to current state', () => {
      mockVisualizerState.getCurrentState.mockReturnValue('READY');

      const state = visualizerStateController.getCurrentState();

      expect(state).toBe('READY');
      expect(mockVisualizerState.getCurrentState).toHaveBeenCalled();
    });

    it('should provide access to selected entity', () => {
      mockVisualizerState.getSelectedEntity.mockReturnValue('test:entity');

      const entity = visualizerStateController.getSelectedEntity();

      expect(entity).toBe('test:entity');
      expect(mockVisualizerState.getSelectedEntity).toHaveBeenCalled();
    });

    it('should provide access to anatomy data', () => {
      const anatomyData = { root: 'test:root', parts: [] };
      mockVisualizerState.getAnatomyData.mockReturnValue(anatomyData);

      const data = visualizerStateController.getAnatomyData();

      expect(data).toBe(anatomyData);
      expect(mockVisualizerState.getAnatomyData).toHaveBeenCalled();
    });

    it('should provide access to current error', () => {
      const error = new Error('Test error');
      mockVisualizerState.getError.mockReturnValue(error);

      const currentError = visualizerStateController.getError();

      expect(currentError).toBe(error);
      expect(mockVisualizerState.getError).toHaveBeenCalled();
    });
  });
});

describe('VisualizerStateController - Cleanup', () => {
  let visualizerStateController;
  let mockVisualizerState;
  let mockAnatomyLoadingDetector;
  let mockEventDispatcher;
  let mockLogger;

  beforeEach(() => {
    mockVisualizerState = {
      getCurrentState: jest.fn(),
      getSelectedEntity: jest.fn(),
      getAnatomyData: jest.fn(),
      getError: jest.fn(),
      selectEntity: jest.fn(),
      setAnatomyData: jest.fn(),
      startRendering: jest.fn(),
      completeRendering: jest.fn(),
      setError: jest.fn(),
      reset: jest.fn(),
      retry: jest.fn(),
      subscribe: jest.fn(),
      dispose: jest.fn(),
    };

    mockAnatomyLoadingDetector = {
      waitForAnatomyReady: jest.fn(),
      waitForEntityCreation: jest.fn(),
      waitForEntityWithAnatomy: jest.fn(),
      dispose: jest.fn(),
    };

    mockEventDispatcher = {
      subscribe: jest.fn(),
      dispatch: jest.fn(),
    };

    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const {
      VisualizerStateController,
    } = require('../../../../src/domUI/visualizer/VisualizerStateController.js');
    visualizerStateController = new VisualizerStateController({
      visualizerState: mockVisualizerState,
      anatomyLoadingDetector: mockAnatomyLoadingDetector,
      eventDispatcher: mockEventDispatcher,
      logger: mockLogger,
    });
  });

  describe('Memory Management', () => {
    it('should dispose all dependencies on cleanup', () => {
      visualizerStateController.dispose();

      expect(mockVisualizerState.dispose).toHaveBeenCalled();
      expect(mockAnatomyLoadingDetector.dispose).toHaveBeenCalled();
    });

    it('should prevent operations after disposal', async () => {
      visualizerStateController.dispose();

      // Test async method
      await expect(
        visualizerStateController.selectEntity('test:entity')
      ).rejects.toThrow('VisualizerStateController has been disposed');

      // Test sync methods
      expect(() => {
        visualizerStateController.getCurrentState();
      }).toThrow('VisualizerStateController has been disposed');
    });

    it('should handle multiple dispose calls gracefully', () => {
      visualizerStateController.dispose();
      visualizerStateController.dispose(); // Should not throw

      expect(mockVisualizerState.dispose).toHaveBeenCalledTimes(1);
      expect(mockAnatomyLoadingDetector.dispose).toHaveBeenCalledTimes(1);
    });
  });
});
