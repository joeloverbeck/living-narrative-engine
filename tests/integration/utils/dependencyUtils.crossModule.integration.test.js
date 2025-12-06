import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TargetManager } from '../../../src/entities/multiTarget/targetManager.js';
import WorldInitializer from '../../../src/initializers/worldInitializer.js';
import EntityFactory from '../../../src/entities/factories/entityFactory.js';
import createSlotAccessResolver from '../../../src/scopeDsl/nodes/slotAccessResolver.js';
import { getDefinition } from '../../../src/entities/utils/definitionLookup.js';
import ActionCommandFormatter from '../../../src/actions/actionFormatter.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { WorldInitializationError } from '../../../src/errors/InitializationError.js';
import { DefinitionNotFoundError } from '../../../src/errors/definitionNotFoundError.js';

class MemoryLogger {
  constructor(prefix = 'test') {
    this.prefix = prefix;
    this.messages = { debug: [], info: [], warn: [], error: [] };
  }

  #record(level, message, metadata) {
    this.messages[level].push({ message, metadata });
  }

  debug(message, metadata) {
    this.#record('debug', message, metadata);
  }

  info(message, metadata) {
    this.#record('info', message, metadata);
  }

  warn(message, metadata) {
    this.#record('warn', message, metadata);
  }

  error(message, metadata) {
    this.#record('error', message, metadata);
  }
}

describe('dependencyUtils integration across real modules', () => {
  /** @type {MemoryLogger} */
  let logger;

  beforeEach(() => {
    logger = new MemoryLogger();
  });

  describe('TargetManager safeguards', () => {
    it('logs structured errors when targets are missing and when invalid identifiers are provided', () => {
      const manager = new TargetManager({ logger });

      expect(() => manager.setTargets(null)).toThrow(
        'Targets object is required'
      );
      expect(logger.messages.error[0]).toEqual({
        message: 'Targets object is required',
        metadata: undefined,
      });

      expect(() => manager.addTarget('', 'actor:missing')).toThrow(
        InvalidArgumentError
      );
      expect(logger.messages.error[1]).toMatchObject({
        message:
          "TargetManager.addTarget: Invalid name ''. Expected non-blank string.",
        metadata: {
          receivedValue: '',
          receivedType: 'string',
          parameterName: 'name',
          context: 'TargetManager.addTarget',
        },
      });

      // Successful path ensures assertions allow valid data through
      manager.addTarget('primary', 'actor:1');
      expect(manager.getPrimaryTarget()).toBe('actor:1');
    });
  });

  describe('WorldInitializer dependency contract', () => {
    it('throws informative errors when repository lacks required methods', () => {
      const entityManager = { createEntityInstance: () => ({}) };
      const worldContext = {};
      const repository = {
        getWorld: () => ({}),
        getEntityInstanceDefinition: () => ({}),
        // get is intentionally missing to trigger assertMethods
      };
      const validatedEventDispatcher = { dispatch: () => {} };
      const eventDispatchService = { dispatchWithLogging: () => {} };
      const scopeRegistry = { initialize: () => {} };

      expect(
        () =>
          new WorldInitializer({
            entityManager,
            worldContext,
            gameDataRepository: repository,
            validatedEventDispatcher,
            eventDispatchService,
            logger,
            scopeRegistry,
          })
      ).toThrow(WorldInitializationError);
    });
  });

  describe('EntityFactory dependency validation', () => {
    let consoleErrorSpy;

    beforeEach(() => {
      consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('relies on validateDependency to enforce logger contracts', () => {
      const validator = { validate: () => ({ valid: true }) };
      const incompleteLogger = {
        info: () => {},
        warn: () => {},
        debug: () => {},
      }; // missing error

      expect(
        () =>
          new EntityFactory({
            validator,
            logger: incompleteLogger,
            idGenerator: () => 'id-1',
            cloner: (value) => value,
            defaultPolicy: {},
          })
      ).toThrow(InvalidArgumentError);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Invalid or missing method 'error' on dependency 'ILogger'."
      );
    });

    it('accepts valid dependencies and initializes specialized factories', () => {
      const validator = { validate: () => ({ valid: true }) };
      const fullLogger = new MemoryLogger('entity-factory');
      fullLogger.error = jest.fn();

      const factory = new EntityFactory({
        validator,
        logger: fullLogger,
        idGenerator: () => 'id-2',
        cloner: (value) => value,
        defaultPolicy: {},
      });

      expect(factory).toBeInstanceOf(EntityFactory);
      expect(fullLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('Slot access resolver dependency enforcement', () => {
    it('rejects missing gateway dependencies before building the resolver', () => {
      expect(() => createSlotAccessResolver({ entitiesGateway: null })).toThrow(
        InvalidArgumentError
      );
    });

    it('validates provided error handlers expose required hooks', () => {
      const entitiesGateway = {
        getComponentData: () => null,
      };

      expect(() =>
        createSlotAccessResolver({
          entitiesGateway,
          errorHandler: { handleError: () => {} },
        })
      ).toThrow(InvalidArgumentError);
    });
  });

  describe('Definition lookup id validation', () => {
    it('logs structured metadata when invalid identifiers are supplied', () => {
      const registry = { getEntityDefinition: () => null };

      expect(() => getDefinition('   ', registry, logger)).toThrow(
        InvalidArgumentError
      );
      expect(logger.messages.error[0]).toMatchObject({
        message:
          "definitionLookup.getDefinition: Invalid ID '   '. Expected non-blank string.",
        metadata: {
          receivedId: '   ',
          receivedType: 'string',
          context: 'definitionLookup.getDefinition',
        },
      });
      expect(logger.messages.warn[0].message).toContain('invalid definitionId');
    });

    it('surfaces registry misses through DefinitionNotFoundError', () => {
      const registry = {
        getEntityDefinition: () => null,
      };

      expect(() => getDefinition('entity:missing', registry, logger)).toThrow(
        DefinitionNotFoundError
      );
      expect(logger.messages.warn.at(-1).message).toContain(
        'Definition not found'
      );
    });
  });

  describe('Action command formatting', () => {
    let formatter;

    beforeEach(() => {
      formatter = new ActionCommandFormatter();
    });

    it('formats commands when dependencies satisfy validateDependencies requirements', () => {
      const actionDefinition = { id: 'inspect', template: 'Inspect {target}' };
      const targetContext = { type: 'entity', entityId: 'npc:1' };
      const entityManager = {
        getEntityInstance: (id) =>
          id === 'npc:1' ? { id, name: 'Guard' } : null,
      };
      const safeEventDispatcher = { dispatch: () => Promise.resolve(true) };
      const displayNameFn = (entity) => entity.name;
      const result = formatter.format(
        actionDefinition,
        targetContext,
        entityManager,
        { logger, safeEventDispatcher },
        { displayNameFn }
      );

      expect(result).toEqual({ ok: true, value: 'Inspect Guard' });
      expect(logger.messages.warn).toHaveLength(0);
    });

    it('surfaces validation failures from dependency assertions with structured errors', () => {
      const actionDefinition = { id: 'inspect', template: 'Inspect {target}' };
      const targetContext = { type: 'entity', entityId: 'npc:1' };
      const entityManager = { getEntityInstance: () => null };
      const safeEventDispatcher = {
        dispatch: jest.fn().mockResolvedValue(true),
      };

      const result = formatter.format(
        actionDefinition,
        targetContext,
        entityManager,
        { logger, safeEventDispatcher },
        { displayNameFn: { not: 'a function' } }
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain(
        'getEntityDisplayName utility function is not available'
      );
      expect(safeEventDispatcher.dispatch).toHaveBeenCalled();
    });

    it('rejects dispatchers without the required method via validateDependency', () => {
      const actionDefinition = { id: 'inspect', template: 'Inspect {target}' };
      const targetContext = { type: 'entity', entityId: 'npc:1' };
      const entityManager = { getEntityInstance: () => null };

      expect(() =>
        formatter.format(actionDefinition, targetContext, entityManager, {
          logger,
          safeEventDispatcher: {},
        })
      ).toThrow(InvalidArgumentError);
    });
  });
});
