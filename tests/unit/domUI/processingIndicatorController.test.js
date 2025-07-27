import { JSDOM } from 'jsdom';
import {
  ProcessingIndicatorController,
  DomElementFactory,
} from '../../../src/domUI';
import {
  TURN_PROCESSING_STARTED,
  TURN_PROCESSING_ENDED,
  PLAYER_TURN_SUBMITTED_ID,
  TURN_STARTED_ID,
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
    const turnStartedHandler = getVedHandler(ved, TURN_STARTED_ID);
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

  describe('Missing DOM elements', () => {
    it('logs debug when speech input element is not found', () => {
      // Use main controller instance with custom selector
      controller.dispose(); // Dispose existing controller first

      controller = new ProcessingIndicatorController({
        logger,
        documentContext: docContext,
        safeEventDispatcher: ved,
        domElementFactory,
        speechInputSelector: '#non-existent-input',
      });

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Speech input element (selector: '#non-existent-input') not found"
        )
      );
    });

    it('dispatches error when outputDiv is missing', () => {
      const domWithoutOutput = new JSDOM(
        `<!DOCTYPE html><html><body></body></html>`
      );
      const docContextWithoutOutput = {
        query: (sel) => domWithoutOutput.window.document.querySelector(sel),
        create: (tag) => domWithoutOutput.window.document.createElement(tag),
        document: domWithoutOutput.window.document,
      };

      const controller3 = new ProcessingIndicatorController({
        logger,
        documentContext: docContextWithoutOutput,
        safeEventDispatcher: ved,
        domElementFactory: new DomElementFactory(docContextWithoutOutput),
      });

      expect(ved.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining(
            'Cannot create #processing-indicator: DomElementFactory or #outputDiv element missing'
          ),
        })
      );

      controller3.dispose();
      domWithoutOutput.window.close();
    });

    it('dispatches error when domElementFactory is null', () => {
      // Create fresh DOM and mocks
      const freshDom = new JSDOM(
        `<!DOCTYPE html><html><body><div id="outputDiv"></div></body></html>`
      );
      const freshDocContext = {
        query: (sel) => freshDom.window.document.querySelector(sel),
        create: (tag) => freshDom.window.document.createElement(tag),
        document: freshDom.window.document,
      };
      const freshVed = {
        subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
        dispatch: jest.fn(),
      };

      const controller4 = new ProcessingIndicatorController({
        logger,
        documentContext: freshDocContext,
        safeEventDispatcher: freshVed,
        domElementFactory: null,
      });

      expect(freshVed.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining(
            'Cannot create #processing-indicator: DomElementFactory or #outputDiv element missing'
          ),
        })
      );

      controller4.dispose();
      freshDom.window.close();
    });
  });

  describe('Error handling during indicator creation', () => {
    it('handles dot span creation failure', () => {
      // Create fresh DOM and mocks
      const freshDom = new JSDOM(
        `<!DOCTYPE html><html><body><div id="outputDiv"></div></body></html>`
      );
      const freshDocContext = {
        query: (sel) => freshDom.window.document.querySelector(sel),
        create: (tag) => freshDom.window.document.createElement(tag),
        document: freshDom.window.document,
      };
      const freshLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      // Mock domElementFactory to fail on span creation
      const mockFactory = {
        create: jest.fn((tag, options) => {
          if (tag === 'div') {
            const div = freshDom.window.document.createElement('div');
            if (options.id) div.id = options.id;
            if (options.cls) div.className = options.cls;
            if (options.attrs?.['aria-live'])
              div.setAttribute('aria-live', options.attrs['aria-live']);
            if (options.attrs?.['aria-label'])
              div.setAttribute('aria-label', options.attrs['aria-label']);
            return div;
          }
          return null; // Fail on span creation
        }),
        span: jest.fn(() => null),
      };

      const controller5 = new ProcessingIndicatorController({
        logger: freshLogger,
        documentContext: freshDocContext,
        safeEventDispatcher: ved,
        domElementFactory: mockFactory,
      });

      expect(freshLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create dot span for indicator')
      );

      controller5.dispose();
      freshDom.window.close();
    });

    it('dispatches error when indicator element creation fails', () => {
      // Create fresh DOM and mocks
      const freshDom = new JSDOM(
        `<!DOCTYPE html><html><body><div id="outputDiv"></div></body></html>`
      );
      const freshDocContext = {
        query: (sel) => freshDom.window.document.querySelector(sel),
        create: (tag) => freshDom.window.document.createElement(tag),
        document: freshDom.window.document,
      };
      const freshVed = {
        subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
        dispatch: jest.fn(),
      };

      // Mock domElementFactory to return null
      const mockFactory = {
        create: jest.fn(() => null),
        span: jest.fn(() => null),
      };

      const controller6 = new ProcessingIndicatorController({
        logger,
        documentContext: freshDocContext,
        safeEventDispatcher: freshVed,
        domElementFactory: mockFactory,
      });

      expect(freshVed.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining(
            'Failed to create #processing-indicator element using DomElementFactory'
          ),
        })
      );

      controller6.dispose();
      freshDom.window.close();
    });
  });

  describe('Existing indicator relocation', () => {
    it('moves existing indicator to outputDiv if not already a child', () => {
      // Dispose current controller and set up fresh DOM
      controller.dispose();

      // Create a new DOM with indicator outside outputDiv
      const newDom = new JSDOM(
        `<!DOCTYPE html><html><body><div id="processing-indicator"></div><div id="outputDiv"></div><input id="speech-input"/></body></html>`
      );
      const newDocContext = {
        query: (sel) => newDom.window.document.querySelector(sel),
        create: (tag) => newDom.window.document.createElement(tag),
        document: newDom.window.document,
      };

      const controller7 = new ProcessingIndicatorController({
        logger,
        documentContext: newDocContext,
        safeEventDispatcher: ved,
        domElementFactory: new DomElementFactory(newDocContext),
      });

      const outputDiv = newDom.window.document.getElementById('outputDiv');
      const indicator = newDom.window.document.getElementById(
        'processing-indicator'
      );

      expect(indicator.parentElement).toBe(outputDiv);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          '#processing-indicator exists but is not a child of #outputDiv. Moving it.'
        )
      );

      controller7.dispose();
      newDom.window.close();
    });
  });

  describe('Null indicator element warnings', () => {
    it('warns when attempting to show indicator with null element', () => {
      // Create fresh DOM and mocks
      const freshDom = new JSDOM(
        `<!DOCTYPE html><html><body><div id="outputDiv"></div></body></html>`
      );
      const freshDocContext = {
        query: (sel) => freshDom.window.document.querySelector(sel),
        create: (tag) => freshDom.window.document.createElement(tag),
        document: freshDom.window.document,
      };
      const freshLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      const freshVed = {
        subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
        dispatch: jest.fn(),
      };

      // Mock domElementFactory to return null for indicator creation
      const mockFactory = {
        create: jest.fn(() => null),
        span: jest.fn(() => null),
      };

      const controller8 = new ProcessingIndicatorController({
        logger: freshLogger,
        documentContext: freshDocContext,
        safeEventDispatcher: freshVed,
        domElementFactory: mockFactory,
      });

      // Try to show indicator through event - should warn because indicator is null
      const startHandler = getVedHandler(freshVed, TURN_PROCESSING_STARTED);
      startHandler();

      expect(freshLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Attempted to show indicator, but #indicatorElement is null'
        )
      );

      controller8.dispose();
      freshDom.window.close();
    });

    it('warns when attempting to hide indicator with null element', () => {
      // Create fresh DOM and mocks
      const freshDom = new JSDOM(
        `<!DOCTYPE html><html><body><div id="outputDiv"></div></body></html>`
      );
      const freshDocContext = {
        query: (sel) => freshDom.window.document.querySelector(sel),
        create: (tag) => freshDom.window.document.createElement(tag),
        document: freshDom.window.document,
      };
      const freshLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      const freshVed = {
        subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
        dispatch: jest.fn(),
      };

      // Mock domElementFactory to return null for indicator creation
      const mockFactory = {
        create: jest.fn(() => null),
        span: jest.fn(() => null),
      };

      const controller9 = new ProcessingIndicatorController({
        logger: freshLogger,
        documentContext: freshDocContext,
        safeEventDispatcher: freshVed,
        domElementFactory: mockFactory,
      });

      // Try to hide indicator through event - should warn because indicator is null
      const endHandler = getVedHandler(freshVed, TURN_PROCESSING_ENDED);
      endHandler();

      expect(freshLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Attempted to hide indicator, but #indicatorElement is null'
        )
      );

      controller9.dispose();
      freshDom.window.close();
    });
  });

  describe('Player type detection', () => {
    it('detects human player using modern player_type component', () => {
      const turnStartedHandler = getVedHandler(ved, TURN_STARTED_ID);
      const focusHandler = getVedHandler(ved, 'core:speech_input_gained_focus');

      // Simulate turn start with player_type component
      turnStartedHandler({
        type: 'core:turn_started',
        payload: {
          entity: {
            components: {
              'core:player_type': { type: 'human' },
            },
          },
        },
      });

      // Now trigger focus event
      focusHandler({
        type: 'core:speech_input_gained_focus',
        payload: { timestamp: Date.now() },
      });

      const indicator = document.querySelector('#processing-indicator');
      expect(indicator?.classList.contains('human')).toBe(true);
    });

    it('detects GOAP AI player', () => {
      const turnStartedHandler = getVedHandler(ved, TURN_STARTED_ID);
      const processingHandler = getVedHandler(ved, TURN_PROCESSING_STARTED);

      turnStartedHandler({
        type: 'core:turn_started',
        payload: {
          entity: {
            components: {
              'core:player_type': { type: 'goap' },
            },
          },
        },
      });

      processingHandler();

      const indicator = document.querySelector('#processing-indicator');
      expect(indicator?.classList.contains('ai-goap')).toBe(true);
      expect(indicator?.getAttribute('aria-label')).toBe('AI planning...');
    });

    it('falls back to legacy detection for human player', () => {
      const turnStartedHandler = getVedHandler(ved, TURN_STARTED_ID);
      const focusHandler = getVedHandler(ved, 'core:speech_input_gained_focus');

      // Use legacy entityType detection
      turnStartedHandler({
        type: 'core:turn_started',
        payload: {
          entityType: 'player',
          entity: {},
        },
      });

      focusHandler({
        type: 'core:speech_input_gained_focus',
        payload: { timestamp: Date.now() },
      });

      const indicator = document.querySelector('#processing-indicator');
      expect(indicator?.classList.contains('human')).toBe(true);
    });

    it('defaults to AI LLM when no player type info available', () => {
      const turnStartedHandler = getVedHandler(ved, TURN_STARTED_ID);
      const processingHandler = getVedHandler(ved, TURN_PROCESSING_STARTED);

      turnStartedHandler({
        type: 'core:turn_started',
        payload: {},
      });

      processingHandler();

      const indicator = document.querySelector('#processing-indicator');
      expect(indicator?.classList.contains('ai-llm')).toBe(true);
    });
  });

  describe('Human player turn submission', () => {
    it('hides indicator when human player submits turn', () => {
      const turnStartedHandler = getVedHandler(ved, TURN_STARTED_ID);
      const focusHandler = getVedHandler(ved, 'core:speech_input_gained_focus');
      const submitHandler = getVedHandler(ved, PLAYER_TURN_SUBMITTED_ID);

      // Start human turn
      turnStartedHandler({
        type: 'core:turn_started',
        payload: {
          entity: {
            components: {
              'core:player_type': { type: 'human' },
            },
          },
        },
      });

      // Show indicator via focus
      focusHandler({
        type: 'core:speech_input_gained_focus',
        payload: { timestamp: Date.now() },
      });

      const indicator = document.querySelector('#processing-indicator');
      expect(indicator?.classList.contains('visible')).toBe(true);

      // Submit turn
      submitHandler({
        type: PLAYER_TURN_SUBMITTED_ID,
        payload: {},
      });

      expect(indicator?.classList.contains('visible')).toBe(false);
    });

    it('does not hide indicator on turn submission for AI players', () => {
      const turnStartedHandler = getVedHandler(ved, TURN_STARTED_ID);
      const processingHandler = getVedHandler(ved, TURN_PROCESSING_STARTED);
      const submitHandler = getVedHandler(ved, PLAYER_TURN_SUBMITTED_ID);

      // Start AI turn
      turnStartedHandler({
        type: 'core:turn_started',
        payload: {
          entity: {
            components: {
              'core:player_type': { type: 'llm' },
            },
          },
        },
      });

      // Show indicator
      processingHandler();

      const indicator = document.querySelector('#processing-indicator');
      expect(indicator?.classList.contains('visible')).toBe(true);

      // Try to submit (should not hide for AI)
      submitHandler({
        type: PLAYER_TURN_SUBMITTED_ID,
        payload: {},
      });

      // Should still be visible because it's not a human turn
      expect(indicator?.classList.contains('visible')).toBe(true);
    });
  });

  describe('Type class management', () => {
    it('removes all type classes before adding new one', () => {
      const turnStartedHandler = getVedHandler(ved, TURN_STARTED_ID);
      const processingHandler = getVedHandler(ved, TURN_PROCESSING_STARTED);
      const focusHandler = getVedHandler(ved, 'core:speech_input_gained_focus');

      // Start as AI GOAP
      turnStartedHandler({
        type: 'core:turn_started',
        payload: {
          entity: {
            components: {
              'core:player_type': { type: 'goap' },
            },
          },
        },
      });

      processingHandler();

      const indicator = document.querySelector('#processing-indicator');
      expect(indicator?.classList.contains('ai-goap')).toBe(true);

      // Switch to human
      turnStartedHandler({
        type: 'core:turn_started',
        payload: {
          entity: {
            components: {
              'core:player_type': { type: 'human' },
            },
          },
        },
      });

      focusHandler({
        type: 'core:speech_input_gained_focus',
        payload: { timestamp: Date.now() },
      });

      // Should only have human class, not ai-goap
      expect(indicator?.classList.contains('human')).toBe(true);
      expect(indicator?.classList.contains('ai-goap')).toBe(false);
      expect(indicator?.classList.contains('ai-llm')).toBe(false);
    });
  });
});
