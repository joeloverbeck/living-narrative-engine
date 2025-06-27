import { JSDOM } from 'jsdom';
import {
  ProcessingIndicatorController,
  DomElementFactory,
} from '../../../src/domUI';
import {
  TURN_PROCESSING_STARTED,
  TURN_PROCESSING_ENDED,
} from '../../../src/constants/eventIds.js';
import {
  beforeEach,
  afterEach,
  describe,
  it,
  expect,
  jest,
} from '@jest/globals';

// Helper to get handler for specific event id
const getVedHandler = (ved, eventId) =>
  ved.subscribe.mock.calls.find((c) => c[0] === eventId)?.[1];

describe('ProcessingIndicatorController', () => {
  let dom;
  let document;
  let window;
  let logger;
  let ved;
  let docContext;
  let domElementFactory;
  let controller;

  beforeEach(() => {
    dom = new JSDOM(
      `<!DOCTYPE html><html><body><div id="outputDiv"></div><input id="speech-input"/></body></html>`
    );
    window = dom.window;
    document = dom.window.document;
    global.window = window;
    global.document = document;
    global.HTMLElement = window.HTMLElement;
    global.HTMLInputElement = window.HTMLInputElement;

    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    docContext = {
      query: (sel) => document.querySelector(sel),
      create: (tag) => document.createElement(tag),
      document,
    };
    domElementFactory = new DomElementFactory(docContext);
    ved = {
      subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
      dispatch: jest.fn(),
    };

    controller = new ProcessingIndicatorController({
      logger,
      documentContext: docContext,
      safeEventDispatcher: ved,
      domElementFactory,
    });
  });

  afterEach(() => {
    controller.dispose();
    jest.restoreAllMocks();
    if (window) window.close();
    global.window = undefined;
    global.document = undefined;
  });

  it('creates indicator element when not present and appends to outputDiv', () => {
    const indicator = document.querySelector('#processing-indicator');
    expect(indicator).not.toBeNull();
    expect(indicator?.parentElement).toBe(document.getElementById('outputDiv'));
    expect(indicator?.querySelectorAll('span.dot').length).toBe(3);
    expect(indicator?.classList.contains('visible')).toBe(false);
  });

  it('shows and hides indicator on turn processing events', () => {
    const startHandler = getVedHandler(ved, TURN_PROCESSING_STARTED);
    const endHandler = getVedHandler(ved, TURN_PROCESSING_ENDED);
    const indicator = document.querySelector('#processing-indicator');
    expect(startHandler).toBeInstanceOf(Function);
    expect(endHandler).toBeInstanceOf(Function);
    const scrollSpy = jest.spyOn(controller, 'scrollToBottom');
    startHandler();
    expect(scrollSpy).toHaveBeenCalledWith('outputDiv', 'outputDiv');
    expect(indicator?.classList.contains('visible')).toBe(true);
    endHandler();
    expect(indicator?.classList.contains('visible')).toBe(false);
  });

  it('toggles indicator based on focus events for human players', () => {
    const inputEl = document.getElementById('speech-input');
    const indicator = document.querySelector('#processing-indicator');

    // Get handlers for the events
    const turnStartedHandler = getVedHandler(ved, 'core:turn_started');
    const focusHandler = getVedHandler(ved, 'core:speech_input_gained_focus');
    const blurHandler = getVedHandler(ved, 'core:speech_input_lost_focus');

    // First, simulate a human player turn starting
    turnStartedHandler({
      type: 'core:turn_started',
      payload: {
        entityId: 'player1',
        entityType: 'player',
        entity: {
          id: 'player1',
          components: {
            'core:player_type': { type: 'human' },
          },
          hasComponent: (id) => id === 'core:player_type',
          getComponentData: (id) =>
            id === 'core:player_type' ? { type: 'human' } : null,
        },
      },
    });

    // Trigger focus event
    focusHandler({
      type: 'core:speech_input_gained_focus',
      payload: { timestamp: Date.now() },
    });
    expect(indicator?.classList.contains('visible')).toBe(true);
    expect(indicator?.classList.contains('human')).toBe(true);

    // Trigger blur event
    blurHandler({
      type: 'core:speech_input_lost_focus',
      payload: { timestamp: Date.now() },
    });
    expect(indicator?.classList.contains('visible')).toBe(false);
  });

  it('removes indicator from DOM on dispose', () => {
    const indicator = document.querySelector('#processing-indicator');
    expect(indicator).not.toBeNull();
    controller.dispose();
    expect(document.querySelector('#processing-indicator')).toBeNull();
  });
});
