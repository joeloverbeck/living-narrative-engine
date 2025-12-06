import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import { EventDispatchService } from '../../../src/utils/eventDispatchService.js';
import InitializationService from '../../../src/initializers/services/initializationService.js';
import { ServiceSetup } from '../../../src/utils/serviceInitializerUtils.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import getDefinition from '../../../src/entities/utils/definitionLookup.js';
import { TargetManager } from '../../../src/entities/multiTarget/targetManager.js';
import { SystemInitializationError } from '../../../src/errors/InitializationError.js';
import { withValidatedDeps } from '../../../src/utils/withValidatedDeps.js';

class MinimalSafeEventDispatcher {
  subscribe() {
    return () => {};
  }
}

class PassiveModsLoader {
  loadMods() {
    return [];
  }
}

class PassiveScopeRegistry {
  initialize() {}
}

class PassiveDataRegistry {
  getAll() {
    return [];
  }
}

class PassiveSystemInitializer {
  async initializeAll() {}
}

class PassiveWorldInitializer {
  async initializeWorldEntities() {}
}

class PassiveContentDependencyValidator {
  async validate() {}
}

class PassiveAnatomyFormattingService {
  async warmCache() {}
}

class PassiveEntityManager {}

class PassiveActionIndex {
  buildIndex() {
    return new Map();
  }
}

class PassiveGameDataRepository {
  getAllActionDefinitions() {
    return [];
  }
}

class PassiveListener {
  handleEvent() {}
}

class PassiveSpatialIndexManager {
  buildIndex() {}
}

class PassiveLlmAdapter {
  async init() {}

  isInitialized() {
    return true;
  }

  isOperational() {
    return true;
  }
}

class PassiveLlmConfigLoader {
  async loadConfig() {
    return {};
  }
}

describe('dependencyUtils integration guard rails', () => {
  let errorSpy;
  let warnSpy;
  let infoSpy;
  let debugSpy;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws when EventDispatchService dependencies are missing', () => {
    const logger = new ConsoleLogger(LogLevel.DEBUG);

    expect(
      () =>
        new EventDispatchService({
          safeEventDispatcher: null,
          logger,
        })
    ).toThrow('EventDispatchService: safeEventDispatcher is required');
  });

  it('surfaces invalid validated event dispatcher through InitializationService', () => {
    const logger = new ConsoleLogger(LogLevel.DEBUG);

    expect(
      () =>
        new InitializationService({
          log: { logger },
          events: {
            validatedEventDispatcher: {},
            safeEventDispatcher: new MinimalSafeEventDispatcher(),
          },
          llm: {
            llmAdapter: new PassiveLlmAdapter(),
            llmConfigLoader: new PassiveLlmConfigLoader(),
          },
          persistence: {
            entityManager: new PassiveEntityManager(),
            domUiFacade: {},
            actionIndex: new PassiveActionIndex(),
            gameDataRepository: new PassiveGameDataRepository(),
            thoughtListener: new PassiveListener(),
            notesListener: new PassiveListener(),
            spatialIndexManager: new PassiveSpatialIndexManager(),
          },
          coreSystems: {
            modsLoader: new PassiveModsLoader(),
            scopeRegistry: new PassiveScopeRegistry(),
            dataRegistry: new PassiveDataRegistry(),
            systemInitializer: new PassiveSystemInitializer(),
            worldInitializer: new PassiveWorldInitializer(),
            contentDependencyValidator: new PassiveContentDependencyValidator(),
            llmAdapterInitializer: new PassiveLlmAdapter(),
            anatomyFormattingService: new PassiveAnatomyFormattingService(),
          },
        })
    ).toThrow(SystemInitializationError);

    expect(errorSpy).toHaveBeenCalledWith(
      "InitializationService: Missing or invalid required dependency 'validatedEventDispatcher'."
    );
  });

  it('propagates validation failures through service setup and downstream modules', () => {
    const logger = new ConsoleLogger(LogLevel.DEBUG);
    const serviceSetup = new ServiceSetup();

    const registry = new InMemoryDataRegistry({ logger });
    expect(() => getDefinition('   ', registry, logger)).toThrow(
      InvalidArgumentError
    );
    expect(errorSpy).toHaveBeenCalledWith(
      "definitionLookup.getDefinition: Invalid ID '   '. Expected non-blank string.",
      expect.objectContaining({ context: 'definitionLookup.getDefinition' })
    );

    errorSpy.mockClear();
    const targetManager = new TargetManager({ logger });
    expect(() => targetManager.setTargets(null)).toThrow(
      'Targets object is required'
    );
    expect(errorSpy).toHaveBeenCalledWith('Targets object is required');

    errorSpy.mockClear();
    expect(() => targetManager.addTarget(' ', 'actor-1')).toThrow(
      InvalidArgumentError
    );
    expect(errorSpy).toHaveBeenCalledWith(
      "TargetManager.addTarget: Invalid name ' '. Expected non-blank string.",
      expect.objectContaining({ parameterName: 'name' })
    );

    errorSpy.mockClear();
    const prefixedLogger = serviceSetup.setupService('Probe', logger, {
      orchestrator: {
        value: { discoverActions: () => [] },
        requiredMethods: ['discoverActions'],
      },
    });
    prefixedLogger.debug('probe ready');
    expect(debugSpy).toHaveBeenCalledWith('Probe: probe ready');

    errorSpy.mockClear();
    expect(() =>
      serviceSetup.setupService('Probe', logger, {
        missing: { value: null },
      })
    ).toThrow(InvalidArgumentError);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Missing required dependency: Probe: missing.')
    );

    errorSpy.mockClear();
    expect(() =>
      serviceSetup.setupService('Probe', logger, {
        callable: { value: {}, isFunction: true },
      })
    ).toThrow(InvalidArgumentError);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Dependency 'Probe: callable' must be a function, but got object."
      )
    );

    errorSpy.mockClear();
    expect(() =>
      serviceSetup.setupService('Probe', logger, {
        operations: {
          value: {},
          requiredMethods: ['execute'],
        },
      })
    ).toThrow(InvalidArgumentError);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Invalid or missing method 'execute' on dependency 'Probe: operations'."
      )
    );

    const Base = class {
      constructor(args) {
        this.logger = args.logger;
      }
    };
    const Decorated = withValidatedDeps(
      Base,
      (args) => args.dependencies ?? null
    );

    const decoratedLogger = serviceSetup.createLogger('Decorated', logger);
    expect(
      () => new Decorated({ logger: decoratedLogger, dependencies: null })
    ).not.toThrow();
  });
});
