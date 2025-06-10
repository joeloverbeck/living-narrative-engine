// tests/turns/services/playerPromptService.extended.test.js
// --- FILE START ---
/* eslint-disable jest/no-conditional-expect */
import HumanPlayerPromptService from '../../../src/turns/services/humanPlayerPromptService.js';
import { PromptError } from '../../../src/errors/promptError.js';
import { PLAYER_TURN_SUBMITTED_ID } from '../../../src/constants/eventIds.js';
import Entity from '../../../src/entities/entity.js';
import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

// Mock factory functions
const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});
const createMockActionDiscoveryService = () => ({ getValidActions: jest.fn() });
const createMockPromptOutputPort = () => ({ prompt: jest.fn() });
const createMockWorldContext = () => ({ getLocationOfEntity: jest.fn() });
const createMockEntityManager = () => ({ getEntityInstance: jest.fn() });
const createMockGameDataRepository = () => ({ getActionDefinition: jest.fn() });
const createMockValidatedEventDispatcher = () => ({
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  dispatch: jest.fn(),
});

// Helper to allow microtasks to process
const tick = (count = 1) => {
  let p = Promise.resolve();
  for (let i = 0; i < count; i++) {
    p = p.then(() => new Promise((resolve) => setTimeout(resolve, 0)));
  }
  return p;
};

describe('PlayerPromptService Constructor - Extended Validation', () => {
  let mockLogger;
  let mockActionDiscoveryService;
  let mockPromptOutputPort;
  let mockWorldContext;
  let mockEntityManager;
  let mockGameDataRepository;
  let mockValidatedEventDispatcher;
  let baseDependencies;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockActionDiscoveryService = createMockActionDiscoveryService();
    mockPromptOutputPort = createMockPromptOutputPort();
    mockWorldContext = createMockWorldContext();
    mockEntityManager = createMockEntityManager();
    mockGameDataRepository = createMockGameDataRepository();
    mockValidatedEventDispatcher = createMockValidatedEventDispatcher();

    baseDependencies = {
      logger: mockLogger,
      actionDiscoverySystem: mockActionDiscoveryService,
      promptOutputPort: mockPromptOutputPort,
      worldContext: mockWorldContext,
      entityManager: mockEntityManager,
      gameDataRepository: mockGameDataRepository,
      validatedEventDispatcher: mockValidatedEventDispatcher,
    };
  });

  it('should initialize successfully with all valid dependencies', () => {
    expect(() => new HumanPlayerPromptService(baseDependencies)).not.toThrow();
  });

  describe('Logger Dependency Validation', () => {
    let consoleErrorSpy;
    beforeEach(() => {
      consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
    });
    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should throw if logger is missing', () => {
      const { logger: _logger, ...deps } = baseDependencies;
      void _logger;
      const testDeps = { ...deps };
      delete testDeps.logger;
      expect(() => new HumanPlayerPromptService(testDeps)).toThrow(
        'PlayerPromptService: Missing ILogger dependency.'
      );
    });
    const methods = ['error', 'info', 'debug', 'warn'];
    methods.forEach((method) => {
      it(`should throw if logger is missing ${method} method`, () => {
        const invalidLogger = { ...createMockLogger(), [method]: undefined };
        expect(
          () =>
            new HumanPlayerPromptService({
              ...baseDependencies,
              logger: invalidLogger,
            })
        ).toThrow(`PlayerPromptService: ILogger lacks method ${method}().`);
      });
    });
  });

  describe('ActionDiscoveryService Dependency Validation', () => {
    let consoleErrorSpy;
    beforeEach(() => {
      consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
    });
    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should throw if actionDiscoverySystem is missing', () => {
      const { actionDiscoverySystem: _actionDiscoverySystem, ...deps } =
        baseDependencies;
      void _actionDiscoverySystem;
      const testDeps = { ...deps };
      delete testDeps.actionDiscoverySystem;
      expect(() => new HumanPlayerPromptService(testDeps)).toThrow(
        'PlayerPromptService: Missing IActionDiscoveryService dependency.'
      );
    });
    it('should throw if actionDiscoverySystem lacks getValidActions method', () => {
      const invalidSystem = {
        ...createMockActionDiscoveryService(),
        getValidActions: undefined,
      };
      expect(
        () =>
          new HumanPlayerPromptService({
            ...baseDependencies,
            actionDiscoverySystem: invalidSystem,
          })
      ).toThrow(
        'PlayerPromptService: IActionDiscoveryService lacks method getValidActions().'
      );
    });
  });

  describe('PromptOutputPort Dependency Validation', () => {
    let consoleErrorSpy;
    beforeEach(() => {
      consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
    });
    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should throw if promptOutputPort is missing', () => {
      const { promptOutputPort: _promptOutputPort, ...deps } = baseDependencies;
      void _promptOutputPort;
      const testDeps = { ...deps };
      delete testDeps.promptOutputPort;
      expect(() => new HumanPlayerPromptService(testDeps)).toThrow(
        'PlayerPromptService: Missing IPromptOutputPort dependency.'
      );
    });
    it('should throw if promptOutputPort lacks prompt method', () => {
      const invalidPort = {
        ...createMockPromptOutputPort(),
        prompt: undefined,
      };
      expect(
        () =>
          new HumanPlayerPromptService({
            ...baseDependencies,
            promptOutputPort: invalidPort,
          })
      ).toThrow(
        'PlayerPromptService: IPromptOutputPort lacks method prompt().'
      );
    });
  });

  describe('WorldContext Dependency Validation', () => {
    let consoleErrorSpy;
    beforeEach(() => {
      consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
    });
    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should throw if worldContext is missing', () => {
      const { worldContext: _worldContext, ...deps } = baseDependencies;
      void _worldContext;
      const testDeps = { ...deps };
      delete testDeps.worldContext;
      expect(() => new HumanPlayerPromptService(testDeps)).toThrow(
        'PlayerPromptService: Missing IWorldContext dependency.'
      );
    });
    it('should throw if worldContext lacks getLocationOfEntity method', () => {
      const invalidContext = {
        ...createMockWorldContext(),
        getLocationOfEntity: undefined,
      };
      expect(
        () =>
          new HumanPlayerPromptService({
            ...baseDependencies,
            worldContext: invalidContext,
          })
      ).toThrow(
        'PlayerPromptService: IWorldContext lacks method getLocationOfEntity().'
      );
    });
  });

  describe('EntityManager Dependency Validation', () => {
    let consoleErrorSpy;
    beforeEach(() => {
      consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
    });
    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should throw if entityManager is missing', () => {
      const { entityManager: _entityManager, ...deps } = baseDependencies;
      void _entityManager;
      const testDeps = { ...deps };
      delete testDeps.entityManager;
      expect(() => new HumanPlayerPromptService(testDeps)).toThrow(
        'PlayerPromptService: Missing IEntityManager dependency.'
      );
    });
    it('should throw if entityManager lacks getEntityInstance method', () => {
      const invalidManager = {
        ...createMockEntityManager(),
        getEntityInstance: undefined,
      };
      expect(
        () =>
          new HumanPlayerPromptService({
            ...baseDependencies,
            entityManager: invalidManager,
          })
      ).toThrow(
        'PlayerPromptService: IEntityManager lacks method getEntityInstance().'
      );
    });
  });

  describe('GameDataRepository Dependency Validation', () => {
    let consoleErrorSpy;
    beforeEach(() => {
      consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
    });
    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should throw if gameDataRepository is missing', () => {
      const { gameDataRepository: _gameDataRepository, ...deps } =
        baseDependencies;
      void _gameDataRepository;
      const testDeps = { ...deps };
      delete testDeps.gameDataRepository;
      expect(() => new HumanPlayerPromptService(testDeps)).toThrow(
        'PlayerPromptService: Missing IGameDataRepository dependency.'
      );
    });
    it('should throw if gameDataRepository lacks getActionDefinition method', () => {
      const invalidRepo = {
        ...createMockGameDataRepository(),
        getActionDefinition: undefined,
      };
      expect(
        () =>
          new HumanPlayerPromptService({
            ...baseDependencies,
            gameDataRepository: invalidRepo,
          })
      ).toThrow(
        'PlayerPromptService: IGameDataRepository lacks method getActionDefinition().'
      );
    });
  });

  describe('ValidatedEventDispatcher Dependency Validation', () => {
    let consoleErrorSpy;
    beforeEach(() => {
      consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
    });
    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should throw if validatedEventDispatcher is missing', () => {
      const { validatedEventDispatcher: _validatedEventDispatcher, ...deps } =
        baseDependencies;
      void _validatedEventDispatcher;
      const testDeps = { ...deps };
      delete testDeps.validatedEventDispatcher;
      expect(() => new HumanPlayerPromptService(testDeps)).toThrow(
        'PlayerPromptService: Missing IValidatedEventDispatcher dependency.'
      );
    });
    const dispatcherMethods = ['subscribe', 'unsubscribe'];
    dispatcherMethods.forEach((method) => {
      it(`should throw if validatedEventDispatcher lacks ${method} method`, () => {
        const invalidDispatcher = {
          ...createMockValidatedEventDispatcher(),
          [method]: undefined,
        };
        expect(
          () =>
            new HumanPlayerPromptService({
              ...baseDependencies,
              validatedEventDispatcher: invalidDispatcher,
            })
        ).toThrow(
          `PlayerPromptService: IValidatedEventDispatcher lacks method ${method}().`
        );
      });
    });
  });
});

describe('PlayerPromptService prompt Method - Extended Scenarios', () => {
  let service;
  let mockLogger;
  let mockActionDiscoveryService;
  let mockPromptOutputPort;
  let mockWorldContext;
  let mockEntityManager;
  let mockGameDataRepository;
  let mockValidatedEventDispatcher;
  let validActor;
  let mockLocation;

  const defaultDiscoveredActions = [
    { id: 'action1', name: 'Action 1', command: 'do it' },
  ];
  const actionDefault = {
    id: 'actionDefault',
    name: 'Default',
    command: 'default',
  };

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockActionDiscoveryService = createMockActionDiscoveryService();
    mockPromptOutputPort = createMockPromptOutputPort();
    mockWorldContext = createMockWorldContext();
    mockEntityManager = createMockEntityManager();
    mockGameDataRepository = createMockGameDataRepository();
    mockValidatedEventDispatcher = createMockValidatedEventDispatcher();

    service = new HumanPlayerPromptService({
      logger: mockLogger,
      actionDiscoverySystem: mockActionDiscoveryService,
      promptOutputPort: mockPromptOutputPort,
      worldContext: mockWorldContext,
      entityManager: mockEntityManager,
      gameDataRepository: mockGameDataRepository,
      validatedEventDispatcher: mockValidatedEventDispatcher,
    });

    validActor = new Entity('player:valid', 'player-template');
    mockLocation = new Entity('location:test', 'location-template');

    mockWorldContext.getLocationOfEntity.mockResolvedValue(mockLocation);
    mockActionDiscoveryService.getValidActions.mockResolvedValue([
      ...defaultDiscoveredActions,
    ]);
    mockPromptOutputPort.prompt.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial Validations and Setup', () => {
    const expectedError = new PromptError(
      'Invalid actor',
      null,
      'INVALID_ACTOR'
    );

    it('should throw PromptError if actor is null', async () => {
      await expect(service.prompt(null)).rejects.toThrow(expectedError);
    });

    it('should throw PromptError if actor.id is missing', async () => {
      const invalidActor = { name: 'No ID Actor' };
      await expect(service.prompt(invalidActor)).rejects.toThrow(expectedError);
    });

    it('should throw PromptError if actor.id is an empty string', async () => {
      const invalidActor = { id: '' };
      await expect(service.prompt(invalidActor)).rejects.toThrow(expectedError);
    });

    it('should throw DOMException with AbortError if cancellationSignal is already aborted before initiation', async () => {
      const abortController = new AbortController();
      abortController.abort();
      const options = { cancellationSignal: abortController.signal };
      try {
        await service.prompt(validActor, options);
        throw new Error('Prompt should have been aborted');
      } catch (e) {
        expect(e).toBeInstanceOf(DOMException);
        expect(e.name).toBe('AbortError');
        expect(e.message).toBe('Prompt aborted before start');
      }
    });
  });

  describe('Superseding Prompts (Behavior of #clearCurrentPrompt)', () => {
    it('cancelCurrentPrompt should do nothing if called after a prompt self-aborted', async () => {
      const actorToAbort = new Entity('player:abort-then-cancel', 't');
      const unsubscribeFn = jest.fn();
      const abortController = new AbortController();
      const signal = abortController.signal;
      const removeEventListenerSpy = jest.spyOn(signal, 'removeEventListener');

      mockValidatedEventDispatcher.subscribe.mockImplementationOnce(
        () => unsubscribeFn
      );

      const promptPromise = service.prompt(actorToAbort, {
        cancellationSignal: signal,
      });
      await tick();

      abortController.abort();

      try {
        await promptPromise;
      } catch (e) {
        expect(e.name).toBe('AbortError');
      }

      await tick();

      service.cancelCurrentPrompt();
      await tick();

      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('no active prompt to cancel')
      );

      expect(unsubscribeFn).toHaveBeenCalledTimes(1);
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(1);
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('worldContext.getLocationOfEntity Failures', () => {
    it('should throw PromptError if getLocationOfEntity returns null', async () => {
      mockWorldContext.getLocationOfEntity.mockResolvedValue(null);
      const promptPromise = service.prompt(validActor);
      await expect(promptPromise).rejects.toThrow(PromptError);
      await expect(promptPromise).rejects.toMatchObject({
        message: 'Location not found',
        code: 'LOCATION_NOT_FOUND',
      });
    });

    it('should throw PromptError if getLocationOfEntity returns undefined', async () => {
      mockWorldContext.getLocationOfEntity.mockResolvedValue(undefined);
      const promptPromise = service.prompt(validActor);
      await expect(promptPromise).rejects.toThrow(PromptError);
      await expect(promptPromise).rejects.toMatchObject({
        message: 'Location not found',
        code: 'LOCATION_NOT_FOUND',
      });
    });

    it('should re-throw generic error if getLocationOfEntity throws one', async () => {
      const genericError = new Error('Generic location error');
      mockWorldContext.getLocationOfEntity.mockRejectedValue(genericError);
      const promptPromise = service.prompt(validActor);
      await expect(promptPromise).rejects.toThrow(genericError);
    });

    it('should re-throw PromptError if getLocationOfEntity throws a PromptError', async () => {
      const specificPromptError = new PromptError(
        'Specific location PromptError',
        null,
        'CUSTOM_LOCATION_ERROR'
      );
      mockWorldContext.getLocationOfEntity.mockRejectedValue(
        specificPromptError
      );
      await expect(service.prompt(validActor)).rejects.toThrow(
        specificPromptError
      );
    });

    it('should re-throw AbortError if getLocationOfEntity throws an AbortError', async () => {
      const abortError = new DOMException(
        'Location fetch aborted',
        'AbortError'
      );
      mockWorldContext.getLocationOfEntity.mockRejectedValue(abortError);
      await expect(service.prompt(validActor)).rejects.toThrow(abortError);
    });

    it('should throw AbortError if cancellationSignal aborts during getLocationOfEntity', async () => {
      const abortController = new AbortController();
      const options = { cancellationSignal: abortController.signal };

      mockWorldContext.getLocationOfEntity.mockImplementation(async () => {
        abortController.abort();
        await tick();
        return mockLocation;
      });

      const promptPromise = service.prompt(validActor, options);

      try {
        await promptPromise;
        throw new Error('Test failed: Prompt should have aborted.');
      } catch (e) {
        expect(e).toBeInstanceOf(DOMException);
        expect(e.name).toBe('AbortError');
        expect(e.message).toBe('Prompt aborted after discovery');
      }
    });
  });
});
// --- FILE END ---
