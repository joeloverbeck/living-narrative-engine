import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import { ActionButtonsRenderer } from '../../../src/domUI/actionButtonsRenderer.js';
import DocumentContext from '../../../src/domUI/documentContext.js';
import DomElementFactory from '../../../src/domUI/domElementFactory.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { LLM_SUGGESTED_ACTION_ID } from '../../../src/constants/eventIds.js';

// Mock dependencies
jest.mock('../../../src/logging/consoleLogger.js');
jest.mock('../../../src/events/validatedEventDispatcher.js');
jest.mock('../../../src/domUI/domElementFactory.js');

describe('ActionButtonsRenderer Supplemental Coverage', () => {
  let dom;
  let document;
  let docContext;
  let mockLogger;
  let mockVed;
  let mockDomElementFactoryInstance;
  let actionButtonsContainerElement;
  let sendButtonElement;
  let speechInputElement;

  const ACTION_BUTTONS_CONTAINER_SELECTOR = '#action-buttons';
  const SEND_BUTTON_SELECTOR = '#player-confirm-turn-button';
  const SPEECH_INPUT_SELECTOR = '#speech-input';
  const UPDATE_ACTIONS_EVENT_TYPE = 'core:update_available_actions';

  beforeEach(() => {
    dom = new JSDOM(
      `<!DOCTYPE html><html><body><div id="game-container"><div id="action-buttons"></div><button id="player-confirm-turn-button"></button><input type="text" id="speech-input" /></div></body></html>`
    );
    document = dom.window.document;
    global.document = document;
    global.window = dom.window;
    global.HTMLElement = dom.window.HTMLElement;
    global.HTMLButtonElement = dom.window.HTMLButtonElement;
    global.HTMLInputElement = dom.window.HTMLInputElement;

    docContext = new DocumentContext(document);
    actionButtonsContainerElement = document.getElementById('action-buttons');
    sendButtonElement = document.getElementById('player-confirm-turn-button');
    speechInputElement = document.getElementById('speech-input');

    mockLogger = new ConsoleLogger();
    mockVed = new ValidatedEventDispatcher({});

    mockDomElementFactoryInstance = new DomElementFactory(docContext);
    mockDomElementFactoryInstance.button.mockImplementation((text, cls) => {
      const btn = document.createElement('button');
      btn.textContent = text;
      if (cls) btn.className = cls;
      return btn;
    });
    mockDomElementFactoryInstance.create.mockImplementation((tagName) =>
      document.createElement(tagName)
    );

    const actualUnsubscribeFn = jest.fn();
    mockVed.subscribe.mockReturnValue(actualUnsubscribeFn);
    mockVed.dispatch.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.document;
    delete global.window;
    delete global.HTMLElement;
    delete global.HTMLButtonElement;
    delete global.HTMLInputElement;
  });

  const mockActionCategorizationService = {
    extractNamespace: jest.fn().mockReturnValue('core'),
    shouldUseGrouping: jest.fn().mockReturnValue(false),
    groupActionsByNamespace: jest.fn().mockReturnValue(new Map()),
    getSortedNamespaces: jest.fn().mockReturnValue([]),
    formatNamespaceDisplayName: jest.fn().mockImplementation((n) => n),
    shouldShowCounts: jest.fn().mockReturnValue(false),
  };

  const createRenderer = (config = {}) => {
    return new ActionButtonsRenderer({
      logger: mockLogger,
      documentContext: docContext,
      validatedEventDispatcher: mockVed,
      domElementFactory: mockDomElementFactoryInstance,
      actionButtonsContainerSelector: ACTION_BUTTONS_CONTAINER_SELECTOR,
      sendButtonSelector: SEND_BUTTON_SELECTOR,
      speechInputSelector: SPEECH_INPUT_SELECTOR,
      actionCategorizationService: mockActionCategorizationService,
      ...config,
    });
  };

  describe('Visual Properties Logging', () => {
    it('should log actions with visual properties', async () => {
      const renderer = createRenderer();
      const handler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === UPDATE_ACTIONS_EVENT_TYPE
      )[1];

      const actions = [
        {
          index: 1,
          actionId: 'core:test',
          commandString: 'Test',
          description: 'Desc',
          params: {},
          visual: { backgroundColor: 'red' },
        },
      ];

      await handler({
        type: UPDATE_ACTIONS_EVENT_TYPE,
        payload: { actorId: 'player', actions },
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[ActionButtonsRenderer] Actions with visual properties:',
        expect.objectContaining({
          total: 1,
          withVisualProps: 1,
          visualDetails: expect.arrayContaining([
            expect.objectContaining({
              actionId: 'core:test',
              visual: { backgroundColor: 'red' },
            }),
          ]),
        })
      );
    });

    it('should log when no actions have visual properties', async () => {
      const renderer = createRenderer();
      const handler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === UPDATE_ACTIONS_EVENT_TYPE
      )[1];

      const actions = [
        {
          index: 1,
          actionId: 'core:test',
          commandString: 'Test',
          description: 'Desc',
          params: {},
          visual: null,
        },
      ];

      await handler({
        type: UPDATE_ACTIONS_EVENT_TYPE,
        payload: { actorId: 'player', actions },
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[ActionButtonsRenderer] No actions have defined visual properties in this update',
        expect.objectContaining({
          total: 1,
          withNullVisual: 1,
          missingVisual: 0,
        })
      );
    });
  });

  describe('LLM Suggestion Callout', () => {
    it('should use suggestion descriptor if provided', async () => {
      const renderer = createRenderer();
      const handler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === LLM_SUGGESTED_ACTION_ID
      )[1];

      // Need to set currentActorId first via update actions
      const updateHandler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === UPDATE_ACTIONS_EVENT_TYPE
      )[1];
      await updateHandler({
        type: UPDATE_ACTIONS_EVENT_TYPE,
        payload: {
          actorId: 'player',
          actions: [
            {
              index: 1,
              actionId: 'core:wait',
              commandString: 'Wait',
              description: 'Wait here',
              params: {},
            },
          ],
        },
      });

      await handler({
        payload: {
          actorId: 'player',
          suggestedIndex: 1,
          suggestedActionDescriptor: 'Try waiting patiently',
        },
      });

      const callout = document.querySelector(
        '.llm-suggestion-callout .llm-suggestion-body'
      );
      expect(callout.textContent).toBe('Try waiting patiently');
    });

    it('should warn and abort if callout elements cannot be created', async () => {
      const renderer = createRenderer();

      // Mock create to return null specifically for suggestion callout elements
      jest.spyOn(docContext, 'create').mockImplementation((tagName) => {
        return null;
      });

      // Set actor ID
      const updateHandler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === UPDATE_ACTIONS_EVENT_TYPE
      )[1];
      await updateHandler({
        type: UPDATE_ACTIONS_EVENT_TYPE,
        payload: { actorId: 'player', actions: [] },
      });

      const handler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === LLM_SUGGESTED_ACTION_ID
      )[1];
      await handler({
        payload: {
          actorId: 'player',
          suggestedIndex: 1,
        },
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Unable to render suggestion callout because required elements could not be created.'
        )
      );
    });
  });

  describe('Theme Handling', () => {
    it('should handle THEME_CHANGED event', async () => {
      const renderer = createRenderer();
      const handler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === 'THEME_CHANGED'
      )[1];

      // Render some buttons first
      const updateHandler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === UPDATE_ACTIONS_EVENT_TYPE
      )[1];
      await updateHandler({
        type: UPDATE_ACTIONS_EVENT_TYPE,
        payload: {
          actorId: 'player',
          actions: [
            {
              index: 1,
              actionId: 'core:test',
              commandString: 'Test',
              description: 'Desc',
              params: {},
            },
          ],
        },
      });

      const button = actionButtonsContainerElement.querySelector('button');
      expect(button).toBeTruthy();

      // Change theme
      await handler({
        payload: {
          newTheme: 'dark',
          previousTheme: 'light',
        },
      });

      expect(button.classList.contains('theme-dark-adapted')).toBe(true);
      expect(button.classList.contains('theme-light-adapted')).toBe(false);
      expect(button.style.getPropertyValue('--current-theme')).toBe('dark');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Applied theme 'dark' to 1 buttons")
      );
    });

    it('should warn on invalid THEME_CHANGED payload', async () => {
      const renderer = createRenderer();
      const handler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === 'THEME_CHANGED'
      )[1];

      await handler({
        payload: {
          // Missing newTheme
        },
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Received THEME_CHANGED event with invalid newTheme'
        ),
        expect.anything()
      );
    });

    it('should abort theme application if list container is missing', async () => {
      const renderer = createRenderer();
      const handler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === 'THEME_CHANGED'
      )[1];

      // Remove container
      renderer.elements.listContainerElement = null;

      await handler({
        payload: {
          newTheme: 'dark',
        },
      });

      // Should not log the success message
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining("Applied theme 'dark'")
      );
    });
  });

  describe('Contrast Validation', () => {
    it('should warn if contrast is insufficient', async () => {
      const renderer = createRenderer();
      const handler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === UPDATE_ACTIONS_EVENT_TYPE
      )[1];

      // Mock _validateContrast to return false to ensure we hit the warning logic
      // We use spyOn if possible, or just overwrite the property for the instance
      renderer._validateContrast = jest.fn().mockReturnValue(false);

      const actions = [
        {
          index: 1,
          actionId: 'core:test',
          commandString: 'Test',
          description: 'Desc',
          params: {},
          visual: {
            backgroundColor: '#ffffff',
            textColor: '#ffffff',
          },
        },
      ];

      await handler({
        type: UPDATE_ACTIONS_EVENT_TYPE,
        payload: { actorId: 'player', actions },
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('insufficient contrast')
      );

      const button = actionButtonsContainerElement.querySelector('button');
      expect(button.classList.contains('contrast-warning')).toBe(true);
    });
  });

  describe('Suggestion Index Resolution', () => {
    it('should fallback to index 1 if invalid index and no wait action', async () => {
      const renderer = createRenderer();
      const updateHandler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === UPDATE_ACTIONS_EVENT_TYPE
      )[1];
      const suggestionHandler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === LLM_SUGGESTED_ACTION_ID
      )[1];

      // Actions with no 'wait'
      await updateHandler({
        type: UPDATE_ACTIONS_EVENT_TYPE,
        payload: {
          actorId: 'player',
          actions: [
            {
              index: 1,
              actionId: 'core:go',
              commandString: 'Go',
              description: 'Go',
              params: {},
            },
            {
              index: 2,
              actionId: 'core:look',
              commandString: 'Look',
              description: 'Look',
              params: {},
            },
          ],
        },
      });

      // Suggest invalid index (e.g. null/undefined via non-integer)
      await suggestionHandler({
        payload: {
          actorId: 'player',
          suggestedIndex: 'invalid', // Not an integer
        },
      });

      // Should select index 1 (default)
      expect(renderer.selectedAction.index).toBe(1);
    });

    it('should clamp index if out of bounds', async () => {
      const renderer = createRenderer();
      const updateHandler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === UPDATE_ACTIONS_EVENT_TYPE
      )[1];
      const suggestionHandler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === LLM_SUGGESTED_ACTION_ID
      )[1];

      await updateHandler({
        type: UPDATE_ACTIONS_EVENT_TYPE,
        payload: {
          actorId: 'player',
          actions: [
            {
              index: 1,
              actionId: 'core:go',
              commandString: 'Go',
              description: 'Go',
              params: {},
            },
            {
              index: 2,
              actionId: 'core:look',
              commandString: 'Look',
              description: 'Look',
              params: {},
            },
          ],
        },
      });

      // Suggest index 99
      await suggestionHandler({
        payload: {
          actorId: 'player',
          suggestedIndex: 99,
        },
      });

      // Should select index 2 (max)
      expect(renderer.selectedAction.index).toBe(2);
    });

    it('should prioritize wait action if index is invalid', async () => {
      const renderer = createRenderer();
      const updateHandler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === UPDATE_ACTIONS_EVENT_TYPE
      )[1];
      const suggestionHandler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === LLM_SUGGESTED_ACTION_ID
      )[1];

      await updateHandler({
        type: UPDATE_ACTIONS_EVENT_TYPE,
        payload: {
          actorId: 'player',
          actions: [
            {
              index: 1,
              actionId: 'core:go',
              commandString: 'Go',
              description: 'Go',
              params: {},
            },
            {
              index: 2,
              actionId: 'core:wait',
              commandString: 'Wait',
              description: 'Wait',
              params: {},
            },
          ],
        },
      });

      await suggestionHandler({
        payload: {
          actorId: 'player',
          suggestedIndex: -5,
        },
      });

      // Should select wait action (index 2)
      expect(renderer.selectedAction.index).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    it('should re-enable speech input when clearing suggestion', async () => {
      const renderer = createRenderer();
      const updateHandler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === UPDATE_ACTIONS_EVENT_TYPE
      )[1];
      const suggestionHandler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === LLM_SUGGESTED_ACTION_ID
      )[1];

      await updateHandler({
        type: UPDATE_ACTIONS_EVENT_TYPE,
        payload: {
          actorId: 'player',
          actions: [
            {
              index: 1,
              actionId: 'core:go',
              commandString: 'Go',
              description: 'Go',
              params: {},
            },
          ],
        },
      });

      // Suggestion disables input
      await suggestionHandler({
        payload: { actorId: 'player', suggestedIndex: 1 },
      });
      expect(speechInputElement.disabled).toBe(true);

      // Update actions for different actor should clear suggestion and re-enable input
      await updateHandler({
        type: UPDATE_ACTIONS_EVENT_TYPE,
        payload: {
          actorId: 'other-actor',
          actions: [],
        },
      });

      expect(speechInputElement.disabled).toBe(false);
    });

    it('should apply theme when rendering list item', async () => {
      const renderer = createRenderer();

      const themeHandler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === 'THEME_CHANGED'
      )[1];

      const updateHandler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === UPDATE_ACTIONS_EVENT_TYPE
      )[1];

      // Set theme

      await themeHandler({ payload: { newTheme: 'dark' } });

      // Render actions

      await updateHandler({
        type: UPDATE_ACTIONS_EVENT_TYPE,

        payload: {
          actorId: 'player',

          actions: [
            {
              index: 1,
              actionId: 'core:test',
              commandString: 'Test',
              description: 'Desc',
              params: {},
            },
          ],
        },
      });

      const button = actionButtonsContainerElement.querySelector('button');

      expect(button.classList.contains('theme-dark-adapted')).toBe(true);

      expect(button.style.getPropertyValue('--current-theme')).toBe('dark');
    });

    it('should warn and ignore suggestion with invalid actorId', async () => {
      const renderer = createRenderer();

      const suggestionHandler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === LLM_SUGGESTED_ACTION_ID
      )[1];

      await suggestionHandler({
        payload: {
          actorId: '', // Invalid

          suggestedIndex: 1,
        },
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid actorId'),

        expect.anything()
      );
    });

    it('should remove suggestion callout if suggestion comes for different actor', async () => {
      const renderer = createRenderer();

      const updateHandler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === UPDATE_ACTIONS_EVENT_TYPE
      )[1];

      const suggestionHandler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === LLM_SUGGESTED_ACTION_ID
      )[1];

      // Setup initial state with actor 'player'

      await updateHandler({
        type: UPDATE_ACTIONS_EVENT_TYPE,

        payload: {
          actorId: 'player',

          actions: [
            {
              index: 1,
              actionId: 'core:go',
              commandString: 'Go',
              description: 'Go',
              params: {},
            },
          ],
        },
      });

      // Suggestion for 'player' (shows callout)

      await suggestionHandler({
        payload: { actorId: 'player', suggestedIndex: 1 },
      });

      expect(document.querySelector('.llm-suggestion-callout')).toBeTruthy();

      // Suggestion for 'other' (should remove callout)

      // Note: currentActorId is still 'player'

      await suggestionHandler({
        payload: { actorId: 'other', suggestedIndex: 1 },
      });

      expect(document.querySelector('.llm-suggestion-callout')).toBeNull();
    });

    it('should handle suggestion with no resolved action (empty text fallback)', async () => {
      const renderer = createRenderer();

      const updateHandler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === UPDATE_ACTIONS_EVENT_TYPE
      )[1];

      const suggestionHandler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === LLM_SUGGESTED_ACTION_ID
      )[1];

      // Empty actions

      await updateHandler({
        type: UPDATE_ACTIONS_EVENT_TYPE,

        payload: { actorId: 'player', actions: [] },
      });

      // Suggestion (no descriptor)

      await suggestionHandler({
        payload: { actorId: 'player', suggestedIndex: 1 },
      });

      // Should render callout with fallback text

      const callout = document.querySelector('.llm-suggestion-body');

      expect(callout).toBeTruthy();

      expect(callout.textContent).toBe('Awaiting suggestion details...');
    });

    it('should abort suggestion rendering if list container is missing', async () => {
      const renderer = createRenderer();

      const suggestionHandler = mockVed.subscribe.mock.calls.find(
        (c) => c[0] === LLM_SUGGESTED_ACTION_ID
      )[1];

      // Remove container

      renderer.elements.listContainerElement = null;

      // Trigger suggestion

      await suggestionHandler({
        payload: { actorId: 'player', suggestedIndex: 1 },
      });

      // Should not crash and should not create callout (since container is missing, can't prepend)

      // And line 1206 should be hit

      expect(document.querySelector('.llm-suggestion-callout')).toBeNull();
    });
  });
});
