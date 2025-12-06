import { describe, it, expect, afterEach } from '@jest/globals';

import InitializationService from '../../../src/initializers/services/initializationService.js';
import { SystemInitializationError } from '../../../src/errors/InitializationError.js';
import { LLMConfigurationManager } from '../../../src/llms/services/llmConfigurationManager.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { ServiceSetup } from '../../../src/utils/serviceInitializerUtils.js';
import { withValidatedDeps } from '../../../src/utils/withValidatedDeps.js';
import { assertMethods } from '../../../src/utils/dependencyUtils.js';

class MemoryLogger {
  constructor() {
    this.errors = [];
    this.debugMessages = [];
  }

  error(message, ...args) {
    this.errors.push({ message, args });
  }

  debug(message, ...args) {
    this.debugMessages.push({ message, args });
  }

  info() {}

  warn() {}
}

describe('dependencyUtils integration edge cases', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs through provided logger when InitializationService validates dispatcher dependencies', () => {
    const logger = new MemoryLogger();

    const dependencies = {
      log: { logger },
      events: {
        // Missing dispatch() to trigger assertFunction failure
        validatedEventDispatcher: {},
        safeEventDispatcher: {
          subscribe: () => () => {},
          dispatch: () => {},
        },
      },
      llm: {
        llmAdapter: {
          init: async () => {},
          isInitialized: () => true,
          isOperational: () => true,
        },
        llmConfigLoader: {
          load: async () => ({ configs: {}, defaultConfigId: 'demo' }),
        },
      },
      persistence: {
        entityManager: {},
        domUiFacade: {},
        actionIndex: { buildIndex: () => {} },
        gameDataRepository: { getAllActionDefinitions: () => [] },
        thoughtListener: { handleEvent: () => {} },
        notesListener: { handleEvent: () => {} },
        spatialIndexManager: { start: () => {}, stop: () => {} },
      },
      coreSystems: {
        modsLoader: { loadMods: async () => ({}) },
        scopeRegistry: { initialize: async () => {} },
        dataRegistry: { getAll: () => [] },
        systemInitializer: { initializeAll: async () => {} },
        worldInitializer: { initializeWorldEntities: async () => {} },
        contentDependencyValidator: { validate: () => ({ isValid: true }) },
        llmAdapterInitializer: {
          initialize: async () => {},
          ensureOperational: async () => {},
        },
        anatomyFormattingService: { initialize: () => {} },
      },
    };

    expect(() => new InitializationService(dependencies)).toThrow(
      SystemInitializationError
    );

    expect(logger.errors).toHaveLength(1);
    expect(logger.errors[0].message).toContain(
      "InitializationService: Missing or invalid required dependency 'validatedEventDispatcher'."
    );
  });

  it('falls back to console logging when validateDependency receives no logger', () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(
      () =>
        new LLMConfigurationManager({
          // No logger provided so dependency validation should fail fast
          logger: undefined,
        })
    ).toThrow(InvalidArgumentError);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Missing required dependency: ILogger.'
    );
  });

  it('uses console fallback when provided logger lacks an error method', () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const setup = new ServiceSetup();
    const incompleteLogger = { info: () => {} };

    expect(() =>
      setup.validateDeps('Reporter', incompleteLogger, {
        reporter: { value: null, requiredMethods: ['log'] },
      })
    ).toThrow(InvalidArgumentError);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Missing required dependency: Reporter: reporter.'
    );
  });

  it('returns early when dependency specifications resolve to null', () => {
    const logger = new MemoryLogger();

    class BaseService {
      constructor(args) {
        this.logger = args.logger;
      }
    }

    const WrappedService = withValidatedDeps(BaseService, () => null);

    expect(() => new WrappedService({ logger })).not.toThrow();
    expect(logger.errors).toHaveLength(0);
  });

  it('treats missing method specifications as optional during service setup validation', () => {
    const setup = new ServiceSetup();
    const logger = new MemoryLogger();

    setup.validateDeps('OptionalService', logger, {
      analytics: { value: { ready: true } },
    });

    expect(logger.errors).toHaveLength(0);
  });

  it('uses default Error when assertMethods is invoked without an ErrorType', () => {
    expect(() =>
      assertMethods(
        { build: () => {} },
        ['missing'],
        'Service requires build() and missing()'
      )
    ).toThrow(Error);
  });
});
