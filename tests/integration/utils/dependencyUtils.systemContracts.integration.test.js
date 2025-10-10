import { describe, it, expect } from '@jest/globals';
import { EventDispatchService } from '../../../src/utils/eventDispatchService.js';
import SystemInitializer from '../../../src/initializers/systemInitializer.js';
import InitializationService from '../../../src/initializers/services/initializationService.js';
import WorldInitializer from '../../../src/initializers/worldInitializer.js';
import { TargetManager } from '../../../src/entities/multiTarget/targetManager.js';
import getDefinition from '../../../src/entities/utils/definitionLookup.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { ServiceSetup } from '../../../src/utils/serviceInitializerUtils.js';
import FacadeFactory from '../../../src/shared/facades/FacadeFactory.js';
import {
  SystemInitializationError,
  WorldInitializationError,
} from '../../../src/errors/InitializationError.js';

class RecordingLogger {
  constructor() {
    /** @type {Record<'error'|'warn'|'info'|'debug', any[][]>} */
    this.records = { error: [], warn: [], info: [], debug: [] };
  }

  error(...args) {
    this.records.error.push(args);
  }

  warn(...args) {
    this.records.warn.push(args);
  }

  info(...args) {
    this.records.info.push(args);
  }

  debug(...args) {
    this.records.debug.push(args);
  }
}

describe('dependencyUtils system contracts integration', () => {
  const createSafeDispatcher = () => ({
    dispatch: async () => true,
  });

  const createValidatedDispatcher = () => ({
    dispatch: async () => true,
    subscribe: () => () => {},
    unsubscribe: () => {},
  });

  const buildEventDispatchService = (logger) =>
    new EventDispatchService({
      safeEventDispatcher: createSafeDispatcher(),
      logger,
    });

  it('logs and throws when EventDispatchService is missing its safe dispatcher', () => {
    const logger = new RecordingLogger();

    expect(
      () =>
        new EventDispatchService({
          safeEventDispatcher: null,
          logger,
        }),
    ).toThrow('EventDispatchService: safeEventDispatcher is required');

    expect(logger.records.error.length).toBe(0);
  });

  it("surfaces resolver validation failures in SystemInitializer's guards", () => {
    const logger = new RecordingLogger();
    const eventDispatchService = buildEventDispatchService(logger);

    expect(() =>
      new SystemInitializer({
        resolver: {},
        logger,
        validatedEventDispatcher: createValidatedDispatcher(),
        eventDispatchService,
        initializationTag: 'boot',
      }),
    ).toThrow("SystemInitializer requires a valid IServiceResolver with 'resolveByTag'.");
  });

  it('logs validation failures for InitializationService when dispatchers are incomplete', () => {
    const logger = new RecordingLogger();

    expect(() =>
      new InitializationService({
        log: { logger },
        events: {
          validatedEventDispatcher: {},
          safeEventDispatcher: { subscribe: () => {} },
        },
        llm: {},
        persistence: {
          entityManager: {},
          domUiFacade: {},
          actionIndex: {},
          gameDataRepository: {},
          thoughtListener: {},
          notesListener: {},
          spatialIndexManager: {},
        },
        coreSystems: {
          modsLoader: {},
          scopeRegistry: {},
          dataRegistry: {},
          systemInitializer: {},
          worldInitializer: {},
          contentDependencyValidator: {},
          llmAdapterInitializer: {},
          anatomyFormattingService: {},
        },
      }),
    ).toThrow(SystemInitializationError);

    expect(logger.records.error.at(0)?.at(0)).toContain(
      "InitializationService: Missing or invalid required dependency 'validatedEventDispatcher'.",
    );
  });

  it('guards repository capabilities when constructing WorldInitializer', () => {
    const logger = new RecordingLogger();
    const eventDispatchService = buildEventDispatchService(logger);

    expect(() =>
      new WorldInitializer({
        entityManager: { createEntityInstance: () => ({}) },
        worldContext: {},
        gameDataRepository: {
          getWorld: () => ({}),
          // getEntityInstanceDefinition missing on purpose
          get: () => ({}),
        },
        validatedEventDispatcher: createValidatedDispatcher(),
        eventDispatchService,
        logger,
        scopeRegistry: { initialize: () => {} },
      }),
    ).toThrow(WorldInitializationError);
  });

  it('accepts well-formed dependencies for WorldInitializer', () => {
    const logger = new RecordingLogger();
    const eventDispatchService = buildEventDispatchService(logger);

    const initializer = new WorldInitializer({
      entityManager: { createEntityInstance: () => ({ id: 'entity-1' }) },
      worldContext: { activeWorld: 'demo' },
      gameDataRepository: {
        getWorld: () => ({ id: 'world-1' }),
        getEntityInstanceDefinition: () => ({ id: 'entity-1', components: {} }),
        get: () => ({ value: true }),
      },
      validatedEventDispatcher: createValidatedDispatcher(),
      eventDispatchService,
      logger,
      scopeRegistry: { initialize: () => {} },
    });

    expect(initializer.getWorldContext()).toEqual({ activeWorld: 'demo' });
  });

  it('enforces non-blank target metadata through TargetManager', () => {
    const logger = new RecordingLogger();
    const manager = new TargetManager({ logger });

    expect(() => manager.addTarget('  ', 'actor-1')).toThrow(InvalidArgumentError);
    expect(logger.records.error.at(0)?.at(0)).toContain('Invalid name');
  });

  it('logs when TargetManager receives an undefined target map', () => {
    const logger = new RecordingLogger();
    const manager = new TargetManager({ logger });

    expect(() => manager.setTargets(null)).toThrow('Targets object is required');
    expect(logger.records.error.at(0)?.at(0)).toBe('Targets object is required');
  });

  it('validates identifiers when retrieving definitions from the registry', () => {
    const logger = new RecordingLogger();
    const registry = new InMemoryDataRegistry({ logger });

    expect(() => getDefinition('   ', registry, logger)).toThrow(InvalidArgumentError);
    expect(logger.records.error.at(0)?.at(0)).toContain('Invalid ID');
    expect(logger.records.warn.at(0)?.at(0)).toContain('invalid definitionId');
  });

  it('flags non-function dependencies through ServiceSetup validation', () => {
    const logger = new RecordingLogger();
    const setup = new ServiceSetup();

    expect(() =>
      setup.validateDeps('Analyzer', logger, {
        callable: { value: {}, isFunction: true },
      }),
    ).toThrow(InvalidArgumentError);

    expect(logger.records.error.at(0)?.at(0)).toBe(
      "Dependency 'Analyzer: callable' must be a function, but got object.",
    );
  });

  it('reports missing container methods when creating a FacadeFactory', () => {
    const logger = new RecordingLogger();

    expect(() =>
      new FacadeFactory({
        logger,
        container: {},
      }),
    ).toThrow(InvalidArgumentError);

    expect(logger.records.error.at(0)?.at(0)).toBe(
      "Invalid or missing method 'resolve' on dependency 'IContainer'.",
    );
  });

  it('logs missing dependency instances when creating a FacadeFactory', () => {
    const logger = new RecordingLogger();

    expect(() =>
      new FacadeFactory({
        logger,
        container: null,
      }),
    ).toThrow(InvalidArgumentError);

    expect(logger.records.error.at(0)?.at(0)).toBe(
      'Missing required dependency: IContainer.',
    );
  });

  it('skips validation gracefully when no dependency specs are provided', () => {
    const logger = new RecordingLogger();
    const setup = new ServiceSetup();

    expect(() => setup.validateDeps('Optional', logger, null)).not.toThrow();
  });

  it('passes validation when service dependencies satisfy the contract', () => {
    const logger = new RecordingLogger();
    const setup = new ServiceSetup();

    expect(() =>
      setup.validateDeps('Workflow', logger, {
        orchestrator: {
          value: { discoverActions: () => [] },
          requiredMethods: ['discoverActions'],
        },
        factory: {
          value: () => {},
          isFunction: true,
        },
      }),
    ).not.toThrow();
  });
});
