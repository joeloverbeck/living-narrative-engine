import { describe, it, expect, jest } from '@jest/globals';
import { ServiceSetup } from '../../../src/utils/serviceInitializerUtils.js';
import { withValidatedDeps } from '../../../src/utils/withValidatedDeps.js';
import { MultiTargetEventBuilder } from '../../../src/entities/multiTarget/multiTargetEventBuilder.js';
import TargetExtractionResult from '../../../src/entities/multiTarget/targetExtractionResult.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { DefinitionNotFoundError } from '../../../src/errors/definitionNotFoundError.js';
import WorldInitializer from '../../../src/initializers/worldInitializer.js';
import InitializationService from '../../../src/initializers/services/initializationService.js';
import SystemInitializer from '../../../src/initializers/systemInitializer.js';
import EventValidationService from '../../../src/validation/eventValidationService.js';
import {
  WorldInitializationError,
  SystemInitializationError,
} from '../../../src/errors/InitializationError.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import getDefinition from '../../../src/entities/utils/definitionLookup.js';
import { validateInstanceAndComponent } from '../../../src/utils/idValidation.js';

class MemoryLogger {
  constructor() {
    this.entries = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
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

  messages(level) {
    return this.entries[level].map((entry) => entry.message);
  }
}

describe('dependencyUtils integration coverage', () => {
  describe('ServiceSetup and validated dependency flows', () => {
    it('logs and throws when a dependency is missing a required method', () => {
      const logger = new MemoryLogger();
      const setup = new ServiceSetup();

      expect(() =>
        setup.setupService('Inventory', logger, {
          repository: {
            value: { add() {}, remove() {} },
            requiredMethods: ['add', 'get', 'remove'],
          },
        })
      ).toThrow(InvalidArgumentError);

      expect(logger.messages('error')).toContain(
        "Inventory: Invalid or missing method 'get' on dependency 'Inventory: repository'."
      );
    });

    it('supports function dependencies flagged with isFunction', () => {
      const logger = new MemoryLogger();
      const setup = new ServiceSetup();

      const prefixed = setup.setupService('Bootstrap', logger, {
        repository: {
          value: { add() {}, get() {}, remove() {} },
          requiredMethods: ['add', 'get', 'remove'],
        },
        dispatcher: {
          value: { dispatch() {} },
          requiredMethods: ['dispatch'],
        },
        initializer: {
          value: async () => true,
          isFunction: true,
        },
      });

      prefixed.info('ready');
      expect(logger.messages('info')).toContain('Bootstrap: ready');
    });

    it('logs when a dependency marked as a function is not callable', () => {
      const logger = new MemoryLogger();
      const setup = new ServiceSetup();

      expect(() =>
        setup.setupService('Bootstrap', logger, {
          runner: {
            value: {},
            isFunction: true,
          },
        })
      ).toThrow(InvalidArgumentError);

      expect(logger.messages('error')).toContain(
        "Bootstrap: Dependency 'Bootstrap: runner' must be a function, but got object."
      );
    });

    it('logs when a dependency is missing entirely', () => {
      const logger = new MemoryLogger();
      const setup = new ServiceSetup();

      expect(() =>
        setup.setupService('Bootstrap', logger, {
          dispatcher: {
            value: null,
            requiredMethods: ['dispatch'],
          },
        })
      ).toThrow(InvalidArgumentError);

      expect(logger.messages('error')).toContain(
        'Bootstrap: Missing required dependency: Bootstrap: dispatcher.'
      );
    });

    it('handles optional dependency maps without validation entries', () => {
      const logger = new MemoryLogger();
      const setup = new ServiceSetup();

      const prefixed = setup.setupService('Bare', logger);
      expect(prefixed).toBeDefined();

      setup.validateDeps('Partial', prefixed, {
        optional: null,
        runner: {
          value: () => true,
          isFunction: true,
        },
      });
    });

    it('decorates classes with dependency validation via withValidatedDeps', () => {
      class ReportService {
        constructor({ repository, logger }) {
          this.repository = repository;
          this.logger = logger;
          this.logger.debug('ReportService constructed');
        }

        listAll() {
          return this.repository.list();
        }
      }

      const ValidatedReportService = withValidatedDeps(
        ReportService,
        ({ repository }) => [
          {
            dependency: repository,
            name: 'ReportService.repository',
            methods: ['list'],
          },
        ]
      );

      const partialLogger = {
        debugMessages: [],
        debug(message) {
          this.debugMessages.push(message);
        },
      };

      expect(
        () =>
          new ValidatedReportService({
            repository: { list: 'not-a-function' },
            logger: partialLogger,
          })
      ).toThrow(
        "Invalid or missing method 'list' on dependency 'ReportService.repository'."
      );

      expect(partialLogger.debugMessages).toContain(
        'ReportService constructed'
      );
    });
  });

  describe('guards in multi-target event builder', () => {
    it('enforces non-blank actor IDs and logs missing extractions', () => {
      const logger = new MemoryLogger();
      const builder = new MultiTargetEventBuilder({ logger });

      builder.setActor('actor:hero');
      builder.setTargets({ primary: ['actor:hero'] });

      expect(() => builder.setActor('  ')).toThrow(InvalidArgumentError);
      expect(logger.messages('error')).toContain(
        "MultiTargetEventBuilder.setActor: Invalid actorId '  '. Expected non-blank string."
      );

      expect(() => builder.setTargetsFromExtraction(null)).toThrow(
        'Target extraction result is required'
      );
      expect(logger.messages('error')).toContain(
        'Target extraction result is required'
      );
    });

    it('sets targets from a real extraction result when dependencies are valid', () => {
      const logger = new MemoryLogger();
      const builder = new MultiTargetEventBuilder({ logger });
      const extraction = TargetExtractionResult.createEmpty(new MemoryLogger());

      builder.setTargetsFromExtraction(extraction);
      expect(logger.messages('debug')).toContain(
        'Targets set from extraction result'
      );
    });
  });

  describe('id validation utilities', () => {
    it('warns and rethrows when a definition ID is invalid', () => {
      const registryLogger = new MemoryLogger();
      const registry = new InMemoryDataRegistry({ logger: registryLogger });
      const logger = new MemoryLogger();

      expect(() => getDefinition('  ', registry, logger)).toThrow(
        InvalidArgumentError
      );
      expect(logger.messages('warn')).toContain(
        "definitionLookup.getDefinition called with invalid definitionId: '  '"
      );
    });

    it('warns when a definition is missing after a valid ID', () => {
      const registryLogger = new MemoryLogger();
      const registry = new InMemoryDataRegistry({ logger: registryLogger });
      const logger = new MemoryLogger();

      expect(() => getDefinition('entity:missing', registry, logger)).toThrow(
        DefinitionNotFoundError
      );
      expect(logger.messages('warn')).toContain(
        'Definition not found in registry: entity:missing'
      );
    });

    it('logs and wraps errors when component IDs are invalid', () => {
      const logger = new MemoryLogger();

      expect(() =>
        validateInstanceAndComponent('entity:1', '   ', logger, 'TestContext')
      ).toThrow(InvalidArgumentError);

      expect(logger.entries.error[0].message).toContain(
        "TestContext: Invalid componentTypeId '   '. Expected non-blank string."
      );
    });
  });

  describe('WorldInitializer dependency enforcement', () => {
    const buildDeps = () => {
      const logger = new MemoryLogger();
      return {
        entityManager: {
          createEntityInstance() {},
          hasBatchSupport() {
            return true;
          },
        },
        worldContext: { ready: false },
        gameDataRepository: {
          getWorld() {
            return { id: 'world:core', entities: [] };
          },
          getEntityInstanceDefinition() {
            return null;
          },
          get() {
            return null;
          },
        },
        validatedEventDispatcher: {
          dispatch() {
            return true;
          },
        },
        eventDispatchService: {
          dispatchWithLogging() {
            return Promise.resolve();
          },
        },
        logger,
        scopeRegistry: {
          initialize() {
            return true;
          },
        },
      };
    };

    it('constructs successfully with fully valid dependencies', () => {
      const deps = buildDeps();
      const initializer = new WorldInitializer(deps);
      expect(initializer.getWorldContext()).toBe(deps.worldContext);
    });

    it('throws WorldInitializationError when repository is missing required methods', () => {
      const deps = buildDeps();
      delete deps.gameDataRepository.get;

      expect(() => new WorldInitializer(deps)).toThrow(
        WorldInitializationError
      );
    });

    it('throws WorldInitializationError when event dispatcher lacks dispatchWithLogging', () => {
      const deps = buildDeps();
      deps.eventDispatchService = {};

      expect(() => new WorldInitializer(deps)).toThrow(
        WorldInitializationError
      );
    });

    it('throws WorldInitializationError when world context is missing', () => {
      const deps = buildDeps();
      deps.worldContext = null;

      expect(() => new WorldInitializer(deps)).toThrow(
        WorldInitializationError
      );
    });
  });

  describe('InitializationService validation', () => {
    it('logs detailed errors when validatedEventDispatcher is invalid', () => {
      const logger = new MemoryLogger();
      const deps = {
        log: { logger },
        events: {
          validatedEventDispatcher: {},
          safeEventDispatcher: { subscribe: () => true },
        },
        llm: {
          llmAdapter: {},
          llmConfigLoader: { load: async () => ({}) },
        },
        persistence: {
          entityManager: {},
          domUiFacade: {},
          actionIndex: { buildIndex: () => {} },
          gameDataRepository: { getAllActionDefinitions: () => [] },
          thoughtListener: { handleEvent: () => {} },
          notesListener: { handleEvent: () => {} },
          spatialIndexManager: { buildIndex: () => {} },
        },
        coreSystems: {
          modsLoader: { loadMods: async () => ({}) },
          scopeRegistry: { initialize: () => {} },
          dataRegistry: { getAll: () => [] },
          systemInitializer: { initializeAll: async () => {} },
          worldInitializer: { initializeWorldEntities: async () => {} },
          contentDependencyValidator: { validate: async () => {} },
          llmAdapterInitializer: { initialize: async () => {} },
          anatomyFormattingService: { initialize: async () => {} },
        },
      };

      expect(() => new InitializationService(deps)).toThrow(
        SystemInitializationError
      );

      expect(logger.messages('error')).toContain(
        "InitializationService: Missing or invalid required dependency 'validatedEventDispatcher'."
      );
    });
  });

  describe('Default guard behavior across services', () => {
    it('uses console fallback when schema validator dependency is missing', () => {
      const logger = new MemoryLogger();
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      expect(
        () => new EventValidationService({ logger, schemaValidator: null })
      ).toThrow(InvalidArgumentError);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Missing required dependency: ISchemaValidator.'
      );
      consoleSpy.mockRestore();
    });

    it('throws default errors when system resolver lacks resolveByTag', () => {
      const logger = new MemoryLogger();
      expect(
        () =>
          new SystemInitializer({
            resolver: {},
            logger,
            validatedEventDispatcher: { dispatch: () => true },
            eventDispatchService: { dispatchWithLogging: () => true },
            initializationTag: 'core',
          })
      ).toThrow(
        "SystemInitializer requires a valid IServiceResolver with 'resolveByTag'."
      );
    });

    it('requires a logger when initializing core systems by default', () => {
      const resolver = { resolveByTag: async () => [] };
      expect(
        () =>
          new SystemInitializer({
            resolver,
            logger: null,
            validatedEventDispatcher: { dispatch: () => true },
            eventDispatchService: { dispatchWithLogging: () => true },
            initializationTag: 'core',
          })
      ).toThrow('SystemInitializer requires an ILogger instance.');
    });

    it('skips validation when dependency specifications are omitted', () => {
      const logger = new MemoryLogger();

      const NoSpecService = withValidatedDeps(
        class Passthrough {
          constructor({ logger: baseLogger }) {
            this.logger = baseLogger;
          }
        },
        () => undefined
      );

      const instance = new NoSpecService({ logger });
      expect(instance.logger).toBe(logger);
    });
  });
});
