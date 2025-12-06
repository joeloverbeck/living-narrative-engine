import { describe, it, expect } from '@jest/globals';

import InitializationService from '../../../src/initializers/services/initializationService.js';
import SystemInitializer from '../../../src/initializers/systemInitializer.js';
import { SystemInitializationError } from '../../../src/errors/InitializationError.js';
import { TargetManager } from '../../../src/entities/multiTarget/targetManager.js';
import { LocationQueryService } from '../../../src/entities/locationQueryService.js';
import FacadeFactory from '../../../src/shared/facades/FacadeFactory.js';
import FacadeRegistry from '../../../src/shared/facades/FacadeRegistry.js';
import BaseFacade from '../../../src/shared/facades/BaseFacade.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { withValidatedDeps } from '../../../src/utils/withValidatedDeps.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

class TestLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(message, metadata) {
    this.debugMessages.push({ message, metadata });
  }

  info(message, metadata) {
    this.infoMessages.push({ message, metadata });
  }

  warn(message, metadata) {
    this.warnMessages.push({ message, metadata });
  }

  error(message, metadata) {
    this.errorMessages.push({ message, metadata });
  }
}

class SimpleSpatialIndexManager {
  constructor(resultMap = new Map()) {
    this.resultMap = resultMap;
    this.calls = [];
  }

  getEntitiesInLocation(locationId) {
    this.calls.push(locationId);
    return this.resultMap.get(locationId) ?? new Set();
  }
}

class SimpleEventBus {
  constructor() {
    this.events = [];
    this.subscriptions = [];
  }

  dispatch(event) {
    this.events.push(event);
  }

  subscribe(eventName, handler) {
    this.subscriptions.push({ eventName, handler });
    return () => {};
  }
}

class SimpleUnifiedCache {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    return this.store.get(key);
  }

  async set(key, value) {
    this.store.set(key, value);
  }

  async invalidate(key) {
    if (typeof key === 'string') {
      this.store.delete(key);
    } else {
      this.store.clear();
    }
  }
}

class ExampleFacade extends BaseFacade {
  constructor(deps) {
    super(deps);
    this.initialized = true;
  }

  async noop() {
    return 'noop';
  }
}

describe('dependencyUtils integration coverage across collaborating modules', () => {
  it('reports missing dispatcher when initialization service is wired with incomplete events infrastructure', () => {
    const logger = new TestLogger();

    const createInitializationService = () =>
      new InitializationService({
        log: { logger },
        events: {
          validatedEventDispatcher: {},
          safeEventDispatcher: { subscribe: () => () => {} },
        },
        llm: {},
        persistence: {},
        coreSystems: {},
      });

    expect(createInitializationService).toThrow(SystemInitializationError);
    expect(logger.errorMessages.map((entry) => entry.message)).toContain(
      "InitializationService: Missing or invalid required dependency 'validatedEventDispatcher'."
    );
  });

  it('initializes system orchestration when valid dependencies are supplied', async () => {
    const logger = new TestLogger();
    const resolver = {
      async resolveByTag(tag) {
        return tag === 'core' ? [] : [];
      },
    };
    const validatedEventDispatcher = {
      async dispatch() {
        return true;
      },
    };
    const eventDispatchService = {
      async dispatchWithLogging() {},
    };

    const initializer = new SystemInitializer({
      resolver,
      logger,
      validatedEventDispatcher,
      eventDispatchService,
      initializationTag: 'core',
    });

    await initializer.initializeAll();
    expect(
      logger.debugMessages.some((entry) =>
        entry.message.includes('SystemInitializer: Starting initialization')
      )
    ).toBe(true);
  });

  it('guards multi-target flows by enforcing presence and non-blank parameters', () => {
    const logger = new TestLogger();
    const manager = new TargetManager({ logger });

    expect(() => manager.setTargets(null)).toThrow(
      'Targets object is required'
    );
    expect(logger.errorMessages[0]).toMatchObject({
      message: 'Targets object is required',
    });

    expect(() => manager.addTarget('   ', 'entity-123')).toThrow(
      InvalidArgumentError
    );
    expect(
      logger.errorMessages.some((entry) =>
        entry.message.includes('TargetManager.addTarget')
      )
    ).toBe(true);

    manager.setTargets({ primary: 'entity-123' });
    manager.addTarget('secondary', 'entity-456');
    expect(manager.getPrimaryTarget()).toBe('entity-123');
  });

  it('safeguards location queries by validating identifiers and warning when invalid', () => {
    const logger = new TestLogger();
    const spatialIndexManager = new SimpleSpatialIndexManager(
      new Map([['loc-1', new Set(['entity-a'])]])
    );
    const service = new LocationQueryService({ spatialIndexManager, logger });

    const emptyResult = service.getEntitiesInLocation('   ');
    expect(Array.from(emptyResult)).toHaveLength(0);
    expect(logger.warnMessages[0]).toMatchObject({
      message:
        "LocationQueryService.getEntitiesInLocation called with invalid locationId: '   '",
    });

    const validResult = service.getEntitiesInLocation('loc-1');
    expect(Array.from(validResult)).toEqual(['entity-a']);
    expect(spatialIndexManager.calls).toEqual(['loc-1']);
  });

  it('validates facade infrastructure dependencies and enforces non-blank facade identifiers', () => {
    const logger = new TestLogger();

    class BrokenContainer {
      isRegistered() {
        return false;
      }
    }

    expect(
      () =>
        new FacadeFactory({
          logger,
          container: new BrokenContainer(),
        })
    ).toThrow(InvalidArgumentError);
    expect(
      logger.errorMessages.some((entry) =>
        entry.message.includes(
          "Invalid or missing method 'resolve' on dependency 'IContainer'."
        )
      )
    ).toBe(true);

    const container = new AppContainer();
    container.register('ILogger', logger);
    container.register('IEventBus', () => new SimpleEventBus(), {
      lifecycle: 'singletonFactory',
    });
    container.register('IUnifiedCache', () => new SimpleUnifiedCache(), {
      lifecycle: 'singletonFactory',
    });
    container.register('TestFacade', () => ExampleFacade, {
      lifecycle: 'singletonFactory',
    });

    const factory = new FacadeFactory({ logger, container });
    const registry = new FacadeRegistry({
      logger,
      eventBus: container.resolve('IEventBus'),
      facadeFactory: factory,
    });

    expect(() => factory.createFacade('')).toThrow(InvalidArgumentError);
    expect(
      logger.errorMessages.some(
        (entry) =>
          entry.message.includes('createFacade: Invalid Facade name') ||
          entry.message.includes('Failed to create facade: ')
      )
    ).toBe(true);

    registry.register(
      {
        name: 'TestFacade',
        category: 'integration',
        version: '1.0.0',
        description: 'Example facade for dependency validation',
      },
      { name: 'TestFacade' }
    );

    const instance = registry.getFacade('TestFacade');
    expect(instance).toBeInstanceOf(ExampleFacade);
    expect(instance.initialized).toBe(true);
  });

  it('validates dependency specifications produced by wrappers across success and failure modes', () => {
    const logger = new TestLogger();

    const OptionalSpecComponent = withValidatedDeps(
      class {
        constructor(args) {
          this.args = args;
        }
      },
      () => undefined
    );

    const optionalInstance = new OptionalSpecComponent({ logger });
    expect(optionalInstance.args.logger).toBe(logger);

    const ValidatedComponent = withValidatedDeps(
      class {
        constructor(args) {
          this.args = args;
        }
      },
      (args) => [
        {
          dependency: args.logger,
          name: 'Logger',
          methods: ['debug', 'error'],
        },
        {
          dependency: args.worker,
          name: 'WorkerFunction',
          isFunction: true,
        },
        {
          dependency: args.cache,
          name: 'CacheService',
          methods: ['get', 'set'],
        },
        {
          dependency: args.optionalService,
          name: 'OptionalService',
        },
      ]
    );

    const cacheService = {
      get() {
        return null;
      },
      set() {},
    };

    const worker = () => 'done';
    const validatedInstance = new ValidatedComponent({
      logger,
      worker,
      cache: cacheService,
      optionalService: {},
    });
    expect(validatedInstance.args.worker()).toBe('done');

    const MissingDependencyComponent = withValidatedDeps(class {}, (args) => [
      { dependency: args.service, name: 'CriticalService', methods: ['run'] },
    ]);

    expect(
      () => new MissingDependencyComponent({ logger, service: null })
    ).toThrow(InvalidArgumentError);
    expect(
      logger.errorMessages.some((entry) =>
        entry.message.includes('Missing required dependency: CriticalService.')
      )
    ).toBe(true);

    expect(
      () =>
        new ValidatedComponent({
          logger,
          worker: {},
          cache: cacheService,
          optionalService: {},
        })
    ).toThrow(InvalidArgumentError);

    expect(
      () =>
        new ValidatedComponent({
          logger,
          worker,
          cache: { get: () => {}, set: null },
          optionalService: {},
        })
    ).toThrow(InvalidArgumentError);

    const FallbackLoggerComponent = withValidatedDeps(
      class {
        constructor(args) {
          this.args = args;
        }
      },
      (args) => [
        {
          dependency: args.service,
          name: 'Service',
          methods: ['run'],
        },
      ]
    );

    const fallbackInstance = new FallbackLoggerComponent({
      logger: { debug() {}, info() {}, warn() {} },
      service: { run() {} },
    });
    expect(typeof fallbackInstance.args.service.run).toBe('function');
  });
});
