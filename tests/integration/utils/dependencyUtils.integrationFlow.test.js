import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import { ServiceSetup } from '../../../src/utils/serviceInitializerUtils.js';
import { withValidatedDeps } from '../../../src/utils/withValidatedDeps.js';
import WorldInitializer from '../../../src/initializers/worldInitializer.js';
import TargetContextBuilder from '../../../src/scopeDsl/utils/targetContextBuilder.js';
import { getDefinition } from '../../../src/entities/utils/definitionLookup.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import InitializationService from '../../../src/initializers/services/initializationService.js';
import { MapManager } from '../../../src/utils/mapManagerUtils.js';
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

  hasBatchSupport() {
    return true;
  }

  createEntityInstance(def) {
    const entity = new SimpleEntity(def.id, def.components ?? {});
    this.entities.set(def.id, entity);
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
    this.dispatched = [];
  }

  dispatch(eventId, payload) {
    this.dispatched.push({ eventId, payload });
    this.logger?.debug?.(`dispatch:${eventId}`, payload);
    return true;
  }
}

class SimpleEventDispatchService {
  constructor(logger) {
    this.logger = logger;
    this.records = [];
  }

  dispatchWithLogging(eventId, payload) {
    this.records.push({ eventId, payload });
    this.logger?.debug?.(`dispatchWithLogging:${eventId}`, payload);
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

  addEntityInstance(instanceDefinition) {
    this.dataRegistry.store(
      'entityInstances',
      instanceDefinition.id,
      instanceDefinition
    );
  }

  addEntityDefinition(definition) {
    this.dataRegistry.store('entityDefinitions', definition.id, definition);
  }

  getWorld(id) {
    return this.dataRegistry.getWorldDefinition(id);
  }

  getEntityInstanceDefinition(id) {
    return this.dataRegistry.getEntityInstanceDefinition(id);
  }

  get(id) {
    return this.dataRegistry.getEntityInstanceDefinition(id);
  }

  getEntityDefinition(id) {
    return this.dataRegistry.getEntityDefinition(id);
  }

  getAll(type) {
    return this.dataRegistry.getAll(type);
  }
}

class SimpleGameStateManager {
  constructor() {
    this.turn = 7;
    this.timeOfDay = 'dusk';
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

class SimpleContentValidator {
  constructor(logger) {
    this.logger = logger;
    this.validated = [];
  }

  async validate(worldName) {
    this.validated.push(worldName);
    this.logger?.debug?.(`content validated for ${worldName}`);
  }
}

class SimpleModsLoader {
  constructor(logger) {
    this.logger = logger;
    this.loaded = [];
  }

  async loadMods(worldName) {
    this.loaded.push(worldName);
    this.logger?.debug?.(`mods loaded for ${worldName}`);
    return { worldName, modules: 1 };
  }
}

class SimpleLLMAdapterInitializer {
  constructor(logger) {
    this.logger = logger;
    this.calls = [];
  }

  async initialize(llmAdapter, llmConfigLoader) {
    this.calls.push({ llmAdapter, llmConfigLoader });
    this.logger?.debug?.('SimpleLLMAdapterInitializer.initialize');
    return true;
  }
}

class SimpleAnatomyFormattingService {
  constructor(logger) {
    this.logger = logger;
    this.invocations = 0;
  }

  async initialize() {
    this.invocations += 1;
    this.logger?.debug?.('SimpleAnatomyFormattingService.initialize');
  }
}

class SimpleLLMAdapter {
  constructor() {
    this.initialized = false;
  }

  async init() {
    this.initialized = true;
  }
}

describe('dependencyUtils cross-module integration', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('wires core services with validated dependencies and shared guards', async () => {
    const consoleLogger = new ConsoleLogger(LogLevel.DEBUG);
    const serviceSetup = new ServiceSetup();

    const prefixedLogger = serviceSetup.setupService(
      'WorldBootstrap',
      consoleLogger,
      {
        repository: {
          value: new MapManager(),
          requiredMethods: ['add', 'get', 'remove'],
        },
        dispatcher: {
          value: new SimpleEventDispatcher(consoleLogger),
          requiredMethods: ['dispatch'],
        },
      }
    );

    const dataRegistry = new InMemoryDataRegistry({ logger: prefixedLogger });
    const repository = new RegistryAdapter({
      dataRegistry,
      logger: prefixedLogger,
    });

    repository.addWorld({ id: 'core-world', entities: [{ id: 'actor:1' }] });
    repository.addEntityDefinition({ id: 'entity:actor', type: 'actor' });
    repository.addEntityInstance({
      id: 'actor:1',
      components: { identity: { name: 'Hero' } },
    });

    const entityManager = new SimpleEntityManager();
    const worldContext = { started: false };
    const eventDispatcher = new SimpleEventDispatcher(prefixedLogger);
    const eventDispatchService = new SimpleEventDispatchService(prefixedLogger);
    const scopeRegistry = new SimpleScopeRegistry(prefixedLogger);

    const worldInitializer = new WorldInitializer({
      entityManager,
      worldContext,
      gameDataRepository: repository,
      validatedEventDispatcher: eventDispatcher,
      eventDispatchService,
      logger: prefixedLogger,
      scopeRegistry,
    });

    expect(worldInitializer.getWorldContext()).toBe(worldContext);

    const ValidatedAccessor = withValidatedDeps(
      class RepositoryAccessor {
        constructor({ repository }) {
          this.repository = repository;
        }

        list(ids) {
          return ids
            .map((id) => this.repository.getEntityInstanceDefinition(id))
            .filter(Boolean);
        }
      },
      ({ repository }) => [
        {
          dependency: repository,
          name: 'RepositoryAccessor: repository',
          methods: ['getEntityInstanceDefinition'],
        },
        {
          dependency: repository.getEntityInstanceDefinition.bind(repository),
          name: 'RepositoryAccessor: getter',
          isFunction: true,
        },
      ]
    );

    const accessor = new ValidatedAccessor({
      repository,
      logger: prefixedLogger,
    });

    entityManager.createEntityInstance({
      id: 'actor:1',
      components: { identity: { name: 'Hero' } },
    });
    entityManager.createEntityInstance({
      id: 'location:town',
      components: { description: 'Town' },
    });

    const gameStateManager = new SimpleGameStateManager();
    const contextBuilder = new TargetContextBuilder({
      entityManager,
      gameStateManager,
      logger: prefixedLogger,
    });

    const baseContext = contextBuilder.buildBaseContext(
      'actor:1',
      'location:town'
    );
    expect(baseContext.actor.id).toBe('actor:1');

    const dependentContext = contextBuilder.buildDependentContext(
      baseContext,
      {
        primary: [
          {
            id: 'actor:1',
          },
        ],
      },
      { contextFrom: 'primary' }
    );

    expect(dependentContext.target.id).toBe('actor:1');

    const definition = getDefinition(
      'entity:actor',
      repository,
      prefixedLogger
    );
    expect(definition).toEqual({ id: 'entity:actor', type: 'actor' });

    const foundInstances = accessor.list(['actor:1']);
    expect(foundInstances).toHaveLength(1);
    expect(foundInstances[0].id).toBe('actor:1');

    const modsLoader = new SimpleModsLoader(prefixedLogger);
    const contentValidator = new SimpleContentValidator(prefixedLogger);
    const llmAdapterInitializer = new SimpleLLMAdapterInitializer(
      prefixedLogger
    );
    const anatomyFormattingService = new SimpleAnatomyFormattingService(
      prefixedLogger
    );
    const llmAdapter = new SimpleLLMAdapter();
    const llmConfigLoader = { load: async () => ({}) };

    const initService = new InitializationService({
      log: { logger: prefixedLogger },
      events: {
        validatedEventDispatcher: eventDispatcher,
        safeEventDispatcher: { subscribe: () => true },
      },
      llm: {
        llmAdapter,
        llmConfigLoader,
      },
      persistence: {
        entityManager,
        domUiFacade: { boot: () => {} },
        actionIndex: { buildIndex: () => ({}) },
        gameDataRepository: {
          getAllActionDefinitions: () => [],
        },
        thoughtListener: { handleEvent: () => {} },
        notesListener: { handleEvent: () => {} },
        spatialIndexManager: { buildIndex: () => {} },
      },
      coreSystems: {
        modsLoader,
        scopeRegistry,
        dataRegistry,
        systemInitializer: { initializeAll: async () => {} },
        worldInitializer,
        contentDependencyValidator: contentValidator,
        llmAdapterInitializer,
        anatomyFormattingService,
      },
    });

    const result = await initService.runInitializationSequence('core-world');
    expect(result.success).toBe(true);
    expect(modsLoader.loaded).toContain('core-world');
    expect(contentValidator.validated).toContain('core-world');
    expect(anatomyFormattingService.invocations).toBe(1);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('surfaces descriptive dependency failures with real modules', () => {
    const consoleLogger = new ConsoleLogger(LogLevel.ERROR);
    const serviceSetup = new ServiceSetup();
    const memoryLogger = new MemoryLogger('failures');

    expect(() =>
      serviceSetup.validateDeps('BrokenService', consoleLogger, {
        faulty: {
          value: { get: () => {} },
          requiredMethods: ['missingMethod'],
        },
      })
    ).toThrow(InvalidArgumentError);

    const entityManager = new SimpleEntityManager();
    const worldContext = {};
    const repository = new RegistryAdapter({
      dataRegistry: new InMemoryDataRegistry({ logger: consoleLogger }),
      logger: consoleLogger,
    });
    const dispatcher = new SimpleEventDispatcher(consoleLogger);
    const eventService = new SimpleEventDispatchService(consoleLogger);
    const scopeRegistry = new SimpleScopeRegistry(consoleLogger);

    expect(
      () =>
        new WorldInitializer({
          entityManager: {},
          worldContext,
          gameDataRepository: repository,
          validatedEventDispatcher: dispatcher,
          eventDispatchService: eventService,
          logger: consoleLogger,
          scopeRegistry,
        })
    ).toThrow(WorldInitializationError);

    expect(
      () =>
        new WorldInitializer({
          entityManager,
          worldContext: null,
          gameDataRepository: repository,
          validatedEventDispatcher: dispatcher,
          eventDispatchService: eventService,
          logger: consoleLogger,
          scopeRegistry,
        })
    ).toThrow(WorldInitializationError);

    expect(
      () =>
        new WorldInitializer({
          entityManager,
          worldContext,
          gameDataRepository: { getWorld: () => null },
          validatedEventDispatcher: dispatcher,
          eventDispatchService: eventService,
          logger: consoleLogger,
          scopeRegistry,
        })
    ).toThrow(WorldInitializationError);

    const builder = new TargetContextBuilder({
      entityManager,
      gameStateManager: new SimpleGameStateManager(),
      logger: memoryLogger,
    });

    expect(() => builder.buildBaseContext('   ', 'location:town')).toThrow(
      InvalidArgumentError
    );

    expect(() =>
      builder.buildDependentContext(null, {}, { contextFrom: 'primary' })
    ).toThrow('Base context is required');

    expect(() => getDefinition('   ', repository, memoryLogger)).toThrow(
      InvalidArgumentError
    );
    expect(memoryLogger.entries.warn[0].message).toContain(
      'definitionLookup.getDefinition called with invalid definitionId'
    );

    const FaultyAccessor = withValidatedDeps(class Faulty {}, () => [
      {
        dependency: null,
        name: 'Faulty: repository',
      },
    ]);

    expect(() => new FaultyAccessor({ logger: undefined })).toThrow(
      InvalidArgumentError
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Missing required dependency: Faulty: repository.'
    );

    expect(
      () =>
        new InitializationService({
          log: { logger: memoryLogger },
          events: {
            validatedEventDispatcher: {},
            safeEventDispatcher: { subscribe: () => {} },
          },
          llm: {},
          persistence: {},
          coreSystems: {},
        })
    ).toThrow(SystemInitializationError);
    expect(
      memoryLogger.entries.error.some((entry) =>
        entry.message.includes(
          "InitializationService: Missing or invalid required dependency 'validatedEventDispatcher'."
        )
      )
    ).toBe(true);
  });
});
