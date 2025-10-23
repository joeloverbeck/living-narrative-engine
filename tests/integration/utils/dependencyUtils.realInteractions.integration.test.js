import InitializationService from '../../../src/initializers/services/initializationService.js';
import WorldInitializer from '../../../src/initializers/worldInitializer.js';
import { EventDispatchService } from '../../../src/utils/eventDispatchService.js';
import { ServiceSetup } from '../../../src/utils/serviceInitializerUtils.js';
import {
  validateInstanceAndComponent,
  isValidId,
} from '../../../src/utils/idValidation.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { SystemInitializationError } from '../../../src/errors/InitializationError.js';
import { TargetManager } from '../../../src/entities/multiTarget/targetManager.js';
import { withValidatedDeps } from '../../../src/utils/withValidatedDeps.js';

class RecordingLogger {
  constructor() {
    this.debugMessages = [];
    this.errorMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
  }

  debug(message, details) {
    this.debugMessages.push({ message, details });
  }

  info(message, details) {
    this.infoMessages.push({ message, details });
  }

  warn(message, details) {
    this.warnMessages.push({ message, details });
  }

  error(message, details) {
    this.errorMessages.push({ message, details });
  }
}

const createInitializationDeps = (logger, overrides = {}) => {
  const base = {
    log: { logger },
    events: {
      validatedEventDispatcher: {
        dispatch: () => Promise.resolve(true),
        subscribe: () => () => {},
        unsubscribe: () => {},
      },
      safeEventDispatcher: {
        subscribe: () => {},
      },
    },
    llm: {
      llmAdapter: {},
      llmConfigLoader: {},
    },
    persistence: {
      entityManager: { createEntityInstance: () => ({}) },
      domUiFacade: { ready: true },
      actionIndex: { buildIndex: () => {} },
      gameDataRepository: {
        getAllActionDefinitions: () => [],
      },
      thoughtListener: { handleEvent: () => {} },
      notesListener: { handleEvent: () => {} },
      spatialIndexManager: { buildIndex: () => {} },
    },
    coreSystems: {
      modsLoader: { loadMods: () => Promise.resolve({}) },
      scopeRegistry: { initialize: () => Promise.resolve() },
      dataRegistry: { getAll: () => [] },
      systemInitializer: { initializeAll: () => Promise.resolve() },
      worldInitializer: { initializeWorldEntities: () => Promise.resolve(true) },
      contentDependencyValidator: { validate: () => Promise.resolve() },
      llmAdapterInitializer: { initialize: () => Promise.resolve(true) },
      anatomyFormattingService: { initialize: () => Promise.resolve() },
    },
  };

  const merge = (target, source) => {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        key in target
      ) {
        result[key] = merge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  };

  return merge(base, overrides);
};

class StubSafeDispatcher {
  constructor() {
    this.dispatchCalls = [];
  }

  async dispatch(eventName, payload) {
    this.dispatchCalls.push({ eventName, payload });
    return true;
  }
}

describe('dependencyUtils integration with real modules', () => {
  test('InitializationService logs and throws when validated dispatcher is missing dispatch method', () => {
    const logger = new RecordingLogger();
    const deps = createInitializationDeps(logger, {
      events: {
        validatedEventDispatcher: {
          dispatch: undefined,
          subscribe: () => () => {},
          unsubscribe: () => {},
        },
      },
    });

    let thrown;
    try {
      new InitializationService(deps);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(SystemInitializationError);
    expect(logger.errorMessages[0].message).toContain(
      'InitializationService: Missing or invalid required dependency'
    );
  });

  test('TargetManager logs and throws when required targets are missing', () => {
    const logger = new RecordingLogger();
    const manager = new TargetManager({ logger });

    expect(() => manager.setTargets(null)).toThrow(
      'Targets object is required'
    );
    expect(logger.errorMessages[0].message).toBe(
      'Targets object is required'
    );
  });

  test('EventDispatchService throws when required dispatcher is missing', () => {
    expect(
      () =>
        new EventDispatchService({
          safeEventDispatcher: null,
          logger: new RecordingLogger(),
        })
    ).toThrow('EventDispatchService: safeEventDispatcher is required');
  });

  test('withValidatedDeps bypasses validation when specFn returns nothing', () => {
    const logger = new RecordingLogger();

    class BaseService {
      constructor(args) {
        this.args = args;
      }
    }

    const Decorated = withValidatedDeps(BaseService, () => undefined);

    expect(() => new Decorated({ logger })).not.toThrow();
  });

  describe('ServiceSetup dependency validation', () => {
    test('valid dependencies pass validation and allow prefixed logger usage', () => {
      const baseLogger = new RecordingLogger();
      const serviceSetup = new ServiceSetup();
      const safeDispatcher = new StubSafeDispatcher();
      const dispatcherService = new EventDispatchService({
        safeEventDispatcher: safeDispatcher,
        logger: baseLogger,
      });

      const deps = {
        dispatcher: {
          value: dispatcherService,
          requiredMethods: ['dispatchWithLogging', 'dispatchWithErrorHandling'],
        },
        initializer: {
          value: () => 'initialized',
          isFunction: true,
        },
        metrics: {
          value: { track: () => {} },
        },
      };

      expect(() =>
        serviceSetup.validateDeps('RealService', baseLogger, deps)
      ).not.toThrow();

      const prefixedLogger = serviceSetup.setupService(
        'RealService',
        baseLogger,
        deps
      );
      prefixedLogger.debug('hello');
      expect(baseLogger.debugMessages[0].message).toBe(
        'RealService: hello'
      );
    });

    test('missing required method triggers InvalidArgumentError and logs detail', () => {
      const baseLogger = new RecordingLogger();
      const serviceSetup = new ServiceSetup();
      const badDeps = {
        dispatcher: {
          value: {},
          requiredMethods: ['dispatchWithLogging'],
        },
      };

      expect(() =>
        serviceSetup.validateDeps('BrokenService', baseLogger, badDeps)
      ).toThrow(InvalidArgumentError);
      expect(baseLogger.errorMessages[0].message).toBe(
        "Invalid or missing method 'dispatchWithLogging' on dependency 'BrokenService: dispatcher'."
      );
    });

    test('non-function dependency flagged via isFunction option', () => {
      const baseLogger = new RecordingLogger();
      const serviceSetup = new ServiceSetup();
      const badDeps = {
        initializer: {
          value: { notCallable: true },
          isFunction: true,
        },
      };

      expect(() =>
        serviceSetup.validateDeps('BrokenInitializer', baseLogger, badDeps)
      ).toThrow(InvalidArgumentError);
      expect(baseLogger.errorMessages[0].message).toBe(
        "Dependency 'BrokenInitializer: initializer' must be a function, but got object."
      );
    });

    test('missing dependency entry reports via InvalidArgumentError', () => {
      const baseLogger = new RecordingLogger();
      const serviceSetup = new ServiceSetup();
      const badDeps = {
        analytics: {
          value: null,
        },
      };

      expect(() =>
        serviceSetup.validateDeps('BrokenAnalytics', baseLogger, badDeps)
      ).toThrow(InvalidArgumentError);
      expect(baseLogger.errorMessages[0].message).toBe(
        "Missing required dependency: BrokenAnalytics: analytics."
      );
    });

    test('undefined dependency map is ignored gracefully', () => {
      const baseLogger = new RecordingLogger();
      const serviceSetup = new ServiceSetup();
      expect(() =>
        serviceSetup.validateDeps('OptionalService', baseLogger, undefined)
      ).not.toThrow();
    });
  });

  test('idValidation propagates dependencyUtils logging for invalid identifiers', () => {
    const componentLogger = new RecordingLogger();

    expect(() =>
      validateInstanceAndComponent('entity-1', '   ', componentLogger, 'TestContext')
    ).toThrow(InvalidArgumentError);

    expect(componentLogger.errorMessages[0].message).toBe(
      "TestContext: Invalid componentTypeId '   '. Expected non-blank string."
    );
    expect(componentLogger.errorMessages[1].message).toBeInstanceOf(
      InvalidArgumentError
    );

    const idLogger = new RecordingLogger();
    expect(() =>
      validateInstanceAndComponent('', 'component-type', idLogger, 'TestContext')
    ).toThrow(InvalidArgumentError);
    expect(idLogger.errorMessages[0].message).toBe(
      "TestContext: Invalid ID ''. Expected non-blank string."
    );

    const validLogger = new RecordingLogger();
    expect(isValidId('actor-1', 'ValidCheck', validLogger)).toBe(true);
    expect(validLogger.errorMessages).toHaveLength(0);
  });

  test('WorldInitializer enforces repository method contracts', () => {
    const entityManager = { createEntityInstance: () => ({}) };
    const worldContext = { initialized: true };
    const repository = {
      getWorld: () => ({}),
      getEntityInstanceDefinition: () => ({}),
      // get method intentionally omitted to trigger assertMethods failure
    };
    const dispatcher = { dispatch: () => Promise.resolve(true) };
    const eventDispatchService = {
      dispatchWithLogging: () => Promise.resolve(),
    };
    const logger = new RecordingLogger();
    const scopeRegistry = { initialize: () => Promise.resolve() };

    expect(() =>
      new WorldInitializer({
        entityManager,
        worldContext,
        gameDataRepository: repository,
        validatedEventDispatcher: dispatcher,
        eventDispatchService,
        logger,
        scopeRegistry,
      })
    ).toThrow();
  });
});
