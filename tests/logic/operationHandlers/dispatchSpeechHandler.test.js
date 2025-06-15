/**
 * @jest-environment node
 */
import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import DispatchSpeechHandler from '../../../src/logic/operationHandlers/dispatchSpeechHandler.js';
import { DISPLAY_SPEECH_ID } from '../../../src/constants/eventIds.js';

const makeLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const makeDispatcher = () => ({ dispatch: jest.fn() });

describe('DispatchSpeechHandler', () => {
  let logger;
  let dispatcher;
  let handler;

  beforeEach(() => {
    logger = makeLogger();
    dispatcher = makeDispatcher();
    handler = new DispatchSpeechHandler({ dispatcher, logger });
    jest.clearAllMocks();
  });

  test('constructor throws with invalid deps', () => {
    expect(() => new DispatchSpeechHandler({ logger })).toThrow();
    expect(() => new DispatchSpeechHandler({ dispatcher })).toThrow();
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
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      DISPLAY_SPEECH_ID,
      expected
    );
  });
});
