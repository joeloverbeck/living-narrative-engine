import { describe, it, expect, beforeEach } from '@jest/globals';
import AppContainer from '../../../../../src/dependencyInjection/appContainer.js';
import { ServiceFactory } from '../../../../../src/actions/pipeline/services/ServiceFactory.js';
import {
  ServiceError,
  ServiceErrorCodes,
} from '../../../../../src/actions/pipeline/services/base/ServiceError.js';
import { tokens } from '../../../../../src/dependencyInjection/tokens.js';

class RecordingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(...args) {
    this.debugLogs.push(args);
  }

  info(...args) {
    this.infoLogs.push(args);
  }

  warn(...args) {
    this.warnLogs.push(args);
  }

  error(...args) {
    this.errorLogs.push(args);
  }
}

describe('ServiceFactory integration coverage for error handling and registration', () => {
  /** @type {AppContainer} */
  let container;
  /** @type {RecordingLogger} */
  let logger;

  beforeEach(() => {
    container = new AppContainer();
    logger = new RecordingLogger();
  });

  const createFactory = () => new ServiceFactory({ container, logger });

  it('creates registered services and logs successful resolution', () => {
    container.register('GreeterService', () => ({ greeting: 'hello' }), {
      lifecycle: 'transient',
    });

    const factory = createFactory();
    const instance = factory.createService('GreeterService');

    expect(instance).toEqual({ greeting: 'hello' });
    expect(
      logger.debugLogs.some(([message]) =>
        message.includes('Successfully created service: GreeterService')
      )
    ).toBe(true);
  });

  it('wraps unexpected resolution failures in a ServiceError', () => {
    container.register('ExplodingService', () => {
      throw new Error('boom');
    });

    const factory = createFactory();

    try {
      factory.createService('ExplodingService');
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceError);
      expect(error.code).toBe(ServiceErrorCodes.DEPENDENCY_ERROR);
      expect(error.message).toContain('ExplodingService');
      expect(
        logger.errorLogs.some(([message]) =>
          message.includes(
            'Failed to create service for token ExplodingService'
          )
        )
      ).toBe(true);
    }
  });

  it('rethrows ServiceError instances without wrapping them', () => {
    const originalResolve = container.resolve.bind(container);
    container.resolve = (token) => {
      if (token === 'ServiceErrorToken') {
        throw new ServiceError(
          'custom failure',
          ServiceErrorCodes.INVALID_STATE
        );
      }
      return originalResolve(token);
    };

    const factory = createFactory();

    try {
      factory.createService('ServiceErrorToken');
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceError);
      expect(error.code).toBe(ServiceErrorCodes.INVALID_STATE);
      expect(error.message).toBe('custom failure');
    } finally {
      container.resolve = originalResolve;
    }
  });

  it('aggregates failures when creating multiple services', () => {
    container.register('StableService', () => ({ ok: true }), {
      lifecycle: 'transient',
    });

    const originalResolve = container.resolve.bind(container);
    container.resolve = (token) => {
      if (token === 'UnstableService') {
        throw new Error('unstable!');
      }
      return originalResolve(token);
    };

    const factory = createFactory();

    try {
      factory.createServices(['StableService', 'UnstableService']);
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceError);
      expect(error.code).toBe(ServiceErrorCodes.DEPENDENCY_ERROR);
      expect(error.value.errors).toHaveLength(1);
      const [captured] = error.value.errors;
      expect(captured.token).toBe('UnstableService');
      expect(captured.error).toBeInstanceOf(ServiceError);
      expect(captured.error.message).toContain('UnstableService');
    } finally {
      container.resolve = originalResolve;
    }
  });

  it('returns a map of services when all createServices calls succeed', () => {
    container.register('AlphaService', () => ({ alpha: 1 }), {
      lifecycle: 'transient',
    });
    container.register('BetaService', () => ({ beta: 2 }), {
      lifecycle: 'transient',
    });

    const factory = createFactory();
    const services = factory.createServices(['AlphaService', 'BetaService']);

    expect(services).toBeInstanceOf(Map);
    expect(services.get('AlphaService')).toEqual({ alpha: 1 });
    expect(services.get('BetaService')).toEqual({ beta: 2 });
  });

  it('registers singleton services and exposes them through the container', () => {
    const factory = createFactory();

    class SingletonService {
      constructor() {
        this.createdAt = Date.now();
      }
    }

    factory.registerService('SingletonService', SingletonService);

    const first = container.resolve('SingletonService');
    const second = container.resolve('SingletonService');

    expect(first).toBeInstanceOf(SingletonService);
    expect(first).toBe(second);
  });

  it('supports registering non-singleton services and forwards options to the container', () => {
    const optionsRecord = [];
    const originalRegister = container.register.bind(container);
    container.register = (token, implementation, options) => {
      optionsRecord.push({ token, options });
      return originalRegister(token, implementation, options);
    };

    const factory = createFactory();

    class TransientService {}

    container.register('DependencyToken', { provided: true });
    factory.registerService('TransientService', TransientService, {
      singleton: false,
      dependencies: ['DependencyToken'],
    });

    const first = container.resolve('TransientService');
    const second = container.resolve('TransientService');

    expect(first).toBeInstanceOf(TransientService);
    expect(second).toBeInstanceOf(TransientService);
    expect(
      optionsRecord.some(
        ({ token, options }) =>
          token === 'TransientService' && options?.singleton === false
      )
    ).toBe(true);

    container.register = originalRegister;
  });

  it('wraps registration failures in ServiceError', () => {
    const originalRegister = container.register.bind(container);
    container.register = (token, implementation, options) => {
      if (token === 'BrokenService') {
        throw new Error('cannot register');
      }
      return originalRegister(token, implementation, options);
    };

    const factory = createFactory();

    try {
      factory.registerService('BrokenService', class {});
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceError);
      expect(error.code).toBe(ServiceErrorCodes.DEPENDENCY_ERROR);
      expect(error.message).toContain('BrokenService');
      expect(
        logger.errorLogs.some(([message]) =>
          message.includes('Failed to register service: BrokenService')
        )
      ).toBe(true);
    } finally {
      container.register = originalRegister;
    }
  });

  it('reports registration availability through hasService', () => {
    container.register('AvailableService', () => ({ ok: true }));

    const factory = createFactory();

    expect(factory.hasService('AvailableService')).toBe(true);
    expect(factory.hasService('MissingService')).toBe(false);
  });

  it('filters pipeline tokens by actual registrations', () => {
    container.register(tokens.ITargetDependencyResolver, { name: 'resolver' });
    container.register(tokens.ITargetDisplayNameResolver, { name: 'display' });

    const factory = createFactory();

    const registered = factory.getRegisteredServices();

    expect(registered).toContain(tokens.ITargetDependencyResolver);
    expect(registered).toContain(tokens.ITargetDisplayNameResolver);
    expect(registered).not.toContain(tokens.ILegacyTargetCompatibilityLayer);
  });
});
