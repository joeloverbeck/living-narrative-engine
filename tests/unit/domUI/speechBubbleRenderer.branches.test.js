import { describe, it, expect, jest } from '@jest/globals';
import { SpeechBubbleRenderer } from '../../../src/domUI';
import { DISPLAY_SPEECH_ID } from '../../../src/constants/eventIds.js';

/**
 * Create a logger mock used by tests.
 *
 * @description Creates a basic mock logger with spies for all log levels.
 * @returns {{debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock}} Logger mock
 */
const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

/**
 * Build a minimal document context for DOM-related tests.
 *
 * @description Generates a document context with optional DOM elements.
 * @param {boolean} hasOutputDiv whether #outputDiv exists
 * @param {boolean} hasMessageList whether #message-list exists
 * @returns {object} mock context
 */
const createMockDocumentContext = (
  hasOutputDiv = true,
  hasMessageList = true
) => {
  document.body.innerHTML = '';
  const out = hasOutputDiv ? document.createElement('div') : null;
  if (out) {
    out.id = 'outputDiv';
    document.body.appendChild(out);
  }
  const msg = hasMessageList ? document.createElement('div') : null;
  if (msg) {
    msg.id = 'message-list';
    document.body.appendChild(msg);
  }
  return {
    query: jest.fn((sel) => document.querySelector(sel)),
    create: jest.fn((tag) => document.createElement(tag)),
    document,
    _outputDiv: out,
    _messageList: msg,
  };
};

/**
 * Provide a DOM element factory for renderer tests.
 *
 * @description Simple DOM element factory using real DOM APIs.
 * @returns {object} factory
 */
const createMockDomElementFactory = () => ({
  create: jest.fn((tag, attrs = {}) => {
    const el = document.createElement(tag);
    if (attrs.cls)
      el.className = Array.isArray(attrs.cls) ? attrs.cls.join(' ') : attrs.cls;
    return el;
  }),
  span: jest.fn((cls) => {
    const el = document.createElement('span');
    if (cls) el.classList.add(cls);
    return el;
  }),
  img: jest.fn((src, alt, cls) => {
    const el = document.createElement('img');
    el.src = src;
    el.alt = alt;
    if (cls) el.classList.add(cls);
    return el;
  }),
});

const createMockEventDispatcher = () => ({
  subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
  dispatch: jest.fn(),
});

const createMockEntityManager = () => ({
  getEntityInstance: jest.fn(),
});

const createMockDisplayProvider = () => ({
  getEntityName: jest.fn().mockReturnValue('Anon'),
  getEntityPortraitPath: jest.fn().mockReturnValue(null),
});

const setup = (ctxOptions) => {
  const logger = createMockLogger();
  const documentContext = ctxOptions?.docContext || createMockDocumentContext();
  const validatedEventDispatcher = createMockEventDispatcher();
  const entityManager = createMockEntityManager();
  const domElementFactory = createMockDomElementFactory();
  const entityDisplayDataProvider = createMockDisplayProvider();
  const renderer = new SpeechBubbleRenderer({
    logger,
    documentContext,
    validatedEventDispatcher,
    entityManager,
    domElementFactory,
    entityDisplayDataProvider,
  });
  return {
    renderer,
    documentContext,
    logger,
    validatedEventDispatcher,
    entityManager,
    entityDisplayDataProvider,
  };
};

describe('SpeechBubbleRenderer additional branches', () => {
  it('falls back to outputDiv when message list missing', () => {
    const ctx = createMockDocumentContext(true, false);
    const { renderer, logger } = setup({ docContext: ctx });
    expect(renderer.effectiveSpeechContainer).toBe(ctx._outputDiv);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('#message-list not found')
    );
  });

  it('logs error when no speech container found', () => {
    const ctx = createMockDocumentContext(false, false);
    const { renderer, logger } = setup({ docContext: ctx });
    expect(renderer.effectiveSpeechContainer).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Critical: Effective speech container')
    );
  });

  it('ignores invalid event object and payload', () => {
    const { renderer, validatedEventDispatcher, logger } = setup();
    const handler = validatedEventDispatcher.subscribe.mock.calls[0][1];
    const spy = jest.spyOn(renderer, 'renderSpeech');
    handler(null);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Received invalid DISPLAY_SPEECH_ID'),
      null
    );
    expect(spy).not.toHaveBeenCalled();
    handler({
      type: DISPLAY_SPEECH_ID,
      payload: { entityId: 5, speechContent: 6 },
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid payload for DISPLAY_SPEECH_ID'),
      { entityId: 5, speechContent: 6 }
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('logs error when dependencies missing for renderSpeech', () => {
    const { renderer, logger } = setup();
    renderer.effectiveSpeechContainer = null;
    renderer.renderSpeech({ entityId: 'e1', speechContent: 'hi' });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Cannot render speech')
    );
  });

  it('adds player-speech class when speaker is player', () => {
    const { renderer, entityManager, documentContext } = setup();
    const entity = {
      hasComponent: jest.fn((componentId) => {
        // Return true for player_type component
        return componentId === 'core:player_type';
      }),
      getComponentData: jest.fn((componentId) => {
        if (componentId === 'core:player_type') {
          return { type: 'human' };
        }
        return null;
      }),
    };
    entityManager.getEntityInstance.mockReturnValue(entity);
    renderer.renderSpeech({ entityId: 'p1', speechContent: 'hello' });
    const entry = documentContext._messageList.querySelector('.speech-entry');
    expect(entry.classList.contains('player-speech')).toBe(true);
  });

  it('sets up portrait listeners when portrait path provided', () => {
    const { renderer, entityDisplayDataProvider } = setup();
    const spy = jest.spyOn(renderer, '_addDomListener');
    entityDisplayDataProvider.getEntityPortraitPath.mockReturnValue('/p.png');
    renderer.renderSpeech({ entityId: 'e1', speechContent: 'hi' });
    expect(spy).toHaveBeenCalledWith(
      expect.any(HTMLImageElement),
      'load',
      expect.any(Function),
      { once: true }
    );
    expect(spy).toHaveBeenCalledWith(
      expect.any(HTMLImageElement),
      'error',
      expect.any(Function),
      { once: true }
    );
  });

  it('scrolls immediately when no portrait', () => {
    const { renderer } = setup();
    const scrollSpy = jest
      .spyOn(renderer, 'scrollToBottom')
      .mockImplementation(() => {});
    renderer.renderSpeech({ entityId: 'e1', speechContent: 'hi' });
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });
});
