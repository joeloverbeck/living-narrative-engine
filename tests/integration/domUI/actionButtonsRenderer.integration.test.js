/**
 * @file Integration tests for ActionButtonsRenderer covering grouped rendering and dispatch flow
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
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
});
