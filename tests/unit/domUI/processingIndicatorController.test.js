import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { ProcessingIndicatorController } from '../../../src/domUI/processingIndicatorController.js';
import {
  TURN_PROCESSING_STARTED,
  TURN_PROCESSING_ENDED,
  PLAYER_TURN_SUBMITTED_ID,
  TURN_STARTED_ID,
} from '../../../src/constants/eventIds.js';
import { safeDispatchError } from '../../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
}));

const HUMAN_PAYLOAD = {
  entity: {
    components: {
      'core:player_type': { type: 'human' },
    },
  },
};

const GOAP_PAYLOAD = {
  entity: {
    components: {
      'core:player_type': { type: 'goap' },
    },
  },
};

describe('ProcessingIndicatorController', () => {
  /** @type {ReturnType<typeof setupController>} */
  let testContext;

  /**
   *
   * @param overrides
   */
  function createDomElementFactory(overrides = {}) {
    return {
      create: jest.fn((tag, options) => {
        if (overrides.create) {
          return overrides.create(tag, options);
        }
        const element = document.createElement(tag);
        if (options?.id) {
          element.id = options.id;
        }
        if (options?.cls) {
          element.className = options.cls;
        }
        if (options?.attrs) {
          Object.entries(options.attrs).forEach(([key, value]) => {
            element.setAttribute(key, value);
          });
        }
        return element;
      }),
      span: jest.fn((cls) => {
        if (overrides.span) {
          return overrides.span(cls);
        }
        const span = document.createElement('span');
        if (cls) {
          span.classList.add(cls);
        }
        return span;
      }),
    };
  }

  /**
   *
   * @param selectorMap
   */
  function createDocumentContext(selectorMap) {
    return {
      query: jest.fn((selector) => {
        const value = selectorMap[selector];
        if (typeof value === 'function') {
          return value();
        }
        return value ?? null;
      }),
      create: jest.fn((tag) => document.createElement(tag)),
    };
  }

  /**
   *
   * @param options
   */
  function setupController(options = {}) {
    const outputDiv = options.outputDiv ?? document.createElement('div');
    outputDiv.id = 'outputDiv';
    outputDiv.scrollTop = 0;
    Object.defineProperty(outputDiv, 'scrollHeight', {
      configurable: true,
      value: options.scrollHeight ?? 250,
    });

    const speechInput =
      options.hasSpeechInput === false ? null : document.createElement('input');

    const indicator = options.existingIndicator ?? null;

    const selectorMap = {
      '#outputDiv': options.outputDivSelector ?? (() => outputDiv),
      [options.speechSelector ?? '#speech-input']: () => speechInput,
      '#processing-indicator': () => indicator,
    };

    const documentContext =
      options.documentContext ?? createDocumentContext(selectorMap);

    const logger = options.logger ?? {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const eventHandlers = {};
    const unsubscribeMocks = [];
    const safeEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn((event, handler) => {
        eventHandlers[event] = handler;
        const unsubscribe = jest.fn();
        unsubscribeMocks.push(unsubscribe);
        return unsubscribe;
      }),
    };

    const domElementFactory =
      options.domElementFactory ?? createDomElementFactory(options.factoryOverrides);

    const controller = new ProcessingIndicatorController({
      logger,
      documentContext,
      safeEventDispatcher,
      domElementFactory,
      speechInputSelector: options.speechSelector ?? '#speech-input',
    });

    return {
      controller,
      documentContext,
      domElementFactory,
      logger,
      safeEventDispatcher,
      eventHandlers,
      unsubscribeMocks,
      outputDiv,
      speechInput,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a processing indicator when one is not present and appends dots', () => {
    testContext = setupController();

    const { outputDiv, domElementFactory } = testContext;
    const indicator = outputDiv.querySelector('#processing-indicator');

    expect(indicator).not.toBeNull();
    expect(indicator?.classList.contains('processing-indicator')).toBe(true);
    expect(domElementFactory.create).toHaveBeenCalledWith(
      'div',
      expect.objectContaining({ id: 'processing-indicator' })
    );
    expect(domElementFactory.span).toHaveBeenCalledTimes(3);
    expect(indicator?.querySelectorAll('.dot')).toHaveLength(3);
    expect(safeDispatchError).not.toHaveBeenCalled();
  });

  it('moves an existing indicator under #outputDiv when found elsewhere', () => {
    const strayContainer = document.createElement('div');
    const existingIndicator = document.createElement('div');
    existingIndicator.id = 'processing-indicator';
    strayContainer.appendChild(existingIndicator);

    const logger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    testContext = setupController({
      existingIndicator,
      logger,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        '#processing-indicator exists but is not a child of #outputDiv'
      )
    );
    expect(existingIndicator.parentElement).toBe(testContext.outputDiv);
    expect(testContext.domElementFactory.create).not.toHaveBeenCalled();
  });

  it('leaves an existing indicator in place when already attached to #outputDiv', () => {
    const outputDiv = document.createElement('div');
    outputDiv.id = 'outputDiv';
    Object.defineProperty(outputDiv, 'scrollHeight', {
      configurable: true,
      value: 100,
    });

    const existingIndicator = document.createElement('div');
    existingIndicator.id = 'processing-indicator';
    outputDiv.appendChild(existingIndicator);

    const logger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    testContext = setupController({
      existingIndicator,
      outputDiv,
      outputDivSelector: () => outputDiv,
      logger,
    });

    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('#processing-indicator exists but is not a child')
    );
    expect(testContext.domElementFactory.create).not.toHaveBeenCalled();
  });

  it('dispatches errors when the factory fails to create the indicator and logs warnings on show', () => {
    const factory = createDomElementFactory({
      create: () => null,
    });

    testContext = setupController({ domElementFactory: factory });

    expect(safeDispatchError).toHaveBeenCalledWith(
      testContext.safeEventDispatcher,
      expect.stringContaining(
        'Failed to create #processing-indicator element using DomElementFactory.'
      )
    );

    const { eventHandlers, logger } = testContext;
    eventHandlers[TURN_STARTED_ID]?.({ payload: GOAP_PAYLOAD });
    eventHandlers[TURN_PROCESSING_STARTED]?.();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Attempted to show indicator, but #indicatorElement is null.'
      )
    );

    eventHandlers[TURN_STARTED_ID]?.({ payload: HUMAN_PAYLOAD });
    eventHandlers['core:speech_input_lost_focus']?.();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Attempted to hide indicator, but #indicatorElement is null.'
      )
    );

    testContext.controller.dispose();
  });

  it('dispatches errors when outputDiv is missing', () => {
    const documentContext = createDocumentContext({
      '#outputDiv': () => null,
      '#speech-input': () => null,
      '#processing-indicator': () => null,
    });

    testContext = setupController({ documentContext });

    expect(safeDispatchError).toHaveBeenCalledWith(
      testContext.safeEventDispatcher,
      expect.stringContaining(
        'Cannot create #processing-indicator: DomElementFactory or #outputDiv element missing.'
      )
    );
  });

  it('shows and hides indicator for human players based on focus events', () => {
    testContext = setupController();
    const { eventHandlers, outputDiv } = testContext;

    eventHandlers[TURN_STARTED_ID]?.({ payload: HUMAN_PAYLOAD });
    eventHandlers[TURN_PROCESSING_STARTED]?.();
    eventHandlers['core:speech_input_gained_focus']?.();

    const indicator = outputDiv.querySelector('#processing-indicator');
    expect(indicator?.classList.contains('visible')).toBe(true);
    expect(indicator?.classList.contains('human')).toBe(true);
    expect(indicator?.getAttribute('aria-label')).toBe('Typing...');

    eventHandlers['core:speech_input_lost_focus']?.();
    expect(indicator?.classList.contains('visible')).toBe(false);

    eventHandlers['core:speech_input_gained_focus']?.();
    expect(indicator?.classList.contains('visible')).toBe(true);

    eventHandlers[PLAYER_TURN_SUBMITTED_ID]?.();
    expect(indicator?.classList.contains('visible')).toBe(false);

    eventHandlers[TURN_PROCESSING_ENDED]?.();
  });

  it('applies AI styling, aria labels, and scroll behavior based on player type', () => {
    const scrollSpy = jest.spyOn(
      ProcessingIndicatorController.prototype,
      'scrollToBottom'
    );

    testContext = setupController();
    const { eventHandlers, outputDiv } = testContext;

    eventHandlers[TURN_STARTED_ID]?.({ payload: GOAP_PAYLOAD });
    eventHandlers[TURN_PROCESSING_STARTED]?.();

    let indicator = outputDiv.querySelector('#processing-indicator');
    expect(indicator?.classList.contains('visible')).toBe(true);
    expect(indicator?.classList.contains('ai-goap')).toBe(true);
    expect(indicator?.getAttribute('aria-label')).toBe('AI planning...');
    expect(scrollSpy).toHaveBeenCalledWith('outputDiv', 'outputDiv');

    eventHandlers['core:speech_input_gained_focus']?.();
    expect(indicator?.classList.contains('ai-goap')).toBe(true);
    expect(indicator?.classList.contains('human')).toBe(false);

    eventHandlers['core:speech_input_lost_focus']?.();
    eventHandlers[PLAYER_TURN_SUBMITTED_ID]?.();

    eventHandlers[TURN_PROCESSING_ENDED]?.();
    expect(indicator?.classList.contains('visible')).toBe(false);

    eventHandlers[TURN_STARTED_ID]?.({
      payload: {
        entity: {
          components: { 'core:player_type': { type: 'mystery-ai' } },
        },
      },
    });
    eventHandlers[TURN_PROCESSING_STARTED]?.();
    indicator = outputDiv.querySelector('#processing-indicator');
    expect(indicator?.classList.contains('ai-llm')).toBe(true);
    expect(indicator?.getAttribute('aria-label')).toBe('AI thinking...');

    eventHandlers[TURN_PROCESSING_ENDED]?.();
    expect(indicator?.classList.contains('visible')).toBe(false);

    eventHandlers[TURN_STARTED_ID]?.({ payload: {} });
    eventHandlers[TURN_PROCESSING_STARTED]?.();
    indicator = outputDiv.querySelector('#processing-indicator');
    expect(indicator?.classList.contains('ai-llm')).toBe(true);
    expect(indicator?.getAttribute('aria-label')).toBe('AI thinking...');

    eventHandlers[TURN_PROCESSING_ENDED]?.();
    expect(indicator?.classList.contains('visible')).toBe(false);

    testContext.controller.elements.outputDiv = null;
    const scrollCallsBefore = scrollSpy.mock.calls.length;
    eventHandlers[TURN_STARTED_ID]?.({ payload: GOAP_PAYLOAD });
    eventHandlers[TURN_PROCESSING_STARTED]?.();
    expect(scrollSpy.mock.calls.length).toBe(scrollCallsBefore);

    scrollSpy.mockRestore();
  });

  it('treats entityType "player" payloads as human turns', () => {
    testContext = setupController();
    const { eventHandlers, outputDiv } = testContext;

    eventHandlers[TURN_STARTED_ID]?.({ payload: { entityType: 'player' } });
    eventHandlers['core:speech_input_gained_focus']?.();

    const indicator = outputDiv.querySelector('#processing-indicator');
    expect(indicator?.classList.contains('human')).toBe(true);
    expect(indicator?.getAttribute('aria-label')).toBe('Typing...');
  });

  it('logs a warning when dot spans cannot be created', () => {
    const logger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const factory = createDomElementFactory({
      span: () => null,
    });

    setupController({ logger, domElementFactory: factory });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to create dot span for indicator.')
    );
  });

  it('logs when the speech input selector cannot be resolved', () => {
    const logger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    setupController({ hasSpeechInput: false, logger });

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Speech input element (selector:')
    );
  });

  it('disposes by unsubscribing events and removing the indicator from DOM', () => {
    testContext = setupController();
    const { controller, outputDiv, unsubscribeMocks } = testContext;
    const indicator = outputDiv.querySelector('#processing-indicator');
    expect(indicator).not.toBeNull();

    controller.dispose();

    unsubscribeMocks.forEach((unsubscribe) => {
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
    expect(outputDiv.querySelector('#processing-indicator')).toBeNull();
  });
});
