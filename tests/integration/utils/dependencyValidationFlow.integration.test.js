import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import InitializationService from '../../../src/initializers/services/initializationService.js';
import { ServiceSetup } from '../../../src/utils/serviceInitializerUtils.js';
import { ServiceRegistry } from '../../../src/actions/pipeline/services/ServiceRegistry.js';
import EntityMutationManager from '../../../src/entities/managers/EntityMutationManager.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { SystemInitializationError } from '../../../src/errors/InitializationError.js';
import {
  createMockLogger,
  createEnhancedMockLogger,
} from '../../common/mockFactories/loggerMocks.js';

// Utility to build a comprehensive dependency graph for InitializationService
/**
 *
 * @param overrides
 */
function createInitializationConfig(overrides = {}) {
  const logger = overrides.log?.logger ?? createMockLogger();

  const baseConfig = {
    log: { logger },
    events: {
      validatedEventDispatcher: {
        dispatch: jest.fn(),
        ...overrides.events?.validatedEventDispatcher,
      },
      safeEventDispatcher: {
        subscribe: jest.fn(),
        ...overrides.events?.safeEventDispatcher,
      },
    },
    llm: {
      llmAdapter: {
        init: jest.fn(),
        isInitialized: jest.fn().mockReturnValue(true),
        isOperational: jest.fn().mockReturnValue(true),
        ...overrides.llm?.llmAdapter,
      },
      llmConfigLoader: {
        loadConfig: jest.fn(),
        ...overrides.llm?.llmConfigLoader,
      },
    },
    persistence: {
      entityManager: overrides.persistence?.entityManager ?? {},
      domUiFacade: overrides.persistence?.domUiFacade ?? {},
      actionIndex: {
        buildIndex: jest.fn(),
        ...overrides.persistence?.actionIndex,
      },
      gameDataRepository: {
        getAllActionDefinitions: jest.fn().mockReturnValue([]),
        ...overrides.persistence?.gameDataRepository,
      },
      thoughtListener: {
        handleEvent: jest.fn(),
        ...overrides.persistence?.thoughtListener,
      },
      notesListener: {
        handleEvent: jest.fn(),
        ...overrides.persistence?.notesListener,
      },
      spatialIndexManager: {
        buildIndex: jest.fn(),
        ...overrides.persistence?.spatialIndexManager,
      },
    },
    coreSystems: {
      modsLoader: {
        loadMods: jest.fn(),
        ...overrides.coreSystems?.modsLoader,
      },
      scopeRegistry: {
        initialize: jest.fn(),
        ...overrides.coreSystems?.scopeRegistry,
      },
      dataRegistry: {
        getAll: jest.fn().mockReturnValue([]),
        ...overrides.coreSystems?.dataRegistry,
      },
      systemInitializer: {
        initializeAll: jest.fn(),
        ...overrides.coreSystems?.systemInitializer,
      },
      worldInitializer: {
        initializeWorldEntities: jest.fn(),
        ...overrides.coreSystems?.worldInitializer,
      },
      contentDependencyValidator: {
        validate: jest.fn(),
        ...overrides.coreSystems?.contentDependencyValidator,
      },
      llmAdapterInitializer: {
        initialize: jest.fn(),
        ...overrides.coreSystems?.llmAdapterInitializer,
      },
      anatomyFormattingService: {
        initialize: jest.fn(),
        ...overrides.coreSystems?.anatomyFormattingService,
      },
    },
  };

  // Allow direct overrides at top level
  return {
    ...baseConfig,
    ...overrides,
    log: { ...baseConfig.log, ...overrides.log },
    events: { ...baseConfig.events, ...overrides.events },
    llm: { ...baseConfig.llm, ...overrides.llm },
    persistence: { ...baseConfig.persistence, ...overrides.persistence },
    coreSystems: { ...baseConfig.coreSystems, ...overrides.coreSystems },
  };
}

describe('dependency utilities integration coverage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('InitializationService dependency validation', () => {
    it('constructs successfully with a fully wired dependency graph', () => {
      const config = createInitializationConfig();

      expect(() => new InitializationService(config)).not.toThrow();
    });

    it('throws when a required dependency is missing', () => {
      const logger = createMockLogger();
      const config = createInitializationConfig({
        log: { logger },
        persistence: { entityManager: null },
      });

      expect(() => new InitializationService(config)).toThrow(
        SystemInitializationError
      );
    });

    it('validates dependency methods and surfaces descriptive errors', () => {
      const logger = createMockLogger();
      const config = createInitializationConfig({
        log: { logger: { error: jest.fn() } },
      });

      expect(() => new InitializationService(config)).toThrow(
        SystemInitializationError
      );
    });

    it('surfaces failures when collaborators are missing required methods', () => {
      const logger = createMockLogger();
      const config = createInitializationConfig({
        log: { logger },
        coreSystems: {
          modsLoader: { loadMods: undefined },
        },
      });

      expect(() => new InitializationService(config)).toThrow(
        SystemInitializationError
      );
    });
  });

  describe('ServiceSetup and validateDependencies', () => {
    let logger;
    let setup;

    beforeEach(() => {
      logger = createEnhancedMockLogger();
      setup = new ServiceSetup();
    });

    it('creates prefixed loggers and validates real service dependencies', () => {
      const registryLogger = createEnhancedMockLogger();
      const registry = new ServiceRegistry({ logger: registryLogger });

      const prefixedLogger = setup.setupService('Pipeline', logger, {
        registry: {
          value: registry,
          requiredMethods: ['register', 'get', 'getStats'],
        },
        onReady: { value: () => true, isFunction: true },
      });

      expect(prefixedLogger.debug).toBeDefined();
      registry.register('demo', { ready: true }, { version: '1.0.0' });
      expect(registry.getStats().services.demo.version).toBe('1.0.0');
    });

    it('throws when required methods are missing on a dependency', () => {
      expect(() =>
        setup.validateDeps('Pipeline', logger, {
          registry: {
            value: { register: jest.fn() },
            requiredMethods: ['register', 'get'],
          },
        })
      ).toThrow(InvalidArgumentError);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid or missing method')
      );
    });

    it('throws when dependencies expected to be functions are not callable', () => {
      expect(() =>
        setup.validateDeps('Pipeline', logger, {
          onReady: { value: 'not-a-function', isFunction: true },
        })
      ).toThrow(InvalidArgumentError);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('must be a function')
      );
    });

    it('safely ignores empty dependency descriptors', () => {
      expect(() => setup.validateDeps('Pipeline', logger)).not.toThrow();
    });
  });

  describe('ServiceRegistry dependency validation', () => {
    it('falls back to console logging when logger lacks error method', () => {
      const debug = jest.fn();
      const info = jest.fn();
      const warn = jest.fn();
      const logger = { debug, info, warn };
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      expect(() => new ServiceRegistry({ logger })).toThrow(
        InvalidArgumentError
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Invalid or missing method 'error' on dependency 'ILogger'."
        )
      );
    });
  });

  describe('EntityMutationManager ID validation', () => {
    let logger;
    let componentMutationService;
    let lifecycleManager;

    beforeEach(() => {
      logger = createEnhancedMockLogger();
      componentMutationService = {
        addComponent: jest.fn().mockResolvedValue(true),
        removeComponent: jest.fn().mockResolvedValue(true),
      };
      lifecycleManager = {
        removeEntityInstance: jest.fn().mockResolvedValue(true),
      };
    });

    it('delegates to mutation services when identifiers are valid', async () => {
      const manager = new EntityMutationManager({
        componentMutationService,
        lifecycleManager,
        logger,
      });

      const result = await manager.addComponent('entity:1', 'test:component', {
        value: 42,
      });

      expect(result).toBe(true);
      expect(componentMutationService.addComponent).toHaveBeenCalledWith(
        'entity:1',
        'test:component',
        { value: 42 }
      );
    });

    it('throws descriptive errors for invalid entity identifiers', async () => {
      const manager = new EntityMutationManager({
        componentMutationService,
        lifecycleManager,
        logger,
      });

      await expect(
        manager.addComponent(null, 'test:component', { value: 42 })
      ).rejects.toThrow(InvalidArgumentError);
      const [message] = logger.error.mock.calls[0];
      expect(message).toContain("Invalid ID 'null'");
    });

    it('throws descriptive errors for invalid component identifiers', async () => {
      const manager = new EntityMutationManager({
        componentMutationService,
        lifecycleManager,
        logger,
      });

      await expect(
        manager.addComponent('entity:1', '  ', { value: 42 })
      ).rejects.toThrow(InvalidArgumentError);
      const [message] = logger.error.mock.calls[0];
      expect(message).toContain("Invalid componentTypeId '  '");
    });

    it('validates dependency presence when constructing the manager', () => {
      expect(
        () =>
          new EntityMutationManager({
            componentMutationService: null,
            lifecycleManager,
            logger,
          })
      ).toThrow(InvalidArgumentError);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Missing required dependency: ComponentMutationService'
        )
      );
    });
  });
});
