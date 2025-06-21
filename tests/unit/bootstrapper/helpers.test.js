import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import {
  resolveAndInitialize,
  setupButtonListener,
  shouldStopEngine,
  attachBeforeUnload,
  createStageError,
  stageSuccess,
  stageFailure,
} from '../../../src/bootstrapper/helpers.js';
import StageError from '../../../src/bootstrapper/stageError.js';

/**
 * Basic logger mock for helper tests.
 *
 * @returns {{debug: jest.Mock, warn: jest.Mock, error: jest.Mock}} Logger mock
 */
function createLogger() {
  return { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

describe('bootstrapper helpers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('resolveAndInitialize', () => {
    it('resolves service and calls init', () => {
      const init = jest.fn();
      const container = { resolve: jest.fn(() => ({ init })) };
      const logger = createLogger();

      const result = resolveAndInitialize(container, 'X', 'init', logger);

      expect(container.resolve).toHaveBeenCalledWith('X');
      expect(init).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('fails when service missing', () => {
      const container = { resolve: jest.fn(() => null) };
      const logger = createLogger();

      const result = resolveAndInitialize(container, 'Y', 'init', logger);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe('setupButtonListener', () => {
    beforeEach(() => {
      document.body.innerHTML = '<button id="btn"></button>';
    });

    it('attaches click handler when element found', () => {
      const logger = createLogger();
      const handler = jest.fn();

      setupButtonListener(document, 'btn', handler, logger, 'stage');
      document.getElementById('btn').click();

      expect(handler).toHaveBeenCalled();
    });

    it('logs warning when element missing', () => {
      document.body.innerHTML = '';
      const logger = createLogger();
      setupButtonListener(document, 'missing', jest.fn(), logger, 'stage');
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('shouldStopEngine', () => {
    it('returns true when engine loop running', () => {
      const engine = {
        getEngineStatus: () => ({ isLoopRunning: true }),
      };
      expect(shouldStopEngine(engine)).toBe(true);
    });

    it('returns false otherwise', () => {
      expect(shouldStopEngine({})).toBe(false);
    });
  });

  describe('attachBeforeUnload', () => {
    it('attaches handler to window', () => {
      const win = { addEventListener: jest.fn() };
      const handler = jest.fn();
      attachBeforeUnload(win, handler);
      expect(win.addEventListener).toHaveBeenCalledWith(
        'beforeunload',
        handler
      );
    });
  });

  describe('stage helpers', () => {
    it('createStageError builds StageError with cause', () => {
      const cause = new Error('c');
      const err = createStageError('Phase', 'msg', cause);
      expect(err).toBeInstanceOf(StageError);
      expect(err.phase).toBe('Phase');
      expect(err.cause).toBe(cause);
      expect(err.message).toBe('msg');
    });

    it('stageSuccess returns success result', () => {
      const res = stageSuccess(123);
      expect(res).toEqual({ success: true, payload: 123 });
    });

    it('stageFailure wraps StageError', () => {
      const res = stageFailure('P', 'boom');
      expect(res.success).toBe(false);
      expect(res.error).toBeInstanceOf(StageError);
      expect(res.error.phase).toBe('P');
    });
  });
});
