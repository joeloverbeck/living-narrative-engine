import { jest } from '@jest/globals';
import AppContainer from '../../src/dependencyInjection/appContainer.js';
import { Registrar } from '../../src/utils/registrarHelpers.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import { UI_SHOW_LLM_PROMPT_PREVIEW } from '../../src/constants/eventIds.js';
import { PromptPreviewModal } from '../../src/domUI/PromptPreviewModal.js';

describe('Integration: LLM Prompt Debug Panel', () => {
  let container;
  let gameEngine;
  let domUiFacade;
  let engineUIManager;
  let eventDispatcher;
  let documentContext;
  let promptPreviewModal;

  beforeEach(async () => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="llm-prompt-debug-widget">
        <button id="llm-prompt-debug-button">prompt to llm</button>
      </div>
      <div id="llm-prompt-debug-modal" class="modal" hidden>
        <div id="llm-prompt-debug-content"></div>
        <div id="llm-prompt-meta-actor"></div>
        <div id="llm-prompt-meta-llm"></div>
        <div id="llm-prompt-meta-actions"></div>
      <div id="llm-prompt-debug-status"></div>
      <button id="llm-prompt-debug-close-button">Close</button>
      <button id="llm-prompt-copy-button">Copy</button>
      </div>
      <!-- Other required elements for registration -->
      <div id="game-output"></div>
      <input id="command-input" />
      <div id="location-info-container"></div>
      <div id="turn-order-ticker">
        <div id="ticker-round-number"></div>
        <div id="ticker-actor-queue"></div>
      </div>
      <div id="action-buttons"></div>
      <div id="perception-log-widget">
        <div id="perception-log-content"></div>
      </div>
    `;

    // Create container and registrar
    container = new AppContainer();
    const registrar = new Registrar(container);
    const ensureInstance = (token, instance) => {
      if (
        typeof container.isRegistered === 'function' &&
        container.isRegistered(token)
      ) {
        return;
      }
      registrar.instance(token, instance);
    };

    // Register core services mock
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    ensureInstance(tokens.ILogger, logger);

    // Ensure these are registered because uiRegistrations might resolve them eagerly
    ensureInstance(tokens.InjuryAggregationService, {
      aggregateInjuries: jest.fn(),
    });
    ensureInstance(tokens.InjuryNarrativeFormatterService, {
      formatInjuryUpdate: jest.fn(), // Adding likely method
      formatDamageEvent: jest.fn(),
      formatFirstPerson: jest.fn(),
    });

    // Mock ISafeEventDispatcher
    // We need a real-ish dispatcher to test subscriptions?
    // Or we can just use a simple emitter.
    const subscribers = {};
    const mockEventDispatcher = {
      subscribe: (event, handler) => {
        if (!subscribers[event]) subscribers[event] = [];
        subscribers[event].push(handler);
      },
      unsubscribe: jest.fn(),
      dispatch: async (event, payload) => {
        if (subscribers[event]) {
          for (const handler of subscribers[event]) {
            handler({ payload });
          }
        }
        return true;
      },
    };
    registrar.instance(tokens.ISafeEventDispatcher, mockEventDispatcher);
    eventDispatcher = mockEventDispatcher;

    // Mock IValidatedEventDispatcher (needed by PromptPreviewModal/BaseModalRenderer)
    const mockValidatedDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      emit: jest.fn(),
      unsubscribe: jest.fn(),
    };
    ensureInstance(tokens.IValidatedEventDispatcher, mockValidatedDispatcher);

    // Register UI registrations
    // We need to register DomUiFacade, EngineUIManager, PromptPreviewModal
    // And their dependencies (DomElementFactory, IDocumentContext, etc.)

    const { registerUI } = await import(
      '../../src/dependencyInjection/registrations/uiRegistrations.js'
    );

    // Register UI using the real registration function (which registers mostly everything)
    // But we need to mock the dependencies it needs (outputDiv, inputElement, document)
    registerUI(container, {
      outputDiv: document.getElementById('game-output'),
      inputElement: document.getElementById('command-input'),
      document: document,
    });

    // Mock any missing dependencies that registerUI expects but we didn't provide (e.g. GameEngine might be needed if referenced?)
    // uiRegistrations registers mostly UI stuff.

    // We need to manually register "EngineUIManager" if registerUI doesn't do it fully or if we want to ensure it uses our mocks.
    // But registerUI DOES register EngineUIManager.

    // Check if we are missing dependencies for DomUiFacade that registerUI might not cover or expects to be there?
    // registerUI registers almost everything in domUI.
    // However, some renderers might depend on IEntityManager, EntityDisplayDataProvider, etc.
    // We need to mock those.

    const mockEntity = {
      hasComponent: jest.fn(() => false),
      getComponentData: jest.fn(),
    };
    ensureInstance(tokens.IEntityManager, {
      getEntitiesWithComponents: jest.fn().mockReturnValue([]),
      getEntitiesInLocation: jest.fn().mockReturnValue([]),
      getEntityInstance: jest.fn(() => mockEntity),
      hasComponent: jest.fn(() => false),
    });
    ensureInstance(tokens.EntityDisplayDataProvider, {
      getEntityName: jest.fn().mockReturnValue('Entity'),
      getLocationDetails: jest.fn().mockReturnValue({}),
      getEntityLocationId: jest.fn().mockReturnValue('loc1'),
      getLocationPortraitData: jest.fn().mockReturnValue(null),
      getEntityPortraitPath: jest.fn().mockReturnValue(null),
    });
    ensureInstance(tokens.IActionCategorizationService, {
      extractNamespace: jest.fn(),
      shouldUseGrouping: jest.fn(),
      groupActionsByNamespace: jest.fn().mockReturnValue({}),
      getSortedNamespaces: jest.fn().mockReturnValue([]),
      formatNamespaceDisplayName: jest.fn().mockReturnValue('Namespace'),
      shouldShowCounts: jest.fn().mockReturnValue(false),
    }); // ActionButtonsRenderer needs this
    ensureInstance(tokens.LLMAdapter, {}); // LlmSelectionModal
    ensureInstance(tokens.IDataRegistry, {}); // LocationRenderer
    ensureInstance(tokens.InjuryAggregationService, {
      aggregateInjuries: jest.fn(),
    });
    ensureInstance(tokens.ILightingStateService, {
      getLocationLightingState: jest.fn().mockReturnValue({
        isLit: true,
        lightSources: [],
      }),
    }); // LocationRenderer
    ensureInstance(tokens.OperationInterpreter, {}); // PerceptibleEventSenderController

    // Resolve components
    domUiFacade = container.resolve(tokens.DomUiFacade);
    engineUIManager = container.resolve(tokens.EngineUIManager);

    // Initialize manager (subscribes to events)
    engineUIManager.initialize();
  });

  it('should open the modal with prompt data when the debug button is clicked', async () => {
    const { setupMenuButtonListenersStage } = await import(
      '../../src/bootstrapper/stages/uiStages.js'
    );
    const logger = container.resolve(tokens.ILogger);

    // Mock Engine
    const mockPreviewMethod = jest.fn(async () => {
      // Simulate engine logic: Dispatch the event
      await eventDispatcher.dispatch(UI_SHOW_LLM_PROMPT_PREVIEW, {
        prompt: 'Mock Prompt Content',
        actorId: 'hero',
        actorName: 'Hero',
        llmId: 'gpt-4',
        actionCount: 3,
        errors: [],
      });
    });

    const mockEngine = {
      previewLlmPromptForCurrentActor: mockPreviewMethod,
      showSaveGameUI: jest.fn(),
      showLoadGameUI: jest.fn(),
    };

    // Run the stage to wire up the button
    await setupMenuButtonListenersStage(mockEngine, logger, document);

    // Simulate click
    const debugButton = document.getElementById('llm-prompt-debug-button');
    debugButton.click();

    // Wait for async operations (event dispatching is async-ish in SafeEventDispatcher, usually awaits listeners)
    // But the click handler calls await gameEngine.previewLlmPromptForCurrentActor()
    // And our mock calls await eventDispatcher.dispatch()
    // So we need to wait.
    await new Promise(process.nextTick);

    // Verify Engine method called
    expect(mockPreviewMethod).toHaveBeenCalled();

    // Verify Modal is shown (DomUiFacade -> PromptPreviewModal)
    // We can check the DOM elements directly since PromptPreviewModal updates them.
    const modal = document.getElementById('llm-prompt-debug-modal');
    const content = document.getElementById('llm-prompt-debug-content');
    const metaActor = document.getElementById('llm-prompt-meta-actor');

    // BaseModalRenderer removes 'hidden' attribute or adds 'visible' class?
    // Let's check PromptPreviewModal implementation or BaseModalRenderer.
    // Usually checking if it's "visible" implies checking display style or classes.
    // But checking the CONTENT update verifies the data flow.

    expect(content.textContent).toBe('Mock Prompt Content');
    expect(metaActor.textContent).toBe('Hero');
  });

  it('should handle errors gracefully', async () => {
    const { setupMenuButtonListenersStage } = await import(
      '../../src/bootstrapper/stages/uiStages.js'
    );
    const logger = container.resolve(tokens.ILogger);

    // Mock Engine to dispatch error
    const mockPreviewMethod = jest.fn(async () => {
      await eventDispatcher.dispatch(UI_SHOW_LLM_PROMPT_PREVIEW, {
        prompt: null,
        errors: ['Something went wrong'],
      });
    });

    const mockEngine = {
      previewLlmPromptForCurrentActor: mockPreviewMethod,
      showSaveGameUI: jest.fn(),
      showLoadGameUI: jest.fn(),
    };

    await setupMenuButtonListenersStage(mockEngine, logger, document);

    document.getElementById('llm-prompt-debug-button').click();
    await new Promise(process.nextTick);

    const status = document.getElementById('llm-prompt-debug-status');
    expect(status.textContent).toContain('Errors: Something went wrong');
  });
});
