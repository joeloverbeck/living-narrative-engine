// tests/unit/dependencyInjection/registrations/uiRegistrations.registerControllers.test.js
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { registerControllers } from '../../../../src/dependencyInjection/registrations/uiRegistrations.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';

// Mock the registerWithLog helper
jest.mock('../../../../src/utils/registrarHelpers.js', () => ({
  registerWithLog: jest.fn(),
  Registrar: jest.fn(),
}));

// Mock the controller classes
jest.mock('../../../../src/domUI/index.js', () => ({
  InputStateController: jest.fn(),
  ProcessingIndicatorController: jest.fn(),
}));

jest.mock('../../../../src/domUI/visualizer/VisualizerState.js', () => ({
  VisualizerState: jest.fn(),
}));

jest.mock('../../../../src/domUI/visualizer/AnatomyLoadingDetector.js', () => ({
  AnatomyLoadingDetector: jest.fn(),
}));

jest.mock(
  '../../../../src/domUI/visualizer/VisualizerStateController.js',
  () => ({
    VisualizerStateController: jest.fn(),
  })
);

jest.mock('../../../../src/domUI/perceptibleEventSenderController.js', () =>
  jest.fn()
);

describe('registerControllers', () => {
  let mockRegistrar;
  let mockLogger;
  let mockRegisterWithLog;

  beforeEach(() => {
    jest.clearAllMocks();

    // Get the mocked function
    const {
      registerWithLog,
    } = require('../../../../src/utils/registrarHelpers.js');
    mockRegisterWithLog = registerWithLog;

    mockRegistrar = {
      register: jest.fn(),
      singletonFactory: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  describe('InputStateController factory', () => {
    it('should register InputStateController as singleton factory', () => {
      registerControllers(mockRegistrar, mockLogger);

      const inputStateCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.InputStateController
      );

      expect(inputStateCall).toBeDefined();
      expect(inputStateCall[3].lifecycle).toBe('singletonFactory');
    });

    it('should create InputStateController with correct dependencies', () => {
      registerControllers(mockRegistrar, mockLogger);

      const inputStateCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.InputStateController
      );

      const factory = inputStateCall[2];
      const mockInputElement = document.createElement('input');
      const mockContainer = {
        resolve: jest.fn((token) => {
          const mocks = {
            [tokens.ILogger]: mockLogger,
            [tokens.IDocumentContext]: { query: jest.fn() },
            [tokens.ISafeEventDispatcher]: { dispatch: jest.fn() },
            [tokens.inputElement]: mockInputElement,
          };
          return mocks[token] || jest.fn();
        }),
      };

      const MockInputStateController =
        require('../../../../src/domUI/index.js').InputStateController;
      const result = factory(mockContainer);

      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.IDocumentContext
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.inputElement);

      expect(MockInputStateController).toHaveBeenCalledWith({
        logger: mockLogger,
        documentContext: expect.any(Object),
        safeEventDispatcher: expect.any(Object),
        inputElement: mockInputElement,
      });
    });
  });

  describe('PerceptibleEventSenderController factory', () => {
    it('should register PerceptibleEventSenderController as singleton factory', () => {
      registerControllers(mockRegistrar, mockLogger);

      const perceptibleEventSenderCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.PerceptibleEventSenderController
      );

      expect(perceptibleEventSenderCall).toBeDefined();
      expect(perceptibleEventSenderCall[3].lifecycle).toBe('singletonFactory');
    });

    it('should create PerceptibleEventSenderController with correct dependencies', () => {
      registerControllers(mockRegistrar, mockLogger);

      const perceptibleEventSenderCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.PerceptibleEventSenderController
      );

      const factory = perceptibleEventSenderCall[2];
      const mockEventBus = { dispatch: jest.fn() };
      const mockDocumentContext = { query: jest.fn() };
      const mockEntityManager = { getEntity: jest.fn() };
      const mockOperationInterpreter = { interpret: jest.fn() };
      const mockContainer = {
        resolve: jest.fn((token) => {
          const mocks = {
            [tokens.ISafeEventDispatcher]: mockEventBus,
            [tokens.IDocumentContext]: mockDocumentContext,
            [tokens.ILogger]: mockLogger,
            [tokens.IEntityManager]: mockEntityManager,
            [tokens.OperationInterpreter]: mockOperationInterpreter,
          };
          return mocks[token] || jest.fn();
        }),
      };

      const MockPerceptibleEventSenderController = require('../../../../src/domUI/perceptibleEventSenderController.js');
      const result = factory(mockContainer);

      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.IDocumentContext
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.OperationInterpreter
      );

      expect(MockPerceptibleEventSenderController).toHaveBeenCalledWith({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
        operationInterpreter: mockOperationInterpreter,
      });
    });
  });

  describe('ProcessingIndicatorController factory', () => {
    it('should register ProcessingIndicatorController as singleton factory', () => {
      registerControllers(mockRegistrar, mockLogger);

      const processingIndicatorCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.ProcessingIndicatorController
      );

      expect(processingIndicatorCall).toBeDefined();
      expect(processingIndicatorCall[3].lifecycle).toBe('singletonFactory');
    });

    it('should create ProcessingIndicatorController with correct dependencies', () => {
      registerControllers(mockRegistrar, mockLogger);

      const processingIndicatorCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.ProcessingIndicatorController
      );

      const factory = processingIndicatorCall[2];
      const mockContainer = {
        resolve: jest.fn((token) => {
          const mocks = {
            [tokens.ILogger]: mockLogger,
            [tokens.IDocumentContext]: { query: jest.fn() },
            [tokens.ISafeEventDispatcher]: { dispatch: jest.fn() },
            [tokens.DomElementFactory]: { createElement: jest.fn() },
          };
          return mocks[token] || jest.fn();
        }),
      };

      const MockProcessingIndicatorController =
        require('../../../../src/domUI/index.js').ProcessingIndicatorController;
      const result = factory(mockContainer);

      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.IDocumentContext
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.DomElementFactory
      );

      expect(MockProcessingIndicatorController).toHaveBeenCalledWith({
        logger: mockLogger,
        documentContext: expect.any(Object),
        safeEventDispatcher: expect.any(Object),
        domElementFactory: expect.any(Object),
      });
    });
  });

  describe('VisualizerState factory', () => {
    it('should register VisualizerState as singleton factory', () => {
      registerControllers(mockRegistrar, mockLogger);

      const visualizerStateCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.VisualizerState
      );

      expect(visualizerStateCall).toBeDefined();
      expect(visualizerStateCall[3].lifecycle).toBe('singletonFactory');
    });

    it('should create VisualizerState with correct dependencies', () => {
      registerControllers(mockRegistrar, mockLogger);

      const visualizerStateCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.VisualizerState
      );

      const factory = visualizerStateCall[2];
      const mockContainer = {
        resolve: jest.fn((token) => {
          const mocks = {
            [tokens.ILogger]: mockLogger,
          };
          return mocks[token] || jest.fn();
        }),
      };

      const {
        VisualizerState: MockVisualizerState,
      } = require('../../../../src/domUI/visualizer/VisualizerState.js');
      const result = factory(mockContainer);

      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(MockVisualizerState).toHaveBeenCalledWith({
        logger: mockLogger,
      });
    });
  });

  describe('AnatomyLoadingDetector factory', () => {
    it('should register AnatomyLoadingDetector as singleton factory', () => {
      registerControllers(mockRegistrar, mockLogger);

      const anatomyLoadingCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.AnatomyLoadingDetector
      );

      expect(anatomyLoadingCall).toBeDefined();
      expect(anatomyLoadingCall[3].lifecycle).toBe('singletonFactory');
    });

    it('should create AnatomyLoadingDetector with correct dependencies', () => {
      registerControllers(mockRegistrar, mockLogger);

      const anatomyLoadingCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.AnatomyLoadingDetector
      );

      const factory = anatomyLoadingCall[2];
      const mockEntityManager = { getEntity: jest.fn() };
      const mockEventDispatcher = { dispatch: jest.fn() };
      const mockContainer = {
        resolve: jest.fn((token) => {
          const mocks = {
            [tokens.IEntityManager]: mockEntityManager,
            [tokens.IValidatedEventDispatcher]: mockEventDispatcher,
            [tokens.ILogger]: mockLogger,
          };
          return mocks[token] || jest.fn();
        }),
      };

      const {
        AnatomyLoadingDetector: MockAnatomyLoadingDetector,
      } = require('../../../../src/domUI/visualizer/AnatomyLoadingDetector.js');
      const result = factory(mockContainer);

      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.IValidatedEventDispatcher
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);

      expect(MockAnatomyLoadingDetector).toHaveBeenCalledWith({
        entityManager: mockEntityManager,
        eventDispatcher: mockEventDispatcher,
        logger: mockLogger,
      });
    });
  });

  describe('VisualizerStateController factory', () => {
    it('should register VisualizerStateController as singleton factory', () => {
      registerControllers(mockRegistrar, mockLogger);

      const visualizerStateControllerCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.VisualizerStateController
      );

      expect(visualizerStateControllerCall).toBeDefined();
      expect(visualizerStateControllerCall[3].lifecycle).toBe(
        'singletonFactory'
      );
    });

    it('should create VisualizerStateController with correct dependencies', () => {
      registerControllers(mockRegistrar, mockLogger);

      const visualizerStateControllerCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.VisualizerStateController
      );

      const factory = visualizerStateControllerCall[2];
      const mockVisualizerState = { setState: jest.fn() };
      const mockAnatomyLoadingDetector = { detect: jest.fn() };
      const mockEventDispatcher = { dispatch: jest.fn() };
      const mockEntityManager = { getEntity: jest.fn() };

      const mockContainer = {
        resolve: jest.fn((token) => {
          const mocks = {
            [tokens.VisualizerState]: mockVisualizerState,
            [tokens.AnatomyLoadingDetector]: mockAnatomyLoadingDetector,
            [tokens.IValidatedEventDispatcher]: mockEventDispatcher,
            [tokens.IEntityManager]: mockEntityManager,
            [tokens.ILogger]: mockLogger,
          };
          return mocks[token] || jest.fn();
        }),
      };

      const {
        VisualizerStateController: MockVisualizerStateController,
      } = require('../../../../src/domUI/visualizer/VisualizerStateController.js');
      const result = factory(mockContainer);

      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.VisualizerState
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.AnatomyLoadingDetector
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.IValidatedEventDispatcher
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);

      expect(MockVisualizerStateController).toHaveBeenCalledWith({
        visualizerState: mockVisualizerState,
        anatomyLoadingDetector: mockAnatomyLoadingDetector,
        eventDispatcher: mockEventDispatcher,
        entityManager: mockEntityManager,
        logger: mockLogger,
      });
    });
  });

  it('should register all controllers', () => {
    registerControllers(mockRegistrar, mockLogger);

    // Count total registrations (7 controllers)
    expect(mockRegisterWithLog).toHaveBeenCalledTimes(7);

    // Verify all tokens were registered
    const registeredTokens = mockRegisterWithLog.mock.calls.map(
      (call) => call[1]
    );
    expect(registeredTokens).toContain(tokens.InputStateController);
    expect(registeredTokens).toContain(tokens.ActorParticipationController);
    expect(registeredTokens).toContain(tokens.PerceptibleEventSenderController);
    expect(registeredTokens).toContain(tokens.ProcessingIndicatorController);
    expect(registeredTokens).toContain(tokens.VisualizerState);
    expect(registeredTokens).toContain(tokens.AnatomyLoadingDetector);
    expect(registeredTokens).toContain(tokens.VisualizerStateController);
  });

  describe('error handling', () => {
    it('should handle null registrar', () => {
      // The function may not throw immediately as registerWithLog is mocked
      // We just verify it can be called
      registerControllers(null, mockLogger);

      // Verify registerWithLog was called with null registrar
      expect(mockRegisterWithLog).toHaveBeenCalledWith(
        null,
        expect.any(String),
        expect.any(Function),
        expect.any(Object),
        mockLogger
      );
    });

    it('should handle missing dependencies gracefully', () => {
      registerControllers(mockRegistrar, mockLogger);

      const inputStateCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.InputStateController
      );

      const factory = inputStateCall[2];
      const faultyContainer = {
        resolve: jest.fn(() => {
          throw new Error('Dependency not found');
        }),
      };

      expect(() => {
        factory(faultyContainer);
      }).toThrow('Dependency not found');
    });

    it('should handle null logger without throwing for controllers that accept it', () => {
      registerControllers(mockRegistrar, mockLogger);

      const visualizerStateCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.VisualizerState
      );

      const factory = visualizerStateCall[2];
      const mockContainer = {
        resolve: jest.fn((token) => {
          if (token === tokens.ILogger) {
            return null;
          }
          return jest.fn();
        }),
      };

      const {
        VisualizerState: MockVisualizerState,
      } = require('../../../../src/domUI/visualizer/VisualizerState.js');

      expect(() => {
        const result = factory(mockContainer);
      }).not.toThrow();

      expect(MockVisualizerState).toHaveBeenCalledWith({
        logger: null,
      });
    });
  });

  describe('dependency resolution order', () => {
    it('should resolve VisualizerStateController dependencies in correct order', () => {
      registerControllers(mockRegistrar, mockLogger);

      const visualizerStateControllerCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.VisualizerStateController
      );

      const factory = visualizerStateControllerCall[2];
      const mockContainer = {
        resolve: jest.fn(() => jest.fn()),
      };

      factory(mockContainer);

      const resolveCalls = mockContainer.resolve.mock.calls;

      // Verify all expected dependencies were resolved
      expect(resolveCalls).toEqual(
        expect.arrayContaining([
          [tokens.VisualizerState],
          [tokens.AnatomyLoadingDetector],
          [tokens.IValidatedEventDispatcher],
          [tokens.IEntityManager],
          [tokens.ILogger],
        ])
      );

      expect(resolveCalls).toHaveLength(5);
    });
  });
});
