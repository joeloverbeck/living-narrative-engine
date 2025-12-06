import { describe, it, beforeEach, expect } from '@jest/globals';
import { BaseService } from '../../../../../src/actions/pipeline/services/base/BaseService.js';
import {
  ServiceError,
  ServiceErrorCodes,
} from '../../../../../src/actions/pipeline/services/base/ServiceError.js';
import { InvalidArgumentError } from '../../../../../src/errors/invalidArgumentError.js';

class RecordingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(message, context) {
    this.debugLogs.push({ message, context });
  }

  info(message, context) {
    this.infoLogs.push({ message, context });
  }

  warn(message, context) {
    this.warnLogs.push({ message, context });
  }

  error(message, context) {
    this.errorLogs.push({ message, context });
  }
}

class ConcreteService extends BaseService {
  constructor(logger) {
    super({ logger });
  }

  validateParamsProxy(params, required) {
    return this.validateParams(params, required);
  }

  validateNonBlankStringProxy(value, name) {
    return this.validateNonBlankString(value, name);
  }

  validatePresentProxy(value, name) {
    return this.validatePresent(value, name);
  }

  logOperationProxy(operation, context, level) {
    return this.logOperation(operation, context, level);
  }

  throwErrorProxy(message, code, context) {
    return this.throwError(message, code, context);
  }

  executeOperationProxy(operationName, operation, context) {
    return this.executeOperation(operationName, operation, context);
  }
}

describe('BaseService integration', () => {
  let logger;
  let service;

  beforeEach(() => {
    logger = new RecordingLogger();
    service = new ConcreteService(logger);
  });

  it('requires a logger with the standard logging methods', () => {
    const incompleteLogger = { info() {}, warn() {}, error() {} };

    expect(() => new ConcreteService(incompleteLogger)).toThrow(
      InvalidArgumentError
    );
  });

  it('confirms initialization status through isInitialized', () => {
    expect(service.isInitialized()).toBe(true);
    expect(service.logger).toBe(logger);
  });

  it('validates parameter objects and reports missing params', () => {
    service.validateParamsProxy({ id: 1, name: 'Ada' }, ['id', 'name']);

    expect(() => service.validateParamsProxy(null, ['id'])).toThrow(
      ServiceError
    );

    try {
      service.validateParamsProxy({ id: 1, name: null }, ['id', 'name']);
      throw new Error('Expected missing parameter validation to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceError);
      expect(error.code).toBe(ServiceErrorCodes.MISSING_PARAMETER);
      expect(error.value).toEqual({
        missing: ['name'],
        provided: ['id', 'name'],
      });
    }
  });

  it('validates non blank strings and present values', () => {
    service.validateNonBlankStringProxy(' action ', 'operationName');
    service.validatePresentProxy({ payload: true }, 'payload');

    expect(() =>
      service.validateNonBlankStringProxy('   ', 'operationName')
    ).toThrow(ServiceError);

    try {
      service.validatePresentProxy(undefined, 'payload');
      throw new Error('Expected validatePresent to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceError);
      expect(error.code).toBe(ServiceErrorCodes.MISSING_PARAMETER);
    }
  });

  it('logs operations with merged context and custom level', () => {
    service.logOperationProxy('resolve', { requestId: 'r-42' }, 'info');

    expect(logger.infoLogs).toEqual([
      {
        message: 'ConcreteService: resolve',
        context: {
          service: 'ConcreteService',
          operation: 'resolve',
          requestId: 'r-42',
        },
      },
    ]);
  });

  it('logs and throws service errors via throwError', () => {
    expect(() =>
      service.throwErrorProxy(
        'unexpected state',
        ServiceErrorCodes.INVALID_STATE,
        {
          snapshot: 'invalid',
        }
      )
    ).toThrow(ServiceError);

    const lastLog = logger.errorLogs.at(-1);
    expect(lastLog).toBeDefined();
    expect(lastLog.message).toBe('ConcreteService: unexpected state');
    expect(lastLog.context).toEqual({
      code: ServiceErrorCodes.INVALID_STATE,
      snapshot: 'invalid',
    });
  });

  it('executes operations and logs lifecycle with success result', async () => {
    const result = await service.executeOperationProxy(
      'hydrate',
      async () => ({ ok: true }),
      { requestId: 'r-99' }
    );

    expect(result).toEqual({ ok: true });
    expect(
      logger.debugLogs.map(({ message, context }) => ({ message, context }))
    ).toEqual([
      {
        message: 'ConcreteService: hydrate',
        context: {
          service: 'ConcreteService',
          operation: 'hydrate',
          status: 'started',
          requestId: 'r-99',
        },
      },
      {
        message: 'ConcreteService: hydrate',
        context: {
          service: 'ConcreteService',
          operation: 'hydrate',
          status: 'completed',
          requestId: 'r-99',
        },
      },
    ]);
  });

  it('rethrows existing ServiceError instances from executeOperation', async () => {
    const failure = new ServiceError(
      'boom',
      ServiceErrorCodes.OPERATION_FAILED
    );

    await expect(
      service.executeOperationProxy('hydrate', async () => {
        throw failure;
      })
    ).rejects.toBe(failure);

    const errorEntry = logger.errorLogs.at(-1);
    expect(errorEntry.context.status).toBe('failed');
    expect(errorEntry.context.error).toBe('boom');
  });

  it('wraps unexpected errors thrown during executeOperation', async () => {
    await expect(
      service.executeOperationProxy(
        'hydrate',
        async () => {
          throw new Error('network down');
        },
        { requestId: 'r-77' }
      )
    ).rejects.toMatchObject({
      message: "Operation 'hydrate' failed: network down",
      code: ServiceErrorCodes.OPERATION_FAILED,
    });

    const errorLog = logger.errorLogs.at(-1);
    expect(errorLog.message).toBe('ConcreteService: hydrate');
    expect(errorLog.context).toEqual({
      service: 'ConcreteService',
      operation: 'hydrate',
      status: 'failed',
      error: 'network down',
      requestId: 'r-77',
    });
  });
});
