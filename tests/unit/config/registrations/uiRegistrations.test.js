// tests/config/registrations/uiRegistrations.test.js
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { registerUI } from '../../../../src/dependencyInjection/registrations/uiRegistrations.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { Registrar } from '../../../../src/utils/registrarHelpers.js';

// --- Mock Registrar Helper ---
// The key to a robust test is to mock the boundary, in this case, the Registrar.
// We create mock functions for each of its methods that we expect `registerUI` to call.
const mockRegister = jest.fn();
jest.mock('../../../../src/utils/registrarHelpers.js', () => {
  const registerWithLog = jest.fn((registrar, token, factory, options) => {
    registrar.register(token, factory, options);
  });
  return {
    Registrar: jest.fn().mockImplementation(() => {
      return { register: mockRegister, singletonFactory: jest.fn() };
    }),
    registerWithLog,
  };
});

describe('registerUI', () => {
  let mockContainer;
  let mockUiElements;

  beforeEach(() => {
    // Clear all mock history before each test run
    jest.clearAllMocks();

    // The mock container now only needs a `resolve` method. The `register` method
    // is no longer needed because we are mocking the `Registrar` that calls it.
    mockContainer = {
      resolve: jest.fn((token) => {
        // Return a valid mock for any dependency that `registerUI` resolves directly.
        // This includes the dispatcher for the Throttler constructor check.
        switch (token) {
          case tokens.ILogger:
            return {
              info: jest.fn(),
              debug: jest.fn(),
              warn: jest.fn(),
              error: jest.fn(),
            };
          case tokens.ISafeEventDispatcher:
            return { subscribe: jest.fn(), dispatch: jest.fn() };
          // For any other resolved dependency, return a generic mock function.
          default:
            return jest.fn();
        }
      }),
    };

    mockUiElements = {
      outputDiv: 'mock-output-div',
      inputElement: 'mock-input-element',
      titleElement: 'mock-title-element',
      document: { querySelector: jest.fn() },
    };

    // --- Execute the function under test ---
    registerUI(mockContainer, mockUiElements);
  });

  it('should create a Registrar instance with the provided container', () => {
    expect(Registrar).toHaveBeenCalledTimes(1);
    expect(Registrar).toHaveBeenCalledWith(mockContainer);
  });

  it('should register essential external dependencies', () => {
    expect(mockRegister).toHaveBeenCalledWith(
      tokens.WindowDocument,
      mockUiElements.document,
      { lifecycle: 'singleton', isInstance: true }
    );
    expect(mockRegister).toHaveBeenCalledWith(
      tokens.outputDiv,
      mockUiElements.outputDiv,
      { lifecycle: 'singleton', isInstance: true }
    );
    expect(mockRegister).toHaveBeenCalledWith(
      tokens.inputElement,
      mockUiElements.inputElement,
      { lifecycle: 'singleton', isInstance: true }
    );
    expect(mockRegister).toHaveBeenCalledWith(
      tokens.titleElement,
      mockUiElements.titleElement,
      { lifecycle: 'singleton', isInstance: true }
    );
  });

  it('should register core utilities via register()', () => {
    expect(mockRegister).toHaveBeenCalledWith(
      tokens.IDocumentContext,
      expect.any(Function),
      { lifecycle: 'singletonFactory' }
    );
    expect(mockRegister).toHaveBeenCalledWith(
      tokens.DomElementFactory,
      expect.any(Function),
      { lifecycle: 'singletonFactory' }
    );
  });

  it('should register alerting services via register()', () => {
    expect(mockRegister).toHaveBeenCalledWith(
      tokens.AlertRouter,
      expect.any(Function),
      { lifecycle: 'singleton', dependencies: [tokens.ISafeEventDispatcher] }
    );
  });

  it('should register ChatAlertRenderer via register()', () => {
    expect(mockRegister).toHaveBeenCalledWith(
      tokens.ChatAlertRenderer,
      expect.any(Function),
      { lifecycle: 'singletonFactory' }
    );
  });

  it('should register all other UI components', () => {
    expect(mockRegister).toHaveBeenCalledWith(
      tokens.TitleRenderer,
      expect.any(Function),
      { lifecycle: 'singletonFactory' }
    );
    expect(mockRegister).toHaveBeenCalledWith(
      tokens.InputStateController,
      expect.any(Function),
      { lifecycle: 'singletonFactory' }
    );
    expect(mockRegister).toHaveBeenCalledWith(
      tokens.LocationRenderer,
      expect.any(Function),
      { lifecycle: 'singletonFactory' }
    );
    expect(mockRegister).toHaveBeenCalledWith(
      tokens.ActionButtonsRenderer,
      expect.any(Function),
      { lifecycle: 'singletonFactory' }
    );
    expect(mockRegister).toHaveBeenCalledWith(
      tokens.PerceptionLogRenderer,
      expect.any(Function),
      { lifecycle: 'singletonFactory' }
    );
    expect(mockRegister).toHaveBeenCalledWith(
      tokens.DomUiFacade,
      expect.any(Function),
      expect.objectContaining({ lifecycle: 'singleton' })
    );
    expect(mockRegister).toHaveBeenCalledWith(
      tokens.EngineUIManager,
      expect.any(Function),
      { lifecycle: 'singletonFactory' }
    );
  });

  it('should eagerly instantiate ChatAlertRenderer by calling container.resolve() at the end', () => {
    // The last action in `registerUI` is to resolve the ChatAlertRenderer.
    // We test that our mock container's resolve function was called with the correct token.
    expect(mockContainer.resolve).toHaveBeenCalledWith(
      tokens.ChatAlertRenderer
    );
  });
});
