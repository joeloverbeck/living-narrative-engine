// tests/unit/dependencyInjection/registrations/uiRegistrations.registerDomElements.test.js
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { registerDomElements } from '../../../../src/dependencyInjection/registrations/uiRegistrations.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { MockContainer } from '../../../common/mockFactories/container.js';

// Mock the registerWithLog helper
jest.mock('../../../../src/utils/registrarHelpers.js', () => ({
  registerWithLog: jest.fn(),
  Registrar: jest.fn(),
}));

// Mock the imported classes
jest.mock('../../../../src/domUI/index.js', () => ({
  DocumentContext: jest.fn(),
  DomElementFactory: jest.fn(),
  WindowUserPrompt: jest.fn(),
}));

jest.mock('../../../../src/alerting/alertRouter.js', () => jest.fn());

describe('registerDomElements', () => {
  let mockRegistrar;
  let mockLogger;
  let mockUiElements;
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

    mockUiElements = {
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document: document,
    };
  });

  it('should register all DOM elements as singleton instances', () => {
    registerDomElements(mockRegistrar, mockUiElements, mockLogger);

    // Verify WindowDocument registration
    expect(mockRegisterWithLog).toHaveBeenCalledWith(
      mockRegistrar,
      tokens.WindowDocument,
      mockUiElements.document,
      { lifecycle: 'singleton', isInstance: true },
      mockLogger
    );

    // Verify outputDiv registration
    expect(mockRegisterWithLog).toHaveBeenCalledWith(
      mockRegistrar,
      tokens.outputDiv,
      mockUiElements.outputDiv,
      { lifecycle: 'singleton', isInstance: true },
      mockLogger
    );

    // Verify inputElement registration
    expect(mockRegisterWithLog).toHaveBeenCalledWith(
      mockRegistrar,
      tokens.inputElement,
      mockUiElements.inputElement,
      { lifecycle: 'singleton', isInstance: true },
      mockLogger
    );
  });

  it('should register IDocumentContext as singleton factory', () => {
    registerDomElements(mockRegistrar, mockUiElements, mockLogger);

    expect(mockRegisterWithLog).toHaveBeenCalledWith(
      mockRegistrar,
      tokens.IDocumentContext,
      expect.any(Function),
      { lifecycle: 'singletonFactory' },
      mockLogger
    );
  });

  it('should register DomElementFactory as singleton factory', () => {
    registerDomElements(mockRegistrar, mockUiElements, mockLogger);

    expect(mockRegisterWithLog).toHaveBeenCalledWith(
      mockRegistrar,
      tokens.DomElementFactory,
      expect.any(Function),
      { lifecycle: 'singletonFactory' },
      mockLogger
    );
  });

  it('should register IUserPrompt as singleton factory', () => {
    registerDomElements(mockRegistrar, mockUiElements, mockLogger);

    expect(mockRegisterWithLog).toHaveBeenCalledWith(
      mockRegistrar,
      tokens.IUserPrompt,
      expect.any(Function),
      { lifecycle: 'singletonFactory' },
      mockLogger
    );
  });

  it('should register AlertRouter with proper dependencies', () => {
    registerDomElements(mockRegistrar, mockUiElements, mockLogger);

    expect(mockRegisterWithLog).toHaveBeenCalledWith(
      mockRegistrar,
      tokens.AlertRouter,
      expect.any(Function),
      { lifecycle: 'singleton', dependencies: [tokens.ISafeEventDispatcher] },
      mockLogger
    );
  });

  it('should register correct number of services', () => {
    registerDomElements(mockRegistrar, mockUiElements, mockLogger);

    // Should register 7 services total (titleElement removed):
    // WindowDocument, outputDiv, inputElement,
    // IDocumentContext, DomElementFactory, IUserPrompt, AlertRouter
    expect(mockRegisterWithLog).toHaveBeenCalledTimes(7);
  });

  describe('factory function behavior', () => {
    let mockContainer;

    beforeEach(() => {
      mockContainer = new MockContainer();
      mockContainer.register(tokens.WindowDocument, mockUiElements.document);
      mockContainer.register(tokens.IDocumentContext, jest.fn());
      mockContainer.register(tokens.ISafeEventDispatcher, jest.fn());
    });

    it('should create DocumentContext factory that resolves WindowDocument', () => {
      registerDomElements(mockRegistrar, mockUiElements, mockLogger);

      // Get the IDocumentContext factory function
      const documentContextCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.IDocumentContext
      );
      expect(documentContextCall).toBeDefined();

      const factory = documentContextCall[2];
      expect(typeof factory).toBe('function');

      // Test the factory function
      const mockResolve = jest.fn().mockReturnValue(mockUiElements.document);
      const result = factory({ resolve: mockResolve });

      expect(mockResolve).toHaveBeenCalledWith(tokens.WindowDocument);
    });

    it('should create DomElementFactory factory that resolves IDocumentContext', () => {
      registerDomElements(mockRegistrar, mockUiElements, mockLogger);

      // Get the DomElementFactory factory function
      const domElementFactoryCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.DomElementFactory
      );
      expect(domElementFactoryCall).toBeDefined();

      const factory = domElementFactoryCall[2];
      expect(typeof factory).toBe('function');

      // Test the factory function
      const mockResolve = jest.fn().mockReturnValue({});
      const result = factory({ resolve: mockResolve });

      expect(mockResolve).toHaveBeenCalledWith(tokens.IDocumentContext);
    });

    it('should create IUserPrompt factory that returns WindowUserPrompt instance', () => {
      registerDomElements(mockRegistrar, mockUiElements, mockLogger);

      // Get the IUserPrompt factory function
      const userPromptCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.IUserPrompt
      );
      expect(userPromptCall).toBeDefined();

      const factory = userPromptCall[2];
      expect(typeof factory).toBe('function');

      // Test the factory function - it should not require any dependencies
      const result = factory();
      expect(result).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle missing UI elements gracefully', () => {
      const incompleteUiElements = {
        outputDiv: null,
        inputElement: undefined,
        titleElement: mockUiElements.titleElement,
        document: mockUiElements.document,
      };

      // Should not throw
      expect(() => {
        registerDomElements(mockRegistrar, incompleteUiElements, mockLogger);
      }).not.toThrow();

      // Should still register all services (7 without titleElement)
      expect(mockRegisterWithLog).toHaveBeenCalledTimes(7);
    });

    it('should handle missing logger gracefully', () => {
      expect(() => {
        registerDomElements(mockRegistrar, mockUiElements, null);
      }).not.toThrow();
    });
  });
});
