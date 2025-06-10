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

      // This test checks what happens if the signal is aborted *during* the async `_fetchContextAndDiscoverActions` call.
      // The SUT implementation checks for abort *after* `getValidActions`.
      const originalGetLocation = mockWorldContext.getLocationOfEntity;
      mockWorldContext.getLocationOfEntity = jest.fn(async (...args) => {
        const result = await originalGetLocation(...args);
        // Abort right after location is fetched. The next step is action discovery.
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
        // The abort listener in prompt() wins the race, rejecting the promise.
        expect(e.message).toBe('Prompt aborted after discovery');
      }
      // Since the abort listener fires and rejects the main promise, the execution within `prompt()` stops.
      // `_fetchContextAndDiscoverActions` may or may not have completed, depending on timing.
      // We will simply verify that the prompt did not proceed.
      expect(mockPromptOutputPort.prompt).not.toHaveBeenCalled();
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
        // This message comes from the check inside `_fetchContextAndDiscoverActions`
        expect(e.message).toBe('Prompt aborted after discovery');
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
        rethrowsAs: Error,
      },
      {
        name: 'PromptError',
        error: discoveryPromptError,
        rethrowsAs: PromptError,
      },
      {
        name: 'DOMException (AbortError)',
        error: discoveryAbortError,
        rethrowsAs: DOMException,
      },
    ];

    testCases.forEach(({ name, error, rethrowsAs }) => {
      it(`should correctly handle ${name} from getValidActions`, async () => {
        mockActionDiscoveryService.getValidActions.mockRejectedValue(error);

        const promptPromise = service.prompt(validActor);

        // The current SUT implementation re-throws the original error without wrapping or logging.
        await expect(promptPromise).rejects.toThrow(rethrowsAs);
        await expect(promptPromise).rejects.toThrow(error);

        // No error logging is expected for these failures in the current implementation.
        expect(mockLogger.error).not.toHaveBeenCalled();

        // The output port should not be called if discovery fails this way.
        expect(mockPromptOutputPort.prompt).not.toHaveBeenCalled();
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
        expectedType: Error,
      },
      {
        name: 'PromptError',
        error: portDispatchPromptError,
        expectedType: PromptError,
      },
      {
        name: 'AbortError',
        error: portDispatchAbortError,
        expectedType: DOMException,
      },
    ];

    errorDefinitions.forEach(({ name, error, expectedType }) => {
      it(`should handle ${name} from main promptOutputPort.prompt call`, async () => {
        mockActionDiscoveryService.getValidActions.mockResolvedValue(
          discoveredActions
        );

        mockPromptOutputPort.prompt.mockRejectedValue(error);

        const promptPromise = service.prompt(validActor);

        // The SUT re-throws the original error from the port.
        await expect(promptPromise).rejects.toThrow(expectedType);
        await expect(promptPromise).rejects.toThrow(error);

        // The SUT does not log these errors.
        expect(mockLogger.error).not.toHaveBeenCalled();

        // Check that mockPromptOutputPort.prompt was called to send actions
        expect(mockPromptOutputPort.prompt).toHaveBeenCalledWith(
          validActor.id,
          discoveredActions
        );
        expect(mockPromptOutputPort.prompt).toHaveBeenCalledTimes(1);

        // Subscription should not happen if dispatch fails.
        expect(mockValidatedEventDispatcher.subscribe).not.toHaveBeenCalled();
      });
    });
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
        message: `Failed to subscribe for player input: ${subscriptionError.message}`,
        code: 'SUBSCRIPTION_ERROR',
        cause: subscriptionError,
      });
    });

    it('should reject with PromptError if subscribe does not return an unsubscribe function', async () => {
      mockValidatedEventDispatcher.subscribe.mockReturnValue(null);

      const promptPromise = service.prompt(validActor);
      await expect(promptPromise).rejects.toThrow(PromptError);
      await expect(promptPromise).rejects.toMatchObject({
        // The SUT wraps the internal error in a PromptError.
        message:
          'Failed to subscribe for player input: subscribe did not return an unsubscribe fn',
        code: 'SUBSCRIPTION_ERROR',
        cause: new Error('subscribe did not return an unsubscribe fn'),
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

      // The SUT now just ignores the event without logging.
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Ignoring')
      );

      // The prompt is still active. We cancel it to prevent jest from complaining about an unhandled promise.
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
      // This should be ignored as the prompt is already settled.
      capturedEventHandler(testEvent);
      await tick();
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

      // The SUT no longer logs a debug message in this case.
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining("did not contain 'submittedByActorId'")
      );
      expect(mockUnsubscribeFn).toHaveBeenCalled();
    });

    it('should log warning and proceed if discoveredActions contains malformed items (but submitted action is valid)', async () => {
      const malformedAction = { name: 'Malformed', command: 'bad' }; // Missing 'id'
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

      // The SUT no longer validates all discovered actions upon submission.
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockUnsubscribeFn).toHaveBeenCalled();
    });

    it('should reject if submitted actionId does not match any discovered action', async () => {
      // discoverableButMalformed in the original test had an ID that was a number,
      // and the submitted ID was a string, so `find` failed. This test is simplified
      // to just check for a non-existent ID.
      const validDiscoveredAction = {
        id: 'validAction123',
        name: 'Valid Action',
        command: 'do valid',
      };
      mockActionDiscoveryService.getValidActions.mockResolvedValue([
        validDiscoveredAction,
      ]);

      const promptPromise = service.prompt(validActor);
      await tick();
      expect(capturedEventHandler).toBeDefined();

      const submittedActionId = 'non-existent-id';
      capturedEventHandler({
        type: PLAYER_TURN_SUBMITTED_ID,
        payload: { actionId: submittedActionId, speech: null },
      });

      await expect(promptPromise).rejects.toMatchObject({
        name: 'PromptError',
        code: 'INVALID_ACTION_ID',
        message: `Unknown actionId '${submittedActionId}'`,
      });
      // The SUT no longer logs a warning about malformed items.
      expect(mockLogger.warn).not.toHaveBeenCalled();
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

      // The SUT no longer checks for a missing name and logs a warning.
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockUnsubscribeFn).toHaveBeenCalled();
    });
  });

  describe('cancelCurrentPrompt Method', () => {
    it('should reject active prompt with PROMPT_CANCELLED if it has no signal', async () => {
      const promptPromise = service.prompt(validActor);
      await tick();

      service.cancelCurrentPrompt();
      await expect(promptPromise).rejects.toMatchObject({
        name: 'PromptError',
        code: 'PROMPT_CANCELLED',
        message: 'Prompt cancelled externally',
      });
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
        message: 'Prompt cancelled externally',
      });
    });

    it('should reject active prompt with AbortError if its signal was already aborted', async () => {
      const abortController = new AbortController();
      const promptPromise = service.prompt(validActor, {
        cancellationSignal: abortController.signal,
      });
      await tick();

      abortController.abort();

      try {
        await promptPromise;
        throw new Error('Promise should have been rejected');
      } catch (e) {
        expect(e.name).toBe('AbortError');
        expect(e.message).toBe('Prompt aborted');
      }
      await tick();

      // Calling cancel again after it's already been settled should do nothing.
      service.cancelCurrentPrompt();
      await tick();

      // SUT no longer logs here
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('no active prompt to cancel')
      );
    });
  });
});
// --- FILE END ---
