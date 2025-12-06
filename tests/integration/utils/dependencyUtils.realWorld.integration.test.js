import { describe, expect, it } from '@jest/globals';
import { EventDispatchService } from '../../../src/utils/eventDispatchService.js';
import { TargetManager } from '../../../src/entities/multiTarget/targetManager.js';
import SystemInitializer from '../../../src/initializers/systemInitializer.js';
import InitializationService from '../../../src/initializers/services/initializationService.js';
import { ServiceSetup } from '../../../src/utils/serviceInitializerUtils.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import getDefinition from '../../../src/entities/utils/definitionLookup.js';
import { SystemInitializationError } from '../../../src/errors/InitializationError.js';

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

describe('dependencyUtils real module interactions', () => {
  it('guards required dependencies when constructing EventDispatchService', () => {
    const logger = new RecordingLogger();

    expect(
      () =>
        new EventDispatchService({
          safeEventDispatcher: null,
          logger,
        })
    ).toThrow('EventDispatchService: safeEventDispatcher is required');
  });

  it('logs and throws when TargetManager receives invalid targets', () => {
    const logger = new RecordingLogger();
    const manager = new TargetManager({ logger });

    expect(() => manager.setTargets(null)).toThrow(
      'Targets object is required'
    );
    expect(logger.records.error.at(0)?.at(0)).toBe(
      'Targets object is required'
    );
  });

  it('validates target names and IDs via assertNonBlankString', () => {
    const logger = new RecordingLogger();
    const manager = new TargetManager({ logger });

    expect(() => manager.addTarget('  ', 'actor-1')).toThrow(
      InvalidArgumentError
    );
    expect(logger.records.error.at(0)?.at(0)).toContain('Invalid name');

    logger.records.error.length = 0;
    manager.addTarget('primary', 'actor-1');
    expect(manager.getPrimaryTarget()).toBe('actor-1');
  });

  it('validates identifiers when looking up definitions', () => {
    const logger = new RecordingLogger();
    const registry = new InMemoryDataRegistry({ logger });

    expect(() => getDefinition('   ', registry, logger)).toThrow(
      InvalidArgumentError
    );
    expect(logger.records.error.at(0)?.at(0)).toContain('Invalid ID');
    expect(logger.records.warn.at(0)?.at(0)).toContain('invalid definitionId');

    registry.store('entityDefinitions', 'hero', { name: 'Hero' });
    const definition = getDefinition('hero', registry, logger);
    expect(definition).toEqual({ name: 'Hero' });
  });

  it('surfaces missing resolver functions through SystemInitializer', () => {
    const logger = new RecordingLogger();
    const validatedEventDispatcher = { dispatch: async () => {} };
    const eventDispatchService = { dispatchWithLogging: async () => {} };

    expect(
      () =>
        new SystemInitializer({
          resolver: {},
          logger,
          validatedEventDispatcher,
          eventDispatchService,
          initializationTag: 'boot',
        })
    ).toThrow(
      "SystemInitializer requires a valid IServiceResolver with 'resolveByTag'."
    );
  });

  it('logs dependency failures when InitializationService wiring is incomplete', () => {
    const logger = new RecordingLogger();

    const attemptConstruction = () =>
      new InitializationService({
        log: { logger },
        events: {
          validatedEventDispatcher: {},
          safeEventDispatcher: { subscribe: () => {} },
        },
        persistence: {
          entityManager: {},
          domUiFacade: {},
          actionIndex: { buildIndex: () => {} },
          gameDataRepository: { getAllActionDefinitions: () => [] },
          thoughtListener: { handleEvent: () => {} },
          notesListener: { handleEvent: () => {} },
          spatialIndexManager: { buildIndex: () => {} },
        },
        llm: {
          llmAdapter: {
            init: async () => {},
            isInitialized: () => true,
            isOperational: () => true,
          },
          llmConfigLoader: { loadConfig: async () => ({}) },
        },
        coreSystems: {
          modsLoader: { loadMods: async () => ({}) },
          scopeRegistry: { initialize: async () => {} },
          dataRegistry: { getAll: () => [] },
          systemInitializer: { initializeAll: async () => {} },
          worldInitializer: { initializeWorldEntities: async () => true },
          contentDependencyValidator: { validate: async () => {} },
          llmAdapterInitializer: { initialize: async () => true },
          anatomyFormattingService: { initialize: async () => {} },
        },
      });

    expect(attemptConstruction).toThrow(SystemInitializationError);
    expect(logger.records.error.at(0)?.at(0)).toContain(
      "InitializationService: Missing or invalid required dependency 'validatedEventDispatcher'."
    );
  });

  it('validates dependency specifications through ServiceSetup', () => {
    const logger = new RecordingLogger();
    const setup = new ServiceSetup();

    expect(() =>
      setup.setupService('Probe', logger, {
        orchestrator: {
          value: { discoverActions: () => [] },
          requiredMethods: ['discoverActions'],
        },
        factory: {
          value: () => {},
          isFunction: true,
        },
      })
    ).not.toThrow();

    expect(() =>
      setup.setupService('Probe', logger, {
        missing: { value: null },
      })
    ).toThrow(InvalidArgumentError);
    expect(logger.records.error.at(-1)?.at(0)).toBe(
      'Probe: Missing required dependency: Probe: missing.'
    );

    expect(() =>
      setup.setupService('Probe', logger, {
        callable: { value: {}, isFunction: true },
      })
    ).toThrow(InvalidArgumentError);
    expect(logger.records.error.at(-1)?.at(0)).toBe(
      "Probe: Dependency 'Probe: callable' must be a function, but got object."
    );
  });
});
