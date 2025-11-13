// tests/unit/dependencyInjection/registrations/uiRegistrations.registerRenderers.test.js
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { registerRenderers } from '../../../../src/dependencyInjection/registrations/uiRegistrations.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';

// Mock the registerWithLog helper
jest.mock('../../../../src/utils/registrarHelpers.js', () => ({
  registerWithLog: jest.fn(),
  Registrar: jest.fn(),
}));

// Mock all the renderer classes
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
}));

jest.mock('../../../../src/domUI/portraitModalRenderer.js', () => ({
  PortraitModalRenderer: jest.fn(),
}));

jest.mock('../../../../src/domUI/saveGameUI.js', () => jest.fn());
jest.mock('../../../../src/domUI/loadGameUI.js', () => jest.fn());

describe('registerRenderers', () => {
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

  it('should register SpeechBubbleRenderer with correct dependencies', () => {
    registerRenderers(mockRegistrar, mockLogger);

    expect(mockRegisterWithLog).toHaveBeenCalledWith(
      mockRegistrar,
      tokens.SpeechBubbleRenderer,
      expect.any(Function),
      {
        lifecycle: 'singleton',
        dependencies: [
          tokens.ILogger,
          tokens.IDocumentContext,
          tokens.IValidatedEventDispatcher,
          tokens.IEntityManager,
          tokens.DomElementFactory,
          tokens.EntityDisplayDataProvider,
          tokens.PortraitModalRenderer,
        ],
      },
      mockLogger
    );
  });

  describe('PortraitModalRenderer factory', () => {
    it('should register PortraitModalRenderer as singleton factory', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const portraitModalCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.PortraitModalRenderer
      );

      expect(portraitModalCall).toBeDefined();
      expect(portraitModalCall[3].lifecycle).toBe('singletonFactory');
    });

    it('should create PortraitModalRenderer with correct dependencies', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const portraitModalCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.PortraitModalRenderer
      );

      const factory = portraitModalCall[2];
      const mockContainer = {
        resolve: jest.fn((token) => {
          const mocks = {
            [tokens.ILogger]: mockLogger,
            [tokens.IDocumentContext]: { query: jest.fn() },
            [tokens.IValidatedEventDispatcher]: { dispatch: jest.fn() },
            [tokens.DomElementFactory]: { createElement: jest.fn() },
          };
          return mocks[token] || jest.fn();
        }),
      };

      const MockPortraitModalRenderer =
        require('../../../../src/domUI/portraitModalRenderer.js').PortraitModalRenderer;
      const result = factory(mockContainer);

      expect(MockPortraitModalRenderer).toHaveBeenCalledWith({
        documentContext: expect.any(Object),
        domElementFactory: expect.any(Object),
        logger: mockLogger,
        validatedEventDispatcher: expect.any(Object),
      });
    });
  });


  describe('LocationRenderer factory', () => {
    it('should register LocationRenderer as singleton factory', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const locationRendererCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.LocationRenderer
      );

      expect(locationRendererCall).toBeDefined();
      expect(locationRendererCall[3].lifecycle).toBe('singletonFactory');
    });

    it('should warn when location container element is not found', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const locationRendererCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.LocationRenderer
      );

      const factory = locationRendererCall[2];
      const mockContainer = {
        resolve: jest.fn((token) => {
          const mocks = {
            [tokens.ILogger]: mockLogger,
            [tokens.IDocumentContext]: {
              query: jest.fn().mockReturnValue(null),
            },
            [tokens.ISafeEventDispatcher]: { dispatch: jest.fn() },
            [tokens.DomElementFactory]: { createElement: jest.fn() },
            [tokens.IEntityManager]: { getEntity: jest.fn() },
            [tokens.EntityDisplayDataProvider]: { getDisplayData: jest.fn() },
            [tokens.IDataRegistry]: { getData: jest.fn() },
          };
          return mocks[token] || jest.fn();
        }),
      };

      const MockLocationRenderer =
        require('../../../../src/domUI/index.js').LocationRenderer;
      const result = factory(mockContainer);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        `UI Registrations: Could not find '#location-info-container' element for LocationRenderer. Location details may not render.`
      );
      expect(MockLocationRenderer).toHaveBeenCalled();
    });

    it('should create LocationRenderer with container element when found', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const locationRendererCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.LocationRenderer
      );

      const factory = locationRendererCall[2];
      const mockLocationContainer = document.createElement('div');
      const mockContainer = {
        resolve: jest.fn((token) => {
          const mocks = {
            [tokens.ILogger]: mockLogger,
            [tokens.IDocumentContext]: {
              query: jest.fn().mockReturnValue(mockLocationContainer),
            },
            [tokens.ISafeEventDispatcher]: { dispatch: jest.fn() },
            [tokens.DomElementFactory]: { createElement: jest.fn() },
            [tokens.IEntityManager]: { getEntity: jest.fn() },
            [tokens.EntityDisplayDataProvider]: { getDisplayData: jest.fn() },
            [tokens.IDataRegistry]: { getData: jest.fn() },
          };
          return mocks[token] || jest.fn();
        }),
      };

      const MockLocationRenderer =
        require('../../../../src/domUI/index.js').LocationRenderer;
      const result = factory(mockContainer);

      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(MockLocationRenderer).toHaveBeenCalledWith({
        logger: mockLogger,
        documentContext: expect.any(Object),
        safeEventDispatcher: expect.any(Object),
        domElementFactory: expect.any(Object),
        entityManager: expect.any(Object),
        entityDisplayDataProvider: expect.any(Object),
        dataRegistry: expect.any(Object),
        containerElement: mockLocationContainer,
      });
    });
  });

  describe('ActionButtonsRenderer factory', () => {
    it('should register ActionButtonsRenderer as singleton factory', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const actionButtonsCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.ActionButtonsRenderer
      );

      expect(actionButtonsCall).toBeDefined();
      expect(actionButtonsCall[3].lifecycle).toBe('singletonFactory');
    });

    it('should create ActionButtonsRenderer with correct dependencies', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const actionButtonsCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.ActionButtonsRenderer
      );

      const factory = actionButtonsCall[2];
      const mockContainer = {
        resolve: jest.fn((token) => {
          const mocks = {
            [tokens.ILogger]: mockLogger,
            [tokens.IDocumentContext]: { query: jest.fn() },
            [tokens.IValidatedEventDispatcher]: { dispatch: jest.fn() },
            [tokens.DomElementFactory]: { createElement: jest.fn() },
            [tokens.IActionCategorizationService]: { categorize: jest.fn() },
          };
          return mocks[token] || jest.fn();
        }),
      };

      const MockActionButtonsRenderer =
        require('../../../../src/domUI/index.js').ActionButtonsRenderer;
      const result = factory(mockContainer);

      expect(MockActionButtonsRenderer).toHaveBeenCalledWith({
        logger: mockLogger,
        documentContext: expect.any(Object),
        validatedEventDispatcher: expect.any(Object),
        domElementFactory: expect.any(Object),
        actionButtonsContainerSelector: '#action-buttons',
        sendButtonSelector: '#player-confirm-turn-button',
        actionCategorizationService: expect.any(Object),
      });
    });
  });

  describe('PerceptionLogRenderer factory', () => {
    it('should register PerceptionLogRenderer as singleton factory', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const perceptionLogCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.PerceptionLogRenderer
      );

      expect(perceptionLogCall).toBeDefined();
      expect(perceptionLogCall[3].lifecycle).toBe('singletonFactory');
    });

    it('should create PerceptionLogRenderer with correct dependencies', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const perceptionLogCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.PerceptionLogRenderer
      );

      const factory = perceptionLogCall[2];
      const mockContainer = {
        resolve: jest.fn((token) => {
          const mocks = {
            [tokens.ILogger]: mockLogger,
            [tokens.IDocumentContext]: { query: jest.fn() },
            [tokens.IValidatedEventDispatcher]: { dispatch: jest.fn() },
            [tokens.DomElementFactory]: { createElement: jest.fn() },
            [tokens.IEntityManager]: { getEntity: jest.fn() },
          };
          return mocks[token] || jest.fn();
        }),
      };

      const MockPerceptionLogRenderer =
        require('../../../../src/domUI/index.js').PerceptionLogRenderer;
      const result = factory(mockContainer);

      expect(MockPerceptionLogRenderer).toHaveBeenCalledWith({
        logger: mockLogger,
        documentContext: expect.any(Object),
        validatedEventDispatcher: expect.any(Object),
        domElementFactory: expect.any(Object),
        entityManager: expect.any(Object),
      });
    });
  });

  describe('SaveGameService factory', () => {
    it('should register SaveGameService as singleton factory', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const saveGameServiceCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.SaveGameService
      );

      expect(saveGameServiceCall).toBeDefined();
      expect(saveGameServiceCall[3].lifecycle).toBe('singletonFactory');
    });

    it('should create SaveGameService with correct dependencies', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const saveGameServiceCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.SaveGameService
      );

      const factory = saveGameServiceCall[2];
      const mockContainer = {
        resolve: jest.fn((token) => {
          const mocks = {
            [tokens.ILogger]: mockLogger,
            [tokens.IUserPrompt]: { prompt: jest.fn() },
          };
          return mocks[token] || jest.fn();
        }),
      };

      const MockSaveGameService =
        require('../../../../src/domUI/index.js').SaveGameService;
      const result = factory(mockContainer);

      expect(MockSaveGameService).toHaveBeenCalledWith({
        logger: mockLogger,
        userPrompt: expect.any(Object),
      });
    });
  });

  describe('SaveGameUI factory', () => {
    it('should register SaveGameUI as singleton factory', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const saveGameUICall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.SaveGameUI
      );

      expect(saveGameUICall).toBeDefined();
      expect(saveGameUICall[3].lifecycle).toBe('singletonFactory');
    });

    it('should create SaveGameUI with correct dependencies', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const saveGameUICall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.SaveGameUI
      );

      const factory = saveGameUICall[2];
      const mockContainer = {
        resolve: jest.fn((token) => {
          const mocks = {
            [tokens.ILogger]: mockLogger,
            [tokens.IDocumentContext]: { query: jest.fn() },
            [tokens.DomElementFactory]: { createElement: jest.fn() },
            [tokens.ISaveLoadService]: { save: jest.fn() },
            [tokens.IValidatedEventDispatcher]: { dispatch: jest.fn() },
            [tokens.SaveGameService]: { save: jest.fn() },
          };
          return mocks[token] || jest.fn();
        }),
      };

      const MockSaveGameUI = require('../../../../src/domUI/saveGameUI.js');
      const result = factory(mockContainer);

      expect(MockSaveGameUI).toHaveBeenCalledWith({
        logger: mockLogger,
        documentContext: expect.any(Object),
        domElementFactory: expect.any(Object),
        saveLoadService: expect.any(Object),
        validatedEventDispatcher: expect.any(Object),
        saveGameService: expect.any(Object),
      });
    });
  });

  describe('LoadGameUI factory', () => {
    it('should register LoadGameUI as singleton factory', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const loadGameUICall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.LoadGameUI
      );

      expect(loadGameUICall).toBeDefined();
      expect(loadGameUICall[3].lifecycle).toBe('singletonFactory');
    });

    it('should create LoadGameUI with correct dependencies', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const loadGameUICall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.LoadGameUI
      );

      const factory = loadGameUICall[2];
      const mockContainer = {
        resolve: jest.fn((token) => {
          const mocks = {
            [tokens.ILogger]: mockLogger,
            [tokens.IDocumentContext]: { query: jest.fn() },
            [tokens.DomElementFactory]: { createElement: jest.fn() },
            [tokens.ISaveLoadService]: { load: jest.fn() },
            [tokens.IValidatedEventDispatcher]: { dispatch: jest.fn() },
            [tokens.IUserPrompt]: { prompt: jest.fn() },
          };
          return mocks[token] || jest.fn();
        }),
      };

      const MockLoadGameUI = require('../../../../src/domUI/loadGameUI.js');
      const result = factory(mockContainer);

      expect(MockLoadGameUI).toHaveBeenCalledWith({
        logger: mockLogger,
        documentContext: expect.any(Object),
        domElementFactory: expect.any(Object),
        saveLoadService: expect.any(Object),
        validatedEventDispatcher: expect.any(Object),
        userPrompt: expect.any(Object),
      });
    });
  });

  describe('LlmSelectionModal factory', () => {
    it('should register LlmSelectionModal as singleton factory', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const llmSelectionCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.LlmSelectionModal
      );

      expect(llmSelectionCall).toBeDefined();
      expect(llmSelectionCall[3].lifecycle).toBe('singletonFactory');
    });

    it('should create LlmSelectionModal with correct dependencies', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const llmSelectionCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.LlmSelectionModal
      );

      const factory = llmSelectionCall[2];
      const mockContainer = {
        resolve: jest.fn((token) => {
          const mocks = {
            [tokens.ILogger]: mockLogger,
            [tokens.IDocumentContext]: { query: jest.fn() },
            [tokens.DomElementFactory]: { createElement: jest.fn() },
            [tokens.LLMAdapter]: { sendRequest: jest.fn() },
            [tokens.IValidatedEventDispatcher]: { dispatch: jest.fn() },
          };
          return mocks[token] || jest.fn();
        }),
      };

      const MockLlmSelectionModal =
        require('../../../../src/domUI/index.js').LlmSelectionModal;
      const result = factory(mockContainer);

      expect(MockLlmSelectionModal).toHaveBeenCalledWith({
        logger: mockLogger,
        documentContext: expect.any(Object),
        domElementFactory: expect.any(Object),
        llmAdapter: expect.any(Object),
        validatedEventDispatcher: expect.any(Object),
      });
    });
  });

  describe('CurrentTurnActorRenderer factory', () => {
    it('should register CurrentTurnActorRenderer as singleton factory', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const currentTurnActorCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.CurrentTurnActorRenderer
      );

      expect(currentTurnActorCall).toBeDefined();
      expect(currentTurnActorCall[3].lifecycle).toBe('singletonFactory');
    });

    it('should create CurrentTurnActorRenderer with correct dependencies', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const currentTurnActorCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.CurrentTurnActorRenderer
      );

      const factory = currentTurnActorCall[2];
      const mockContainer = {
        resolve: jest.fn((token) => {
          const mocks = {
            [tokens.ILogger]: mockLogger,
            [tokens.IDocumentContext]: { query: jest.fn() },
            [tokens.IValidatedEventDispatcher]: { dispatch: jest.fn() },
            [tokens.IEntityManager]: { getEntity: jest.fn() },
            [tokens.EntityDisplayDataProvider]: { getDisplayData: jest.fn() },
          };
          return mocks[token] || jest.fn();
        }),
      };

      const MockCurrentTurnActorRenderer =
        require('../../../../src/domUI/index.js').CurrentTurnActorRenderer;
      const result = factory(mockContainer);

      expect(MockCurrentTurnActorRenderer).toHaveBeenCalledWith({
        logger: mockLogger,
        documentContext: expect.any(Object),
        validatedEventDispatcher: expect.any(Object),
        entityManager: expect.any(Object),
        entityDisplayDataProvider: expect.any(Object),
      });
    });
  });

  describe('ChatAlertRenderer factory', () => {
    it('should register ChatAlertRenderer as singleton factory', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const chatAlertCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.ChatAlertRenderer
      );

      expect(chatAlertCall).toBeDefined();
      expect(chatAlertCall[3].lifecycle).toBe('singletonFactory');
    });

    it('should create ChatAlertRenderer with correct dependencies', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const chatAlertCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.ChatAlertRenderer
      );

      const factory = chatAlertCall[2];
      const mockContainer = {
        resolve: jest.fn((token) => {
          const mocks = {
            [tokens.ILogger]: mockLogger,
            [tokens.IDocumentContext]: { query: jest.fn() },
            [tokens.ISafeEventDispatcher]: { dispatch: jest.fn() },
            [tokens.DomElementFactory]: { createElement: jest.fn() },
            [tokens.AlertRouter]: { route: jest.fn() },
          };
          return mocks[token] || jest.fn();
        }),
      };

      const MockChatAlertRenderer =
        require('../../../../src/domUI/index.js').ChatAlertRenderer;
      const result = factory(mockContainer);

      expect(MockChatAlertRenderer).toHaveBeenCalledWith({
        logger: mockLogger,
        documentContext: expect.any(Object),
        safeEventDispatcher: expect.any(Object),
        domElementFactory: expect.any(Object),
        alertRouter: expect.any(Object),
      });
    });
  });

  describe('ActionResultRenderer factory', () => {
    it('should register ActionResultRenderer as singleton factory', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const actionResultCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.ActionResultRenderer
      );

      expect(actionResultCall).toBeDefined();
      expect(actionResultCall[3].lifecycle).toBe('singletonFactory');
    });

    it('should create ActionResultRenderer with correct dependencies', () => {
      registerRenderers(mockRegistrar, mockLogger);

      const actionResultCall = mockRegisterWithLog.mock.calls.find(
        (call) => call[1] === tokens.ActionResultRenderer
      );

      const factory = actionResultCall[2];
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

      const MockActionResultRenderer =
        require('../../../../src/domUI/index.js').ActionResultRenderer;
      const result = factory(mockContainer);

      expect(MockActionResultRenderer).toHaveBeenCalledWith({
        logger: mockLogger,
        documentContext: expect.any(Object),
        safeEventDispatcher: expect.any(Object),
        domElementFactory: expect.any(Object),
      });
    });
  });

  it('should register all renderers', () => {
    registerRenderers(mockRegistrar, mockLogger);

    // Count total registrations (TitleRenderer removed, TurnOrderTickerRenderer added)
    expect(mockRegisterWithLog).toHaveBeenCalledTimes(13);

    // Verify all tokens were registered
    const registeredTokens = mockRegisterWithLog.mock.calls.map(
      (call) => call[1]
    );
    expect(registeredTokens).toContain(tokens.PortraitModalRenderer);
    expect(registeredTokens).toContain(tokens.SpeechBubbleRenderer);
    expect(registeredTokens).toContain(tokens.LocationRenderer);
    expect(registeredTokens).toContain(tokens.ActionButtonsRenderer);
    expect(registeredTokens).toContain(tokens.PerceptionLogRenderer);
    expect(registeredTokens).toContain(tokens.SaveGameService);
    expect(registeredTokens).toContain(tokens.SaveGameUI);
    expect(registeredTokens).toContain(tokens.LoadGameUI);
    expect(registeredTokens).toContain(tokens.LlmSelectionModal);
    expect(registeredTokens).toContain(tokens.CurrentTurnActorRenderer);
    expect(registeredTokens).toContain(tokens.ChatAlertRenderer);
    expect(registeredTokens).toContain(tokens.ActionResultRenderer);
    expect(registeredTokens).toContain(tokens.TurnOrderTickerRenderer);
  });
});
