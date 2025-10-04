import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import TargetContextBuilder from '../../../src/scopeDsl/utils/targetContextBuilder.js';
import WorldInitializer from '../../../src/initializers/worldInitializer.js';
import SystemInitializer from '../../../src/initializers/systemInitializer.js';
import InitializationService from '../../../src/initializers/services/initializationService.js';
import { TargetManager } from '../../../src/entities/multiTarget/targetManager.js';
import { ServiceSetup } from '../../../src/utils/serviceInitializerUtils.js';
import {
  isValidId,
  validateInstanceAndComponent,
} from '../../../src/utils/idValidation.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { SystemInitializationError } from '../../../src/errors/InitializationError.js';
import createSlotAccessResolver from '../../../src/scopeDsl/nodes/slotAccessResolver.js';

class MemoryLogger {
  constructor(prefix = '') {
    this.prefix = prefix;
    this.messages = { debug: [], info: [], warn: [], error: [] };
  }

  debug(message, metadata) {
    this.messages.debug.push({ message, metadata });
  }

  info(message, metadata) {
    this.messages.info.push({ message, metadata });
  }

  warn(message, metadata) {
    this.messages.warn.push({ message, metadata });
  }

  error(message, metadata) {
    this.messages.error.push({ message, metadata });
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
  constructor(entities = new Map()) {
    this.entities = entities;
  }

  getEntityInstance(id) {
    return this.entities.get(id) ?? null;
  }

  createEntityInstance(def) {
    const entity = new SimpleEntity(def.id, def.components ?? {});
    this.entities.set(def.id, entity);
    return entity;
  }

  hasBatchSupport() {
    return false;
  }

  getAllComponentTypesForEntity(id) {
    const entity = this.entities.get(id);
    if (!entity) return [];
    return Object.keys(entity.getAllComponents());
  }
}

class FakeRepository {
  constructor(world = { entities: [] }) {
    this._world = world;
  }

  getWorld() {
    return this._world;
  }

  getEntityInstanceDefinition(id) {
    return this._world.entities.find((entry) => entry.id === id) ?? null;
  }

  get(id) {
    return this.getEntityInstanceDefinition(id);
  }
}

describe('dependencyUtils integration with core modules', () => {
  let logger;
  let entityManager;
  let gameStateManager;

  beforeEach(() => {
    logger = new MemoryLogger();
    entityManager = new SimpleEntityManager(
      new Map([
        [
          'actor:1',
          new SimpleEntity('actor:1', {
            identity: { name: 'Hero' },
          }),
        ],
        [
          'location:town',
          new SimpleEntity('location:town', { description: 'Town Square' }),
        ],
      ])
    );
    gameStateManager = {
      getCurrentTurn: () => 3,
      getTimeOfDay: () => 'dawn',
      getWeather: () => 'clear',
    };
  });

  it('builds target contexts and surfaces validation errors via TargetContextBuilder', () => {
    const builder = new TargetContextBuilder({
      entityManager,
      gameStateManager,
      logger,
    });

    const base = builder.buildBaseContext('actor:1', 'location:town');
    expect(base.actor.id).toBe('actor:1');
    expect(base.location.id).toBe('location:town');
    expect(base.game.turnNumber).toBe(3);

    const dependent = builder.buildDependentContext(
      base,
      {
        primary: [
          {
            id: 'actor:1',
          },
        ],
      },
      { contextFrom: 'primary' }
    );

    expect(dependent.target.id).toBe('actor:1');
    expect(logger.messages.error).toHaveLength(0);

    expect(() => builder.buildBaseContext('   ', 'location:town')).toThrow(
      InvalidArgumentError
    );
    const [invalidIdLog] = logger.messages.error;
    expect(invalidIdLog.message).toContain('Invalid actorId');
    expect(() =>
      builder.buildDependentContext(null, {}, { contextFrom: null })
    ).toThrow('Base context is required');
  });

  it('rejects missing dependencies when constructing TargetContextBuilder', () => {
    expect(
      () => new TargetContextBuilder({ entityManager: null, gameStateManager, logger })
    ).toThrow(InvalidArgumentError);
    expect(
      () =>
        new TargetContextBuilder({
          entityManager,
          gameStateManager: null,
          logger,
        })
    ).toThrow(InvalidArgumentError);
  });

  it('validates repositories and event infrastructure in WorldInitializer', async () => {
    const worldContext = { initialized: true };
    const repository = new FakeRepository({
      entities: [
        {
          id: 'npc:1',
          components: { identity: { name: 'Villager' } },
        },
      ],
    });
    const validatedEventDispatcher = { dispatch: jest.fn() };
    const eventDispatchService = { dispatchWithLogging: jest.fn() };
    const scopeRegistry = { initialize: jest.fn() };

    const initializer = new WorldInitializer({
      entityManager,
      worldContext,
      gameDataRepository: repository,
      validatedEventDispatcher,
      eventDispatchService,
      logger,
      scopeRegistry,
    });

    expect(initializer.getWorldContext()).toBe(worldContext);

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
    ).toThrow('WorldInitializer requires an IGameDataRepository');
  });

  it('requires callable dependencies in SystemInitializer', async () => {
    const logger = new MemoryLogger();
    const validatedEventDispatcher = { dispatch: jest.fn() };
    const eventDispatchService = { dispatchWithLogging: jest.fn() };

    expect(
      () =>
        new SystemInitializer({
          resolver: {},
          logger,
          validatedEventDispatcher,
          eventDispatchService,
          initializationTag: 'systems',
        })
    ).toThrow("SystemInitializer requires a valid IServiceResolver");

    const resolver = {
      async resolveByTag(tag) {
        expect(tag).toBe('systems');
        return [
          {
            async initialize() {
              /* no-op */
            },
          },
        ];
      },
    };

    const initializer = new SystemInitializer({
      resolver,
      logger,
      validatedEventDispatcher,
      eventDispatchService,
      initializationTag: 'systems',
    });

    await expect(initializer.initializeAll()).resolves.toBeUndefined();
  });

  it('coordinates ID validation helpers with structured logging', () => {
    const logger = new MemoryLogger();

    expect(isValidId('entity-42', 'test', logger)).toBe(true);
    expect(isValidId('', 'test', logger)).toBe(false);

    expect(() =>
      validateInstanceAndComponent('entity-1', '', logger, 'entity-component:test')
    ).toThrow(InvalidArgumentError);

    const lastError = logger.messages.error.at(-1);
    expect(lastError.message).toBeInstanceOf(InvalidArgumentError);
  });

  describe('slot access resolver dependency validation', () => {
    let entitiesGateway;
    let consoleSpy;

    beforeEach(() => {
      entitiesGateway = {
        getComponentData: jest.fn(() => null),
      };
      consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('falls back to console logging when error handler is misconfigured', () => {
      expect(() =>
        createSlotAccessResolver({
          entitiesGateway,
          errorHandler: {},
        })
      ).toThrow(InvalidArgumentError);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Invalid or missing method \'handleError\' on dependency \'IScopeDslErrorHandler\'.'
      );
    });

    it('accepts fully configured dependencies and exposes resolver contract', () => {
      const errorHandler = {
        handleError: jest.fn(),
        getErrorBuffer: jest.fn(() => []),
      };
      const resolver = createSlotAccessResolver({
        entitiesGateway,
        errorHandler,
      });
      expect(typeof resolver.canResolve).toBe('function');
      expect(typeof resolver.resolve).toBe('function');
    });
  });

  it('logs missing target maps when TargetManager receives null data', () => {
    const managerLogger = new MemoryLogger();
    const manager = new TargetManager({ logger: managerLogger });

    expect(() => manager.setTargets(null)).toThrow('Targets object is required');
    const [logEntry] = managerLogger.messages.error;
    expect(logEntry.message).toBe('Targets object is required');
  });

  it('records initialization dependency failures with detailed logging', () => {
    const logger = new MemoryLogger();
    const validatedEventDispatcher = {}; // missing dispatch
    const safeEventDispatcher = { subscribe: () => {} };

    const modsLoader = { loadMods: () => Promise.resolve([]) };
    const scopeRegistry = { initialize: () => {} };
    const dataRegistry = { getAll: () => [] };
    const systemInitializer = { initializeAll: () => Promise.resolve() };
    const worldInitializer = { initializeWorldEntities: () => Promise.resolve() };
    const entityManager = { getAllEntities: () => [] };
    const actionIndex = { buildIndex: () => {} };
    const gameDataRepository = { getAllActionDefinitions: () => [] };
    const thoughtListener = { handleEvent: () => {} };
    const notesListener = { handleEvent: () => {} };
    const spatialIndexManager = { rebuildIndex: () => {} };
    const llmAdapter = { init: () => {}, isInitialized: () => true, isOperational: () => true };
    const llmConfigLoader = { load: () => Promise.resolve() };
    const contentDependencyValidator = { validate: () => ({ success: true }) };
    const anatomyFormattingService = { initialize: () => {} };

    expect(() =>
      new InitializationService({
        log: { logger },
        events: { validatedEventDispatcher, safeEventDispatcher },
        llm: { llmAdapter, llmConfigLoader },
        persistence: {
          entityManager,
          domUiFacade: {},
          actionIndex,
          gameDataRepository,
          thoughtListener,
          notesListener,
          spatialIndexManager,
        },
        coreSystems: {
          modsLoader,
          scopeRegistry,
          dataRegistry,
          systemInitializer,
          worldInitializer,
          contentDependencyValidator,
          anatomyFormattingService,
        },
      })
    ).toThrow(SystemInitializationError);

    expect(logger.messages.error.map((entry) => entry.message)).toContain(
      "InitializationService: Missing or invalid required dependency 'validatedEventDispatcher'."
    );
  });

  it('validates function dependencies through ServiceSetup', () => {
    const baseLogger = new MemoryLogger();
    const setup = new ServiceSetup();

    expect(() =>
      setup.validateDeps('ExecutionService', baseLogger, {
        runner: { value: 42, isFunction: true },
      })
    ).toThrow(InvalidArgumentError);

    expect(baseLogger.messages.error[0].message).toBe(
      "Dependency 'ExecutionService: runner' must be a function, but got number."
    );

    expect(() => setup.validateDeps('OptionalService', baseLogger)).not.toThrow();
  });
});
