/**
 * @jest-environment node
 */
import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import DispatchSpeechHandler from '../../../src/logic/operationHandlers/dispatchSpeechHandler.js';
import {
  DISPLAY_SPEECH_ID,
  SYSTEM_ERROR_OCCURRED_ID,
} from '../../../src/constants/eventIds.js';

const makeLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const makeSafeDispatcher = () => ({ dispatch: jest.fn() });

describe('DispatchSpeechHandler', () => {
  let logger;
  let safeDispatcher;
  let handler;

  beforeEach(() => {
    logger = makeLogger();
    safeDispatcher = makeSafeDispatcher();
    handler = new DispatchSpeechHandler({ dispatcher: safeDispatcher, logger });
    jest.clearAllMocks();
  });

  test('constructor throws with invalid deps', () => {
    expect(() => new DispatchSpeechHandler({ logger })).toThrow();
    expect(
      () => new DispatchSpeechHandler({ dispatcher: safeDispatcher })
    ).toThrow();
  });

  const base = { entity_id: 'e1', speech_content: 'hi' };
  const combos = [
    ['no optional params', {}, {}],
    ['allow_html true', { allow_html: true }, { allowHtml: true }],
    ['allow_html false', { allow_html: false }, { allowHtml: false }],
    ['thoughts only', { thoughts: 't' }, { thoughts: 't' }],
    ['notes only', { notes: 'n' }, { notes: 'n' }],
    [
      'thoughts and notes',
      { thoughts: 't', notes: 'n' },
      { thoughts: 't', notes: 'n' },
    ],
    [
      'thoughts + allow_html',
      { thoughts: 't', allow_html: true },
      { thoughts: 't', allowHtml: true },
    ],
    [
      'notes + allow_html',
      { notes: 'n', allow_html: false },
      { notes: 'n', allowHtml: false },
    ],
    [
      'thoughts + notes + allow_html',
      { thoughts: 't', notes: 'n', allow_html: true },
      { thoughts: 't', notes: 'n', allowHtml: true },
    ],
  ];

  test.each(combos)('dispatch payload %s', (_desc, extras, expectedExtras) => {
    const params = { ...base, ...extras };
    const expected = {
      entityId: base.entity_id,
      speechContent: base.speech_content,
      ...expectedExtras,
    };
    handler.execute(params, {});
    expect(safeDispatcher.dispatch).toHaveBeenCalledWith(
      DISPLAY_SPEECH_ID,
      expected
    );
  });

  test('dispatches error event on invalid parameters', () => {
    handler.execute(null, {});
    expect(logger.warn).toHaveBeenCalledWith(
      'DISPATCH_SPEECH: params missing or invalid.',
      { params: null }
    );
    expect(safeDispatcher.dispatch).not.toHaveBeenCalled();
  });

  test('dispatches error event if underlying dispatch throws', () => {
    safeDispatcher.dispatch.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const params = { entity_id: 'e1', speech_content: 'oops' };
    handler.execute(params, {});
    expect(safeDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'DISPATCH_SPEECH: Error dispatching display_speech.',
      })
    );
  });
});
