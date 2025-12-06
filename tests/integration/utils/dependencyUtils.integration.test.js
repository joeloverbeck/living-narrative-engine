import { describe, it, expect, beforeEach } from '@jest/globals';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

import SystemInitializer from '../../../src/initializers/systemInitializer.js';
import { DelegatingDecisionProvider } from '../../../src/turns/providers/delegatingDecisionProvider.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import DefaultPathResolver from '../../../src/pathing/defaultPathResolver.js';
import SchemaLoader from '../../../src/loaders/schemaLoader.js';
import TargetManager from '../../../src/entities/multiTarget/targetManager.js';
import { LocationQueryService } from '../../../src/entities/locationQueryService.js';
import WorldInitializer from '../../../src/initializers/worldInitializer.js';
import FacadeFactory from '../../../src/shared/facades/FacadeFactory.js';
import FacadeRegistry from '../../../src/shared/facades/FacadeRegistry.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { WorldInitializationError } from '../../../src/errors/InitializationError.js';

class TestLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(message, ...args) {
    this.debugMessages.push({ message, args });
  }

  info(message, ...args) {
    this.infoMessages.push({ message, args });
  }

  warn(message, ...args) {
    this.warnMessages.push({ message, args });
  }

  error(message, ...args) {
    this.errorMessages.push({ message, args });
  }
}

class TestValidatedEventDispatcher {
  constructor() {
    this.dispatched = [];
  }

  async dispatch(eventName, payload) {
    this.dispatched.push({ eventName, payload });
    return true;
  }
}

class TestSafeEventDispatcher {
  constructor() {
    this.dispatched = [];
    this.subscriptions = [];
  }

  async dispatch(eventName, payload) {
    this.dispatched.push({ eventName, payload });
    return true;
  }

  subscribe(eventName, handler) {
    this.subscriptions.push({ eventName, handler });
    return () => {};
  }
}

class TestEventDispatchService {
  constructor(logger) {
    this.logger = logger;
    this.logged = [];
  }

  async dispatchWithLogging(eventName, payload, context, options = {}) {
    this.logged.push({ eventName, payload, context, options });
  }
}

class TestResolver {
  constructor(systems) {
    this.systems = systems;
    this.lastRequestedTag = null;
  }

  async resolveByTag(tag) {
    this.lastRequestedTag = tag;
    return this.systems;
  }
}

class TestSystem {
  constructor(name = 'TestSystem') {
    this.name = name;
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
  }
}

class TestSpatialIndexManager {
  constructor(data = {}) {
    this.data = data;
    this.calls = [];
  }

  getEntitiesInLocation(locationId) {
    this.calls.push(locationId);
    return new Set(this.data[locationId] ?? []);
  }
}

class MinimalConfiguration {
  getBaseDataPath() {
    return './data';
  }

  getSchemaBasePath() {
    return 'schemas';
  }

  getContentBasePath() {
    return '';
  }

  getGameConfigFilename() {
    return 'game.json';
  }

  getModsBasePath() {
    return 'mods';
  }

  getModManifestFilename() {
    return 'mod-manifest.json';
  }

  getRuleBasePath() {
    return 'rules';
  }

  getSchemaFiles() {
    return [
      'common.schema.json',
      'entity-instance.schema.json',
      'world.schema.json',
    ];
  }
}

class FileSystemJsonFetcher {
  async fetch(identifier) {
    const absolutePath = path.resolve(process.cwd(), identifier);
    const contents = await readFile(absolutePath, 'utf-8');
    return JSON.parse(contents);
  }
}

class IncompleteLogger {
  constructor() {
    this.errorMessages = [];
  }

  info() {}

  warn() {}

  error(message) {
    this.errorMessages.push(message);
  }
}

class TestEventBus {
  constructor() {
    this.dispatched = [];
    this.subscriptions = [];
  }

  dispatch(eventName, payload) {
    this.dispatched.push({ eventName, payload });
    return true;
  }

  subscribe(eventName, handler) {
    this.subscriptions.push({ eventName, handler });
    return () => {};
  }
}

class TestContainer {
  constructor() {
    this.registry = new Map();
  }

  register(token, value) {
    this.registry.set(token, value);
  }

  resolve(token) {
    if (!this.registry.has(token)) {
      throw new Error(`Token not registered: ${token}`);
    }
    return this.registry.get(token);
  }

  isRegistered(token) {
    return this.registry.has(token);
  }
}

class SampleFacade {
  constructor({ logger, eventBus, unifiedCache, greeting = 'hello' }) {
    this.logger = logger;
    this.eventBus = eventBus;
    this.unifiedCache = unifiedCache;
    this.greeting = greeting;
  }

  announce(subject) {
    const message = `${this.greeting}, ${subject}`;
    this.logger.info(message);
    this.eventBus.dispatch('FACADE_MESSAGE', { message });
    return message;
  }
}

class TestGameDataRepository {
  getWorld() {
    return { entities: [] };
  }

  getEntityInstanceDefinition() {
    return {};
  }

  get() {
    return {};
  }
}

class TestEntityManager {
  constructor() {
    this.created = [];
  }

  createEntityInstance(entityDefinition) {
    this.created.push(entityDefinition);
    return { id: `entity-${this.created.length}` };
  }
}

class TestScopeRegistry {
  async initialize() {
    return true;
  }
}

class TestWorldContext {}

class TestEventDispatchTracer {}

class TestUnifiedCache {
  constructor() {
    this.store = new Map();
  }

  set(key, value) {
    this.store.set(key, value);
  }

  get(key) {
    return this.store.get(key);
  }
}

describe('dependencyUtils integration via SystemInitializer', () => {
  let logger;

  beforeEach(() => {
    logger = new TestLogger();
  });

  it('initializes tagged systems when dependencies are valid', async () => {
    const systems = [new TestSystem('Alpha'), new TestSystem('Beta')];
    const resolver = new TestResolver(systems);
    const validatedEventDispatcher = new TestValidatedEventDispatcher();
    const eventDispatchService = new TestEventDispatchService(logger);

    const initializer = new SystemInitializer({
      resolver,
      logger,
      validatedEventDispatcher,
      eventDispatchService,
      initializationTag: 'core:startup',
    });

    await initializer.initializeAll();

    expect(resolver.lastRequestedTag).toBe('core:startup');
    expect(systems.every((system) => system.initialized)).toBe(true);
    expect(eventDispatchService.logged).toHaveLength(0);
  });

  it('throws when resolver lacks required resolveByTag method', () => {
    const validatedEventDispatcher = new TestValidatedEventDispatcher();
    const eventDispatchService = new TestEventDispatchService(logger);

    expect(
      () =>
        new SystemInitializer({
          resolver: {},
          logger,
          validatedEventDispatcher,
          eventDispatchService,
          initializationTag: 'broken',
        })
    ).toThrow(
      "SystemInitializer requires a valid IServiceResolver with 'resolveByTag'."
    );
  });

  it('throws when logger dependency is missing', () => {
    const resolver = new TestResolver([]);
    const validatedEventDispatcher = new TestValidatedEventDispatcher();
    const eventDispatchService = new TestEventDispatchService(new TestLogger());

    expect(
      () =>
        new SystemInitializer({
          resolver,
          logger: null,
          validatedEventDispatcher,
          eventDispatchService,
          initializationTag: 'missing-logger',
        })
    ).toThrow('SystemInitializer requires an ILogger instance.');
  });
});

describe('dependencyUtils integration via DelegatingDecisionProvider', () => {
  let logger;
  let safeEventDispatcher;

  beforeEach(() => {
    logger = new TestLogger();
    safeEventDispatcher = new TestSafeEventDispatcher();
  });

  it('delegates decision making to provided function', async () => {
    const provider = new DelegatingDecisionProvider({
      delegate: async () => ({ index: 1, speech: 'hello there' }),
      logger,
      safeEventDispatcher,
    });

    const result = await provider.decide({ id: 'actor-1' }, {}, [
      { actionId: 'test-action' },
    ]);

    expect(result.chosenIndex).toBe(1);
    expect(result.speech).toBe('hello there');
    expect(safeEventDispatcher.dispatched).toHaveLength(0);
  });

  it('throws when delegate is not a function', () => {
    expect(
      () =>
        new DelegatingDecisionProvider({
          delegate: 'invalid-delegate',
          logger,
          safeEventDispatcher,
        })
    ).toThrow(InvalidArgumentError);
  });
});

describe('dependencyUtils integration via SchemaLoader', () => {
  let logger;
  let configuration;
  let pathResolver;
  let fetcher;
  let validator;

  beforeEach(() => {
    logger = new TestLogger();
    configuration = new MinimalConfiguration();
    pathResolver = new DefaultPathResolver(configuration);
    fetcher = new FileSystemJsonFetcher();
    validator = new AjvSchemaValidator({ logger });
  });

  it('loads and validates core schemas with actual dependencies', async () => {
    const loader = new SchemaLoader(
      configuration,
      pathResolver,
      fetcher,
      validator,
      logger
    );

    await loader.loadAndCompileAllSchemas();

    expect(
      validator.validateSchemaRefs(
        'schema://living-narrative-engine/common.schema.json'
      )
    ).toBe(true);
    expect(
      validator.validateSchemaRefs(
        'schema://living-narrative-engine/world.schema.json'
      )
    ).toBe(true);

    const summary = loader.getSchemaLoadingSummary();
    expect(summary.totalConfigured).toBe(configuration.getSchemaFiles().length);
    expect(summary.loadedSchemas).toEqual(
      expect.arrayContaining([
        'schema://living-narrative-engine/common.schema.json',
        'schema://living-narrative-engine/entity-instance.schema.json',
        'schema://living-narrative-engine/world.schema.json',
      ])
    );
  });

  it('reports invalid logger configuration through dependency validation', () => {
    const brokenLogger = new IncompleteLogger();

    expect(
      () =>
        new SchemaLoader(
          configuration,
          pathResolver,
          fetcher,
          validator,
          brokenLogger
        )
    ).toThrow(InvalidArgumentError);

    expect(brokenLogger.errorMessages).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "Invalid or missing method 'debug' on dependency 'ILogger'."
        ),
      ])
    );
  });
});

describe('dependencyUtils integration via TargetManager', () => {
  let logger;
  let manager;

  beforeEach(() => {
    logger = new TestLogger();
    manager = new TargetManager({ logger });
  });

  it('stores targets and determines primary target', () => {
    manager.setTargets({ primary: 'entity-1', ally: 'entity-2' });
    expect(manager.getPrimaryTarget()).toBe('entity-1');
    expect(manager.getTarget('ally')).toBe('entity-2');
    expect(logger.debugMessages.length).toBeGreaterThan(0);
  });

  it('logs and throws when targets object is missing', () => {
    expect(() => manager.setTargets(null)).toThrow(
      'Targets object is required'
    );
    expect(logger.errorMessages).toEqual(
      expect.arrayContaining([
        { message: 'Targets object is required', args: [] },
      ])
    );
  });

  it('rejects blank target names and entity identifiers', () => {
    expect(() => manager.addTarget('   ', 'entity-3')).toThrow(
      InvalidArgumentError
    );
    expect(() => manager.addTarget('secondary', '   ')).toThrow(
      InvalidArgumentError
    );
    expect(
      logger.errorMessages.some(({ message }) =>
        message.includes('TargetManager.addTarget: Invalid name')
      )
    ).toBe(true);
    expect(
      logger.errorMessages.some(({ message }) =>
        message.includes('TargetManager.addTarget: Invalid entityId')
      )
    ).toBe(true);
  });
});

describe('dependencyUtils integration via LocationQueryService', () => {
  let logger;
  let spatialIndexManager;
  let service;

  beforeEach(() => {
    logger = new TestLogger();
    spatialIndexManager = new TestSpatialIndexManager({
      'location-1': ['entity-a', 'entity-b'],
    });
    service = new LocationQueryService({
      spatialIndexManager,
      logger,
    });
  });

  it('returns entities for valid location id', () => {
    const result = service.getEntitiesInLocation('location-1');
    expect(Array.from(result)).toEqual(['entity-a', 'entity-b']);
    expect(spatialIndexManager.calls).toEqual(['location-1']);
  });

  it('returns empty set and logs warning for invalid id', () => {
    const result = service.getEntitiesInLocation('   ');
    expect(result.size).toBe(0);
    expect(
      logger.warnMessages.some(({ message }) =>
        message.includes('invalid locationId')
      )
    ).toBe(true);
  });
});

describe('dependencyUtils integration via WorldInitializer', () => {
  let logger;
  let entityManager;
  let worldContext;
  let gameDataRepository;
  let validatedEventDispatcher;
  let eventDispatchService;
  let scopeRegistry;

  beforeEach(() => {
    logger = new TestLogger();
    entityManager = new TestEntityManager();
    worldContext = new TestWorldContext();
    gameDataRepository = new TestGameDataRepository();
    validatedEventDispatcher = new TestValidatedEventDispatcher();
    eventDispatchService = new TestEventDispatchService(logger);
    scopeRegistry = new TestScopeRegistry();
  });

  it('instantiates with valid dependencies and exposes world context', () => {
    const initializer = new WorldInitializer({
      entityManager,
      worldContext,
      gameDataRepository,
      validatedEventDispatcher,
      eventDispatchService,
      logger,
      scopeRegistry,
      config: {},
    });

    expect(initializer.getWorldContext()).toBe(worldContext);
  });

  it('throws when game data repository is missing required methods', () => {
    expect(
      () =>
        new WorldInitializer({
          entityManager,
          worldContext,
          gameDataRepository: {},
          validatedEventDispatcher,
          eventDispatchService,
          logger,
          scopeRegistry,
        })
    ).toThrow(WorldInitializationError);
  });
});

describe('dependencyUtils integration with FacadeFactory and FacadeRegistry', () => {
  let logger;
  let eventBus;
  let container;
  let unifiedCache;

  beforeEach(() => {
    logger = new TestLogger();
    eventBus = new TestEventBus();
    container = new TestContainer();
    unifiedCache = new TestUnifiedCache();

    container.register('ILogger', logger);
    container.register('IEventBus', eventBus);
    container.register('IUnifiedCache', unifiedCache);
    container.register('TestFacade', SampleFacade);
  });

  it('registers and resolves facades while enforcing non-blank names', () => {
    const facadeFactory = new FacadeFactory({ logger, container });
    const registry = new FacadeRegistry({
      logger,
      eventBus,
      facadeFactory,
    });

    registry.register(
      {
        name: 'TestFacade',
        category: 'testing',
        version: '1.0.0',
        description: 'Test facade for integration coverage',
        tags: ['integration'],
      },
      { name: 'TestFacade', greeting: 'hi' }
    );

    const facadeInstance = registry.getFacade('TestFacade', {
      greeting: 'Howdy',
    });
    expect(facadeInstance).toBeInstanceOf(SampleFacade);
    const announcement = facadeInstance.announce('integration');
    expect(announcement).toBe('Howdy, integration');
    expect(
      eventBus.dispatched.some(
        ({ eventName }) => eventName === 'FACADE_REGISTERED'
      )
    ).toBe(true);

    expect(() => registry.getFacade('')).toThrow(InvalidArgumentError);
  });
});
