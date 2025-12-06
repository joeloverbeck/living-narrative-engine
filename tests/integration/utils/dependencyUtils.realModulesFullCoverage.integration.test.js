import { describe, it, expect } from '@jest/globals';
import { ServiceSetup } from '../../../src/utils/serviceInitializerUtils.js';
import WorldInitializer from '../../../src/initializers/worldInitializer.js';
import SystemInitializer from '../../../src/initializers/systemInitializer.js';
import InitializationService from '../../../src/initializers/services/initializationService.js';
import TargetContextBuilder from '../../../src/scopeDsl/utils/targetContextBuilder.js';
import { MultiTargetEventBuilder } from '../../../src/entities/multiTarget/multiTargetEventBuilder.js';
import { getDefinition } from '../../../src/entities/utils/definitionLookup.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { withValidatedDeps } from '../../../src/utils/withValidatedDeps.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import {
  WorldInitializationError,
  SystemInitializationError,
} from '../../../src/errors/InitializationError.js';

class MemoryLogger {
  constructor(prefix = '') {
    this.prefix = prefix;
    this.entries = { debug: [], info: [], warn: [], error: [] };
  }

  #record(level, message, metadata) {
    this.entries[level].push({ message, metadata });
  }

  debug(message, metadata) {
    this.#record('debug', message, metadata);
  }

  info(message, metadata) {
    this.#record('info', message, metadata);
  }

  warn(message, metadata) {
    this.#record('warn', message, metadata);
  }

  error(message, metadata) {
    this.#record('error', message, metadata);
  }
}

class SimpleEntity {
  constructor(id, components = {}) {
    this.id = id;
    this._components = components;
  }

  getAllComponents() {
    return this._components;
  }
}

class SimpleEntityManager {
  constructor(initial = new Map()) {
    this.entities = new Map(initial);
  }

  createEntityInstance(definition) {
    const entity = new SimpleEntity(definition.id, definition.components ?? {});
    this.entities.set(definition.id, entity);
    return entity;
  }

  getEntityInstance(id) {
    return this.entities.get(id) ?? null;
  }

  getAllComponentTypesForEntity(id) {
    const entity = this.entities.get(id);
    if (!entity) return [];
    return Object.keys(entity.getAllComponents());
  }
}

class SimpleEventDispatcher {
  constructor(logger) {
    this.logger = logger;
    this.events = [];
  }

  dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
    this.logger?.debug?.(`dispatch:${eventId}`, payload);
    return true;
  }
}

class SimpleEventDispatchService {
  constructor(logger) {
    this.logger = logger;
    this.records = [];
  }

  dispatchWithLogging(eventId, payload, context, options = {}) {
    this.records.push({ eventId, payload, context, options });
    this.logger?.debug?.(`dispatchWithLogging:${eventId}`, {
      payload,
      context,
      options,
    });
    return true;
  }
}

class SimpleScopeRegistry {
  constructor(logger) {
    this.logger = logger;
    this.initializedWith = null;
  }

  initialize(config) {
    this.initializedWith = config;
    this.logger?.debug?.('SimpleScopeRegistry.initialize', config);
    return true;
  }
}

class RegistryAdapter {
  constructor({ dataRegistry, logger }) {
    this.dataRegistry = dataRegistry;
    this.logger = logger;
  }

  addWorld(worldDefinition) {
    this.dataRegistry.store('worlds', worldDefinition.id, worldDefinition);
  }

  addEntityDefinition(definition) {
    this.dataRegistry.store('entityDefinitions', definition.id, definition);
  }

  addEntityInstance(instanceDefinition) {
    this.dataRegistry.store(
      'entityInstances',
      instanceDefinition.id,
      instanceDefinition
    );
  }

  getWorld(id) {
    return this.dataRegistry.getWorldDefinition(id);
  }

  getEntityInstanceDefinition(id) {
    return this.dataRegistry.getEntityInstanceDefinition(id);
  }

  get(id) {
    return this.getEntityInstanceDefinition(id);
  }

  getEntityDefinition(id) {
    return this.dataRegistry.getEntityDefinition(id);
  }
}

class SimpleGameStateManager {
  constructor() {
    this.turn = 4;
    this.timeOfDay = 'dawn';
    this.weather = 'clear';
  }

  getCurrentTurn() {
    return this.turn;
  }

  getTimeOfDay() {
    return this.timeOfDay;
  }

  getWeather() {
    return this.weather;
  }
}

class SimpleResolver {
  constructor(systems, logger) {
    this.systems = systems;
    this.logger = logger;
  }

  async resolveByTag(tag) {
    this.logger?.debug?.(`SimpleResolver.resolveByTag:${tag}`);
    return this.systems;
  }
}

describe('dependencyUtils integration with real modules for full coverage', () => {
  it('validates cross-module dependencies and flows without mocks', async () => {
    const baseLogger = new MemoryLogger('base');
    const serviceSetup = new ServiceSetup();
    const prefixedLogger = serviceSetup.setupService(
      'DependencyHarness',
      baseLogger,
      {
        repository: {
          value: {
            add: () => {},
            get: () => {},
            remove: () => {},
          },
          requiredMethods: ['add', 'get', 'remove'],
        },
        callable: {
          value: () => true,
          isFunction: true,
        },
      }
    );

    serviceSetup.validateDeps('DependencyHarness', prefixedLogger, null);

    const dataRegistry = new InMemoryDataRegistry({ logger: prefixedLogger });
    const repository = new RegistryAdapter({
      dataRegistry,
      logger: prefixedLogger,
    });

    repository.addWorld({ id: 'core-world', entities: [{ id: 'actor:hero' }] });
    repository.addEntityDefinition({ id: 'entity:hero', type: 'actor' });
    repository.addEntityInstance({
      id: 'actor:hero',
      components: { identity: { name: 'Hero' } },
    });
    repository.addEntityInstance({
      id: 'location:town',
      components: { description: 'Town square' },
    });

    const entityManager = new SimpleEntityManager();
    entityManager.createEntityInstance({
      id: 'actor:hero',
      components: { identity: { name: 'Hero' } },
    });
    entityManager.createEntityInstance({
      id: 'location:town',
      components: { description: 'Town square' },
    });

    const validatedEventDispatcher = new SimpleEventDispatcher(prefixedLogger);
    const eventDispatchService = new SimpleEventDispatchService(prefixedLogger);
    const scopeRegistry = new SimpleScopeRegistry(prefixedLogger);

    const initializationLog = [];
    const resolver = new SimpleResolver(
      [
        {
          async initialize() {
            initializationLog.push('primary');
          },
        },
        {
          async initialize() {
            initializationLog.push('secondary');
            throw new Error('secondary failed');
          },
        },
        {},
        null,
      ],
      prefixedLogger
    );

    const systemInitializer = new SystemInitializer({
      resolver,
      logger: prefixedLogger,
      validatedEventDispatcher,
      eventDispatchService,
      initializationTag: 'core:init',
    });

    const worldInitializer = new WorldInitializer({
      entityManager,
      worldContext: { started: false },
      gameDataRepository: repository,
      validatedEventDispatcher,
      eventDispatchService,
      logger: prefixedLogger,
      scopeRegistry,
    });

    expect(worldInitializer.getWorldContext()).toEqual({ started: false });

    const RepositoryAccessor = withValidatedDeps(
      class Accessor {
        constructor({ repository: repo }) {
          this.repository = repo;
        }

        list(ids) {
          return ids
            .map((id) => this.repository.getEntityInstanceDefinition(id))
            .filter(Boolean);
        }
      },
      ({ repository: repo }) => [
        {
          dependency: repo,
          name: 'RepositoryAccessor.repository',
          methods: ['getEntityInstanceDefinition'],
        },
        {
          dependency: repo.getEntityInstanceDefinition.bind(repo),
          name: 'RepositoryAccessor.lookup',
          isFunction: true,
        },
      ]
    );

    const fallbackLogger = { warn: () => {} };
    const accessor = new RepositoryAccessor({
      repository,
      logger: fallbackLogger,
    });

    const listed = accessor.list(['actor:hero', 'missing']);
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe('actor:hero');

    const gameStateManager = new SimpleGameStateManager();
    const contextBuilder = new TargetContextBuilder({
      entityManager,
      gameStateManager,
      logger: prefixedLogger,
    });

    const baseContext = contextBuilder.buildBaseContext(
      'actor:hero',
      'location:town'
    );
    const dependentContext = contextBuilder.buildDependentContext(
      baseContext,
      {
        primary: [
          {
            id: 'actor:hero',
          },
        ],
      },
      { contextFrom: 'primary' }
    );

    expect(baseContext.actor.id).toBe('actor:hero');
    expect(dependentContext.target.id).toBe('actor:hero');

    const definition = getDefinition('entity:hero', repository, prefixedLogger);
    expect(definition).toEqual({ id: 'entity:hero', type: 'actor' });

    await systemInitializer.initializeAll();

    expect(initializationLog).toEqual(['primary', 'secondary']);
    expect(eventDispatchService.records.length).toBeGreaterThan(0);
    expect(scopeRegistry.initializedWith).toBeNull();

    expect(
      baseLogger.entries.debug.some((entry) =>
        entry.message.includes('DependencyHarness:')
      )
    ).toBe(true);
  });

  it('surfaces descriptive failures when dependencies are invalid', () => {
    const memoryLogger = new MemoryLogger('failures');
    const serviceSetup = new ServiceSetup();
    const prefixedLogger = serviceSetup.createLogger(
      'FailureHarness',
      memoryLogger
    );

    expect(() =>
      serviceSetup.validateDeps('FailureHarness', prefixedLogger, {
        missing: {
          value: null,
        },
      })
    ).toThrow(InvalidArgumentError);

    expect(() =>
      serviceSetup.validateDeps('FailureHarness', prefixedLogger, {
        badMethods: {
          value: { get: () => {} },
          requiredMethods: ['missingMethod'],
        },
      })
    ).toThrow(InvalidArgumentError);

    expect(() =>
      serviceSetup.validateDeps('FailureHarness', prefixedLogger, {
        badCallable: {
          value: {},
          isFunction: true,
        },
      })
    ).toThrow(InvalidArgumentError);

    const FaultyAccessor = withValidatedDeps(class Faulty {}, () => [
      {
        dependency: null,
        name: 'Faulty.repository',
      },
    ]);

    expect(() => new FaultyAccessor({ logger: undefined })).toThrow(
      InvalidArgumentError
    );

    const builderLogger = new MemoryLogger('builder');
    const multiTargetBuilder = new MultiTargetEventBuilder({
      logger: builderLogger,
    });
    expect(() => multiTargetBuilder.setTargets(null)).toThrow(Error);
    expect(
      builderLogger.entries.error.some(({ message }) =>
        message.includes('Targets object is required')
      )
    ).toBe(true);

    const initLogger = new MemoryLogger('init');
    expect(
      () => new InitializationService({ log: { logger: initLogger } })
    ).toThrow(SystemInitializationError);
    expect(
      initLogger.entries.error.some(({ message }) =>
        message.includes('validatedEventDispatcher')
      )
    ).toBe(true);

    const dataRegistry = new InMemoryDataRegistry({ logger: prefixedLogger });
    const repository = new RegistryAdapter({
      dataRegistry,
      logger: prefixedLogger,
    });
    repository.addWorld({ id: 'core-world', entities: [{ id: 'actor:hero' }] });
    repository.addEntityDefinition({ id: 'entity:hero', type: 'actor' });
    repository.addEntityInstance({
      id: 'actor:hero',
      components: { identity: { name: 'Hero' } },
    });

    const entityManager = new SimpleEntityManager();
    entityManager.createEntityInstance({
      id: 'actor:hero',
      components: { identity: { name: 'Hero' } },
    });

    const gameStateManager = new SimpleGameStateManager();
    const contextLogger = new MemoryLogger('context');
    const contextBuilder = new TargetContextBuilder({
      entityManager,
      gameStateManager,
      logger: contextLogger,
    });

    expect(() =>
      contextBuilder.buildBaseContext('   ', 'location:town')
    ).toThrow(InvalidArgumentError);
    expect(contextLogger.entries.error.length).toBeGreaterThan(0);

    expect(() =>
      contextBuilder.buildDependentContext(null, {}, { contextFrom: 'primary' })
    ).toThrow(Error);

    expect(() => getDefinition('   ', repository, memoryLogger)).toThrow(
      InvalidArgumentError
    );
    expect(memoryLogger.entries.warn.length).toBeGreaterThan(0);

    expect(
      () =>
        new WorldInitializer({
          entityManager: {},
          worldContext: {},
          gameDataRepository: {
            getWorld: () => ({}),
            getEntityInstanceDefinition: () => ({}),
          },
          validatedEventDispatcher: { dispatch: () => {} },
          eventDispatchService: { dispatchWithLogging: () => {} },
          logger: prefixedLogger,
          scopeRegistry: { initialize: () => {} },
        })
    ).toThrow(WorldInitializationError);

    expect(
      () =>
        new SystemInitializer({
          resolver: {},
          logger: prefixedLogger,
          validatedEventDispatcher: { dispatch: () => {} },
          eventDispatchService: new SimpleEventDispatchService(prefixedLogger),
          initializationTag: '   ',
        })
    ).toThrow(Error);
  });
});
