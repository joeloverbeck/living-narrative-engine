import { describe, it, expect, beforeEach } from '@jest/globals';
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import {
  initializeCoreServices,
  initializeAnatomyServices,
  initializeAuxiliaryServices,
} from '../../../../src/utils/initialization/commonInitialization.js';

class TestLogger {
  constructor() {
    this.entries = [];
  }

  #record(level, message, details) {
    this.entries.push({ level, message, details });
  }

  info(message, details) {
    this.#record('info', message, details);
  }

  debug(message, details) {
    this.#record('debug', message, details);
  }

  warn(message, details) {
    this.#record('warn', message, details);
  }

  error(message, details) {
    this.#record('error', message, details);
  }

  messagesFor(level) {
    return this.entries
      .filter((entry) => entry.level === level)
      .map((entry) => entry.message);
  }

  indexOfMessage(message) {
    return this.entries.findIndex((entry) => entry.message === message);
  }
}

class TestSystemInitializer {
  constructor() {
    this.initializeCalls = 0;
    this.sequence = [];
  }

  async initializeAll() {
    this.sequence.push('begin');
    this.initializeCalls += 1;
    await Promise.resolve();
    this.sequence.push('complete');
  }
}

class AsyncFormattingService {
  constructor() {
    this.initializeCalls = 0;
    this.sequence = [];
  }

  async initialize() {
    this.sequence.push('start');
    this.initializeCalls += 1;
    await Promise.resolve();
    this.sequence.push('finished');
  }
}

class IdentityService {
  constructor(name) {
    this.name = name;
  }
}

describe('commonInitialization integration', () => {
  let container;
  let logger;
  let tokens;
  let anatomyFormattingService;
  let anatomyDescriptionService;
  let systemInitializer;
  let modsLoader;
  let registry;
  let entityManager;
  let eventDispatcher;

  beforeEach(() => {
    container = new AppContainer();
    logger = new TestLogger();
    anatomyFormattingService = new AsyncFormattingService();
    anatomyDescriptionService = new IdentityService('anatomyDescription');
    systemInitializer = new TestSystemInitializer();
    modsLoader = new IdentityService('modsLoader');
    registry = new IdentityService('registry');
    entityManager = new IdentityService('entityManager');
    eventDispatcher = new IdentityService('eventDispatcher');

    tokens = {
      ILogger: 'ILogger',
      ModsLoader: 'ModsLoader',
      IDataRegistry: 'IDataRegistry',
      IEntityManager: 'IEntityManager',
      SystemInitializer: 'SystemInitializer',
      ISafeEventDispatcher: 'ISafeEventDispatcher',
      AnatomyFormattingService: 'AnatomyFormattingService',
      AnatomyDescriptionService: 'AnatomyDescriptionService',
    };

    container.register(tokens.ILogger, logger);
    container.register(tokens.ModsLoader, modsLoader);
    container.register(tokens.IDataRegistry, registry);
    container.register(tokens.IEntityManager, entityManager);
    container.register(tokens.SystemInitializer, systemInitializer);
    container.register(tokens.ISafeEventDispatcher, eventDispatcher);
    container.register(
      tokens.AnatomyFormattingService,
      anatomyFormattingService
    );
    container.register(
      tokens.AnatomyDescriptionService,
      anatomyDescriptionService
    );
  });

  it('wires the initialization workflow through the container and services', async () => {
    const coreServices = await initializeCoreServices(container, tokens);

    expect(coreServices.logger).toBe(logger);
    expect(coreServices.modsLoader).toBe(modsLoader);
    expect(coreServices.registry).toBe(registry);
    expect(coreServices.entityManager).toBe(entityManager);
    expect(coreServices.systemInitializer).toBe(systemInitializer);
    expect(coreServices.eventDispatcher).toBe(eventDispatcher);

    expect(logger.messagesFor('debug')).toContain(
      'Core services resolved successfully'
    );

    const anatomyServices = await initializeAnatomyServices(
      container,
      coreServices.logger,
      tokens
    );

    expect(anatomyServices.anatomyFormattingService).toBe(
      anatomyFormattingService
    );
    expect(anatomyServices.anatomyDescriptionService).toBe(
      anatomyDescriptionService
    );
    expect(anatomyFormattingService.initializeCalls).toBe(1);
    expect(anatomyFormattingService.sequence).toEqual(['start', 'finished']);

    let infoMessages = logger.messagesFor('info');
    expect(infoMessages).toEqual([
      'Initializing anatomy-specific services...',
      'AnatomyFormattingService initialized successfully',
    ]);
    expect(
      logger.indexOfMessage('Initializing anatomy-specific services...')
    ).toBeLessThan(
      logger.indexOfMessage('AnatomyFormattingService initialized successfully')
    );

    await initializeAuxiliaryServices(container, coreServices.logger, tokens);

    expect(systemInitializer.initializeCalls).toBe(1);
    expect(systemInitializer.sequence).toEqual(['begin', 'complete']);

    infoMessages = logger.messagesFor('info');
    expect(infoMessages).toEqual([
      'Initializing anatomy-specific services...',
      'AnatomyFormattingService initialized successfully',
      'Initializing auxiliary services...',
      'Auxiliary services initialized successfully',
    ]);
  });
});
