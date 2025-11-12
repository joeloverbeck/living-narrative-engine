/**
 * @file Integration tests for ActionButtonsRenderer covering grouped rendering and dispatch flow
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { PLAYER_TURN_SUBMITTED_ID } from '../../../src/constants/eventIds.js';
import { ActionButtonsRenderer } from '../../../src/domUI/actionButtonsRenderer.js';

const UPDATE_AVAILABLE_ACTIONS_EVENT = 'core:update_available_actions';

/**
 * Helper to pause for a given duration
 * @param {number} ms milliseconds to wait
 * @returns {Promise<void>}
 */
const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

describe('ActionButtonsRenderer Integration', () => {
  /** @type {IntegrationTestBed} */
  let testBed;
  /** @type {import('../../../src/interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} */
  let validatedEventDispatcher;
  /** @type {import('../../../src/interfaces/IEventBus.js').IEventBus} */
  let eventBus;
  /** @type {ActionButtonsRenderer} */
  let actionButtonsRenderer;
  /** @type {HTMLElement} */
  let container;
  /** @type {HTMLButtonElement} */
  let sendButton;
  /** @type {HTMLInputElement} */
  let speechInput;
  /** @type {import('../../../src/domUI/documentContext.js').default} */
  let documentContext;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();

    documentContext = testBed.get(tokens.IDocumentContext);
    documentContext.window = window;
    documentContext.body = document.body;

    // Ensure DOM collaborators exist before resolving renderer
    container = document.querySelector('#action-buttons');
    if (!container) {
      container = document.createElement('div');
      container.id = 'action-buttons';
      document.body.appendChild(container);
    }

    sendButton = document.getElementById('player-confirm-turn-button');
    if (!sendButton) {
      sendButton = document.createElement('button');
      sendButton.id = 'player-confirm-turn-button';
      document.body.appendChild(sendButton);
    }

    speechInput = document.getElementById('speech-input');
    if (!speechInput) {
      speechInput = document.createElement('input');
      speechInput.id = 'speech-input';
      document.body.appendChild(speechInput);
    }

    validatedEventDispatcher = testBed.get(tokens.IValidatedEventDispatcher);
    eventBus = testBed.get(tokens.IEventBus);
    actionButtonsRenderer = testBed.get(tokens.ActionButtonsRenderer);
    container = document.querySelector('#action-buttons');
  });

  afterEach(async () => {
    if (actionButtonsRenderer) {
      actionButtonsRenderer.dispose();
    }
    await testBed.cleanup();
    document.body.innerHTML = '';
  });

  const buildAction = (index, actionId, commandString, description, overrides = {}) => ({
    index,
    actionId,
    commandString,
    description,
    params: { targetId: 'player' },
    ...overrides,
  });

  it('renders grouped actions with visual styling and hover behaviour using real services', async () => {
    const actions = [
      buildAction(1, 'core:wait', 'Wait', 'Pause to observe', {
        visual: {
          backgroundColor: '#000000',
          textColor: '#010101',
          hoverBackgroundColor: '#111111',
          hoverTextColor: '#fefefe',
        },
      }),
      buildAction(2, 'core:look', 'Look Around', 'Survey the surroundings', {
        visual: null,
      }),
      buildAction(3, 'core:plan', 'Plan Move', 'Prepare the next step'),
      buildAction(4, 'affection:hug', 'Hug Ally', 'Provide comfort'),
      buildAction(5, 'movement:walk_north', 'Walk North', 'Head northward', {
        visual: {
          backgroundColor: '#2244ff',
          textColor: '#ffffff',
        },
      }),
      buildAction(6, 'movement:sprint', 'Sprint Forward', 'Move swiftly'),
    ];

    const invalidComposite = {
      index: 7,
      actionId: '',
      commandString: ' ',
      description: '',
      params: null,
    };

    const dispatched = await validatedEventDispatcher.dispatch(
      UPDATE_AVAILABLE_ACTIONS_EVENT,
      {
        actorId: 'actor-group-test',
        actions: [...actions, invalidComposite],
      }
    );

    expect(dispatched).toBe(true);

    const headers = Array.from(
      container.querySelectorAll('.action-section-header')
    ).map((el) => el.textContent);
    expect(headers).toEqual(['CORE (3)', 'AFFECTION (1)', 'MOVEMENT (2)']);

    const namespaces = Array.from(
      container.querySelectorAll('.action-group')
    ).map((el) => el.getAttribute('data-namespace'));
    expect(namespaces).toEqual(['core', 'affection', 'movement']);

    expect(container.querySelector('[data-action-index="7"]')).toBeNull();

    const firstButton = container.querySelector(
      'button.action-button[data-action-index="1"]'
    );
    expect(firstButton).toBeTruthy();
    expect(firstButton.classList.contains('action-button-custom-visual')).toBe(
      true
    );
    expect(firstButton.classList.contains('theme-aware-button')).toBe(true);
    expect(firstButton.dataset.customBg).toBe('#000000');
    expect(firstButton.dataset.hoverBg).toBe('#111111');
    expect(firstButton.classList.contains('contrast-warning')).toBe(true);
    expect(firstButton.style.getPropertyValue('--custom-bg-color')).toBe(
      '#000000'
    );
    expect(firstButton.style.getPropertyValue('--i')).toBe('0');

    firstButton.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(firstButton.classList.contains('action-button-hovering')).toBe(true);
    expect(window.getComputedStyle(firstButton).backgroundColor).toBe(
      'rgb(17, 17, 17)'
    );

    firstButton.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await wait(60);
    expect(firstButton.classList.contains('action-button-hovering')).toBe(false);
    expect(window.getComputedStyle(firstButton).backgroundColor).toBe(
      'rgb(0, 0, 0)'
    );

    actionButtonsRenderer.updateButtonVisual('core:wait', {
      backgroundColor: '#0044ff',
      textColor: '#ffffff',
    });
    expect(firstButton.dataset.customBg).toBe('#0044ff');
    expect(firstButton.classList.contains('contrast-warning')).toBe(true);
    expect(window.getComputedStyle(firstButton).backgroundColor).toBe(
      'rgb(0, 68, 255)'
    );
    expect(window.getComputedStyle(firstButton).color).toBe('rgb(255, 255, 255)');

    actionButtonsRenderer.updateButtonVisual('core:wait', null);
    expect(firstButton.classList.contains('action-button-custom-visual')).toBe(
      false
    );
    expect(firstButton.dataset.customBg).toBeUndefined();
    expect(firstButton.classList.contains('contrast-warning')).toBe(false);

    expect(
      container.classList.contains(ActionButtonsRenderer.FADE_IN_CLASS)
    ).toBe(true);
    container.dispatchEvent(new Event('animationend'));
    expect(
      container.classList.contains(ActionButtonsRenderer.FADE_IN_CLASS)
    ).toBe(false);
  });

  it('dispatches selected actions and clears state on send', async () => {
    const actions = [
      buildAction(1, 'core:wait', 'Wait', 'Pause for a moment'),
      buildAction(2, 'movement:step', 'Take Step', 'Advance carefully'),
    ];

    const dispatched = await validatedEventDispatcher.dispatch(
      UPDATE_AVAILABLE_ACTIONS_EVENT,
      {
        actorId: 'actor-dispatch-test',
        actions,
      }
    );
    expect(dispatched).toBe(true);

    const buttons = container.querySelectorAll('button.action-button');
    expect(buttons).toHaveLength(2);

    buttons[0].click();
    expect(sendButton.disabled).toBe(false);

    speechInput.value = 'For the realm';

    const receivedEvents = [];
    const unsubscribe = eventBus.subscribe(
      PLAYER_TURN_SUBMITTED_ID,
      (eventObject) => {
        receivedEvents.push(eventObject);
      }
    );

    sendButton.click();
    await wait();

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0]).toMatchObject({
      type: PLAYER_TURN_SUBMITTED_ID,
      payload: {
        submittedByActorId: 'actor-dispatch-test',
        chosenIndex: 1,
        speech: 'For the realm',
      },
    });

    if (typeof unsubscribe === 'function') {
      unsubscribe();
    }

    expect(speechInput.value).toBe('');
    expect(sendButton.disabled).toBe(true);
    expect(
      container.classList.contains(ActionButtonsRenderer.FADE_OUT_CLASS)
    ).toBe(true);

    container.dispatchEvent(new Event('animationend'));
    expect(container.classList.contains(ActionButtonsRenderer.DISABLED_CLASS)).toBe(
      true
    );
    expect(container.querySelectorAll('button.action-button')).toHaveLength(0);
  });

  it('clears actions when receiving an invalid update payload', async () => {
    await validatedEventDispatcher.dispatch(UPDATE_AVAILABLE_ACTIONS_EVENT, {
      actorId: 'actor-initial',
      actions: [buildAction(1, 'core:wait', 'Wait', 'Pause')],
    });

    const firstButton = container.querySelector('button.action-button');
    expect(firstButton).toBeTruthy();
    firstButton.click();
    expect(sendButton.disabled).toBe(false);

    await validatedEventDispatcher.dispatch(UPDATE_AVAILABLE_ACTIONS_EVENT, {
      actor: 'missing-fields',
      actions: null,
    });

    const emptyMessage = container.querySelector('.empty-list-message');
    expect(emptyMessage).toBeTruthy();
    expect(emptyMessage.textContent).toBe('No actions available.');
    expect(sendButton.disabled).toBe(true);
    expect(actionButtonsRenderer.selectedAction).toBeNull();
  });

  it('reapplies selection for matching actions and clears stale selections on refresh', async () => {
    const actions = [
      buildAction(1, 'core:wait', 'Wait', 'Pause to observe'),
      buildAction(2, 'core:listen', 'Listen', 'Hear surroundings'),
    ];

    await validatedEventDispatcher.dispatch(UPDATE_AVAILABLE_ACTIONS_EVENT, {
      actorId: 'actor-refresh',
      actions,
    });

    const available = [...actionButtonsRenderer.availableActions];
    expect(available).toHaveLength(2);

    actionButtonsRenderer.selectedAction = available[0];
    await actionButtonsRenderer.refreshList();

    const firstButton = container.querySelector(
      'button.action-button[data-action-index="1"]'
    );
    expect(firstButton?.classList.contains('selected')).toBe(true);
    expect(sendButton.disabled).toBe(false);

    actionButtonsRenderer.selectedAction = {
      ...available[0],
      index: 99,
    };
    await actionButtonsRenderer.refreshList();

    expect(actionButtonsRenderer.selectedAction).toBeNull();
    expect(sendButton.disabled).toBe(true);
    const selectedButtons = container.querySelectorAll(
      'button.action-button.selected'
    );
    expect(selectedButtons.length).toBe(0);
  });

  it('supports delegated hover handling and caches parsed colors', async () => {
    const actions = [
      buildAction(1, 'core:inspect', 'Inspect', 'Check surroundings', {
        visual: {
          backgroundColor: '#112233',
          textColor: '#ffffff',
          hoverBackgroundColor: '#223344',
          hoverTextColor: '#eeeeee',
        },
      }),
      buildAction(2, 'core:odd', 'Odd Color', 'Invalid color test', {
        visual: {
          backgroundColor: 'not-a-real-color',
          textColor: '#ffffff',
        },
      }),
    ];

    const getComputedSpy = jest.spyOn(
      documentContext.window,
      'getComputedStyle'
    );

    await validatedEventDispatcher.dispatch(UPDATE_AVAILABLE_ACTIONS_EVENT, {
      actorId: 'actor-hover',
      actions,
    });

    const parsedColor = actionButtonsRenderer.colorParseCache.get('#112233');
    expect(parsedColor).toEqual({ r: 17, g: 34, b: 51 });
    expect(actionButtonsRenderer.colorParseCache.get('not-a-real-color')).toBeNull();

    getComputedSpy.mockClear();
    actionButtonsRenderer.updateButtonVisual('core:inspect', {
      backgroundColor: '#112233',
      textColor: '#ffffff',
    });
    expect(getComputedSpy).not.toHaveBeenCalled();

    const strayDiv = document.createElement('div');
    container.appendChild(strayDiv);
    strayDiv.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(actionButtonsRenderer.hoverTimeouts.size).toBe(0);

    const firstButton = container.querySelector(
      'button.action-button[data-action-index="1"]'
    );
    expect(firstButton).toBeTruthy();
    const nestedSpan = document.createElement('span');
    firstButton.appendChild(nestedSpan);

    nestedSpan.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(firstButton.classList.contains('action-button-hovering')).toBe(true);

    nestedSpan.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    expect(actionButtonsRenderer.hoverTimeouts.size).toBe(1);

    actionButtonsRenderer.dispose();
    expect(actionButtonsRenderer.hoverTimeouts.size).toBe(0);

    getComputedSpy.mockRestore();
  });

  it('handles send button edge cases and dispatcher failures', async () => {
    const actions = [
      buildAction(1, 'core:wait', 'Wait', 'Pause briefly'),
      buildAction(2, 'core:plan', 'Plan', 'Strategize'),
    ];

    await validatedEventDispatcher.dispatch(UPDATE_AVAILABLE_ACTIONS_EVENT, {
      actorId: 'actor-send-cases',
      actions,
    });

    // Send attempt without a selection should disable the send button
    sendButton.click();
    await wait();
    expect(sendButton.disabled).toBe(true);

    // Simulate detached send button element
    const realSendButton = sendButton;
    testBed.mockLogger.error.mockClear();
    actionButtonsRenderer.elements.sendButtonElement = null;
    realSendButton.disabled = false;
    realSendButton.click();
    await wait();
    expect(testBed.mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "#handleSendAction called, but sendButtonElement is null."
      )
    );

    actionButtonsRenderer.elements.sendButtonElement = realSendButton;

    // Remove speech input so debug logging path is exercised
    if (actionButtonsRenderer.elements.speechInputElement) {
      actionButtonsRenderer.elements.speechInputElement.remove();
    }
    actionButtonsRenderer.elements.speechInputElement = null;

    const selectableButton = container.querySelector(
      'button.action-button[data-action-index="1"]'
    );
    expect(selectableButton).toBeTruthy();
    selectableButton.click();
    expect(sendButton.disabled).toBe(false);

    testBed.mockLogger.debug.mockClear();
    const exceptionSpy = jest
      .spyOn(validatedEventDispatcher, 'dispatch')
      .mockImplementationOnce(() => {
        throw new Error('dispatch failure');
      });

    sendButton.click();
    await wait();
    expect(testBed.mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('No speech input element available.')
    );
    expect(testBed.mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        `Exception during dispatch for '${PLAYER_TURN_SUBMITTED_ID}'.`
      ),
      expect.objectContaining({
        payload: expect.objectContaining({ chosenIndex: 1 }),
        error: expect.any(Error),
      })
    );

    exceptionSpy.mockRestore();

    // Simulate a dispatch returning false to trigger failure handling
    actionButtonsRenderer.selectedAction =
      actionButtonsRenderer.availableActions[0];
    sendButton.disabled = false;
    const failureSpy = jest
      .spyOn(validatedEventDispatcher, 'dispatch')
      .mockResolvedValueOnce(false);

    testBed.mockLogger.error.mockClear();
    sendButton.click();
    await wait();
    expect(failureSpy).toHaveBeenCalledWith(
      PLAYER_TURN_SUBMITTED_ID,
      expect.objectContaining({ chosenIndex: 1 })
    );
    expect(testBed.mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        `Failed to dispatch '${PLAYER_TURN_SUBMITTED_ID}' for action index '1'.`
      ),
      expect.objectContaining({
        payload: expect.objectContaining({ chosenIndex: 1 }),
      })
    );

    failureSpy.mockRestore();
  });
});
