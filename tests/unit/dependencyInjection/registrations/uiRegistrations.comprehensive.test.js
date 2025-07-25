// tests/unit/dependencyInjection/registrations/uiRegistrations.comprehensive.test.js
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  registerRenderers,
  registerControllers,
  registerFacadeAndManager,
  registerLegacyInputHandler,
} from '../../../../src/dependencyInjection/registrations/uiRegistrations.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';

// Create mocks for registrarHelpers
jest.mock('../../../../src/utils/registrarHelpers.js', () => ({
  registerWithLog: jest.fn(),
  Registrar: jest.fn(),
}));

// Mock all the UI components
jest.mock('../../../../src/domUI/index.js', () => ({
  SpeechBubbleRenderer: jest.fn(),
  TitleRenderer: jest.fn(),
  LocationRenderer: jest.fn(),
  ActionButtonsRenderer: jest.fn(),
  PerceptionLogRenderer: jest.fn(),
  DomUiFacade: jest.fn(),
  LlmSelectionModal: jest.fn(),
  CurrentTurnActorRenderer: jest.fn(),
  ProcessingIndicatorController: jest.fn(),
  ChatAlertRenderer: jest.fn(),
  ActionResultRenderer: jest.fn(),
  SaveGameService: jest.fn(),
  EntityLifecycleMonitor: jest.fn(),
  InputStateController: jest.fn(),
  EngineUIManager: jest.fn(),
}));

jest.mock('../../../../src/input/inputHandler.js', () => jest.fn());
jest.mock('../../../../src/input/globalKeyHandler.js', () => jest.fn());
jest.mock('../../../../src/domUI/saveGameUI.js', () => jest.fn());
jest.mock('../../../../src/domUI/loadGameUI.js', () => jest.fn());
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

describe('uiRegistrations Comprehensive Coverage Tests', () => {
  let mockRegistrar;
  let mockLogger;
  let mockRegisterWithLog;

  beforeEach(() => {
    jest.clearAllMocks();

    // Get the mocked registerWithLog function
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

  describe('registerRenderers', () => {
    it('should call registerWithLog for all renderer services', () => {
      registerRenderers(mockRegistrar, mockLogger);

      // Should register all 13 renderer services
      expect(mockRegisterWithLog).toHaveBeenCalledTimes(13);
    });

    it('should register LocationRenderer factory with warning capability', () => {
      registerRenderers(mockRegistrar, mockLogger);

      // Find the LocationRenderer call
      const locationCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.LocationRenderer
      );
      expect(locationCall).toBeDefined();

      const factory = locationCall[2];
      expect(typeof factory).toBe('function');

      // Test the factory with missing element (line 180-188)
      const mockContainer = {
        resolve: jest.fn((token) => {
          if (token === tokens.IDocumentContext) {
            return { query: jest.fn().mockReturnValue(null) }; // Missing element
          }
          if (token === tokens.ILogger) {
            return mockLogger;
          }
          return jest.fn();
        }),
      };

      factory(mockContainer);

      // Should trigger the warning on lines 184-187
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Could not find '#location-info-container' element"
        )
      );
    });

    it('should execute all factory functions without errors', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const mockContainer = {
        resolve: jest.fn((token) => {
          if (token === tokens.IDocumentContext) {
            return {
              query: jest.fn().mockReturnValue(document.createElement('div')),
            };
          }
          if (token === tokens.ILogger) {
            return mockLogger;
          }
          return jest.fn();
        }),
      };

      // Test all factory calls (covers lines 166, 207, 223, 238, 253, 265, 297, 312)
      const factoryCalls = mockRegisterWithLog.mock.calls
        .filter((call) => call[3]?.lifecycle === 'singletonFactory')
        .map((call) => call[2]);

      factoryCalls.forEach((factory) => {
        expect(() => factory(mockContainer)).not.toThrow();
      });
    });
  });

  describe('registerControllers', () => {
    it('should call registerWithLog for all controller services', () => {
      registerControllers(mockRegistrar, mockLogger);

      // Should register 6 controller services
      expect(mockRegisterWithLog).toHaveBeenCalledTimes(6);
    });

    it('should execute all factory functions without errors', () => {
      registerControllers(mockRegistrar, mockLogger);

      const mockContainer = {
        resolve: jest.fn(() => jest.fn()),
      };

      // Test all factory calls (covers lines 364, 390, 404, 415, 428)
      const factoryCalls = mockRegisterWithLog.mock.calls
        .filter((call) => call[3]?.lifecycle === 'singletonFactory')
        .map((call) => call[2]);

      factoryCalls.forEach((factory) => {
        expect(() => factory(mockContainer)).not.toThrow();
      });
    });
  });

  describe('registerFacadeAndManager', () => {
    it('should call registerWithLog for facade and manager', () => {
      registerFacadeAndManager(mockRegistrar, mockLogger);

      // Should register 2 services
      expect(mockRegisterWithLog).toHaveBeenCalledTimes(2);
    });

    it('should execute EngineUIManager factory without errors', () => {
      registerFacadeAndManager(mockRegistrar, mockLogger);

      const mockContainer = {
        resolve: jest.fn(() => jest.fn()),
      };

      // Test EngineUIManager factory (covers line 474)
      const engineUICall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.EngineUIManager
      );

      const factory = engineUICall[2];
      expect(() => factory(mockContainer)).not.toThrow();
    });
  });

  describe('registerLegacyInputHandler', () => {
    it('should register using singletonFactory and log debug message', () => {
      registerLegacyInputHandler(mockRegistrar, mockLogger);

      // Should call singletonFactory (line 494)
      expect(mockRegistrar.singletonFactory).toHaveBeenCalledTimes(1);
      expect(mockRegistrar.singletonFactory).toHaveBeenCalledWith(
        tokens.IInputHandler,
        expect.any(Function)
      );

      // Should log debug message
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('UI Registrations: Registered')
      );
    });

    it('should execute InputHandler factory without errors', () => {
      registerLegacyInputHandler(mockRegistrar, mockLogger);

      const mockContainer = {
        resolve: jest.fn(() => jest.fn()),
      };

      // Test the factory function (covers line 494)
      const factory = mockRegistrar.singletonFactory.mock.calls[0][1];
      expect(() => factory(mockContainer)).not.toThrow();
    });
  });

  describe('factory execution edge cases', () => {
    it('should handle LocationRenderer with found element', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const locationCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.LocationRenderer
      );

      const factory = locationCall[2];

      // Test with found element (no warning)
      const mockContainerWithElement = {
        resolve: jest.fn((token) => {
          if (token === tokens.IDocumentContext) {
            return {
              query: jest.fn().mockReturnValue(document.createElement('div')),
            };
          }
          if (token === tokens.ILogger) {
            return mockLogger;
          }
          return jest.fn();
        }),
      };

      factory(mockContainerWithElement);

      // Should not trigger warning
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should handle factory dependency resolution errors', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const titleCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.TitleRenderer
      );

      const factory = titleCall[2];

      const faultyContainer = {
        resolve: jest.fn(() => {
          throw new Error('Dependency resolution failed');
        }),
      };

      expect(() => factory(faultyContainer)).toThrow(
        'Dependency resolution failed'
      );
    });

    it('should handle partial dependency resolution', () => {
      registerControllers(mockRegistrar, mockLogger);

      const inputStateCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.InputStateController
      );

      const factory = inputStateCall[2];

      const partialContainer = {
        resolve: jest.fn((token) => {
          if (token === tokens.ILogger) {
            return mockLogger;
          }
          return null; // Return null for other dependencies
        }),
      };

      expect(() => factory(partialContainer)).not.toThrow();
    });
  });

  describe('comprehensive factory coverage', () => {
    it('should cover all renderer factory lines', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const mockContainer = {
        resolve: jest.fn((token) => {
          // Provide appropriate mocks for different tokens
          const mocks = {
            [tokens.ILogger]: mockLogger,
            [tokens.IDocumentContext]: {
              query: jest.fn().mockReturnValue(document.createElement('div')),
            },
            [tokens.ISafeEventDispatcher]: { dispatch: jest.fn() },
            [tokens.IValidatedEventDispatcher]: { dispatch: jest.fn() },
            [tokens.titleElement]: document.createElement('h1'),
            [tokens.DomElementFactory]: { createElement: jest.fn() },
            [tokens.IEntityManager]: { getEntity: jest.fn() },
            [tokens.EntityDisplayDataProvider]: { getData: jest.fn() },
            [tokens.IDataRegistry]: { get: jest.fn() },
            [tokens.ISaveLoadService]: { save: jest.fn() },
            [tokens.SaveGameService]: { save: jest.fn() },
            [tokens.IUserPrompt]: { prompt: jest.fn() },
            [tokens.LLMAdapter]: { generate: jest.fn() },
            [tokens.AlertRouter]: { route: jest.fn() },
          };
          return mocks[token] || jest.fn();
        }),
      };

      // Execute all renderer factories to cover uncovered lines
      const rendererTokens = [
        tokens.TitleRenderer,
        tokens.ActionButtonsRenderer,
        tokens.PerceptionLogRenderer,
        tokens.EntityLifecycleMonitor,
        tokens.SaveGameService,
        tokens.SaveGameUI,
        tokens.LlmSelectionModal,
        tokens.CurrentTurnActorRenderer,
        tokens.ChatAlertRenderer,
        tokens.ActionResultRenderer,
      ];

      rendererTokens.forEach((token) => {
        const call = mockRegisterWithLog.mock.calls.find((c) => c[1] === token);
        if (call) {
          const factory = call[2];
          factory(mockContainer);
        }
      });

      expect(mockContainer.resolve).toHaveBeenCalled();
    });

    it('should cover all controller factory lines', () => {
      registerControllers(mockRegistrar, mockLogger);

      const mockContainer = {
        resolve: jest.fn((token) => {
          const mocks = {
            [tokens.ILogger]: mockLogger,
            [tokens.IDocumentContext]: { query: jest.fn() },
            [tokens.ISafeEventDispatcher]: { dispatch: jest.fn() },
            [tokens.IValidatedEventDispatcher]: { dispatch: jest.fn() },
            [tokens.inputElement]: document.createElement('input'),
            [tokens.WindowDocument]: document,
            [tokens.DomElementFactory]: { createElement: jest.fn() },
            [tokens.IEntityManager]: { getEntity: jest.fn() },
            [tokens.VisualizerState]: { getState: jest.fn() },
            [tokens.AnatomyLoadingDetector]: { detect: jest.fn() },
          };
          return mocks[token] || jest.fn();
        }),
      };

      // Execute all controller factories
      const controllerTokens = [
        tokens.InputStateController,
        tokens.GlobalKeyHandler,
        tokens.ProcessingIndicatorController,
        tokens.VisualizerState,
        tokens.AnatomyLoadingDetector,
        tokens.VisualizerStateController,
      ];

      controllerTokens.forEach((token) => {
        const call = mockRegisterWithLog.mock.calls.find((c) => c[1] === token);
        if (call) {
          const factory = call[2];
          factory(mockContainer);
        }
      });

      expect(mockContainer.resolve).toHaveBeenCalled();
    });
  });
});
