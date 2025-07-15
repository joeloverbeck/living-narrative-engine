/**
 * @file Tests for VisualizerStateController - Optimized with shared test infrastructure
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import AnatomyVisualizerTestBed from '../../../common/anatomy/anatomyVisualizerTestBed.js';

// Cache the module to avoid repeated require() calls
let VisualizerStateController;

describe('VisualizerStateController - Initialization', () => {
  let visualizerStateController;
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyVisualizerTestBed();
    
    // Load module once and cache it
    if (!VisualizerStateController) {
      VisualizerStateController = require('../../../../src/domUI/visualizer/VisualizerStateController.js').VisualizerStateController;
    }

    visualizerStateController = new VisualizerStateController({
      visualizerState: testBed.mockVisualizerState,
      anatomyLoadingDetector: testBed.mockAnatomyLoadingDetector,
      eventDispatcher: testBed.mockEventDispatcher,
      entityManager: testBed.mockEntityManager,
      logger: testBed.mockLogger,
    });
  });

  afterEach(async () => {
    if (
      visualizerStateController &&
      typeof visualizerStateController.dispose === 'function'
    ) {
      try {
        visualizerStateController.dispose();
      } catch (error) {
        // Ignore disposal errors in tests
      }
    }
    await testBed.cleanup();
  });

  describe('Constructor and Dependencies', () => {
    const dependencyTests = [
      {
        name: 'visualizerState',
        omit: 'visualizerState',
        expectedError: 'Missing required dependency: visualizerState.'
      },
      {
        name: 'anatomyLoadingDetector',
        omit: 'anatomyLoadingDetector', 
        expectedError: 'Missing required dependency: anatomyLoadingDetector.'
      },
      {
        name: 'eventDispatcher',
        omit: 'eventDispatcher',
        expectedError: 'Missing required dependency: eventDispatcher.'
      },
      {
        name: 'entityManager',
        omit: 'entityManager',
        expectedError: 'Missing required dependency: entityManager.'
      }
    ];

    test.each(dependencyTests)('should require $name dependency', ({ omit, expectedError }) => {
      const deps = {
        visualizerState: testBed.mockVisualizerState,
        anatomyLoadingDetector: testBed.mockAnatomyLoadingDetector,
        eventDispatcher: testBed.mockEventDispatcher,
        entityManager: testBed.mockEntityManager,
        logger: testBed.mockLogger,
      };
      delete deps[omit];

      expect(() => {
        new VisualizerStateController(deps);
      }).toThrow(expectedError);
    });

    it('should initialize with proper dependencies', () => {
      expect(visualizerStateController).toBeDefined();
      expect(testBed.mockVisualizerState.subscribe).toHaveBeenCalled();
    });
  });

  describe('State Subscription', () => {
    it('should subscribe to visualizer state changes on initialization', () => {
      expect(testBed.mockVisualizerState.subscribe).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it('should dispatch events when state changes', () => {
      const stateChangeHandler = testBed.mockVisualizerState.subscribe.mock.calls[0][0];

      stateChangeHandler({
        previousState: 'IDLE',
        currentState: 'LOADING',
        selectedEntity: 'test:entity',
        anatomyData: null,
        error: null,
      });

      expect(testBed.mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        'anatomy:visualizer_state_changed',
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
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyVisualizerTestBed();
    testBed.mockVisualizerState.getCurrentState.mockReturnValue('IDLE');

    visualizerStateController = new VisualizerStateController({
      visualizerState: testBed.mockVisualizerState,
      anatomyLoadingDetector: testBed.mockAnatomyLoadingDetector,
      eventDispatcher: testBed.mockEventDispatcher,
      entityManager: testBed.mockEntityManager,
      logger: testBed.mockLogger,
    });
  });

  afterEach(async () => {
    if (
      visualizerStateController &&
      typeof visualizerStateController.dispose === 'function'
    ) {
      try {
        visualizerStateController.dispose();
      } catch (error) {
        // Ignore disposal errors in tests
      }
    }
    await testBed.cleanup();
  });

  describe('Entity Selection', () => {
    const entitySelectionScenarios = [
      {
        name: 'successful entity selection',
        entityId: 'test:entity:123',
        anatomyLoadingResult: true,
        expectSelectCalled: true,
        expectSetErrorCalled: false
      },
      {
        name: 'failed entity selection',
        entityId: 'test:entity:invalid',
        anatomyLoadingResult: false,
        expectSelectCalled: true,
        expectSetErrorCalled: true
      }
    ];

    test.each(entitySelectionScenarios)(
      'should handle $name',
      async ({ entityId, anatomyLoadingResult, expectSelectCalled, expectSetErrorCalled }) => {
        testBed.mockAnatomyLoadingDetector.waitForEntityWithAnatomy.mockResolvedValue(
          anatomyLoadingResult
        );
        testBed.mockVisualizerState.getCurrentState.mockReturnValue('IDLE');

        await visualizerStateController.selectEntity(entityId);

        if (expectSelectCalled) {
          expect(testBed.mockVisualizerState.selectEntity).toHaveBeenCalledWith(entityId);
          expect(testBed.mockAnatomyLoadingDetector.waitForEntityWithAnatomy)
            .toHaveBeenCalledWith(entityId, expect.any(Object));
        }
        
        if (expectSetErrorCalled) {
          expect(testBed.mockVisualizerState.setError).toHaveBeenCalledWith(
            expect.any(Error)
          );
        }
      }
    );

    const invalidEntityTests = [
      { name: 'empty string', value: '' },
      { name: 'null', value: null },
      { name: 'number', value: 123 }
    ];

    test.each(invalidEntityTests)(
      'should validate entity ID: $name',
      async ({ value }) => {
        await visualizerStateController.selectEntity(value);
        
        const state = visualizerStateController.getCurrentState();
        expect(['IDLE', 'ERROR']).toContain(state);
      }
    );

    it('should not allow selection when already processing', async () => {
      testBed.mockVisualizerState.getCurrentState.mockReturnValue('LOADING');

      await visualizerStateController.selectEntity('test:entity');

      expect(testBed.mockVisualizerState.getCurrentState()).toBe('LOADING');
      expect(testBed.mockVisualizerState.selectEntity).not.toHaveBeenCalled();
    });
  });

  describe('Anatomy Data Processing', () => {
    const anatomyDataScenarios = [
      {
        name: 'available anatomy data',
        anatomyData: { root: 'test:root', parts: ['part1', 'part2'] },
        expectSetAnatomyData: true,
        expectSetError: false
      },
      {
        name: 'missing anatomy data',
        anatomyData: null,
        expectSetAnatomyData: false,
        expectSetError: true
      }
    ];

    test.each(anatomyDataScenarios)(
      'should process $name',
      async ({ anatomyData, expectSetAnatomyData, expectSetError }) => {
        const entityId = 'test:entity:123';
        
        testBed.mockAnatomyLoadingDetector.waitForEntityWithAnatomy.mockResolvedValue(true);
        
        // Create a custom entity manager for this test
        const customEntityManager = {
          getEntityInstance: jest.fn().mockResolvedValue({
            getComponentData: jest.fn().mockReturnValue(
              anatomyData ? { body: anatomyData } : anatomyData
            ),
          }),
        };

        const testController = new VisualizerStateController({
          visualizerState: testBed.mockVisualizerState,
          anatomyLoadingDetector: testBed.mockAnatomyLoadingDetector,
          eventDispatcher: testBed.mockEventDispatcher,
          entityManager: customEntityManager,
          logger: testBed.mockLogger,
        });

        await testController.selectEntity(entityId);

        if (expectSetAnatomyData) {
          expect(testBed.mockVisualizerState.setAnatomyData).toHaveBeenCalledWith(anatomyData);
        }
        
        if (expectSetError) {
          expect(testBed.mockVisualizerState.setError).toHaveBeenCalledWith(expect.any(Error));
        }
      }
    );
  });
});

describe('VisualizerStateController - Rendering Workflow', () => {
  let visualizerStateController;
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyVisualizerTestBed();

    visualizerStateController = new VisualizerStateController({
      visualizerState: testBed.mockVisualizerState,
      anatomyLoadingDetector: testBed.mockAnatomyLoadingDetector,
      eventDispatcher: testBed.mockEventDispatcher,
      entityManager: testBed.mockEntityManager,
      logger: testBed.mockLogger,
    });
  });

  afterEach(async () => {
    if (
      visualizerStateController &&
      typeof visualizerStateController.dispose === 'function'
    ) {
      try {
        visualizerStateController.dispose();
      } catch (error) {
        // Ignore disposal errors in tests
      }
    }
    await testBed.cleanup();
  });

  describe('Rendering Control', () => {
    const renderingScenarios = [
      {
        name: 'start rendering when anatomy data is ready',
        initialState: 'LOADED',
        action: 'startRendering',
        expectSuccess: true,
        expectedError: null
      },
      {
        name: 'complete rendering successfully',
        initialState: 'RENDERING',
        action: 'completeRendering',
        expectSuccess: true,
        expectedError: null
      },
      {
        name: 'not allow rendering when not in LOADED state',
        initialState: 'IDLE',
        action: 'startRendering',
        expectSuccess: false,
        expectedError: 'Cannot start rendering from IDLE state'
      },
      {
        name: 'not allow completing rendering when not in RENDERING state',
        initialState: 'LOADED',
        action: 'completeRendering',
        expectSuccess: false,
        expectedError: 'Cannot complete rendering from LOADED state'
      }
    ];

    test.each(renderingScenarios)(
      'should $name',
      ({ initialState, action, expectSuccess, expectedError }) => {
        testBed.mockVisualizerState.getCurrentState.mockReturnValue(initialState);

        if (expectSuccess) {
          visualizerStateController[action]();
          expect(testBed.mockVisualizerState[action]).toHaveBeenCalled();
        } else {
          expect(() => {
            visualizerStateController[action]();
          }).toThrow(expectedError);
        }
      }
    );
  });
});

describe('VisualizerStateController - Error Handling', () => {
  let visualizerStateController;
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyVisualizerTestBed();

    visualizerStateController = new VisualizerStateController({
      visualizerState: testBed.mockVisualizerState,
      anatomyLoadingDetector: testBed.mockAnatomyLoadingDetector,
      eventDispatcher: testBed.mockEventDispatcher,
      entityManager: testBed.mockEntityManager,
      logger: testBed.mockLogger,
    });
  });

  afterEach(async () => {
    if (
      visualizerStateController &&
      typeof visualizerStateController.dispose === 'function'
    ) {
      try {
        visualizerStateController.dispose();
      } catch (error) {
        // Ignore disposal errors in tests
      }
    }
    await testBed.cleanup();
  });

  describe('Error Management', () => {
    it('should handle errors and update state', async () => {
      const error = new Error('Test error');

      await visualizerStateController.handleError(error);

      expect(testBed.mockLogger.error).toHaveBeenCalled();
    });

    it('should handle retry from error state', () => {
      testBed.mockVisualizerState.getCurrentState.mockReturnValue('ERROR');
      testBed.mockVisualizerState.getSelectedEntity.mockReturnValue('test:entity');

      visualizerStateController.retry();

      expect(testBed.mockVisualizerState.retry).toHaveBeenCalled();
    });

    it('should not allow retry when not in error state', () => {
      testBed.mockVisualizerState.getCurrentState.mockReturnValue('IDLE');

      expect(() => {
        visualizerStateController.retry();
      }).toThrow('Cannot retry when not in ERROR state');
    });

    it('should reset state and clear errors', () => {
      visualizerStateController.reset();

      expect(testBed.mockVisualizerState.reset).toHaveBeenCalled();
    });
  });
});

describe('VisualizerStateController - State Access', () => {
  let visualizerStateController;
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyVisualizerTestBed();

    visualizerStateController = new VisualizerStateController({
      visualizerState: testBed.mockVisualizerState,
      anatomyLoadingDetector: testBed.mockAnatomyLoadingDetector,
      eventDispatcher: testBed.mockEventDispatcher,
      entityManager: testBed.mockEntityManager,
      logger: testBed.mockLogger,
    });
  });

  afterEach(async () => {
    if (
      visualizerStateController &&
      typeof visualizerStateController.dispose === 'function'
    ) {
      try {
        visualizerStateController.dispose();
      } catch (error) {
        // Ignore disposal errors in tests
      }
    }
    await testBed.cleanup();
  });

  describe('State Getters', () => {
    const stateGetterScenarios = [
      {
        name: 'current state',
        method: 'getCurrentState',
        mockValue: 'READY',
        expectedValue: 'READY'
      },
      {
        name: 'selected entity',
        method: 'getSelectedEntity',
        mockValue: 'test:entity',
        expectedValue: 'test:entity'
      },
      {
        name: 'anatomy data',
        method: 'getAnatomyData',
        mockValue: { root: 'test:root', parts: [] },
        expectedValue: { root: 'test:root', parts: [] }
      },
      {
        name: 'current error',
        method: 'getError',
        mockValue: new Error('Test error'),
        expectedValue: expect.any(Error)
      }
    ];

    test.each(stateGetterScenarios)(
      'should provide access to $name',
      ({ method, mockValue, expectedValue }) => {
        testBed.mockVisualizerState[method].mockReturnValue(mockValue);

        const result = visualizerStateController[method]();

        expect(result).toEqual(expectedValue);
        expect(testBed.mockVisualizerState[method]).toHaveBeenCalled();
      }
    );
  });
});

describe('VisualizerStateController - Cleanup', () => {
  let visualizerStateController;
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyVisualizerTestBed();

    visualizerStateController = new VisualizerStateController({
      visualizerState: testBed.mockVisualizerState,
      anatomyLoadingDetector: testBed.mockAnatomyLoadingDetector,
      eventDispatcher: testBed.mockEventDispatcher,
      entityManager: testBed.mockEntityManager,
      logger: testBed.mockLogger,
    });
  });

  describe('Memory Management', () => {
    it('should dispose all dependencies on cleanup', () => {
      visualizerStateController.dispose();

      expect(testBed.mockVisualizerState.dispose).toHaveBeenCalled();
      expect(testBed.mockAnatomyLoadingDetector.dispose).toHaveBeenCalled();
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

      expect(testBed.mockVisualizerState.dispose).toHaveBeenCalledTimes(1);
      expect(testBed.mockAnatomyLoadingDetector.dispose).toHaveBeenCalledTimes(1);
    });
  });
});
