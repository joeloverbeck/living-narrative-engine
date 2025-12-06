import { describe, it, expect } from '@jest/globals';

import InitializationService from '../../../src/initializers/services/initializationService.js';
import FacadeRegistry from '../../../src/shared/facades/FacadeRegistry.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import {
  InitializationError,
  SystemInitializationError,
} from '../../../src/errors/InitializationError.js';
import { withValidatedDeps } from '../../../src/utils/withValidatedDeps.js';

class RecordingLogger {
  constructor() {
    this.errorCalls = [];
    this.debugCalls = [];
  }

  debug(message, ...args) {
    this.debugCalls.push({ message, args });
  }

  error(message, ...args) {
    this.errorCalls.push({ message, args });
  }

  info() {}

  warn() {}
}

class PassiveSafeEventDispatcher {
  subscribe() {
    return () => {};
  }
}

class SimpleThoughtListener {
  handleEvent() {}
}

class SimpleNotesListener {
  handleEvent() {}
}

class SimpleActionIndex {
  constructor() {
    this.receivedDefinitions = null;
  }

  buildIndex(definitions) {
    this.receivedDefinitions = Array.isArray(definitions)
      ? [...definitions]
      : [];
  }
}

class SimpleGameDataRepository {
  getAllActionDefinitions() {
    return [];
  }
}

class SimpleModsLoader {
  async loadMods() {
    return [];
  }
}

class SimpleScopeRegistry {
  async initialize() {
    return true;
  }
}

class SimpleDataRegistry {
  getAll() {
    return [];
  }
}

class SimpleSystemInitializer {
  async initializeAll() {}
}

class SimpleWorldInitializer {
  async initializeWorldEntities() {
    return true;
  }
}

class SimpleContentDependencyValidator {
  async validate() {}
}

class SimpleLlmAdapterInitializer {
  async initialize() {
    return true;
  }
}

class SimpleAnatomyFormattingService {
  async initialize() {}
}

class SimpleSpatialIndexManager {
  buildIndex() {}
}

class SimpleFacadeFactory {
  registerFacade() {}

  createFacade() {
    return {};
  }

  isRegistered() {
    return false;
  }
}

describe('dependencyUtils error handling integration', () => {
  it('records dependency failure when InitializationService receives an invalid dispatcher', () => {
    const logger = new RecordingLogger();
    const invalidDispatcher = {};
    const safeEventDispatcher = new PassiveSafeEventDispatcher();

    const attemptConstruction = () =>
      new InitializationService({
        log: { logger },
        events: {
          validatedEventDispatcher: invalidDispatcher,
          safeEventDispatcher,
        },
        llm: {
          llmAdapter: {
            async init() {},
            isInitialized() {
              return true;
            },
            isOperational() {
              return true;
            },
          },
          llmConfigLoader: {
            async load() {
              return {};
            },
          },
        },
        persistence: {
          entityManager: {},
          domUiFacade: {},
          actionIndex: new SimpleActionIndex(),
          gameDataRepository: new SimpleGameDataRepository(),
          thoughtListener: new SimpleThoughtListener(),
          notesListener: new SimpleNotesListener(),
          spatialIndexManager: new SimpleSpatialIndexManager(),
        },
        coreSystems: {
          modsLoader: new SimpleModsLoader(),
          scopeRegistry: new SimpleScopeRegistry(),
          dataRegistry: new SimpleDataRegistry(),
          systemInitializer: new SimpleSystemInitializer(),
          worldInitializer: new SimpleWorldInitializer(),
          contentDependencyValidator: new SimpleContentDependencyValidator(),
          llmAdapterInitializer: new SimpleLlmAdapterInitializer(),
          anatomyFormattingService: new SimpleAnatomyFormattingService(),
        },
      });

    expect(attemptConstruction).toThrow(SystemInitializationError);
    expect(logger.errorCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message:
            "InitializationService: Missing or invalid required dependency 'validatedEventDispatcher'.",
        }),
      ])
    );
  });

  it('surfaces missing dependencies through FacadeRegistry validation', () => {
    const logger = new RecordingLogger();
    const facadeFactory = new SimpleFacadeFactory();

    expect(
      () =>
        new FacadeRegistry({
          logger,
          eventBus: null,
          facadeFactory,
        })
    ).toThrow(InvalidArgumentError);

    expect(logger.errorCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Missing required dependency: IEventBus.',
        }),
      ])
    );
  });

  it('uses provided logger when InitializationService raises content validation errors downstream', async () => {
    const logger = new RecordingLogger();
    const safeEventDispatcher = new PassiveSafeEventDispatcher();
    const validatedEventDispatcher = {
      async dispatch() {
        return true;
      },
    };

    class RejectingContentValidator extends SimpleContentDependencyValidator {
      async validate() {
        throw new InitializationError('content validation failed');
      }
    }

    const service = new InitializationService({
      log: { logger },
      events: { validatedEventDispatcher, safeEventDispatcher },
      llm: {
        llmAdapter: {
          async init() {},
          isInitialized() {
            return true;
          },
          isOperational() {
            return true;
          },
        },
        llmConfigLoader: {
          async load() {
            return {};
          },
        },
      },
      persistence: {
        entityManager: {},
        domUiFacade: {},
        actionIndex: new SimpleActionIndex(),
        gameDataRepository: new SimpleGameDataRepository(),
        thoughtListener: new SimpleThoughtListener(),
        notesListener: new SimpleNotesListener(),
        spatialIndexManager: new SimpleSpatialIndexManager(),
      },
      coreSystems: {
        modsLoader: new SimpleModsLoader(),
        scopeRegistry: new SimpleScopeRegistry(),
        dataRegistry: new SimpleDataRegistry(),
        systemInitializer: new SimpleSystemInitializer(),
        worldInitializer: new SimpleWorldInitializer(),
        contentDependencyValidator: new RejectingContentValidator(),
        llmAdapterInitializer: new SimpleLlmAdapterInitializer(),
        anatomyFormattingService: new SimpleAnatomyFormattingService(),
      },
    });

    const result = await service.runInitializationSequence('content-world');
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(InitializationError);
    expect(
      logger.errorCalls.some(({ message }) =>
        message.includes('content validation failed')
      )
    ).toBe(true);
  });

  it('falls back to console logging when the validator logger lacks an error function', () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    class BaseService {
      constructor() {
        this.initialized = true;
      }
    }

    const DecoratedService = withValidatedDeps(BaseService, () => [
      { dependency: null, name: 'DecoratedDependency' },
    ]);

    expect(
      () =>
        new DecoratedService({
          logger: { warn() {}, info() {} },
        })
    ).toThrow(InvalidArgumentError);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Missing required dependency: DecoratedDependency.'
      )
    );

    consoleSpy.mockRestore();
  });

  it('allows optional dependency specifications to short-circuit validation', () => {
    const DecoratedService = withValidatedDeps(
      class OptionalDepsService {
        constructor() {
          this.created = true;
        }
      },
      () => null
    );

    expect(
      () => new DecoratedService({ logger: new RecordingLogger() })
    ).not.toThrow();
  });
});
