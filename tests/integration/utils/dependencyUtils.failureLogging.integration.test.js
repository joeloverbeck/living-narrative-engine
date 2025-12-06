import { describe, it, expect } from '@jest/globals';

import InitializationService from '../../../src/initializers/services/initializationService.js';
import CommandProcessor from '../../../src/commands/commandProcessor.js';
import { EventDispatchService } from '../../../src/utils/eventDispatchService.js';
import { SystemInitializationError } from '../../../src/errors/InitializationError.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

class RecordingLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(message, context) {
    this.debugMessages.push({ message, context });
  }

  info(message, context) {
    this.infoMessages.push({ message, context });
  }

  warn(message, context) {
    this.warnMessages.push({ message, context });
  }

  error(message, context) {
    this.errorMessages.push({ message, context });
  }
}

class WorkingSafeEventDispatcher {
  constructor() {
    this.dispatchCalls = [];
    this.subscriptions = [];
  }

  async dispatch(eventName, payload) {
    this.dispatchCalls.push({ eventName, payload });
    return true;
  }

  subscribe(eventName, handler) {
    this.subscriptions.push({ eventName, handler });
    return () => {};
  }
}

class PassiveModsLoader {
  async loadMods() {
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

class PassiveLlmAdapterInitializer {
  async initialize() {}
}

class PassiveAnatomyFormattingService {
  async warmCache() {}
}

class PassiveEntityManager {
  createEntityInstance() {
    return { id: 'entity-1' };
  }
}

class PassiveActionIndex {
  async buildIndex() {
    return new Map();
  }
}

class PassiveGameDataRepository {
  getAllActionDefinitions() {
    return [];
  }

  getWorld() {
    return { id: 'world' };
  }

  get() {
    return {};
  }

  getEntityInstanceDefinition() {
    return {};
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

describe('dependencyUtils failure logging integration', () => {
  const createBaseInitializationDependencies = ({
    logger,
    validatedEventDispatcher,
  }) => ({
    log: { logger },
    events: {
      validatedEventDispatcher,
      safeEventDispatcher: new WorkingSafeEventDispatcher(),
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
      llmAdapterInitializer: new PassiveLlmAdapterInitializer(),
      anatomyFormattingService: new PassiveAnatomyFormattingService(),
    },
  });

  it('surfaces a structured error when validatedEventDispatcher lacks dispatch', () => {
    const logger = new RecordingLogger();
    const brokenDispatcher = { subscribe: () => {} };

    expect(
      () =>
        new InitializationService(
          createBaseInitializationDependencies({
            logger,
            validatedEventDispatcher: brokenDispatcher,
          })
        )
    ).toThrow(SystemInitializationError);

    const loggedMessages = logger.errorMessages.map(({ message }) => message);
    expect(loggedMessages).toContain(
      "InitializationService: Missing or invalid required dependency 'validatedEventDispatcher'."
    );
  });

  it('logs and throws when CommandProcessor is missing a safe event dispatcher', () => {
    const logger = new RecordingLogger();
    const eventDispatchService = new EventDispatchService({
      safeEventDispatcher: new WorkingSafeEventDispatcher(),
      logger,
    });

    expect(
      () =>
        new CommandProcessor({
          safeEventDispatcher: null,
          eventDispatchService,
          logger,
        })
    ).toThrow(InvalidArgumentError);

    const loggedMessages = logger.errorMessages.map(({ message }) => message);
    expect(loggedMessages).toContain(
      'Missing required dependency: safeEventDispatcher.'
    );
  });
});
