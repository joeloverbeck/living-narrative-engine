// tests/turns/services/playerPromptService.more.test.js
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
});

// Helper to allow microtasks to process
const tick = (count = 1) => {
  let p = Promise.resolve();
  for (let i = 0; i < count; i++) {
    p = p.then(() => new Promise((resolve) => setTimeout(resolve, 0)));
  }
  return p;
};

describe('PlayerPromptService - Further Scenarios', () => {
  let service;
  let mockLogger;
  let mockActionDiscoveryService;
  let mockPromptOutputPort;
  let mockWorldContext;
  let mockValidatedEventDispatcher;
  let mockEntityManager;
  let mockGameDataRepository;
  let validActor;
  let mockLocation;
  let defaultAction;
  let discoveredActions;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockActionDiscoveryService = createMockActionDiscoveryService();
    mockPromptOutputPort = createMockPromptOutputPort();
    mockWorldContext = createMockWorldContext();
    mockValidatedEventDispatcher = createMockValidatedEventDispatcher();
    mockEntityManager = createMockEntityManager();
    mockGameDataRepository = createMockGameDataRepository();

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
    defaultAction = {
      id: 'action:default',
      name: 'Default Action',
      command: 'do default',
    };
    discoveredActions = [
      defaultAction,
      { id: 'action:other', name: 'Other', command: 'other' },
    ];

    mockWorldContext.getLocationOfEntity.mockResolvedValue(mockLocation);
    mockActionDiscoveryService.getValidActions.mockResolvedValue(
      discoveredActions
    );
    mockPromptOutputPort.prompt.mockResolvedValue(undefined); // Default successful prompt
    mockValidatedEventDispatcher.subscribe.mockReturnValue(jest.fn());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Cancellation Signal Timing', () => {
    it('should throw AbortError if signal aborts after location fetch but before action discovery', async () => {
      const abortController = new AbortController();
      const options = { cancellationSignal: abortController.signal };

      let originalGetLocation = mockWorldContext.getLocationOfEntity;
      mockWorldContext.getLocationOfEntity = jest.fn(async (...args) => {
        const result = await originalGetLocation(...args);
        abortController.abort();
        return result;
      });

      const promptPromise = service.prompt(validActor, options);

      try {
        await promptPromise;
        throw new Error(
          'Test failed: Promise was expected to reject but it resolved.'
        );
      } catch (e) {
        expect(e).toBeInstanceOf(DOMException);
        expect(e.name).toBe('AbortError');
        expect(e.message).toBe(
          'Prompt aborted by signal during location fetch.'
        );
      }
      expect(mockActionDiscoveryService.getValidActions).not.toHaveBeenCalled();
    });

    it('should throw AbortError if signal aborts after action discovery but before output port prompt', async () => {
      const abortController = new AbortController();
      const options = { cancellationSignal: abortController.signal };

      let originalGetValidActions = mockActionDiscoveryService.getValidActions;
      mockActionDiscoveryService.getValidActions = jest.fn(async (...args) => {
        const result = await originalGetValidActions(...args);
        abortController.abort();
        return result;
      });

      const promptPromise = service.prompt(validActor, options);

      try {
        await promptPromise;
        throw new Error(
          'Test failed: Promise was expected to reject but it resolved.'
        );
      } catch (e) {
        expect(e).toBeInstanceOf(DOMException);
        expect(e.name).toBe('AbortError');
        expect(e.message).toMatch(
          /Prompt aborted by signal after (action discovery|context\/action fetch)\./
        );
      }
      expect(mockPromptOutputPort.prompt).not.toHaveBeenCalled();
    });
  });

  describe('actionDiscoverySystem.getValidActions Failures', () => {
    const discoveryError = new Error('Discovery Failed'); // This is the 'error' for the 'Error' test case
    const discoveryPromptError = new PromptError(
      'Discovery PromptError',
      discoveryError,
      'DISCOVERY_SPECIFIC_ERROR'
    );
    const discoveryAbortError = new DOMException(
      'Discovery Aborted',
      'AbortError'
    );

    const testCases = [
      {
        name: 'Error', // This case will use 'discoveryError'
        error: discoveryError,
        expectedCause: discoveryError,
        rethrows: false,
        errorCode: 'ACTION_DISCOVERY_FAILED',
      },
      {
        name: 'PromptError',
        error: discoveryPromptError,
        expectedCause: discoveryPromptError,
        rethrows: true,
      },
      {
        name: 'DOMException (AbortError)',
        error: discoveryAbortError,
        expectedCause: discoveryAbortError,
        rethrows: true,
      },
    ];

    testCases.forEach(({ name, error, expectedCause, rethrows, errorCode }) => {
      it(`should correctly handle and log ${name} from getValidActions`, async () => {
        mockActionDiscoveryService.getValidActions.mockRejectedValue(error);

        const promptPromise = service.prompt(validActor);

        if (rethrows) {
          await expect(promptPromise).rejects.toThrow(error);
        } else {
          // This is for the 'Error' case which gets wrapped
          await expect(promptPromise).rejects.toThrow(PromptError);
          await expect(promptPromise).rejects.toMatchObject({
            message: `Action discovery failed for actor ${validActor.id}. Details: ${error.message}`, // error.message is "Discovery Failed"
            cause: expectedCause, // expectedCause is discoveryError
            code: errorCode, // ACTION_DISCOVERY_FAILED
          });
        }

        expect(mockLogger.error).toHaveBeenCalledWith(
          `PlayerPromptService._fetchContextAndDiscoverActions: Action discovery failed for actor ${validActor.id}.`,
          error // For 'Error' case, this is discoveryError. For others, it's discoveryPromptError/discoveryAbortError.
        );

        const promptCatchLogCall = mockLogger.error.mock.calls.find(
          (call) =>
            call[0] ===
            `PlayerPromptService.prompt: Error during prompt setup for actor ${validActor.id}.`
        );
        expect(promptCatchLogCall).toBeDefined();

        if (promptCatchLogCall) {
          const loggedErrorInPromptCatch = promptCatchLogCall[1];
          if (rethrows) {
            expect(loggedErrorInPromptCatch).toBe(error);
          } else {
            // 'Error' case, error was wrapped by _fetchContextAndDiscoverActions
            expect(loggedErrorInPromptCatch).toBeInstanceOf(PromptError);
            expect(loggedErrorInPromptCatch.cause).toBe(error); // Original discoveryError
            expect(loggedErrorInPromptCatch.message).toBe(
              `Action discovery failed for actor ${validActor.id}. Details: ${error.message}`
            );
            expect(loggedErrorInPromptCatch.code).toBe(errorCode); // ACTION_DISCOVERY_FAILED
          }
        }

        // Service attempts to dispatch ACTION_DISCOVERY_FAILED to output port.
        // Other errors (PromptError not ACTION_DISCOVERY_FAILED, AbortError) rethrown from _fetchContextAndDiscoverActions
        // are caught by prompt()'s main catch, which then just rethrows them without trying to dispatch to output port.
        if (name === 'Error') {
          // Results in ACTION_DISCOVERY_FAILED
          const expectedErrorMessageInPort = `Action discovery failed for actor ${validActor.id}. Details: ${error.message}`; // error is discoveryError
          expect(mockPromptOutputPort.prompt).toHaveBeenCalledWith(
            validActor.id,
            [],
            expectedErrorMessageInPort
          );
        } else {
          expect(mockPromptOutputPort.prompt).not.toHaveBeenCalled();
        }
      });
    });
  });

  describe('promptOutputPort.prompt (Main Dispatch) Failures', () => {
    const portDispatchError = new Error('Port Dispatch Failed');
    const portDispatchPromptError = new PromptError(
      'Port Dispatch PromptError',
      portDispatchError,
      'PORT_ERROR'
    );
    const portDispatchAbortError = new DOMException(
      'Port Dispatch Aborted',
      'AbortError'
    );

    const errorDefinitions = [
      {
        name: 'Generic Error',
        error: portDispatchError,
        expectedType: PromptError,
        rethrows: false,
        needsMessageCheck: true,
        errorCode: 'OUTPUT_PORT_DISPATCH_FAILED',
      },
      {
        name: 'PromptError',
        error: portDispatchPromptError,
        expectedType: PromptError,
        rethrows: true,
        needsMessageCheck: false,
      },
      {
        name: 'AbortError',
        error: portDispatchAbortError,
        expectedType: DOMException,
        rethrows: true,
        needsMessageCheck: false,
      },
    ];

    errorDefinitions.forEach(
      ({
        name,
        error,
        expectedType,
        rethrows,
        needsMessageCheck,
        errorCode,
      }) => {
        it(`should handle ${name} from main promptOutputPort.prompt call`, async () => {
          const logMessageFromPromptMethod = `PlayerPromptService.prompt: Error during prompt setup for actor ${validActor.id}.`;
          const logMessageFromHelperMethod = `PlayerPromptService._dispatchPromptToOutputPort: Failed to dispatch prompt via output port for actor ${validActor.id}.`;

          let errorReceivedAndLoggedByPromptMethod;
          let specificExpectedErrorMessageForMatcher;

          if (name === 'Generic Error') {
            specificExpectedErrorMessageForMatcher = `Failed to dispatch prompt via output port for actor ${validActor.id}. Details: ${error.message}`;
            errorReceivedAndLoggedByPromptMethod = expect.objectContaining({
              message: specificExpectedErrorMessageForMatcher,
              cause: error,
              code: errorCode,
            });
          } else {
            errorReceivedAndLoggedByPromptMethod = error;
            specificExpectedErrorMessageForMatcher = error.message;
          }

          mockActionDiscoveryService.getValidActions.mockResolvedValue(
            discoveredActions
          );

          // This mock simulates promptOutputPort.prompt throwing an error when called to send actions.
          // The service calls it as: this.#promptOutputPort.prompt(actorId, discoveredActions)
          mockPromptOutputPort.prompt.mockImplementation(
            async (actorIdParam, actionsParam, errorMessageParam) => {
              // If errorMessageParam is undefined, it means it was called to send actions
              if (
                actorIdParam === validActor.id &&
                actionsParam === discoveredActions &&
                errorMessageParam === undefined
              ) {
                throw error; // This 'error' is from the test case definition (portDispatchError, etc.)
              }
              return undefined; // For any other call pattern
            }
          );

          const promptPromise = service.prompt(validActor);

          await expect(promptPromise).rejects.toThrow(expectedType);

          if (rethrows) {
            await expect(promptPromise).rejects.toThrow(error);
          } else if (needsMessageCheck && name === 'Generic Error') {
            await expect(promptPromise).rejects.toMatchObject({
              message: specificExpectedErrorMessageForMatcher,
              cause: error,
              code: errorCode,
            });
          }

          expect(mockLogger.error).toHaveBeenCalledWith(
            logMessageFromHelperMethod, // Log from _dispatchPromptToOutputPort
            error // The original error thrown by the mockPromptOutputPort.prompt
          );

          expect(mockLogger.error).toHaveBeenCalledWith(
            logMessageFromPromptMethod, // Log from prompt()'s main catch
            errorReceivedAndLoggedByPromptMethod // The error caught and logged by prompt()
          );

          // Check that mockPromptOutputPort.prompt was called to send actions (2 args)
          expect(mockPromptOutputPort.prompt).toHaveBeenCalledWith(
            validActor.id,
            discoveredActions
          );

          expect(mockValidatedEventDispatcher.subscribe).not.toHaveBeenCalled();
        });
      }
    );
  });

  describe('Event Subscription Failures', () => {
    it('should reject with PromptError if validatedEventDispatcher.subscribe throws', async () => {
      const subscriptionError = new Error('Subscription System Error');
      mockValidatedEventDispatcher.subscribe.mockImplementation(() => {
        throw subscriptionError;
      });

      const promptPromise = service.prompt(validActor);
      await expect(promptPromise).rejects.toThrow(PromptError);
      await expect(promptPromise).rejects.toMatchObject({
        message: `Failed to subscribe to player input event for actor ${validActor.id}. Details: ${subscriptionError.message}`,
        code: 'SUBSCRIPTION_ERROR',
        cause: subscriptionError,
      });
    });

    it('should reject with PromptError if subscribe does not return an unsubscribe function', async () => {
      mockValidatedEventDispatcher.subscribe.mockReturnValue(null);

      const promptPromise = service.prompt(validActor);
      await expect(promptPromise).rejects.toThrow(PromptError);
      await expect(promptPromise).rejects.toMatchObject({
        message: `Failed to subscribe to player input event for actor ${validActor.id}: No unsubscribe function returned.`,
        code: 'SUBSCRIPTION_FAILED',
      });
    });
  });

  describe('handlePlayerTurnSubmitted Edge Cases', () => {
    let capturedEventHandler;
    let mockUnsubscribeFn;

    beforeEach(() => {
      mockUnsubscribeFn = jest.fn();
      mockValidatedEventDispatcher.subscribe.mockImplementation(
        (eventName, handler) => {
          if (eventName === PLAYER_TURN_SUBMITTED_ID) {
            capturedEventHandler = handler;
          }
          return mockUnsubscribeFn;
        }
      );
    });

    it('should ignore event if submittedByActorId is for a different actor', async () => {
      const promptPromise = service.prompt(validActor);
      await tick();

      expect(capturedEventHandler).toBeDefined();
      capturedEventHandler({
        type: PLAYER_TURN_SUBMITTED_ID,
        payload: {
          submittedByActorId: 'actor:other',
          actionId: defaultAction.id,
          speech: null,
        },
      });
      await tick();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `PlayerPromptService._handlePlayerTurnSubmittedEvent: Received ${PLAYER_TURN_SUBMITTED_ID} for actor actor:other, but this prompt is for ${validActor.id}. Ignoring.`
      );
      service.cancelCurrentPrompt();
      await expect(promptPromise).rejects.toThrow(PromptError);
    });

    it('should ignore event if prompt is already settled (e.g., by abort)', async () => {
      const abortController = new AbortController();
      const promptPromise = service.prompt(validActor, {
        cancellationSignal: abortController.signal,
      });
      await tick();
      expect(capturedEventHandler).toBeDefined();

      abortController.abort();
      try {
        await promptPromise;
      } catch (e) {
        expect(e.name).toBe('AbortError');
      }
      await tick();

      const testEvent = {
        type: PLAYER_TURN_SUBMITTED_ID,
        payload: {
          submittedByActorId: validActor.id,
          actionId: defaultAction.id,
          speech: null,
        },
      };
      capturedEventHandler(testEvent);
      await tick();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `PlayerPromptService._handlePlayerTurnSubmittedEvent: Listener for ${validActor.id} (event ${testEvent.type}) received event but prompt already settled. Ignoring.`
      );
    });

    it('should proceed if submittedByActorId is missing in payload', async () => {
      const promptPromise = service.prompt(validActor);
      await tick();
      expect(capturedEventHandler).toBeDefined();

      capturedEventHandler({
        type: PLAYER_TURN_SUBMITTED_ID,
        payload: { actionId: defaultAction.id, speech: 'Hello' },
      });

      await expect(promptPromise).resolves.toEqual({
        action: defaultAction,
        speech: 'Hello',
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `PlayerPromptService._handlePlayerTurnSubmittedEvent: ${PLAYER_TURN_SUBMITTED_ID} event did not contain 'submittedByActorId'. Proceeding based on this prompt's actor: ${validActor.id}.`
      );
      expect(mockUnsubscribeFn).toHaveBeenCalled();
    });

    it('should log warning and proceed if discoveredActions contains malformed items (but submitted action is valid)', async () => {
      const malformedAction = { name: 'Malformed', command: 'bad' };
      const validDiscoveredAction = {
        id: 'validAction123',
        name: 'Valid Action',
        command: 'do valid',
      };
      mockActionDiscoveryService.getValidActions.mockResolvedValue([
        malformedAction,
        validDiscoveredAction,
      ]);

      const promptPromise = service.prompt(validActor);
      await tick();
      expect(capturedEventHandler).toBeDefined();

      capturedEventHandler({
        type: PLAYER_TURN_SUBMITTED_ID,
        payload: { actionId: validDiscoveredAction.id, speech: null },
      });

      await expect(promptPromise).resolves.toEqual({
        action: validDiscoveredAction,
        speech: null,
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `PlayerPromptService._handlePlayerTurnSubmittedEvent: Malformed item in discoveredActions for prompt (actor ${validActor.id}). Item:`,
        malformedAction
      );
      expect(mockUnsubscribeFn).toHaveBeenCalled();
    });

    it('should reject if submitted actionId matches a malformed item (even if other items are valid)', async () => {
      const discoverableButMalformed = {
        id: 123,
        name: 'Numeric ID',
        command: 'num',
      };
      const validDiscoveredAction = {
        id: 'validAction123',
        name: 'Valid Action',
        command: 'do valid',
      };
      mockActionDiscoveryService.getValidActions.mockResolvedValue([
        discoverableButMalformed,
        validDiscoveredAction,
      ]);

      const promptPromise = service.prompt(validActor);
      await tick();
      expect(capturedEventHandler).toBeDefined();

      capturedEventHandler({
        type: PLAYER_TURN_SUBMITTED_ID,
        payload: { actionId: '123', speech: null },
      });

      await expect(promptPromise).rejects.toMatchObject({
        name: 'PromptError',
        code: 'INVALID_ACTION_ID',
        message: `Invalid actionId '123' submitted by actor ${validActor.id}. Action not available.`,
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `PlayerPromptService._handlePlayerTurnSubmittedEvent: Malformed item in discoveredActions for prompt (actor ${validActor.id}). Item:`,
        discoverableButMalformed
      );
      expect(mockUnsubscribeFn).toHaveBeenCalled();
    });

    it('should log warning but resolve if selected action is missing a name', async () => {
      const actionWithoutName = { id: 'action:no-name', command: 'do no name' };
      mockActionDiscoveryService.getValidActions.mockResolvedValue([
        actionWithoutName,
      ]);

      const promptPromise = service.prompt(validActor);
      await tick();
      expect(capturedEventHandler).toBeDefined();

      capturedEventHandler({
        type: PLAYER_TURN_SUBMITTED_ID,
        payload: { actionId: 'action:no-name', speech: 'Test Speech' },
      });

      await expect(promptPromise).resolves.toEqual({
        action: actionWithoutName,
        speech: 'Test Speech',
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `PlayerPromptService._handlePlayerTurnSubmittedEvent: Action 'action:no-name' found for prompt (actor ${validActor.id}), but missing 'name'. Action:`,
        actionWithoutName
      );
      expect(mockUnsubscribeFn).toHaveBeenCalled();
    });
  });

  describe('cancelCurrentPrompt Method', () => {
    it('should log "no active prompt" if called when no prompt is active', () => {
      service.cancelCurrentPrompt();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'PlayerPromptService: cancelCurrentPrompt called.'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'PlayerPromptService: cancelCurrentPrompt called, but no active prompt to cancel.'
      );
    });

    it('should reject active prompt with PROMPT_CANCELLED if it has no signal', async () => {
      const promptPromise = service.prompt(validActor);
      await tick();

      service.cancelCurrentPrompt();
      await expect(promptPromise).rejects.toMatchObject({
        name: 'PromptError',
        code: 'PROMPT_CANCELLED',
        message:
          'Current player prompt was explicitly cancelled by external request.',
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'PlayerPromptService: cancelCurrentPrompt called.'
      );
    });

    it('should reject active prompt with PROMPT_CANCELLED if its signal is not aborted', async () => {
      const abortController = new AbortController();
      const promptPromise = service.prompt(validActor, {
        cancellationSignal: abortController.signal,
      });
      await tick();

      service.cancelCurrentPrompt();
      await expect(promptPromise).rejects.toMatchObject({
        name: 'PromptError',
        code: 'PROMPT_CANCELLED',
        message:
          'Current player prompt was explicitly cancelled by external request.',
      });
    });

    it('should reject active prompt with AbortError if its signal was already aborted, and log correctly', async () => {
      const abortController = new AbortController();
      const promptPromise = service.prompt(validActor, {
        cancellationSignal: abortController.signal,
      });
      await tick();

      abortController.abort();

      try {
        await promptPromise;
      } catch (e) {
        expect(e.name).toBe('AbortError');
        expect(e.message).toBe('Prompt aborted by signal.');
      }
      await tick();

      service.cancelCurrentPrompt();
      await tick();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'PlayerPromptService: cancelCurrentPrompt called.'
      );

      const debugCalls = mockLogger.debug.mock.calls;
      const lastCancelDebugLog = debugCalls.find((call) =>
        call[0].startsWith(
          'PlayerPromptService: cancelCurrentPrompt called, but no active prompt'
        )
      );

      expect(lastCancelDebugLog).toBeDefined();
      expect(lastCancelDebugLog[0]).toBe(
        'PlayerPromptService: cancelCurrentPrompt called, but no active prompt to cancel.'
      );
    });
  });
});
// --- FILE END ---
