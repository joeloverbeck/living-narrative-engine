import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import { MultiTargetEventBuilder } from '../../../src/entities/multiTarget/multiTargetEventBuilder.js';
import TargetExtractionResult from '../../../src/entities/multiTarget/targetExtractionResult.js';
import { TargetManager } from '../../../src/entities/multiTarget/targetManager.js';
import WorldInitializer from '../../../src/initializers/worldInitializer.js';
import { EventDispatchService } from '../../../src/utils/eventDispatchService.js';
import CommandProcessor from '../../../src/commands/commandProcessor.js';
import SchemaLoader from '../../../src/loaders/schemaLoader.js';
import {
  validateDependencies,
  assertMethods,
} from '../../../src/utils/dependencyUtils.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { DelegatingDecisionProvider } from '../../../src/turns/providers/delegatingDecisionProvider.js';

class MinimalSafeEventDispatcher {
  constructor() {
    this.dispatchCalls = [];
  }

  async dispatch(eventName, payload) {
    this.dispatchCalls.push({ eventName, payload });
    return true;
  }
}

describe('dependencyUtils integration orchestrator coverage', () => {
  let consoleErrorSpy;
  let consoleWarnSpy;
  let consoleInfoSpy;
  let consoleDebugSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('propagates guard failures through multi-target builders', () => {
    const logger = new ConsoleLogger(LogLevel.DEBUG);

    // Drop constructor noise so later assertions are meaningful.
    consoleInfoSpy.mockClear();
    consoleDebugSpy.mockClear();

    const targetManager = new TargetManager({ logger });

    expect(() => targetManager.addTarget('', 'npc-01')).toThrow(
      InvalidArgumentError
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "TargetManager.addTarget: Invalid name ''. Expected non-blank string.",
      expect.objectContaining({
        receivedValue: '',
        parameterName: 'name',
      })
    );

    consoleErrorSpy.mockClear();

    const builder = new MultiTargetEventBuilder({ logger });
    builder.setActor('hero-01');
    builder.setAction('core:wave');
    builder.setOriginalInput('wave at npc');

    expect(() => builder.setTargets(null)).toThrow(
      'Targets object is required'
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith('Targets object is required');

    consoleErrorSpy.mockClear();

    const populatedManager = new TargetManager({
      logger,
      targets: { primary: 'npc-02', ally: 'npc-03' },
    });
    const extraction = new TargetExtractionResult({
      targetManager: populatedManager,
    });

    expect(() => builder.setTargetsFromExtraction(extraction)).not.toThrow();
    expect(builder.setLegacyTarget('npc-02')).toBe(builder);

    expect(() => builder.setLegacyTarget('   ')).toThrow(InvalidArgumentError);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "MultiTargetEventBuilder.setLegacyTarget: Invalid targetId '   '. Expected non-blank string.",
      expect.objectContaining({
        parameterName: 'targetId',
      })
    );
  });

  it('raises descriptive world initialization errors when wiring is incomplete', () => {
    const logger = new ConsoleLogger(LogLevel.ERROR);
    consoleInfoSpy.mockClear();
    consoleDebugSpy.mockClear();

    const minimalDeps = {
      entityManager: { createEntityInstance() {} },
      worldContext: {},
      gameDataRepository: {
        getWorld() {
          return {};
        },
        getEntityInstanceDefinition() {
          return {};
        },
        get() {
          return {};
        },
      },
      validatedEventDispatcher: { dispatch: () => {} },
      eventDispatchService: new EventDispatchService({
        safeEventDispatcher: new MinimalSafeEventDispatcher(),
        logger,
      }),
      logger,
      scopeRegistry: { initialize: () => {} },
    };

    expect(
      () =>
        new WorldInitializer({
          ...minimalDeps,
          entityManager: {},
        })
    ).toThrow(
      'WorldInitializer requires an IEntityManager with createEntityInstance().'
    );

    expect(
      () =>
        new WorldInitializer({
          ...minimalDeps,
          worldContext: null,
        })
    ).toThrow('WorldInitializer requires a WorldContext.');

    expect(
      () =>
        new WorldInitializer({
          ...minimalDeps,
          gameDataRepository: {
            getWorld() {
              return {};
            },
          },
        })
    ).toThrow(
      'WorldInitializer requires an IGameDataRepository with getWorld(), getEntityInstanceDefinition(), and get().'
    );
  });

  it('enforces dependency contracts across command processing and schema loading', async () => {
    const logger = new ConsoleLogger(LogLevel.DEBUG);
    consoleInfoSpy.mockClear();
    consoleDebugSpy.mockClear();

    const safeDispatcher = new MinimalSafeEventDispatcher();
    const eventDispatchService = new EventDispatchService({
      safeEventDispatcher: safeDispatcher,
      logger,
    });

    // assertMethods propagates logger-aware failures
    expect(() =>
      assertMethods(
        { dispatchWithLogging: () => {} },
        ['dispatchWithLogging', 'dispatchWithErrorHandling'],
        'Event dispatch API incomplete',
        InvalidArgumentError,
        logger
      )
    ).toThrow(InvalidArgumentError);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Event dispatch API incomplete'
    );

    consoleErrorSpy.mockClear();

    expect(() =>
      assertMethods(
        eventDispatchService,
        [
          'dispatchWithLogging',
          'dispatchWithErrorHandling',
          'dispatchSystemError',
        ],
        'Event dispatch API complete',
        InvalidArgumentError,
        logger
      )
    ).not.toThrow();

    const commandProcessor = new CommandProcessor({
      safeEventDispatcher: safeDispatcher,
      eventDispatchService,
      logger,
    });

    const invalidActor = { id: '   ' };
    const invalidAction = { actionDefinitionId: '   ', commandString: 'wave' };

    const failureResult = await commandProcessor.dispatchAction(
      invalidActor,
      invalidAction
    );

    expect(failureResult.success).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'CommandProcessor.dispatchAction: Input validation failed',
      expect.objectContaining({
        error:
          "CommandProcessor.dispatchAction: Invalid ID '   '. Expected non-blank string.",
      })
    );

    consoleErrorSpy.mockClear();

    const validActor = { id: 'hero-01' };
    const validAction = {
      actionDefinitionId: 'core:wave',
      commandString: 'wave',
    };

    await commandProcessor.dispatchAction(validActor, validAction);

    expect(safeDispatcher.dispatchCalls.length).toBeGreaterThan(0);

    const configuration = {
      getSchemaFiles() {
        return ['dummy.schema.json'];
      },
    };
    const pathResolver = {
      resolveSchemaPath(name) {
        return `/virtual/${name}`;
      },
    };
    const fetcher = {
      async fetch(path) {
        return {
          $id: `schema://${path}`,
          type: 'object',
        };
      },
    };
    const validator = {
      added: [],
      async addSchema(schema) {
        this.added.push(schema);
      },
      async addSchemas(schemas) {
        this.added.push(...schemas);
      },
      isSchemaLoaded() {
        return true;
      },
      validateSchemaRefs() {
        return true;
      },
      getLoadedSchemaIds() {
        return this.added.map((schema) => schema.$id);
      },
    };

    expect(() => validateDependencies(null, logger)).not.toThrow();

    const loader = new SchemaLoader(
      configuration,
      pathResolver,
      fetcher,
      validator,
      logger
    );

    await expect(loader.loadAndCompileAllSchemas()).resolves.toBeUndefined();

    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockClear();

    expect(
      () =>
        new SchemaLoader(
          configuration,
          pathResolver,
          fetcher,
          { addSchema: async () => {}, addSchemas: async () => {} },
          logger
        )
    ).toThrow(
      "Invalid or missing method 'isSchemaLoaded' on dependency 'ISchemaValidator'."
    );

    expect(
      () => new SchemaLoader(configuration, pathResolver, fetcher, null, logger)
    ).toThrow('Missing required dependency: ISchemaValidator.');

    const bareLogger = { error: jest.fn(), debug: jest.fn() };
    const minimalSafeDispatcher = { dispatch: jest.fn() };
    expect(
      () =>
        new DelegatingDecisionProvider({
          delegate: {},
          logger: bareLogger,
          safeEventDispatcher: minimalSafeDispatcher,
        })
    ).toThrow("Dependency 'delegate' must be a function, but got object.");
    expect(bareLogger.error).toHaveBeenCalledWith(
      "Dependency 'delegate' must be a function, but got object."
    );
  });
});
