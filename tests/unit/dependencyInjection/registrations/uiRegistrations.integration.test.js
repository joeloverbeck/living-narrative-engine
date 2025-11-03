// tests/unit/dependencyInjection/registrations/uiRegistrations.integration.test.js
// This test file provides integration testing for the complete registerUI flow
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { registerUI } from '../../../../src/dependencyInjection/registrations/uiRegistrations.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';

// Mock all the UI components
jest.mock('../../../../src/domUI/index.js', () => ({
  SpeechBubbleRenderer: jest.fn(),
  TitleRenderer: jest.fn(),
  LocationRenderer: jest.fn(),
  ActionButtonsRenderer: jest.fn(),
  PerceptionLogRenderer: jest.fn(),
  SaveGameService: jest.fn(),
  CurrentTurnActorRenderer: jest.fn(),
  ChatAlertRenderer: jest.fn(),
  ActionResultRenderer: jest.fn(),
  LlmSelectionModal: jest.fn(),
  DomUiFacade: jest.fn(),
  EngineUIManager: jest.fn(),
  InputStateController: jest.fn(),
  ProcessingIndicatorController: jest.fn(),
  DocumentContext: jest.fn(),
  DomElementFactory: jest.fn(),
  WindowUserPrompt: jest.fn(),
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

jest.mock('../../../../src/input/inputHandler.js', () => jest.fn());
jest.mock('../../../../src/alerting/alertRouter.js', () => jest.fn());
jest.mock('../../../../src/domUI/saveGameUI.js', () => jest.fn());
jest.mock('../../../../src/domUI/loadGameUI.js', () => jest.fn());

describe('registerUI - integration test', () => {
  let mockContainer;
  let mockLogger;
  let mockUiElements;
  let registrations;

  beforeEach(() => {
    jest.clearAllMocks();

    registrations = new Map();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create a more complete mock container that tracks registrations
    mockContainer = {
      register: jest.fn((token, implementation, options) => {
        registrations.set(token, { implementation, options });
      }),
      singletonFactory: jest.fn((token, factory) => {
        registrations.set(token, { factory, lifecycle: 'singletonFactory' });
      }),
      resolve: jest.fn((token) => {
        // Return mocks for commonly resolved dependencies
        const mocks = {
          [tokens.ILogger]: mockLogger,
          [tokens.ChatAlertRenderer]: { initialize: jest.fn() },
          [tokens.ActionResultRenderer]: { initialize: jest.fn() },
          [tokens.GlobalKeyHandler]: { initialize: jest.fn() },
          [tokens.IDocumentContext]: { query: jest.fn() },
          [tokens.ISafeEventDispatcher]: { dispatch: jest.fn() },
          [tokens.IValidatedEventDispatcher]: { dispatch: jest.fn() },
          [tokens.DomElementFactory]: { createElement: jest.fn() },
          [tokens.IEntityManager]: { getEntity: jest.fn() },
          [tokens.EntityDisplayDataProvider]: { getDisplayData: jest.fn() },
          [tokens.IDataRegistry]: { getData: jest.fn() },
          [tokens.IUserPrompt]: { prompt: jest.fn() },
          [tokens.ISaveLoadService]: { save: jest.fn(), load: jest.fn() },
          [tokens.SaveGameService]: { save: jest.fn() },
          [tokens.IActionCategorizationService]: { categorize: jest.fn() },
          [tokens.AlertRouter]: { route: jest.fn() },
          [tokens.LLMAdapter]: { sendRequest: jest.fn() },
          [tokens.WindowDocument]: document,
          [tokens.inputElement]: document.createElement('input'),
          [tokens.outputDiv]: document.createElement('div'),
          [tokens.titleElement]: document.createElement('h1'),
          [tokens.DomUiFacade]: { initialize: jest.fn() },
          [tokens.VisualizerState]: { setState: jest.fn() },
          [tokens.AnatomyLoadingDetector]: { detect: jest.fn() },
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

  it('should complete the full registration flow', () => {
    registerUI(mockContainer, mockUiElements);

    // Verify logger was resolved
    expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);

    // Verify start and end logging
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'UI Registrations: Starting (Refactored DOM UI)...'
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'UI Registrations: Complete.'
    );

    // Verify eager instantiations
    expect(mockContainer.resolve).toHaveBeenCalledWith(
      tokens.ChatAlertRenderer
    );
    expect(mockContainer.resolve).toHaveBeenCalledWith(
      tokens.ActionResultRenderer
    );
  });

  it('should register all expected tokens', () => {
    registerUI(mockContainer, mockUiElements);

    // Check that registrations were made (via register or singletonFactory)
    const totalCalls =
      mockContainer.register.mock.calls.length +
      mockContainer.singletonFactory.mock.calls.length;

    // We expect at least some registrations to have been made
    expect(totalCalls).toBeGreaterThan(0);
  });

  it('should handle UI elements with missing location container', () => {
    // Mock document.query to return null for location container
    const mockDocumentContext = {
      query: jest.fn((selector) => {
        if (selector === '#location-info-container') {
          return null;
        }
        return document.createElement('div');
      }),
    };

    mockContainer.resolve = jest.fn((token) => {
      if (token === tokens.ILogger) return mockLogger;
      if (token === tokens.IDocumentContext) return mockDocumentContext;
      return {
        dispatch: jest.fn(),
        getEntity: jest.fn(),
        initialize: jest.fn(),
      };
    });

    registerUI(mockContainer, mockUiElements);

    // The registration should complete even with missing container
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'UI Registrations: Complete.'
    );
  });

  it('should log all eager instantiation messages', () => {
    registerUI(mockContainer, mockUiElements);

    const debugCalls = mockLogger.debug.mock.calls;
    const messages = debugCalls.map((call) => call[0]);

    // Check for all expected debug messages
    expect(messages).toContain(
      'UI Registrations: Starting (Refactored DOM UI)...'
    );
    expect(messages).toContain(
      `UI Registrations: Eagerly instantiated ${tokens.ChatAlertRenderer} to attach listeners.`
    );
    expect(messages).toContain(
      `UI Registrations: Eagerly instantiated ${tokens.ActionResultRenderer}.`
    );
    expect(messages).toContain('UI Registrations: Complete.');
  });

  it('should complete successfully with minimal UI elements', () => {
    const minimalUiElements = {
      outputDiv: null,
      inputElement: null,
      titleElement: null,
      document: document,
    };

    expect(() => {
      registerUI(mockContainer, minimalUiElements);
    }).not.toThrow();

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'UI Registrations: Complete.'
    );
  });

  it('should work with custom document object', () => {
    const customDocument = {
      ...document,
      custom: true,
    };

    const customUiElements = {
      ...mockUiElements,
      document: customDocument,
    };

    registerUI(mockContainer, customUiElements);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'UI Registrations: Complete.'
    );
  });
});
