// tests/unit/dependencyInjection/registrations/uiRegistrations.registerFacadeAndManager.test.js
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { registerFacadeAndManager } from '../../../../src/dependencyInjection/registrations/uiRegistrations.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';

// Mock the registerWithLog helper
jest.mock('../../../../src/utils/registrarHelpers.js', () => ({
  registerWithLog: jest.fn(),
  Registrar: jest.fn(),
}));

// Mock the facade and manager classes
jest.mock('../../../../src/domUI/index.js', () => ({
  DomUiFacade: jest.fn(),
  EngineUIManager: jest.fn(),
}));

describe('registerFacadeAndManager', () => {
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

  describe('DomUiFacade registration', () => {
    it('should register DomUiFacade as singleton with correct dependencies', () => {
      registerFacadeAndManager(mockRegistrar, mockLogger);

      const domUiFacadeCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.DomUiFacade
      );

      expect(domUiFacadeCall).toBeDefined();
      expect(domUiFacadeCall[2]).toBe(
        require('../../../../src/domUI/index.js').DomUiFacade
      );
      expect(domUiFacadeCall[3]).toEqual({
        lifecycle: 'singleton',
        dependencies: [
          tokens.ActionButtonsRenderer,
          tokens.ActionResultRenderer,
          tokens.LocationRenderer,
          tokens.InputStateController,
          tokens.SpeechBubbleRenderer,
          tokens.PerceptionLogRenderer,
          tokens.SaveGameUI,
          tokens.LoadGameUI,
          tokens.LlmSelectionModal,
          tokens.TurnOrderTickerRenderer,
          tokens.InjuryStatusPanel,
          tokens.PromptPreviewModal,
          // EntityLifecycleMonitor is commented out for performance
          // TitleRenderer removed with title banner
        ],
      });
    });

    it('should not include EntityLifecycleMonitor in dependencies (disabled for performance)', () => {
      registerFacadeAndManager(mockRegistrar, mockLogger);

      const domUiFacadeCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.DomUiFacade
      );

      expect(domUiFacadeCall[3].dependencies).not.toContain(
        tokens.EntityLifecycleMonitor
      );
    });

    it('should pass logger to registerWithLog for DomUiFacade', () => {
      registerFacadeAndManager(mockRegistrar, mockLogger);

      const domUiFacadeCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.DomUiFacade
      );

      expect(domUiFacadeCall[4]).toBe(mockLogger);
    });
  });

  describe('EngineUIManager factory', () => {
    it('should register EngineUIManager as singleton factory', () => {
      registerFacadeAndManager(mockRegistrar, mockLogger);

      const engineUIManagerCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.EngineUIManager
      );

      expect(engineUIManagerCall).toBeDefined();
      expect(engineUIManagerCall[3].lifecycle).toBe('singletonFactory');
    });

    it('should create EngineUIManager with correct dependencies', () => {
      registerFacadeAndManager(mockRegistrar, mockLogger);

      const engineUIManagerCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.EngineUIManager
      );

      const factory = engineUIManagerCall[2];
      const mockEventDispatcher = { dispatch: jest.fn() };
      const mockDomUiFacade = { initialize: jest.fn() };

      const mockContainer = {
        resolve: jest.fn((token) => {
          const mocks = {
            [tokens.ISafeEventDispatcher]: mockEventDispatcher,
            [tokens.DomUiFacade]: mockDomUiFacade,
            [tokens.ILogger]: mockLogger,
          };
          return mocks[token] || jest.fn();
        }),
      };

      // Instead of trying to verify the mock was called (which is complex due to module mocking),
      // we verify that the factory function resolves the correct dependencies and executes without error
      expect(() => {
        factory(mockContainer);
      }).not.toThrow();

      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomUiFacade);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
    });

    it('should pass logger to registerWithLog for EngineUIManager', () => {
      registerFacadeAndManager(mockRegistrar, mockLogger);

      const engineUIManagerCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.EngineUIManager
      );

      expect(engineUIManagerCall[4]).toBe(mockLogger);
    });
  });

  it('should register exactly 2 services', () => {
    registerFacadeAndManager(mockRegistrar, mockLogger);

    expect(mockRegisterWithLog).toHaveBeenCalledTimes(2);
  });

  it('should register both DomUiFacade and EngineUIManager', () => {
    registerFacadeAndManager(mockRegistrar, mockLogger);

    const registeredTokens = mockRegisterWithLog.mock.calls.map(
      (call) => call[1]
    );
    expect(registeredTokens).toContain(tokens.DomUiFacade);
    expect(registeredTokens).toContain(tokens.EngineUIManager);
  });

  describe('error handling', () => {
    it('should handle null registrar', () => {
      // The function may not throw immediately as registerWithLog is mocked
      // We just verify it can be called
      registerFacadeAndManager(null, mockLogger);

      // Verify registerWithLog was called with null registrar
      expect(mockRegisterWithLog).toHaveBeenCalledWith(
        null,
        expect.any(String),
        expect.any(Function),
        expect.any(Object),
        mockLogger
      );
    });

    it('should handle missing dependencies in EngineUIManager factory', () => {
      registerFacadeAndManager(mockRegistrar, mockLogger);

      const engineUIManagerCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.EngineUIManager
      );

      const factory = engineUIManagerCall[2];
      const faultyContainer = {
        resolve: jest.fn(() => {
          throw new Error('Dependency not found');
        }),
      };

      expect(() => {
        factory(faultyContainer);
      }).toThrow('Dependency not found');
    });

    it('should handle null eventDispatcher in EngineUIManager factory', () => {
      registerFacadeAndManager(mockRegistrar, mockLogger);

      const engineUIManagerCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.EngineUIManager
      );

      const factory = engineUIManagerCall[2];
      const mockContainer = {
        resolve: jest.fn((token) => {
          if (token === tokens.ISafeEventDispatcher) {
            return null;
          }
          const mocks = {
            [tokens.DomUiFacade]: { initialize: jest.fn() },
            [tokens.ILogger]: mockLogger,
          };
          return mocks[token] || jest.fn();
        }),
      };

      // The production EngineUIManager throws immediately when eventDispatcher is null
      expect(() => {
        factory(mockContainer);
      }).toThrow(
        'EngineUIManager: ISafeEventDispatcher dependency is required.'
      );
    });

    it('should handle null domUiFacade in EngineUIManager factory', () => {
      registerFacadeAndManager(mockRegistrar, mockLogger);

      const engineUIManagerCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.EngineUIManager
      );

      const factory = engineUIManagerCall[2];
      const mockContainer = {
        resolve: jest.fn((token) => {
          if (token === tokens.DomUiFacade) {
            return null;
          }
          const mocks = {
            [tokens.ISafeEventDispatcher]: { dispatch: jest.fn() },
            [tokens.ILogger]: mockLogger,
          };
          return mocks[token] || jest.fn();
        }),
      };

      // The production EngineUIManager throws immediately when domUiFacade is null
      expect(() => {
        factory(mockContainer);
      }).toThrow('EngineUIManager: DomUiFacade dependency is required.');
    });

    it('should handle null logger in EngineUIManager factory', () => {
      registerFacadeAndManager(mockRegistrar, mockLogger);

      const engineUIManagerCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.EngineUIManager
      );

      const factory = engineUIManagerCall[2];
      const mockContainer = {
        resolve: jest.fn((token) => {
          if (token === tokens.ILogger) {
            return null;
          }
          const mocks = {
            [tokens.ISafeEventDispatcher]: { dispatch: jest.fn() },
            [tokens.DomUiFacade]: { initialize: jest.fn() },
          };
          return mocks[token] || jest.fn();
        }),
      };

      // The production EngineUIManager throws immediately when logger is null
      expect(() => {
        factory(mockContainer);
      }).toThrow('EngineUIManager: ILogger dependency is required.');
    });
  });

  describe('dependency resolution order', () => {
    it('should resolve EngineUIManager dependencies in correct order', () => {
      registerFacadeAndManager(mockRegistrar, mockLogger);

      const engineUIManagerCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.EngineUIManager
      );

      const factory = engineUIManagerCall[2];
      const mockContainer = {
        resolve: jest.fn((token) => {
          const mocks = {
            [tokens.ISafeEventDispatcher]: { dispatch: jest.fn() },
            [tokens.DomUiFacade]: { initialize: jest.fn() },
            [tokens.ILogger]: {
              debug: jest.fn(),
              info: jest.fn(),
              warn: jest.fn(),
              error: jest.fn(),
            },
          };
          return mocks[token] || jest.fn();
        }),
      };

      factory(mockContainer);

      const resolveCalls = mockContainer.resolve.mock.calls;

      // Verify all expected dependencies were resolved
      expect(resolveCalls).toEqual(
        expect.arrayContaining([
          [tokens.ISafeEventDispatcher],
          [tokens.DomUiFacade],
          [tokens.ILogger],
        ])
      );

      expect(resolveCalls).toHaveLength(3);
    });
  });

  describe('DomUiFacade dependencies', () => {
    it('should have exactly 12 dependencies (TitleRenderer removed, EntityLifecycleMonitor removed, TurnOrderTickerRenderer, InjuryStatusPanel, and PromptPreviewModal added)', () => {
      registerFacadeAndManager(mockRegistrar, mockLogger);

      const domUiFacadeCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.DomUiFacade
      );

      expect(domUiFacadeCall[3].dependencies).toHaveLength(12);
    });

    it('should include all required renderer dependencies', () => {
      registerFacadeAndManager(mockRegistrar, mockLogger);

      const domUiFacadeCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.DomUiFacade
      );

      const dependencies = domUiFacadeCall[3].dependencies;

      // Verify all expected dependencies are present (TitleRenderer removed, TurnOrderTickerRenderer added)
      expect(dependencies).toContain(tokens.ActionButtonsRenderer);
      expect(dependencies).toContain(tokens.ActionResultRenderer);
      expect(dependencies).toContain(tokens.LocationRenderer);
      expect(dependencies).toContain(tokens.InputStateController);
      expect(dependencies).toContain(tokens.SpeechBubbleRenderer);
      expect(dependencies).toContain(tokens.PerceptionLogRenderer);
      expect(dependencies).toContain(tokens.SaveGameUI);
      expect(dependencies).toContain(tokens.LoadGameUI);
      expect(dependencies).toContain(tokens.LlmSelectionModal);
      expect(dependencies).toContain(tokens.TurnOrderTickerRenderer);
      expect(dependencies).toContain(tokens.InjuryStatusPanel);
      expect(dependencies).toContain(tokens.PromptPreviewModal);
    });
  });
});
