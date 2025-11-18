import { afterEach, describe, expect, it, jest } from '@jest/globals';

/**
 *
 */
function createLogger() {
  return {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}

describe('registerLoaders full instantiation coverage', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it('instantiates loaders, phases, cache, and mods loader registrations', async () => {
    jest.resetModules();
    delete global.window;
    process.env.NODE_ENV = 'test';

    const created = {};
    const logger = createLogger();

    const mockClass = (path, factory) => {
      jest.doMock(path, () => {
        const Klass = factory();
        return { __esModule: true, default: Klass };
      });
    };

    mockClass('../../../../src/loaders/entityDefinitionLoader.js', () => {
      return class MockEntityDefinitionLoader {
        constructor(
          configuration,
          pathResolver,
          dataFetcher,
          schemaValidator,
          dataRegistry,
          loggerDep,
          safeDispatcher
        ) {
          created.entityDefinitionLoader = {
            configuration,
            pathResolver,
            dataFetcher,
            schemaValidator,
            dataRegistry,
            logger: loggerDep,
            safeDispatcher,
          };
        }
      };
    });

    mockClass('../../../../src/loaders/gameConfigLoader.js', () => {
      return class MockGameConfigLoader {
        constructor(config) {
          created.gameConfigLoader = config;
          this.config = config;
        }
      };
    });

    mockClass('../../../../src/loaders/promptTextLoader.js', () => {
      return class MockPromptTextLoader {
        constructor(config) {
          created.promptTextLoader = config;
          this.config = config;
        }
      };
    });

    mockClass('../../../../src/loaders/modsLoader.js', () => {
      return class MockModsLoader {
        constructor(deps) {
          created.modsLoader = deps;
          this.logger = deps.logger;
          this.cache = deps.cache;
          this.session = deps.session;
          this.registry = deps.registry;
        }
      };
    });

    mockClass('../../../../src/loaders/ModsLoadSession.js', () => {
      return class MockModsLoadSession {
        constructor(config) {
          created.modsLoadSession = config;
          this.phases = config.phases;
          this.cache = config.cache;
          this.logger = config.logger;
        }
      };
    });

    mockClass('../../../../src/loaders/schemaLoader.js', () => {
      return class MockSchemaLoader {
        constructor(configuration, pathResolver, dataFetcher, schemaValidator, loggerDep) {
          created.schemaLoader = {
            configuration,
            pathResolver,
            dataFetcher,
            schemaValidator,
            logger: loggerDep,
          };
        }
      };
    });

    const mockPhase = (phaseName) =>
      class MockPhase {
        constructor(config) {
          created[phaseName] = config;
          this.config = config;
          this.name = phaseName;
        }
      };

    mockClass('../../../../src/loaders/phases/SchemaPhase.js', () =>
      mockPhase('SchemaPhase')
    );
    mockClass('../../../../src/loaders/phases/GameConfigPhase.js', () =>
      mockPhase('GameConfigPhase')
    );
    mockClass('../../../../src/loaders/phases/ManifestPhase.js', () =>
      mockPhase('ManifestPhase')
    );
    mockClass('../../../../src/loaders/phases/contentPhase.js', () =>
      mockPhase('ContentPhase')
    );
    mockClass('../../../../src/loaders/phases/anatomyValidationPhase.js', () =>
      mockPhase('anatomy-validation')
    );
    mockClass('../../../../src/loaders/phases/worldPhase.js', () =>
      mockPhase('WorldPhase')
    );
    mockClass('../../../../src/loaders/phases/summaryPhase.js', () =>
      mockPhase('SummaryPhase')
    );

    jest.doMock('../../../../src/validation/modReferenceExtractor.js', () => ({
      __esModule: true,
      default: class MockModReferenceExtractor {
        constructor(config) {
          created.modReferenceExtractor = config;
        }
      },
    }));

    jest.doMock('../../../../src/validation/modCrossReferenceValidator.js', () => ({
      __esModule: true,
      default: class MockModCrossReferenceValidator {
        constructor(config) {
          created.modCrossReferenceValidator = config;
        }
      },
    }));

    jest.doMock('../../../../src/validation/modValidationOrchestrator.js', () => ({
      __esModule: true,
      default: class MockModValidationOrchestrator {
        constructor(config) {
          created.modValidationOrchestrator = config;
        }
      },
    }));

    jest.doMock('../../../../src/validation/violationReporter.js', () => ({
      __esModule: true,
      default: class MockViolationReporter {
        constructor(config) {
          created.violationReporter = config;
        }
      },
    }));

    jest.doMock('../../../../src/anatomy/slotGenerator.js', () => ({
      __esModule: true,
      default: class MockSlotGenerator {
        constructor(config) {
          created.slotGenerator = config;
        }
      },
    }));

    jest.doMock('../../../../src/anatomy/recipePatternResolver/patternResolver.js', () => ({
      __esModule: true,
      default: class MockRecipePatternResolver {
        constructor(config) {
          created.recipePatternResolver = config;
        }
      },
    }));

    jest.doMock('../../../../src/anatomy/validation/rules/blueprintRecipeValidationRule.js', () => ({
      __esModule: true,
      BlueprintRecipeValidationRule: class MockBlueprintRecipeValidationRule {
        constructor(config) {
          created.blueprintRecipeValidationRule = config;
        }
      },
    }));

    const AppContainer = require('../../../../src/dependencyInjection/appContainer.js').default;
    const { tokens } = require('../../../../src/dependencyInjection/tokens.js');
    const { registerLoaders } = require('../../../../src/dependencyInjection/registrations/loadersRegistrations.js');

    const container = new AppContainer();
    container.register(tokens.ILogger, () => logger);
    container.register(tokens.ISafeEventDispatcher, () => ({ dispatch: jest.fn() }));
    container.register(tokens.IValidatedEventDispatcher, () => ({ dispatchValidated: jest.fn() }));
    container.register(tokens.IPathConfiguration, () => ({ promptBasePath: '/prompt' }));

    await registerLoaders(container);

    const entityLoader = container.resolve(tokens.EntityLoader);
    expect(entityLoader).toBeDefined();
    expect(created.entityDefinitionLoader.logger).toBe(logger);
    const safeDispatcher = container.resolve(tokens.ISafeEventDispatcher);
    expect(created.entityDefinitionLoader.safeDispatcher).toBe(safeDispatcher);

    const gameConfigLoader = container.resolve(tokens.GameConfigLoader);
    expect(gameConfigLoader).toBeDefined();
    expect(created.gameConfigLoader.logger).toBe(logger);

    const summaryLogger = container.resolve(tokens.WorldLoadSummaryLogger);
    expect(summaryLogger).toBeDefined();

    const schemaPhase = container.resolve(tokens.SchemaPhase);
    const gameConfigPhase = container.resolve(tokens.GameConfigPhase);
    const manifestPhase = container.resolve(tokens.ManifestPhase);
    const contentPhase = container.resolve(tokens.ContentPhase);
    const worldPhase = container.resolve(tokens.WorldPhase);
    const summaryPhase = container.resolve(tokens.SummaryPhase);

    expect(schemaPhase.name).toBe('SchemaPhase');
    expect(gameConfigPhase.name).toBe('GameConfigPhase');
    expect(manifestPhase.name).toBe('ManifestPhase');
    expect(contentPhase.name).toBe('ContentPhase');
    expect(worldPhase.name).toBe('WorldPhase');
    expect(summaryPhase.name).toBe('SummaryPhase');

    const loadCache = container.resolve(tokens.ILoadCache);
    expect(loadCache).toBeDefined();

    const modsLoader = container.resolve(tokens.ModsLoader);
    expect(modsLoader).toBeDefined();
    expect(created.modsLoader.logger).toBe(logger);
    expect(created.modsLoader.cache).toBe(loadCache);
    expect(created.modsLoader.session).toBeInstanceOf(Object);
    expect(created.modsLoadSession.cache).toBe(loadCache);
    expect(created.modsLoadSession.phases).toHaveLength(7);
    expect(created.modsLoadSession.phases.map((phase) => phase.name)).toEqual([
      'SchemaPhase',
      'GameConfigPhase',
      'ManifestPhase',
      'ContentPhase',
      'anatomy-validation',
      'WorldPhase',
      'SummaryPhase',
    ]);
    expect(logger.debug).toHaveBeenCalledWith(
      'ModsLoader: All 7 phases resolved successfully'
    );

    const schemaLoader = container.resolve(tokens.SchemaLoader);
    expect(schemaLoader).toBeDefined();
    expect(created.schemaLoader.logger).toBe(logger);

    const violationReporter = container.resolve(tokens.IViolationReporter);
    expect(violationReporter).toBeDefined();
    expect(created.violationReporter.logger).toBe(logger);
  });
});
