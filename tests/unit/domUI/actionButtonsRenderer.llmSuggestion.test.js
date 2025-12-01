import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ActionButtonsRenderer } from '../../../src/domUI/actionButtonsRenderer.js';
import { LLM_SUGGESTED_ACTION_ID } from '../../../src/constants/eventIds.js';

const UPDATE_ACTIONS_EVENT = 'core:update_available_actions';

function createEventDispatcher() {
  const handlers = new Map();

  return {
    handlers,
    subscribe: jest.fn((event, handler) => {
      handlers.set(event, handler);
      return { unsubscribe: jest.fn() };
    }),
    dispatch: jest.fn(async (eventType, payload) => {
      const handler = handlers.get(eventType);
      if (handler) {
        await handler({ type: eventType, payload });
      }
      return true;
    }),
    unsubscribe: jest.fn(),
  };
}

function createActionCategorizationService() {
  return {
    extractNamespace: jest.fn(() => null),
    shouldUseGrouping: jest.fn(() => false),
    groupActionsByNamespace: jest.fn((actions) => new Map([['default', actions]])),
    getSortedNamespaces: jest.fn(() => []),
    formatNamespaceDisplayName: jest.fn(() => ''),
    shouldShowCounts: jest.fn(() => false),
  };
}

describe('ActionButtonsRenderer LLM suggestions', () => {
  /** @type {ActionButtonsRenderer} */
  let renderer;
  let validatedEventDispatcher;
  let sendButton;
  let container;
  let logger;

  const baseActions = [
    {
      index: 1,
      actionId: 'core:wait',
      commandString: 'wait',
      params: {},
      description: 'Wait',
    },
    {
      index: 2,
      actionId: 'core:move',
      commandString: 'move north',
      params: {},
      description: 'Move',
    },
  ];

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="action-buttons"></div>
      <button id="player-confirm-turn-button"></button>
      <input id="speech-input" />
    `;

    container = document.querySelector('#action-buttons');
    sendButton = document.querySelector('#player-confirm-turn-button');

    validatedEventDispatcher = createEventDispatcher();

    const documentContext = {
      query: (selector) => document.querySelector(selector),
      create: (tag) => document.createElement(tag),
    };

    logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };

    const domElementFactory = {
      create: (tag, className) => {
        const el = document.createElement(tag);
        if (className) {
          el.className = className;
        }
        return el;
      },
      button: (text, className) => {
        const btn = document.createElement('button');
        btn.textContent = text;
        if (className) {
          btn.className = className;
        }
        return btn;
      },
    };

    renderer = new ActionButtonsRenderer({
      logger,
      documentContext,
      validatedEventDispatcher,
      domElementFactory,
      actionButtonsContainerSelector: '#action-buttons',
      sendButtonSelector: '#player-confirm-turn-button',
      speechInputSelector: '#speech-input',
      actionCategorizationService: createActionCategorizationService(),
    });
  });

  afterEach(() => {
    renderer?.dispose();
    document.body.innerHTML = '';
  });

  it('renders callout and falls back to wait when suggestion is out of range', async () => {
    await validatedEventDispatcher.dispatch(LLM_SUGGESTED_ACTION_ID, {
      actorId: 'actor-1',
      suggestedIndex: 5,
      suggestedActionDescriptor: 'Open the door',
    });

    await validatedEventDispatcher.dispatch(UPDATE_ACTIONS_EVENT, {
      actorId: 'actor-1',
      actions: baseActions,
    });

    expect(renderer.selectedAction?.index).toBe(1);

    const callout = container.querySelector('.llm-suggestion-callout');
    expect(callout).not.toBeNull();
    expect(callout.textContent).toContain('LLM suggestion');
    expect(callout.textContent).toContain('Open the door');
    expect(sendButton.disabled).toBe(false);
  });

  it('preselects valid suggestion and falls back to command string when descriptor is missing', async () => {
    await validatedEventDispatcher.dispatch(UPDATE_ACTIONS_EVENT, {
      actorId: 'actor-1',
      actions: baseActions,
    });

    await validatedEventDispatcher.dispatch(LLM_SUGGESTED_ACTION_ID, {
      actorId: 'actor-1',
      suggestedIndex: 2,
    });

    expect(renderer.selectedAction?.index).toBe(2);

    const callout = container.querySelector('.llm-suggestion-callout');
    expect(callout).not.toBeNull();
    expect(callout.textContent).toContain('move north');
  });

  it('disables speech input during LLM suggestion and re-enables when cleared', async () => {
    const speechInput = document.querySelector('#speech-input');
    expect(speechInput.disabled).toBe(false);

    await validatedEventDispatcher.dispatch(LLM_SUGGESTED_ACTION_ID, {
      actorId: 'actor-llm',
      suggestedIndex: 1,
    });

    expect(speechInput.disabled).toBe(true);

    // Clear suggestion by updating actions for a different actor
    await validatedEventDispatcher.dispatch(UPDATE_ACTIONS_EVENT, {
      actorId: 'actor-human',
      actions: baseActions,
    });

    expect(speechInput.disabled).toBe(false);
  });
});
