// tests/config/registrations/uiRegistrations.test.js
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { registerUI } from '../../../src/dependencyInjection/registrations/uiRegistrations.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { Registrar } from '../../../src/dependencyInjection/registrarHelpers.js';

// --- Mock Registrar Helper ---
// The key to a robust test is to mock the boundary, in this case, the Registrar.
// We create mock functions for each of its methods that we expect `registerUI` to call.
const mockInstance = jest.fn();
const mockSingle = jest.fn();
const mockSingletonFactory = jest.fn();
jest.mock('../../../src/dependencyInjection/registrarHelpers.js', () => {
  // This factory is called by Jest when `new Registrar()` is encountered.
  // We return an object that has our mock methods on it.
  return {
    Registrar: jest.fn().mockImplementation(() => {
      return {
        instance: mockInstance,
        single: mockSingle,
        singletonFactory: mockSingletonFactory,
      };
    }),
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
          case tokens.IValidatedEventDispatcher:
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

  it('should register essential external dependencies via registrar.instance()', () => {
    expect(mockInstance).toHaveBeenCalledWith(
      tokens.WindowDocument,
      mockUiElements.document
    );
    expect(mockInstance).toHaveBeenCalledWith(
      tokens.outputDiv,
      mockUiElements.outputDiv
    );
    expect(mockInstance).toHaveBeenCalledWith(
      tokens.inputElement,
      mockUiElements.inputElement
    );
    expect(mockInstance).toHaveBeenCalledWith(
      tokens.titleElement,
      mockUiElements.titleElement
    );
  });

  it('should register core utilities via registrar.singletonFactory()', () => {
    expect(mockSingletonFactory).toHaveBeenCalledWith(
      tokens.IDocumentContext,
      expect.any(Function)
    );
    expect(mockSingletonFactory).toHaveBeenCalledWith(
      tokens.DomElementFactory,
      expect.any(Function)
    );
  });

  it('should register alerting services via registrar.single()', () => {
    // Check that AlertRouter and IAlertMessageFormatter are registered correctly
    expect(mockSingle).toHaveBeenCalledWith(
      tokens.AlertRouter,
      expect.any(Function),
      [tokens.ISafeEventDispatcher]
    );
    expect(mockSingle).toHaveBeenCalledWith(
      tokens.IAlertMessageFormatter,
      expect.any(Function)
    );
  });

  it('should register ChatAlertRenderer via registrar.singletonFactory()', () => {
    // Verify the specific registration for the class we modified
    expect(mockSingletonFactory).toHaveBeenCalledWith(
      tokens.ChatAlertRenderer,
      expect.any(Function)
    );
  });

  it('should register all other UI components', () => {
    // Spot-check a few other key registrations to ensure they are still present
    expect(mockSingle).toHaveBeenCalledWith(
      tokens.UiMessageRenderer,
      expect.any(Function),
      expect.any(Array)
    );
    expect(mockSingletonFactory).toHaveBeenCalledWith(
      tokens.TitleRenderer,
      expect.any(Function)
    );
    expect(mockSingletonFactory).toHaveBeenCalledWith(
      tokens.InputStateController,
      expect.any(Function)
    );
    expect(mockSingletonFactory).toHaveBeenCalledWith(
      tokens.LocationRenderer,
      expect.any(Function)
    );
    expect(mockSingletonFactory).toHaveBeenCalledWith(
      tokens.ActionButtonsRenderer,
      expect.any(Function)
    );
    expect(mockSingletonFactory).toHaveBeenCalledWith(
      tokens.PerceptionLogRenderer,
      expect.any(Function)
    );
    expect(mockSingle).toHaveBeenCalledWith(
      tokens.DomUiFacade,
      expect.any(Function),
      expect.any(Array)
    );
    expect(mockSingletonFactory).toHaveBeenCalledWith(
      tokens.EngineUIManager,
      expect.any(Function)
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
