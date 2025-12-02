// tests/unit/dependencyInjection/registrations/uiRegistrations.test.js
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { registerUI } from '../../../../src/dependencyInjection/registrations/uiRegistrations.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';

// Mock Registrar
jest.mock('../../../../src/utils/registrarHelpers.js', () => ({
  Registrar: jest.fn().mockImplementation(() => ({
    register: jest.fn(),
    singletonFactory: jest.fn(),
  })),
  registerWithLog: jest.fn(),
}));

describe('registerUI - main orchestration function', () => {
  let mockContainer;
  let mockLogger;
  let mockUiElements;
  let mockChatAlertRenderer;
  let mockActionResultRenderer;
  let MockRegistrar;

  beforeEach(() => {
    jest.clearAllMocks();

    MockRegistrar =
      require('../../../../src/utils/registrarHelpers.js').Registrar;

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockChatAlertRenderer = { initialize: jest.fn() };
    mockActionResultRenderer = { initialize: jest.fn() };

    mockContainer = {
      resolve: jest.fn((token) => {
        const mocks = {
          [tokens.ILogger]: mockLogger,
          [tokens.ChatAlertRenderer]: mockChatAlertRenderer,
          [tokens.ActionResultRenderer]: mockActionResultRenderer,
        };
        return mocks[token] || jest.fn();
      }),
    };

    mockUiElements = {
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document: document,
    };
  });

  it('should resolve logger from container', () => {
    registerUI(mockContainer, mockUiElements);

    expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
  });

  it('should log start message', () => {
    registerUI(mockContainer, mockUiElements);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'UI Registrations: Starting (Refactored DOM UI)...'
    );
  });

  it('should create a new Registrar instance', () => {
    registerUI(mockContainer, mockUiElements);

    expect(MockRegistrar).toHaveBeenCalledWith(mockContainer);
  });

  it('should eagerly instantiate ChatAlertRenderer', () => {
    registerUI(mockContainer, mockUiElements);

    expect(mockContainer.resolve).toHaveBeenCalledWith(
      tokens.ChatAlertRenderer
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `UI Registrations: Eagerly instantiated ${tokens.ChatAlertRenderer} to attach listeners.`
    );
  });

  it('should eagerly instantiate ActionResultRenderer', () => {
    registerUI(mockContainer, mockUiElements);

    expect(mockContainer.resolve).toHaveBeenCalledWith(
      tokens.ActionResultRenderer
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `UI Registrations: Eagerly instantiated ${tokens.ActionResultRenderer}.`
    );
  });

  it('should log completion message', () => {
    registerUI(mockContainer, mockUiElements);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'UI Registrations: Complete.'
    );
  });

  it('should verify Registrar is used for service registration', () => {
    const mockRegistrarInstance = {
      register: jest.fn(),
      singletonFactory: jest.fn(),
    };
    MockRegistrar.mockImplementation(() => mockRegistrarInstance);

    registerUI(mockContainer, mockUiElements);

    // Verify the registrar instance was created and used
    expect(MockRegistrar).toHaveBeenCalledWith(mockContainer);
    expect(MockRegistrar).toHaveBeenCalledTimes(1);
  });

  describe('error handling', () => {
    it('should throw when accessing properties on null container', () => {
      expect(() => {
        registerUI(null, mockUiElements);
      }).toThrow(/Cannot.*null/); // Will throw when new Registrar(null) is called
    });

    it('should throw when accessing properties on null uiElements', () => {
      expect(() => {
        registerUI(mockContainer, null);
      }).toThrow(/Cannot.*null/); // Will throw when accessing properties on null uiElements
    });

    it('should fail if eager instantiation fails for ChatAlertRenderer', () => {
      const errorContainer = {
        resolve: jest.fn((token) => {
          if (token === tokens.ChatAlertRenderer) {
            throw new Error('Failed to instantiate ChatAlertRenderer');
          }
          return token === tokens.ILogger ? mockLogger : jest.fn();
        }),
      };

      expect(() => {
        registerUI(errorContainer, mockUiElements);
      }).toThrow('Failed to instantiate ChatAlertRenderer');
    });

    it('should throw when logger is null and debug is called', () => {
      const containerWithNullLogger = {
        resolve: jest.fn((token) => {
          if (token === tokens.ILogger) {
            return null;
          }
          return jest.fn();
        }),
      };

      expect(() => {
        registerUI(containerWithNullLogger, mockUiElements);
      }).toThrow(/Cannot.*null/); // Will throw when trying to call logger.debug on null
    });
  });

  describe('logging sequence', () => {
    it('should log messages in correct sequence', () => {
      registerUI(mockContainer, mockUiElements);

      const debugCalls = mockLogger.debug.mock.calls.map((call) => call[0]);

      expect(debugCalls).toEqual([
        'UI Registrations: Starting (Refactored DOM UI)...',
        'UI Registrations: Registered IInputHandler (legacy) with VED.',
        `UI Registrations: Eagerly instantiated ${tokens.ChatAlertRenderer} to attach listeners.`,
        `UI Registrations: Eagerly instantiated ${tokens.ActionResultRenderer}.`,
        `UI Registrations: Eagerly instantiated ${tokens.InjuryStatusPanel}.`,
        'UI Registrations: Complete.',
      ]);
    });
  });

  describe('integration flow', () => {
    it('should resolve services in correct order for eager instantiation', () => {
      registerUI(mockContainer, mockUiElements);

      const resolveCalls = mockContainer.resolve.mock.calls;
      const tokenOrder = resolveCalls.map((call) => call[0]);

      // Logger should be resolved first
      expect(tokenOrder[0]).toBe(tokens.ILogger);

      // Eager instantiations should happen after registrations
      const chatAlertIndex = tokenOrder.indexOf(tokens.ChatAlertRenderer);
      const actionResultIndex = tokenOrder.indexOf(tokens.ActionResultRenderer);

      expect(chatAlertIndex).toBeGreaterThan(0);
      expect(actionResultIndex).toBeGreaterThan(chatAlertIndex);
    });

    it('should work with different UI element types', () => {
      const customUiElements = {
        outputDiv: document.createElement('section'),
        inputElement: document.createElement('textarea'),
        titleElement: document.createElement('h2'),
        document: window.document,
      };

      expect(() => {
        registerUI(mockContainer, customUiElements);
      }).not.toThrow();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'UI Registrations: Complete.'
      );
    });

    it('should handle complete workflow from start to finish', () => {
      const workflowContainer = {
        resolve: jest.fn((token) => {
          const services = {
            [tokens.ILogger]: mockLogger,
            [tokens.ChatAlertRenderer]: mockChatAlertRenderer,
            [tokens.ActionResultRenderer]: mockActionResultRenderer,
          };
          return services[token] || jest.fn();
        }),
      };

      registerUI(workflowContainer, mockUiElements);

      // Verify complete workflow
      expect(MockRegistrar).toHaveBeenCalledWith(workflowContainer);
      expect(workflowContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
      expect(workflowContainer.resolve).toHaveBeenCalledWith(
        tokens.ChatAlertRenderer
      );
      expect(workflowContainer.resolve).toHaveBeenCalledWith(
        tokens.ActionResultRenderer
      );

      // Verify logging sequence
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'UI Registrations: Starting (Refactored DOM UI)...'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'UI Registrations: Complete.'
      );
    });

    it('should properly handle UI elements destructuring', () => {
      const elementsWithExtraProps = {
        outputDiv: document.createElement('div'),
        inputElement: document.createElement('input'),
        titleElement: document.createElement('h1'),
        document: document,
        extraProp: 'should be ignored',
        anotherExtra: 123,
      };

      expect(() => {
        registerUI(mockContainer, elementsWithExtraProps);
      }).not.toThrow();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'UI Registrations: Complete.'
      );
    });

    it('should maintain proper separation between registration and eager instantiation', () => {
      registerUI(mockContainer, mockUiElements);

      const debugCalls = mockLogger.debug.mock.calls;
      const messages = debugCalls.map((call) => call[0]);

      // Registration should happen before eager instantiation
      const startIndex = messages.findIndex((msg) => msg.includes('Starting'));
      const legacyIndex = messages.findIndex((msg) =>
        msg.includes('Registered IInputHandler')
      );
      const eagerStartIndex = messages.findIndex((msg) =>
        msg.includes('Eagerly instantiated')
      );
      const completeIndex = messages.findIndex((msg) =>
        msg.includes('Complete')
      );

      expect(startIndex).toBeLessThan(legacyIndex);
      expect(legacyIndex).toBeLessThan(eagerStartIndex);
      expect(eagerStartIndex).toBeLessThan(completeIndex);
    });
  });
});
