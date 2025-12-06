import { describe, it, expect, beforeEach } from '@jest/globals';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import {
  SystemInitializationError,
  WorldInitializationError,
} from '../../../src/errors/InitializationError.js';
import WorldInitializer from '../../../src/initializers/worldInitializer.js';
import InitializationService from '../../../src/initializers/services/initializationService.js';
import ActionContextBuilder from '../../../src/turns/prompting/actionContextBuilder.js';
import { EventDispatchService } from '../../../src/utils/eventDispatchService.js';
import { ServiceSetup } from '../../../src/utils/serviceInitializerUtils.js';
import idValidation from '../../../src/utils/idValidation.js';
import { MultiTargetEventBuilder } from '../../../src/entities/multiTarget/multiTargetEventBuilder.js';
import { withValidatedDeps } from '../../../src/utils/withValidatedDeps.js';

class MemoryLogger {
  constructor(prefix = '') {
    this.prefix = prefix;
    this.entries = { debug: [], info: [], warn: [], error: [] };
  }

  #record(level, message, metadata) {
    this.entries[level].push({ message, metadata });
  }

  debug(message, metadata) {
    this.#record('debug', `${this.prefix}${message}`, metadata);
  }

  info(message, metadata) {
    this.#record('info', `${this.prefix}${message}`, metadata);
  }

  warn(message, metadata) {
    this.#record('warn', `${this.prefix}${message}`, metadata);
  }

  error(message, metadata) {
    this.#record('error', `${this.prefix}${message}`, metadata);
  }
}

class StubEntityManager {
  createEntityInstance() {
    return { id: 'entity:1' };
  }

  hasBatchSupport() {
    return false;
  }
}

class StubRepository {
  getWorld() {
    return { id: 'world:demo', entities: [] };
  }

  getEntityInstanceDefinition() {
    return { id: 'instance:demo' };
  }

  get() {
    return null;
  }
}

class StubEventDispatcher {
  dispatch() {
    return true;
  }
}

class StubEventDispatchService {
  async dispatchWithLogging() {
    return true;
  }
}

class StubScopeRegistry {
  initialize() {
    return true;
  }
}

class StubModsLoader {
  loadMods() {
    return Promise.resolve();
  }
}

class StubDataRegistry {
  getAll() {
    return [];
  }
}

class StubSystemInitializer {
  initializeAll() {
    return Promise.resolve();
  }
}

class StubWorldInitializer {
  initializeWorldEntities() {
    return Promise.resolve();
  }
}

class StubSafeEventDispatcher {
  subscribe() {}
}

class StubActionIndex {
  buildIndex() {
    return {};
  }
}

class StubGameDataRepository {
  getAllActionDefinitions() {
    return [];
  }
}

class StubListener {
  handleEvent() {}
}

class StubSpatialIndexManager {
  buildIndex() {
    return Promise.resolve();
  }
}

class StubDomUiFacade {}

class StubContentDependencyValidator {
  async validate() {
    return { warnings: [], errors: [] };
  }
}

class StubLlmAdapter {
  init() {}

  isInitialized() {
    return true;
  }

  isOperational() {
    return true;
  }
}

class StubLlmConfigLoader {
  async loadConfiguration() {
    return {};
  }
}

class StubAnatomyFormattingService {}

class StubWorldContext {
  async getLocationOfEntity() {
    return { id: 'location:1' };
  }
}

class DecoratedBase {
  constructor(args) {
    this.args = args;
  }
}

class StubLlmAdapterInitializer {
  initialize() {
    return Promise.resolve(true);
  }
}

describe('dependencyUtils integration coverage', () => {
  let logger;

  beforeEach(() => {
    logger = new MemoryLogger();
  });

  describe('WorldInitializer dependency validation', () => {
    it('constructs successfully when all dependencies satisfy assertions', () => {
      expect(
        () =>
          new WorldInitializer({
            entityManager: new StubEntityManager(),
            worldContext: { id: 'world:demo' },
            gameDataRepository: new StubRepository(),
            validatedEventDispatcher: new StubEventDispatcher(),
            eventDispatchService: new StubEventDispatchService(),
            logger,
            scopeRegistry: new StubScopeRegistry(),
            config: {
              isFeatureEnabled: () => true,
              getValue: () => 5,
            },
          })
      ).not.toThrow();
    });

    it('throws meaningful errors when required dependencies are invalid', () => {
      expect(
        () =>
          new WorldInitializer({
            entityManager: {},
            worldContext: { id: 'world:demo' },
            gameDataRepository: new StubRepository(),
            validatedEventDispatcher: new StubEventDispatcher(),
            eventDispatchService: new StubEventDispatchService(),
            logger,
            scopeRegistry: new StubScopeRegistry(),
          })
      ).toThrow(WorldInitializationError);

      expect(
        () =>
          new WorldInitializer({
            entityManager: new StubEntityManager(),
            worldContext: null,
            gameDataRepository: new StubRepository(),
            validatedEventDispatcher: new StubEventDispatcher(),
            eventDispatchService: new StubEventDispatchService(),
            logger,
            scopeRegistry: new StubScopeRegistry(),
          })
      ).toThrow(WorldInitializationError);

      expect(
        () =>
          new WorldInitializer({
            entityManager: new StubEntityManager(),
            worldContext: { id: 'world:demo' },
            gameDataRepository: { getWorld() {} },
            validatedEventDispatcher: new StubEventDispatcher(),
            eventDispatchService: new StubEventDispatchService(),
            logger,
            scopeRegistry: new StubScopeRegistry(),
          })
      ).toThrow(WorldInitializationError);
    });
  });

  describe('InitializationService dependency failures', () => {
    it('logs errors when injected services do not provide required functions', () => {
      const failingLogger = new MemoryLogger('Initialization: ');

      expect(
        () =>
          new InitializationService({
            log: { logger: failingLogger },
            events: {
              validatedEventDispatcher: {},
              safeEventDispatcher: new StubSafeEventDispatcher(),
            },
            llm: {
              llmAdapter: new StubLlmAdapter(),
              llmConfigLoader: new StubLlmConfigLoader(),
            },
            persistence: {
              entityManager: new StubEntityManager(),
              domUiFacade: new StubDomUiFacade(),
              actionIndex: new StubActionIndex(),
              gameDataRepository: new StubGameDataRepository(),
              thoughtListener: new StubListener(),
              notesListener: new StubListener(),
              spatialIndexManager: new StubSpatialIndexManager(),
            },
            coreSystems: {
              modsLoader: new StubModsLoader(),
              scopeRegistry: new StubScopeRegistry(),
              dataRegistry: new StubDataRegistry(),
              systemInitializer: new StubSystemInitializer(),
              worldInitializer: new StubWorldInitializer(),
              contentDependencyValidator: new StubContentDependencyValidator(),
              llmAdapterInitializer: new StubLlmAdapterInitializer(),
              anatomyFormattingService: new StubAnatomyFormattingService(),
            },
          })
      ).toThrow(SystemInitializationError);

      expect(failingLogger.entries.error.length).toBeGreaterThan(0);
      expect(
        failingLogger.entries.error.some(({ message }) =>
          message.includes(
            'InitializationService: Missing or invalid required dependency'
          )
        )
      ).toBe(true);
    });
  });

  describe('ServiceSetup.validateDeps', () => {
    it('creates prefixed loggers and validates dependencies successfully', () => {
      const setup = new ServiceSetup();
      const prefixed = setup.setupService('InventoryService', logger, {
        storage: {
          value: {
            save: () => true,
          },
          requiredMethods: ['save'],
        },
        transformer: {
          value: () => 'ok',
          isFunction: true,
        },
      });

      prefixed.debug('initialized');
      expect(logger.entries.debug[0].message).toBe(
        'InventoryService: initialized'
      );
      expect(logger.entries.error).toHaveLength(0);
    });

    it('throws InvalidArgumentError when dependencies are missing required capabilities', () => {
      const setup = new ServiceSetup();

      expect(() =>
        setup.setupService('BrokenService', logger, {
          storage: {
            value: {},
            requiredMethods: ['save'],
          },
        })
      ).toThrow(InvalidArgumentError);

      expect(logger.entries.error.length).toBeGreaterThan(0);
      expect(
        logger.entries.error.some(({ message }) =>
          message.includes('Invalid or missing method')
        )
      ).toBe(true);
    });

    it('throws when dependencies are declared but missing entirely', () => {
      const setup = new ServiceSetup();

      expect(() =>
        setup.setupService('MissingDependencyService', logger, {
          missing: {
            value: null,
          },
        })
      ).toThrow(InvalidArgumentError);

      expect(
        logger.entries.error.some(({ message }) =>
          message.includes(
            'Missing required dependency: MissingDependencyService: missing'
          )
        )
      ).toBe(true);
    });

    it('requires callable dependencies when marked as functions', () => {
      const setup = new ServiceSetup();

      expect(() =>
        setup.setupService('CallableCheckService', logger, {
          callable: {
            value: {},
            isFunction: true,
          },
        })
      ).toThrow(InvalidArgumentError);

      expect(
        logger.entries.error.some(({ message }) =>
          message.includes(
            "Dependency 'CallableCheckService: callable' must be a function"
          )
        )
      ).toBe(true);
    });

    it('falls back to console logging when logger lacks an error method', () => {
      const setup = new ServiceSetup();
      const silentLogger = { debug: () => {} };
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      expect(() =>
        setup.validateDeps('ConsoleFallbackService', silentLogger, {
          storage: {
            value: {},
            requiredMethods: ['save'],
          },
        })
      ).toThrow(InvalidArgumentError);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('ConsoleFallbackService: storage')
      );
      consoleSpy.mockRestore();
    });

    it('returns immediately when no dependency specifications are provided', () => {
      const setup = new ServiceSetup();
      expect(() =>
        setup.validateDeps('OptionalService', logger, undefined)
      ).not.toThrow();
      expect(logger.entries.error).toHaveLength(0);
    });
  });

  describe('idValidation integration', () => {
    it('validates identifiers and reports issues through dependencyUtils helpers', () => {
      expect(idValidation.isValidId('npc:hero', 'test-context', logger)).toBe(
        true
      );
      expect(idValidation.isValidId('   ', 'test-context', logger)).toBe(false);

      expect(() =>
        idValidation.validateInstanceAndComponent(
          'npc:hero',
          'component:vision',
          logger
        )
      ).not.toThrow();

      expect(() =>
        idValidation.validateInstanceAndComponent('', '', logger, 'integration')
      ).toThrow(InvalidArgumentError);

      expect(logger.entries.error.length).toBeGreaterThan(0);
      expect(
        logger.entries.error.some(({ message }) =>
          message.includes('integration: Invalid')
        )
      ).toBe(true);
    });
  });

  describe('EventDispatchService dependency enforcement', () => {
    it('accepts valid dependencies without raising errors', () => {
      const service = new EventDispatchService({
        safeEventDispatcher: { dispatch: async () => true },
        logger,
      });

      expect(() =>
        service.dispatchWithLogging('event', { payload: true })
      ).not.toThrow();
    });

    it('throws default errors when required dependencies are missing', () => {
      expect(
        () =>
          new EventDispatchService({
            safeEventDispatcher: null,
            logger,
          })
      ).toThrow(Error);
    });
  });

  describe('withValidatedDeps decorator', () => {
    it('validates dependencies even when logger is not provided', () => {
      const Decorated = withValidatedDeps(DecoratedBase, (args) => [
        { dependency: args.runner, name: 'runner', methods: ['run'] },
      ]);

      expect(
        () => new Decorated({ runner: { run: () => true } })
      ).not.toThrow();

      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      expect(() => new Decorated({ runner: {} })).toThrow(InvalidArgumentError);
      consoleSpy.mockRestore();
    });
  });

  describe('ActionContextBuilder dependency validation', () => {
    it('uses validateDependency defaults for basic dependency checks', () => {
      const builder = new ActionContextBuilder({
        worldContext: new StubWorldContext(),
        entityManager: new StubEntityManager(),
        gameDataRepository: new StubRepository(),
        logger,
      });

      expect(builder).toBeDefined();

      expect(
        () =>
          new ActionContextBuilder({
            worldContext: new StubWorldContext(),
            entityManager: null,
            gameDataRepository: new StubRepository(),
            logger,
          })
      ).toThrow(InvalidArgumentError);
    });
  });

  describe('MultiTargetEventBuilder assertions', () => {
    it('enforces non-blank strings and presence for target configuration', () => {
      const builderLogger = new MemoryLogger('builder: ');
      const builder = new MultiTargetEventBuilder({ logger: builderLogger });

      const payload = builder
        .setActor('npc:hero')
        .setAction('core:wave')
        .setOriginalInput('wave at hero')
        .setTargets({ primary: 'npc:hero' })
        .build();

      expect(payload.actorId).toBe('npc:hero');
      expect(payload.targets).toEqual({ primary: 'npc:hero' });

      const failingBuilder = new MultiTargetEventBuilder({
        logger: builderLogger,
      });

      expect(() => failingBuilder.setActor('  ')).toThrow(InvalidArgumentError);
      expect(() => failingBuilder.setTargets(null)).toThrow(Error);

      expect(builderLogger.entries.error.length).toBeGreaterThan(0);
      expect(
        builderLogger.entries.error.some(
          ({ message }) =>
            message.includes('Invalid actorId') ||
            message.includes('Targets object is required')
        )
      ).toBe(true);
    });
  });
});
