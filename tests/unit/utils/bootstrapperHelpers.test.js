import { describe, it, expect, jest } from '@jest/globals';
import StageError from '../../../src/bootstrapper/StageError.js';
import {
  resolveAndInitialize,
  setupButtonListener,
  shouldStopEngine,
  attachBeforeUnload,
  createStageError,
  stageSuccess,
  stageFailure,
} from '../../../src/utils/bootstrapperHelpers.js';

describe('bootstrapperHelpers', () => {
  describe('resolveAndInitialize', () => {
    const token = 'GameService';
    const initFn = 'initialize';
    const createLogger = () => ({
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    });

    it('returns success when service resolves and initializes', async () => {
      const logger = createLogger();
      const initSpy = jest.fn();
      const service = { [initFn]: initSpy };
      const container = { resolve: jest.fn(() => service) };

      const result = await resolveAndInitialize(
        container,
        token,
        initFn,
        logger,
        'alpha',
        42
      );

      expect(container.resolve).toHaveBeenCalledWith(token);
      expect(initSpy).toHaveBeenCalledWith('alpha', 42);
      expect(logger.debug).toHaveBeenCalledWith(
        `${token} Init: Resolving ${token}...`
      );
      expect(logger.debug).toHaveBeenCalledWith(
        `${token} Init: Initialized successfully.`
      );
      expect(result).toEqual({ success: true, payload: undefined });
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('returns failure when service cannot be resolved', async () => {
      const logger = createLogger();
      const container = { resolve: jest.fn(() => undefined) };

      const result = await resolveAndInitialize(
        container,
        token,
        initFn,
        logger
      );

      expect(logger.warn).toHaveBeenCalledWith(
        `${token} Init: ${token} could not be resolved.`
      );
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe(`${token} could not be resolved.`);
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('returns failure when init method is missing', async () => {
      const logger = createLogger();
      const container = { resolve: jest.fn(() => ({})) };

      const result = await resolveAndInitialize(
        container,
        token,
        initFn,
        logger
      );

      expect(logger.error).toHaveBeenCalled();
      const [message, error] = logger.error.mock.calls.at(-1);
      expect(message).toBe(`${token} Init: Failed to initialize.`);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe(`${token} missing ${initFn}()`);
      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
    });

    it('returns failure when initialization throws an error', async () => {
      const logger = createLogger();
      const thrown = new Error('boom');
      const service = {
        [initFn]: jest.fn(() => {
          throw thrown;
        }),
      };
      const container = { resolve: jest.fn(() => service) };

      const result = await resolveAndInitialize(
        container,
        token,
        initFn,
        logger
      );

      expect(logger.error).toHaveBeenCalledWith(
        `${token} Init: Failed to initialize.`,
        thrown
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe(thrown);
    });

    it('awaits asynchronous initialization before returning success', async () => {
      const logger = createLogger();
      let resolved = false;
      const initSpy = jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        resolved = true;
      });
      const service = { [initFn]: initSpy };
      const container = { resolve: jest.fn(() => service) };

      const resultPromise = resolveAndInitialize(
        container,
        token,
        initFn,
        logger
      );

      expect(resolved).toBe(false);

      const result = await resultPromise;

      expect(resolved).toBe(true);
      expect(result).toEqual({ success: true, payload: undefined });
    });
  });

  describe('setupButtonListener', () => {
    it('attaches listener when button is present', () => {
      const doc = document.implementation.createHTMLDocument();
      doc.body.innerHTML = '<button id="start-btn"></button>';
      const button = doc.getElementById('start-btn');
      const addEventListenerSpy = jest.spyOn(button, 'addEventListener');
      const handler = jest.fn();
      const logger = { debug: jest.fn(), warn: jest.fn() };

      setupButtonListener(doc, 'start-btn', handler, logger, 'Boot Stage');

      expect(addEventListenerSpy).toHaveBeenCalledWith('click', handler);
      expect(logger.debug).toHaveBeenCalledWith(
        'Boot Stage: start-btn listener attached to #start-btn.'
      );
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('logs warning when button is missing', () => {
      const doc = document.implementation.createHTMLDocument();
      const logger = { debug: jest.fn(), warn: jest.fn() };
      const handler = jest.fn();

      setupButtonListener(doc, 'missing-btn', handler, logger, 'Boot Stage');

      expect(logger.warn).toHaveBeenCalledWith(
        'Boot Stage: Could not find #missing-btn. Listener not attached.'
      );
      expect(logger.debug).not.toHaveBeenCalled();
    });
  });

  describe('shouldStopEngine', () => {
    it('returns true when engine is running', () => {
      const status = { isLoopRunning: true };
      const engine = { getEngineStatus: jest.fn(() => status) };

      expect(shouldStopEngine(engine)).toBe(true);
      expect(engine.getEngineStatus).toHaveBeenCalled();
    });

    it('returns false when engine is missing', () => {
      expect(shouldStopEngine(null)).toBe(false);
      expect(shouldStopEngine(undefined)).toBe(false);
    });

    it('returns false when engine lacks getEngineStatus', () => {
      const engine = {};
      expect(shouldStopEngine(engine)).toBe(false);
    });

    it('returns false when loop is not running', () => {
      const engine = {
        getEngineStatus: jest.fn(() => ({ isLoopRunning: false })),
      };
      expect(shouldStopEngine(engine)).toBe(false);
    });
  });

  describe('attachBeforeUnload', () => {
    it('registers event handler on window', () => {
      const handler = jest.fn();
      const windowRef = { addEventListener: jest.fn() };

      attachBeforeUnload(windowRef, handler);

      expect(windowRef.addEventListener).toHaveBeenCalledWith(
        'beforeunload',
        handler
      );
    });
  });

  describe('createStageError', () => {
    it('creates StageError with phase, message, and cause', () => {
      const cause = new Error('original');
      const error = createStageError('Init', 'failed', cause);

      expect(error).toBeInstanceOf(StageError);
      expect(error.phase).toBe('Init');
      expect(error.message).toBe('failed');
      expect(error.cause).toBe(cause);
    });
  });

  describe('stageSuccess', () => {
    it('returns successful result with payload', () => {
      expect(stageSuccess('payload')).toEqual({
        success: true,
        payload: 'payload',
      });
      expect(stageSuccess()).toEqual({ success: true, payload: undefined });
    });
  });

  describe('stageFailure', () => {
    it('wraps error in StageError and marks result as failure', () => {
      const cause = new Error('root cause');
      const result = stageFailure('Phase', 'broken', cause);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(StageError);
      expect(result.error.phase).toBe('Phase');
      expect(result.error.message).toBe('broken');
      expect(result.error.cause).toBe(cause);
    });
  });
});
