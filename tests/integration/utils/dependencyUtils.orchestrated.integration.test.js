import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import EventBus from '../../../src/events/eventBus.js';
import UnifiedCache from '../../../src/cache/UnifiedCache.js';
import BaseFacade from '../../../src/shared/facades/BaseFacade.js';
import FacadeFactory from '../../../src/shared/facades/FacadeFactory.js';
import FacadeRegistry from '../../../src/shared/facades/FacadeRegistry.js';
import { EventDispatchService } from '../../../src/utils/eventDispatchService.js';
import SystemInitializer from '../../../src/initializers/systemInitializer.js';
import WorldInitializer from '../../../src/initializers/worldInitializer.js';
import InitializationService from '../../../src/initializers/services/initializationService.js';
import { LocationQueryService } from '../../../src/entities/locationQueryService.js';
import { TargetManager } from '../../../src/entities/multiTarget/targetManager.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import {
  WorldInitializationError,
  SystemInitializationError,
} from '../../../src/errors/InitializationError.js';
import { withValidatedDeps } from '../../../src/utils/withValidatedDeps.js';

/**
 * Simple facade implementation exercising BaseFacade behaviour.
 */
class IntegrationTestFacade extends BaseFacade {
  constructor(deps) {
    super(deps);
    this._hits = 0;
  }

  async warmCache(cacheKey, payloadBuilder) {
    return await this.cacheableOperation(cacheKey, async () => {
      this._hits += 1;
      return payloadBuilder();
    });
  }

  async performResilientOperation(name, operation) {
    return await this.executeWithResilience(name, operation, null, {
      timeout: 50,
    });
  }

  announce(payload) {
    this.dispatchEvent('INTEGRATION_FACADE_READY', payload);
  }

  get invocationCount() {
    return this._hits;
  }
}

describe('dependencyUtils integration orchestrated across real modules', () => {
  /** @type {ReturnType<typeof jest.spyOn>[]} */
  let consoleSpies;
  /** @type {ConsoleLogger} */
  let logger;
  /** @type {AppContainer} */
  let container;
  /** @type {EventBus} */
  let eventBus;
  /** @type {UnifiedCache} */
  let unifiedCache;
  /** @type {FacadeFactory} */
  let facadeFactory;
  /** @type {FacadeRegistry} */
  let facadeRegistry;

  beforeEach(() => {
    consoleSpies = [
      jest.spyOn(console, 'info').mockImplementation(() => {}),
      jest.spyOn(console, 'warn').mockImplementation(() => {}),
      jest.spyOn(console, 'error').mockImplementation(() => {}),
      jest.spyOn(console, 'debug').mockImplementation(() => {}),
      jest.spyOn(console, 'group').mockImplementation(() => {}),
      jest.spyOn(console, 'groupCollapsed').mockImplementation(() => {}),
      jest.spyOn(console, 'groupEnd').mockImplementation(() => {}),
    ];

    logger = new ConsoleLogger(LogLevel.DEBUG);

    container = new AppContainer();
    container.register('ILogger', () => logger);
    container.register('EventBus', EventBus, {
      lifecycle: 'singleton',
      dependencies: ['ILogger'],
    });
    container.register('IEventBus', () => container.resolve('EventBus'));
    container.register('UnifiedCache', UnifiedCache, {
      lifecycle: 'singleton',
      dependencies: ['ILogger'],
    });
    container.register('IUnifiedCache', () =>
      container.resolve('UnifiedCache')
    );
    container.register('IntegrationTestFacade', () => IntegrationTestFacade);

    eventBus = container.resolve('EventBus');
    unifiedCache = container.resolve('UnifiedCache');
    facadeFactory = new FacadeFactory({ logger, container });
    facadeRegistry = new FacadeRegistry({
      logger,
      eventBus,
      facadeFactory,
    });

    facadeRegistry.register(
      {
        name: 'IntegrationTestFacade',
        category: 'integration',
        version: '1.0.0',
        description: 'Synthetic facade used for exercising dependency guards',
      },
      {
        name: 'IntegrationTestFacade',
        constructor: IntegrationTestFacade,
        dependencies: ['ILogger', 'EventBus', 'UnifiedCache'],
      }
    );
  });

  afterEach(() => {
    consoleSpies.forEach((spy) => spy.mockRestore());
  });

  it('wires container-managed modules and exercises dependency validations end-to-end', async () => {
    const receivedEvents = [];
    eventBus.subscribe('INTEGRATION_FACADE_READY', (event) => {
      receivedEvents.push(event);
    });

    const facade = facadeRegistry.getFacade('IntegrationTestFacade');

    const cachedValue = await facade.warmCache('integration:payload', () => ({
      timestamp: Date.now(),
      source: 'integration-test',
    }));
    expect(cachedValue.source).toBe('integration-test');

    const cacheHit = await facade.warmCache('integration:payload', () => ({
      timestamp: Date.now(),
      source: 'should-not-run',
    }));
    expect(cacheHit.source).toBe('integration-test');
    expect(facade.invocationCount).toBe(1);

    const result = await facade.performResilientOperation(
      'ping-backend',
      async () => {
        return 'pong';
      }
    );
    expect(result).toBe('pong');

    facade.announce({ shard: 'alpha' });
    await eventBus.dispatch('INTEGRATION_FACADE_READY');
    expect(receivedEvents.length).toBeGreaterThan(0);

    console.error.mockClear();
    const targetManager = new TargetManager({ logger });
    expect(() => targetManager.setTargets(null)).toThrow(
      'Targets object is required'
    );
    expect(console.error).toHaveBeenCalled();

    // UnifiedCache should now contain the computed payload.
    const rawFromCache = unifiedCache.get('integration:payload');
    expect(rawFromCache.source).toBe('integration-test');
  });

  it('surfaces invalid wiring through dependency guards across factory and registry', () => {
    expect(
      () =>
        new FacadeFactory({
          logger,
          container: { resolve() {} },
        })
    ).toThrow(InvalidArgumentError);

    expect(
      () =>
        new FacadeFactory({
          logger,
          container: null,
        })
    ).toThrow(InvalidArgumentError);

    const brokenEventBus = { subscribe: () => {}, dispatch: null };
    expect(
      () =>
        new FacadeRegistry({
          logger,
          eventBus: brokenEventBus,
          facadeFactory,
        })
    ).toThrow(InvalidArgumentError);

    expect(() => facadeFactory.createFacade('   ')).toThrow(
      InvalidArgumentError
    );

    expect(
      () => new EventDispatchService({ safeEventDispatcher: null, logger })
    ).toThrow('EventDispatchService: safeEventDispatcher is required');

    expect(
      () =>
        new InitializationService({
          log: { logger },
          events: {
            validatedEventDispatcher: {},
            safeEventDispatcher: { subscribe() {} },
          },
        })
    ).toThrow(SystemInitializationError);
  });

  it('enforces presence and function contracts when initializing systems', async () => {
    class NoopDispatcher {
      constructor() {
        this.calls = [];
      }
      async dispatch(eventName, payload) {
        this.calls.push({ eventName, payload });
      }
    }

    const safeDispatcher = {
      async dispatch() {
        return true;
      },
    };

    const eventDispatchService = new EventDispatchService({
      safeEventDispatcher: safeDispatcher,
      logger,
    });

    const resolver = {
      async resolveByTag(tag) {
        if (tag === 'startup') {
          return [
            {
              async initialize() {
                return true;
              },
            },
            {},
          ];
        }
        return [];
      },
    };

    const initializer = new SystemInitializer({
      resolver,
      logger,
      validatedEventDispatcher: new NoopDispatcher(),
      eventDispatchService,
      initializationTag: 'startup',
    });

    await initializer.initializeAll();

    expect(
      () =>
        new SystemInitializer({
          resolver: {},
          logger,
          validatedEventDispatcher: new NoopDispatcher(),
          eventDispatchService,
          initializationTag: 'boot',
        })
    ).toThrow(/resolveByTag/);

    expect(
      () =>
        new SystemInitializer({
          resolver,
          logger: null,
          validatedEventDispatcher: new NoopDispatcher(),
          eventDispatchService,
          initializationTag: 'boot',
        })
    ).toThrow('SystemInitializer requires an ILogger instance.');
  });

  it('guards world initialization dependencies using assertMethods and related helpers', () => {
    const dependencies = {
      entityManager: {
        createEntityInstance: () => {},
        hasBatchSupport: () => false,
      },
      worldContext: {},
      gameDataRepository: {
        getWorld: () => ({}),
        getEntityInstanceDefinition: () => ({}),
        get: () => ({}),
      },
      validatedEventDispatcher: { dispatch: () => {} },
      eventDispatchService: { dispatchWithLogging: () => Promise.resolve() },
      logger,
      scopeRegistry: { initialize: () => {} },
    };

    const worldInitializer = new WorldInitializer(dependencies);
    expect(worldInitializer.getWorldContext()).toBe(dependencies.worldContext);

    expect(
      () =>
        new WorldInitializer({
          ...dependencies,
          gameDataRepository: {
            getWorld: () => ({}),
          },
        })
    ).toThrow(WorldInitializationError);
  });

  it('validates identifiers through LocationQueryService and propagates logging on failure', () => {
    const spatialIndexManager = {
      getEntitiesInLocation(id) {
        return new Set([`${id}:entity-a`, `${id}:entity-b`]);
      },
    };

    const service = new LocationQueryService({
      spatialIndexManager,
      logger,
    });

    const validResult = service.getEntitiesInLocation('location-42');
    expect(Array.from(validResult)).toContain('location-42:entity-a');

    const invalidResult = service.getEntitiesInLocation('');
    expect(invalidResult.size).toBe(0);
    expect(console.warn).toHaveBeenCalled();
  });

  it('enforces function specifications when composed with withValidatedDeps', () => {
    class ServiceBase {
      constructor({ logger }) {
        this.logger = logger;
      }
    }

    const EnhancedService = withValidatedDeps(
      ServiceBase,
      ({ handler, aggregator, logger: suppliedLogger }) => [
        {
          dependency: suppliedLogger,
          name: 'ILogger',
          methods: ['info', 'error'],
        },
        { dependency: handler, name: 'handler', isFunction: true },
        {
          dependency: aggregator,
          name: 'aggregator',
          methods: ['add', 'flush'],
        },
      ]
    );

    const handler = () => 'handled';
    const aggregator = {
      add: jest.fn(),
      flush: jest.fn(),
    };

    const service = new EnhancedService({
      logger,
      handler,
      aggregator,
    });

    expect(service.logger).toBe(logger);

    expect(
      () =>
        new EnhancedService({
          logger,
          handler: {},
          aggregator,
        })
    ).toThrow(InvalidArgumentError);

    expect(
      () =>
        new EnhancedService({
          logger,
          handler,
          aggregator: { add: () => {} },
        })
    ).toThrow(InvalidArgumentError);
  });
});
