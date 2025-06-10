// tests/turns/services/playerPromptService.test.js
// --- FILE START ---

import HumanPlayerPromptService from '../../../src/turns/services/humanPlayerPromptService.js'; // Adjusted path to match project structure
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import Entity from '../../../src/entities/entity.js';
import { PromptError } from '../../../src/errors/promptError.js';
import { PLAYER_TURN_SUBMITTED_ID } from '../../../src/constants/eventIds.js';

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

let mockLogger,
  mockActionDiscoveryService,
  mockPromptOutputPort,
  mockWorldContext,
  mockEntityManager,
  mockGameDataRepository,
  mockValidatedEventDispatcher,
  validDependencies,
  service,
  mockActor;

beforeEach(() => {
  mockLogger = createMockLogger();
  mockActionDiscoveryService = createMockActionDiscoveryService();
  mockPromptOutputPort = createMockPromptOutputPort();
  mockWorldContext = createMockWorldContext();
  mockEntityManager = createMockEntityManager();
  mockGameDataRepository = createMockGameDataRepository();
  mockValidatedEventDispatcher = createMockValidatedEventDispatcher();

  validDependencies = {
    logger: mockLogger,
    actionDiscoverySystem: mockActionDiscoveryService,
    promptOutputPort: mockPromptOutputPort,
    worldContext: mockWorldContext,
    entityManager: mockEntityManager,
    gameDataRepository: mockGameDataRepository,
    validatedEventDispatcher: mockValidatedEventDispatcher,
  };
  service = new HumanPlayerPromptService(validDependencies);
  mockActor = new Entity('player:test', 'dummy');
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('PlayerPromptService Constructor', () => {
  it('should succeed when all valid dependencies are provided', () => {
    mockLogger.info.mockClear();
    const localService = new HumanPlayerPromptService(validDependencies);
    expect(localService).toBeInstanceOf(HumanPlayerPromptService);
  });

  describe('ValidatedEventDispatcher Dependency Validation', () => {
    it('should throw if validatedEventDispatcher is missing', () => {
      const { validatedEventDispatcher: _, ...incompleteDeps } =
        validDependencies;
      expect(() => new HumanPlayerPromptService(incompleteDeps)).toThrow(
        'PlayerPromptService: Missing IValidatedEventDispatcher dependency.'
      );
    });
    it('should throw if validatedEventDispatcher lacks subscribe method', () => {
      const invalidDispatcher = {
        ...mockValidatedEventDispatcher,
        subscribe: undefined,
      };
      expect(
        () =>
          new HumanPlayerPromptService({
            ...validDependencies,
            validatedEventDispatcher: invalidDispatcher,
          })
      ).toThrow(
        'PlayerPromptService: IValidatedEventDispatcher lacks method subscribe().'
      );
    });
    it('should throw if validatedEventDispatcher lacks unsubscribe method', () => {
      const invalidDispatcher = {
        ...mockValidatedEventDispatcher,
        unsubscribe: undefined,
      };
      expect(
        () =>
          new HumanPlayerPromptService({
            ...validDependencies,
            validatedEventDispatcher: invalidDispatcher,
          })
      ).toThrow(
        'PlayerPromptService: IValidatedEventDispatcher lacks method unsubscribe().'
      );
    });
  });
});

describe('PlayerPromptService prompt Method', () => {
  it('should execute the happy path successfully, resolving with selected action and speech', async () => {
    const mockLocation = new Entity('location:test', 'dummy');
    const lookAction = {
      id: 'core:look',
      name: 'Look Around',
      command: 'Look Around',
    };
    const speakAction = {
      id: 'core:speak',
      name: 'Speak Freely',
      command: 'Speak Freely',
    };

    const mockDiscoveredActions = [lookAction, speakAction];
    const chosenActionId = speakAction.id;
    const chosenSpeech = 'Hello there!';
    const expectedResolution = { action: speakAction, speech: chosenSpeech };

    mockWorldContext.getLocationOfEntity.mockResolvedValue(mockLocation);
    mockActionDiscoveryService.getValidActions.mockResolvedValue(
      mockDiscoveredActions
    );
    mockPromptOutputPort.prompt.mockResolvedValue(undefined);

    const mockUnsubscribeFn = jest.fn();
    mockValidatedEventDispatcher.subscribe.mockReset();

    mockValidatedEventDispatcher.subscribe.mockImplementation(
      (eventName, eventHandlerCallback) => {
        if (eventName === PLAYER_TURN_SUBMITTED_ID) {
          Promise.resolve().then(() => {
            eventHandlerCallback({
              type: PLAYER_TURN_SUBMITTED_ID,
              payload: {
                actionId: chosenActionId,
                speech: chosenSpeech,
                submittedByActorId: mockActor.id,
              },
            });
          });
        }
        return mockUnsubscribeFn;
      }
    );

    const resultPromise = service.prompt(mockActor);
    await expect(resultPromise).resolves.toEqual(expectedResolution);
    expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(
      PLAYER_TURN_SUBMITTED_ID,
      expect.any(Function)
    );
    expect(mockUnsubscribeFn).toHaveBeenCalled();
  });

  describe('when action discovery fails', () => {
    const discoveryError = new Error('Discovery Boom!');
    const mockLocation = new Entity('location:test', 'dummy');

    beforeEach(() => {
      mockWorldContext.getLocationOfEntity.mockResolvedValue(mockLocation);
      mockActionDiscoveryService.getValidActions.mockRejectedValue(
        discoveryError
      );
    });

    it('should reject with the original discovery error', async () => {
      mockLogger.error.mockClear();

      const promptPromise = service.prompt(mockActor);

      // The SUT now re-throws the original error without wrapping it.
      await expect(promptPromise).rejects.toThrow(discoveryError);

      // Therefore, no special error logging or dispatching to the port is expected.
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockPromptOutputPort.prompt).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.any(String)
      );
    });
  });

  describe('Player input promise handling', () => {
    let mockDiscoveredActionsList;
    let mockLocationInst;
    let mockUnsubscribeFnForSuite;

    beforeEach(() => {
      mockLocationInst = new Entity('location:test-loc-promise', 'dummy');
      mockDiscoveredActionsList = [
        { id: 'action1', name: 'Action One', command: 'do one' },
        { id: 'action2', name: 'Action Two', command: 'do two' },
      ];
      mockWorldContext.getLocationOfEntity.mockResolvedValue(mockLocationInst);
      mockActionDiscoveryService.getValidActions.mockResolvedValue(
        mockDiscoveredActionsList
      );
      mockPromptOutputPort.prompt.mockResolvedValue(undefined);
      mockUnsubscribeFnForSuite = jest.fn();
      mockValidatedEventDispatcher.subscribe.mockReturnValue(
        mockUnsubscribeFnForSuite
      );
    });

    afterEach(() => {});

    const getCallbackAndPromise = async (actorForPrompt) => {
      let capturedCbArg;
      const originalSubscribeMock = mockValidatedEventDispatcher.subscribe;

      const temporaryCapturingMock = jest.fn((evtName, cb) => {
        if (evtName === PLAYER_TURN_SUBMITTED_ID) {
          capturedCbArg = cb;
        }
        return mockUnsubscribeFnForSuite;
      });
      mockValidatedEventDispatcher.subscribe = temporaryCapturingMock;

      const promise = service.prompt(actorForPrompt);

      await new Promise((resolve) => setTimeout(resolve, 0));

      if (!capturedCbArg) {
        console.error('Debug: Callback not captured by temporary mock.');
        console.error(
          'Calls on temporaryCapturingMock:',
          JSON.stringify(temporaryCapturingMock.mock.calls)
        );
        mockValidatedEventDispatcher.subscribe = originalSubscribeMock;
        try {
          await promise;
          throw new Error(
            'getCallbackAndPromise: service.prompt resolved but callback was not captured.'
          );
        } catch (e) {
          throw new Error(
            `getCallbackAndPromise: Callback not captured. service.prompt error or unexpected resolution: ${e.message}. Original error cause: ${e.cause ? e.cause : 'N/A'}`
          );
        }
      }

      mockValidatedEventDispatcher.subscribe = originalSubscribeMock;

      expect(capturedCbArg).toBeInstanceOf(Function);
      return { promptPromise: promise, capturedCallback: capturedCbArg };
    };

    it('should reject with PromptError if submitted actionId is invalid', async () => {
      const { promptPromise, capturedCallback } =
        await getCallbackAndPromise(mockActor);
      const invalidActionId = 'invalid-action-id';
      capturedCallback({
        type: PLAYER_TURN_SUBMITTED_ID,
        payload: {
          actionId: invalidActionId,
          speech: null,
          submittedByActorId: mockActor.id,
        },
      });
      await expect(promptPromise).rejects.toMatchObject({
        name: 'PromptError',
        message: `Unknown actionId '${invalidActionId}'`,
        code: 'INVALID_ACTION_ID',
      });
      expect(mockUnsubscribeFnForSuite).toHaveBeenCalled();
    });

    it('should clear timeout (conceptually, ensure cleanup) and unsubscribe when event is received', async () => {
      const { promptPromise, capturedCallback } =
        await getCallbackAndPromise(mockActor);
      const validAction = mockDiscoveredActionsList[0];

      capturedCallback({
        type: PLAYER_TURN_SUBMITTED_ID,
        payload: {
          actionId: validAction.id,
          speech: 'test speech',
          submittedByActorId: mockActor.id,
        },
      });

      await expect(promptPromise).resolves.toEqual({
        action: validAction,
        speech: 'test speech',
      });
      expect(mockUnsubscribeFnForSuite).toHaveBeenCalled();
    });

    it('should reject with PromptError if event object itself is malformed (e.g. not an object, or missing type/payload)', async () => {
      const { promptPromise, capturedCallback } =
        await getCallbackAndPromise(mockActor);
      capturedCallback({
        someOtherData: 'value',
        speech: 'only speech',
        actionId: 'some-action',
        submittedByActorId: mockActor.id,
      });

      await expect(promptPromise).rejects.toMatchObject({
        name: 'PromptError',
        message: 'Malformed event',
        code: 'INVALID_EVENT',
      });
      expect(mockUnsubscribeFnForSuite).toHaveBeenCalled();
    });

    it('should reject with PromptError if event.payload is missing actionId', async () => {
      const { promptPromise, capturedCallback } =
        await getCallbackAndPromise(mockActor);
      capturedCallback({
        type: PLAYER_TURN_SUBMITTED_ID,
        payload: {
          speech: 'only speech, no actionId',
          submittedByActorId: mockActor.id,
        },
      });

      try {
        await promptPromise;
        throw new Error(
          'Test failed: Promise was expected to reject but it resolved.'
        );
      } catch (error) {
        expect(error).toBeInstanceOf(PromptError);
        expect(error.name).toBe('PromptError');
        expect(error.code).toBe('INVALID_ACTION_ID');
        const expectedMessage = `Unknown actionId 'undefined'`;
        expect(error.message).toBe(expectedMessage);
      }
      expect(mockUnsubscribeFnForSuite).toHaveBeenCalled();
    });
  });
});
// --- FILE END ---
