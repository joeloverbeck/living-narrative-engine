/**
 * @file Integration tests for bootstrapperHelpers utilities using real collaborators.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
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

/** @typedef {import('../../../src/types/stageResult.js').StageResult} StageResult */

describe('bootstrapperHelpers integration', () => {
  let container;
  let logger;

  beforeEach(() => {
    container = new AppContainer();
    logger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  describe('resolveAndInitialize', () => {
    it('resolves a registered service and invokes the initialization method', async () => {
      const initSpy = jest.fn();
      const serviceInstance = {
        initialize: initSpy,
      };
      container.register('TestService', serviceInstance);

      const result = await resolveAndInitialize(
        container,
        'TestService',
        'initialize',
        logger,
        'alpha',
        42
      );

      expect(result).toEqual(stageSuccess());
      expect(initSpy).toHaveBeenCalledWith('alpha', 42);
      expect(logger.debug).toHaveBeenNthCalledWith(
        1,
        'TestService Init: Resolving TestService...'
      );
      expect(logger.debug).toHaveBeenNthCalledWith(
        2,
        'TestService Init: Initialized successfully.'
      );
    });

    it('returns a failure result and logs when resolution throws', async () => {
      const errorLogger = jest.spyOn(logger, 'error');

      const result = await resolveAndInitialize(
        container,
        'MissingService',
        'initialize',
        logger
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(errorLogger).toHaveBeenCalledTimes(1);
      expect(errorLogger.mock.calls[0][0]).toBe(
        'MissingService Init: Failed to initialize.'
      );
      expect(errorLogger.mock.calls[0][1]).toBeInstanceOf(Error);
    });

    it('surfaces stage failure when the service lacks the init method', async () => {
      container.register('BrokenService', {});

      const result = await resolveAndInitialize(
        container,
        'BrokenService',
        'initialize',
        logger
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(logger.error).toHaveBeenCalledWith(
        'BrokenService Init: Failed to initialize.',
        expect.any(Error)
      );
    });
  });

  describe('setupButtonListener', () => {
    it('attaches a click handler when the button exists', () => {
      const button = document.createElement('button');
      button.id = 'start-button';
      document.body.appendChild(button);

      const handler = jest.fn();

      setupButtonListener(
        document,
        'start-button',
        handler,
        logger,
        'Bootstrap'
      );

      button.click();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledWith(
        'Bootstrap: start-button listener attached to #start-button.'
      );
    });

    it('logs a warning when the button is missing', () => {
      setupButtonListener(document, 'missing-button', () => {}, logger, 'Bootstrap');

      expect(logger.warn).toHaveBeenCalledWith(
        'Bootstrap: Could not find #missing-button. Listener not attached.'
      );
    });
  });

  describe('shouldStopEngine', () => {
    it('detects when the engine loop is running', () => {
      const engine = {
        getEngineStatus: () => ({ isLoopRunning: true }),
      };

      expect(shouldStopEngine(engine)).toBe(true);
    });

    it('returns false when engine is missing or not running', () => {
      const stoppedEngine = {
        getEngineStatus: () => ({ isLoopRunning: false }),
      };

      expect(shouldStopEngine(stoppedEngine)).toBe(false);
      expect(shouldStopEngine(null)).toBe(false);
      expect(shouldStopEngine({})).toBe(false);
    });
  });

  describe('attachBeforeUnload', () => {
    it('wires the handler to the window beforeunload event', () => {
      const handler = jest.fn();

      attachBeforeUnload(window, handler);

      window.dispatchEvent(new Event('beforeunload'));

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('stage error helpers', () => {
    it('creates StageErrors with phase and cause metadata', () => {
      const rootCause = new Error('Underlying');

      const error = createStageError('Initialization', 'Boom', rootCause);

      expect(error).toBeInstanceOf(StageError);
      expect(error.message).toBe('Boom');
      expect(error.phase).toBe('Initialization');
      expect(error.cause).toBe(rootCause);
    });

    it('creates success and failure StageResults', () => {
      const payload = { ok: true };
      const successResult = stageSuccess(payload);
      expect(successResult).toEqual({ success: true, payload });

      const rootError = new Error('Nope');
      const failureResult = stageFailure('Load', 'Failed to load', rootError);
      expect(failureResult.success).toBe(false);
      expect(failureResult.error).toBeInstanceOf(StageError);
      expect(failureResult.error.phase).toBe('Load');
      expect(failureResult.error.message).toBe('Failed to load');
      expect(failureResult.error.cause).toBe(rootError);
    });
  });
});
