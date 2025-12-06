import { describe, it, expect } from '@jest/globals';
import {
  assertParamsObject,
  initHandlerLogger,
  validateDeps,
  resolveExecutionLogger,
} from '../../../../src/utils/handlerUtils/indexUtils.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/systemEventIds.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

class RecordingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(message, ...args) {
    this.debugLogs.push([message, ...args]);
  }

  info(message, ...args) {
    this.infoLogs.push([message, ...args]);
  }

  warn(message, ...args) {
    this.warnLogs.push([message, ...args]);
  }

  error(message, ...args) {
    this.errorLogs.push([message, ...args]);
  }
}

class RecordingDispatcher {
  constructor() {
    this.events = [];
  }

  dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
    return true;
  }
}

describe('handlerUtils/indexUtils integration', () => {
  it('assertParamsObject integrates with safeDispatchError for dispatcher-style loggers', () => {
    const dispatcherLogger = new RecordingDispatcher();

    const validResult = assertParamsObject(
      { value: 1 },
      dispatcherLogger,
      'OperationX'
    );
    expect(validResult).toBe(true);
    expect(dispatcherLogger.events).toHaveLength(0);

    const invalidResult = assertParamsObject(
      null,
      dispatcherLogger,
      'OperationX'
    );
    expect(invalidResult).toBe(false);
    expect(dispatcherLogger.events).toHaveLength(1);

    const [{ eventId, payload }] = dispatcherLogger.events;
    expect(eventId).toBe(SYSTEM_ERROR_OCCURRED_ID);
    expect(payload.message).toMatch(/OperationX: params missing or invalid\./);
    expect(payload.details).toEqual({ params: null });
  });

  it('initHandlerLogger returns prefixed logger and validates dependencies', () => {
    const baseLogger = new RecordingLogger();
    const dependencies = {
      orchestrator: {
        value: { discoverActions() {} },
        requiredMethods: ['discoverActions'],
      },
      traceFactory: {
        value: () => 'trace',
        isFunction: true,
      },
    };

    const handlerLogger = initHandlerLogger(
      'CommandHandler',
      baseLogger,
      dependencies
    );

    handlerLogger.info('started');
    handlerLogger.warn('check state', { ok: false });

    expect(baseLogger.infoLogs).toEqual([['CommandHandler: started']]);
    expect(baseLogger.warnLogs).toEqual([
      ['CommandHandler: check state', { ok: false }],
    ]);
  });

  it('validateDeps exposes dependency validation through the index', () => {
    const baseLogger = new RecordingLogger();
    const prefixedLogger = initHandlerLogger('Validator', baseLogger, {
      noop: { value: { run() {} }, requiredMethods: ['run'] },
    });

    expect(() =>
      validateDeps('Validator', prefixedLogger, {
        missingMethod: {
          value: {},
          requiredMethods: ['run'],
        },
      })
    ).toThrow(InvalidArgumentError);

    const lastError = baseLogger.errorLogs.at(-1)?.[0] ?? '';
    expect(lastError).toMatch(
      /Invalid or missing method 'run' on dependency 'Validator: missingMethod'/
    );
  });

  it('resolveExecutionLogger prefers the logger from execution context when available', () => {
    const defaultLogger = new RecordingLogger();
    const contextLogger = new RecordingLogger();

    const resolved = resolveExecutionLogger(defaultLogger, {
      logger: contextLogger,
    });

    expect(resolved).toBe(contextLogger);

    const fallback = resolveExecutionLogger(defaultLogger, undefined);
    expect(fallback).toBe(defaultLogger);
  });
});
