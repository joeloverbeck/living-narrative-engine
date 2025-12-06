import { beforeEach, describe, expect, it } from '@jest/globals';

import { GameStateValidationServiceForPrompting } from '../../../src/validation/gameStateValidationServiceForPrompting.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import GameDataRepository from '../../../src/data/gameDataRepository.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import { ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING } from '../../../src/constants/textDefaults.js';

class TestLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(message, ...args) {
    this.debugMessages.push({ message, args });
  }

  info(message, ...args) {
    this.infoMessages.push({ message, args });
  }

  warn(message, ...args) {
    this.warnMessages.push({ message, args });
  }

  error(message, ...args) {
    this.errorMessages.push({ message, args });
  }

  groupCollapsed() {}

  groupEnd() {}

  table() {}

  setLogLevel() {}
}

const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('GameStateValidationServiceForPrompting (integration)', () => {
  /** @type {GameStateValidationServiceForPrompting} */
  let service;
  /** @type {TestLogger} */
  let logger;
  /** @type {EventBus} */
  let eventBus;
  let registry;
  let gameDataRepository;
  let schemaValidator;
  let validatedEventDispatcher;
  let safeEventDispatcher;
  /** @type {{type: string, payload: any}[]} */
  let dispatchedEvents;

  beforeEach(async () => {
    logger = new TestLogger();
    eventBus = new EventBus({ logger });
    registry = new InMemoryDataRegistry({ logger });
    gameDataRepository = new GameDataRepository(registry, logger);
    schemaValidator = new AjvSchemaValidator({ logger });

    const systemErrorPayloadSchema = {
      $id: `${SYSTEM_ERROR_OCCURRED_ID}#payload`,
      type: 'object',
      properties: {
        message: { type: 'string' },
        details: {
          type: 'object',
          additionalProperties: true,
        },
      },
      required: ['message', 'details'],
      additionalProperties: false,
    };

    await schemaValidator.addSchema(
      systemErrorPayloadSchema,
      systemErrorPayloadSchema.$id
    );

    registry.store('events', SYSTEM_ERROR_OCCURRED_ID, {
      id: SYSTEM_ERROR_OCCURRED_ID,
      payloadSchema: systemErrorPayloadSchema,
      summary: 'Dispatched when a critical system error occurs.',
    });

    validatedEventDispatcher = new ValidatedEventDispatcher({
      eventBus,
      gameDataRepository,
      schemaValidator,
      logger,
    });

    safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher,
      logger,
    });

    service = new GameStateValidationServiceForPrompting({
      logger,
      safeEventDispatcher,
    });

    dispatchedEvents = [];
    eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, async (event) => {
      dispatchedEvents.push(event);
    });
  });

  it('dispatches a system error through the real event pipeline when the DTO is missing', async () => {
    const result = service.validate(null);

    expect(result).toEqual({
      isValid: false,
      errorContent: ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING,
    });

    await flushAsync();

    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0]).toMatchObject({
      type: SYSTEM_ERROR_OCCURRED_ID,
      payload: {
        message:
          'GameStateValidationServiceForPrompting.validate: AIGameStateDTO is null or undefined.',
        details: {},
      },
    });
  });

  it('logs warnings for incomplete DTOs but does not dispatch errors when optional fields are missing', async () => {
    const incompleteState = {
      actorId: 'actor-001',
    };

    const result = service.validate(incompleteState);

    expect(result).toEqual({ isValid: true, errorContent: null });

    await flushAsync();

    expect(
      logger.warnMessages.some(({ message }) =>
        message.includes("AIGameStateDTO is missing 'actorState'")
      )
    ).toBe(true);
    expect(
      logger.warnMessages.some(({ message }) =>
        message.includes("AIGameStateDTO is missing 'actorPromptData'")
      )
    ).toBe(true);
    expect(dispatchedEvents).toHaveLength(0);
  });

  it('treats DTOs with critical data as valid without logging warnings or dispatching errors', async () => {
    const completeState = {
      actorState: { mood: 'calm' },
      actorPromptData: { summary: 'Ready for prompt.' },
    };

    const result = service.validate(completeState);

    expect(result).toEqual({ isValid: true, errorContent: null });

    await flushAsync();

    expect(logger.warnMessages).toHaveLength(0);
    expect(dispatchedEvents).toHaveLength(0);
  });

  it('guards against missing logger dependencies during integration wiring', () => {
    expect(
      () =>
        new GameStateValidationServiceForPrompting({
          safeEventDispatcher,
        })
    ).toThrow(
      'GameStateValidationServiceForPrompting: Logger dependency is required.'
    );
  });

  it('guards against event dispatchers that do not expose a dispatch function', () => {
    expect(
      () =>
        new GameStateValidationServiceForPrompting({
          logger,
          safeEventDispatcher: {},
        })
    ).toThrow(
      'GameStateValidationServiceForPrompting: safeEventDispatcher with dispatch method is required.'
    );
  });
});
